import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStatus, Prisma, TransactionType, OrderType } from '@prisma/client';
import { WalletService } from '../wallet/wallet.service';
import { PromoService } from '../promo/promo.service';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
    private readonly promoService: PromoService,
  ) {}

  async create(userId: string, data: {
    addressId: string;
    items: { productId: string; quantity: number }[];
    paymentMethod?: string;
    scheduledAt?: Date;
    notes?: string;
    subscriptionId?: string;
    type?: OrderType;
    promoCode?: string;
  }) {
    // 1. Pre-fetch products
    const productIds = data.items.map((i) => i.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, isActive: true, deletedAt: null },
    });

    if (products.length !== productIds.length) {
      throw new BadRequestException('One or more products are invalid');
    }

    // 2. Pre-fetch logistics info
    const address = await this.prisma.address.findUnique({ where: { id: data.addressId } });
    if (!address) throw new NotFoundException('Address not found');

    const route = await this.prisma.route.findFirst({
      where: { pincodes: { has: address.pincode }, isActive: true },
    });

    const distributor = route
      ? await this.prisma.distributor.findFirst({
          where: { routeId: route.id, isActive: true, deletedAt: null },
        })
      : null;

    // 3. Atomic Transaction Flow
    return this.prisma.$transaction(async (tx) => {
      let totalAmount = new Prisma.Decimal(0);
      let depositAmount = new Prisma.Decimal(0);

      const orderItems = data.items.map((item) => {
        const product = products.find((p) => p.id === item.productId)!;
        const unitPrice = product.price;
        const totalPrice = unitPrice.mul(item.quantity);
        const deposit = product.deposit.mul(item.quantity);
        totalAmount = totalAmount.add(totalPrice);
        depositAmount = depositAmount.add(deposit);
        return {
          productId: item.productId,
          quantity: item.quantity,
          unitPrice,
          totalPrice,
          deposit,
        };
      });

      const baseTotal = totalAmount.add(depositAmount);
      let discountAmount = new Prisma.Decimal(0);
      let promoId = null;

      // Validate and apply promo
      if (data.promoCode) {
        const result = await this.promoService.validatePromoTx(tx, data.promoCode, userId, Number(baseTotal));
        discountAmount = new Prisma.Decimal(result.discountAmount);
        promoId = result.promo.id;
      }

      const payableAmount = baseTotal.sub(discountAmount);

      // Create the order
      const order = await tx.order.create({
        data: {
          userId,
          addressId: data.addressId,
          subscriptionId: data.subscriptionId,
          type: data.type || (data.subscriptionId ? 'SUBSCRIPTION' : 'ONE_TIME'),
          routeId: route?.id ?? null,
          distributorId: distributor?.id ?? null,
          totalAmount,
          depositAmount,
          discountAmount,
          payableAmount,
          paymentMethod: (data.paymentMethod as any) ?? 'CASH',
          paymentStatus: data.paymentMethod === 'WALLET' ? 'COMPLETED' : 'PENDING',
          scheduledAt: data.scheduledAt,
          notes: data.notes,
          items: { create: orderItems },
        },
        include: { items: { include: { product: true } }, address: true },
      });

      // Deduct Wallet
      if (data.paymentMethod === 'WALLET') {
        await this.wallet.debitTx(
          tx,
          userId,
          payableAmount.toNumber(),
          `Payment for Order #${order.id}`,
          'ORDER',
          order.id
        );
      }

      // Record Promo Usage
      if (promoId) {
        await tx.promoUsage.create({
          data: {
            userId,
            promoId,
            orderId: order.id,
            subscriptionId: data.subscriptionId,
            discountApplied: discountAmount
          }
        });
        await tx.promoCode.update({
          where: { id: promoId },
          data: { usedCount: { increment: 1 } }
        });
      }

      return order;
    });
  }

  async findAll(filters: { userId?: string; status?: OrderStatus; distributorId?: string }) {
    return this.prisma.order.findMany({
      where: {
        deletedAt: null,
        ...(filters.userId && { userId: filters.userId }),
        ...(filters.status && { status: filters.status }),
        ...(filters.distributorId && { distributorId: filters.distributorId }),
      },
      include: {
        user: { select: { id: true, name: true, phone: true } },
        address: true,
        items: { include: { product: { select: { id: true, name: true, imageUrl: true } } } },
        distributor: { select: { id: true } },
        deliveryPartner: { select: { id: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, deletedAt: null },
      include: {
        user: { select: { id: true, name: true, phone: true } },
        address: true,
        items: { include: { product: true } },
        payment: true,
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async acceptOrder(id: string, distributorId: string) {
    const order = await this.findById(id);
    if (order.distributorId !== distributorId) {
      throw new BadRequestException('Order is not assigned to this distributor');
    }
    return this.prisma.order.update({
      where: { id },
      data: { status: 'CONFIRMED' },
    });
  }

  async rejectOrder(id: string, distributorId: string) {
    const order = await this.findById(id);
    if (order.distributorId !== distributorId) {
      throw new BadRequestException('Order is not assigned to this distributor');
    }
    // Freelance fallback logic: remove distributor and keep it open for freelance
    return this.prisma.order.update({
      where: { id },
      data: { 
        distributorId: null,
        status: 'PENDING',
        notes: `${order.notes ?? ''} [Rejected by distributor ${distributorId}]`.trim(),
      },
    });
  }

  async assignToDeliveryPartner(id: string, deliveryPartnerId: string) {
    const order = await this.findById(id);
    const dp = await this.prisma.deliveryPartner.findUnique({ where: { id: deliveryPartnerId } });
    if (!dp) throw new NotFoundException('Delivery partner not found');

    return this.prisma.order.update({
      where: { id },
      data: { 
        deliveryPartnerId,
        status: 'ASSIGNED',
      },
    });
  }

  async cancelOrder(id: string, userId: string) {
    const order = await this.findById(id);
    if (order.userId !== userId) throw new BadRequestException('Cannot cancel another user\'s order');
    if (['DELIVERED', 'CANCELLED'].includes(order.status)) {
      throw new BadRequestException(`Cannot cancel order in ${order.status} status`);
    }
    return this.prisma.order.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
  }

  // --- Production Logics ---

  async updateStatus(id: string, status: OrderStatus, deliveryPartnerId?: string) {
    return this.prisma.order.update({
      where: { id },
      data: { status, deliveryPartnerId },
    });
  }

  async createBatch(routeId: string, scheduledDate: Date, deliverySlot: string) {
    // Find all confirmed orders for this route and slot
    const orders = await this.prisma.order.findMany({
      where: {
        routeId,
        scheduledAt: {
          gte: new Date(scheduledDate.setHours(0, 0, 0, 0)),
          lte: new Date(scheduledDate.setHours(23, 59, 59, 999)),
        },
        status: 'CONFIRMED',
        batchId: null,
      },
    });

    if (orders.length === 0) {
      throw new BadRequestException('No eligible orders found for this route/slot');
    }

    return this.prisma.orderBatch.create({
      data: {
        routeId,
        scheduledDate,
        deliverySlot,
        status: 'OPEN',
        orders: {
          connect: orders.map((o) => ({ id: o.id })),
        },
      },
      include: { orders: true },
    });
  }

  async markBatchAsInProgress(batchId: string, deliveryPartnerId: string) {
    await this.prisma.orderBatch.update({
      where: { id: batchId },
      data: { status: 'IN_PROGRESS' },
    });

    return this.prisma.order.updateMany({
      where: { batchId },
      data: { 
        status: 'OUT_FOR_DELIVERY',
        deliveryPartnerId,
      },
    });
  }

  async completeDelivery(id: string, data: { 
    codCollected?: number; 
    jarsReturned: number; 
    jarsMissing?: number; 
    jarsDamaged?: number;
    proofUrl?: string;
    notes?: string;
  }) {
    const order = await this.prisma.order.findFirst({
        where: { id, deletedAt: null },
        include: { items: { include: { product: true } } }
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status !== 'OUT_FOR_DELIVERY') {
      throw new BadRequestException('Order must be out for delivery to complete');
    }

    const jarsMissing = data.jarsMissing || 0;
    const jarsDamaged = data.jarsDamaged || 0;
    const jarsReturned = data.jarsReturned || 0;

    // Calculate how many jars were delivered in this order
    const jarsDelivered = order.items
        .filter(i => i.product.isJar)
        .reduce((sum, i) => sum + i.quantity, 0);

    const netJarChange = jarsDelivered - jarsReturned - jarsMissing - jarsDamaged;

    return this.prisma.$transaction(async (tx) => {
        // 1. Update Order status
        const updatedOrder = await tx.order.update({
            where: { id },
            data: { 
              status: 'DELIVERED',
              deliveredAt: new Date(),
              codCollected: data.codCollected,
              jarsReturned: data.jarsReturned,
              proofUrl: data.proofUrl,
              paymentStatus: data.codCollected ? 'COMPLETED' : order.paymentStatus,
              notes: data.notes ? `${order.notes ?? ''} | ${data.notes}` : order.notes,
            },
        });

        // 2. Update User jar & deposit stats
        const user = await tx.user.update({
            where: { id: order.userId },
            data: {
                jarsHeld: { increment: netJarChange },
                // If missing, deduct deposit from depositBalance (if any)
                // Assuming each missing jar costs its product's deposit amount
                // For simplicity, we'll use a fixed or product-based deposit
            }
        });

        // 3. Record Lifecycles
        if (jarsReturned > 0) {
            await tx.jarLifecycle.create({
                data: {
                    orderId: id,
                    customerId: order.userId,
                    action: 'COLLECTED',
                    quantity: jarsReturned,
                    notes: 'Empty jars returned',
                }
            });
        }

        if (jarsMissing > 0) {
            await tx.jarLifecycle.create({
                data: {
                    orderId: id,
                    customerId: order.userId,
                    action: 'LOST',
                    quantity: jarsMissing,
                    notes: 'Jars reported missing',
                }
            });
        }

        if (jarsDamaged > 0) {
            await tx.jarLifecycle.create({
                data: {
                    orderId: id,
                    customerId: order.userId,
                    action: 'DAMAGED',
                    quantity: jarsDamaged,
                    notes: 'Jars reported damaged',
                }
            });
            // Apply penalty from wallet for damaged jars
            const penaltyPerJar = 150; // Standard Kerala penalty
            await this.wallet.adjustForJarLoss(order.userId, jarsDamaged, penaltyPerJar, id);
        }

        return updatedOrder;
    });
  }

  async getBatchDetails(batchId: string) {
    return this.prisma.orderBatch.findUnique({
      where: { id: batchId },
      include: { 
        orders: { 
          include: { 
            address: true, 
            user: { select: { name: true, phone: true } },
            items: { include: { product: true } }
          } 
        } 
      },
    });
  }
}
