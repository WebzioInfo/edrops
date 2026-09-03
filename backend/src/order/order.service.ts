import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { OrderStatus, OrderSource, OrderType, PaymentStatus } from '@prisma/client';

import { CreatePartnerOrderDto, CreatePartnerOrderItemDto } from './dto/create-partner-order.dto';

@Injectable()
export class OrderService {
  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
  ) {}

  findAll(customerId: string) {
    return this.prisma.order.findMany({
      where: { customerId },
      include: {
        address: true,
        items: {
          include: {
            product: {
              include: {
                images: true,
                brand: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  findStaffAll() {
    return this.prisma.order.findMany({
      include: {
        customer: {
          include: {
            user: { select: { firstName: true, lastName: true, phone: true, email: true, id: true } },
          },
        },
        address: true,
        items: {
          include: {
            product: {
              include: {
                images: true,
                brand: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async findOne(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: {
          include: {
            user: { select: { firstName: true, lastName: true, phone: true, email: true, id: true } },
          },
        },
        address: true,
        items: {
          include: {
            product: {
              include: {
                images: true,
                brand: true,
              },
            },
          },
        },
        history: {
          include: {
            user: { select: { firstName: true, lastName: true, phone: true, role: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!order) throw new NotFoundException(`Order not found: ${orderId}`);
    return order;
  }

  async findPartnerAll(query?: { status?: string; search?: string }) {
    const where: any = {};

    if (query?.status && query.status !== 'ALL') {
      if (query.status === 'PENDING') {
        where.status = { in: [OrderStatus.NEW, OrderStatus.ASSIGNED, OrderStatus.ACCEPTED_BY_PARTNER, OrderStatus.OUT_FOR_DELIVERY, OrderStatus.PENDING_ASSIGNMENT] };
      } else if (query.status === 'DELIVERED') {
        where.status = { in: [OrderStatus.DELIVERED, OrderStatus.COMPLETED] };
      } else {
        where.status = query.status as OrderStatus;
      }
    }

    if (query?.search?.trim()) {
      const q = query.search.trim();
      where.OR = [
        { id: { contains: q, mode: 'insensitive' } },
        { customer: { user: { firstName: { contains: q, mode: 'insensitive' } } } },
        { customer: { user: { lastName: { contains: q, mode: 'insensitive' } } } },
        { customer: { user: { phone: { contains: q, mode: 'insensitive' } } } },
        { customer: { companyName: { contains: q, mode: 'insensitive' } } },
        { address: { city: { contains: q, mode: 'insensitive' } } },
        { address: { street: { contains: q, mode: 'insensitive' } } },
      ];
    }

    return this.prisma.order.findMany({
      where,
      include: {
        customer: {
          include: {
            user: { select: { firstName: true, lastName: true, phone: true, email: true, id: true } },
          },
        },
        address: true,
        items: {
          include: {
            product: {
              include: {
                images: true,
                brand: true,
              },
            },
          },
        },
        history: {
          include: {
            user: { select: { firstName: true, lastName: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async createPartnerOrder(dto: CreatePartnerOrderDto, userId: string) {
    // 1. Validate Customer
    const customer = await this.prisma.customer.findUnique({
      where: { id: dto.customerId },
      include: {
        user: true,
        addresses: true,
      },
    });

    if (!customer) {
      throw new NotFoundException('Selected customer does not exist');
    }

    // 2. Validate Items
    if (!dto.items || !Array.isArray(dto.items) || dto.items.length === 0) {
      throw new BadRequestException('Order must contain at least one product item');
    }

    const productIds = dto.items.map((i) => i.productId);
    const dbProducts = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      include: { brand: true },
    });

    if (dbProducts.length !== productIds.length) {
      throw new BadRequestException('One or more selected products are invalid');
    }

    // Recalculate totals authoritatively on backend
    let subTotal = 0;
    const orderItemsData = dto.items.map((item) => {
      const product = dbProducts.find((p) => p.id === item.productId);
      if (!product) {
        throw new BadRequestException(`Product not found: ${item.productId}`);
      }

      const qty = Math.max(1, Math.floor(Number(item.quantity) || 1));
      const price = Number(item.unitPrice);
      if (isNaN(price) || price < 0) {
        throw new BadRequestException(`Invalid unit price for product: ${product.name}`);
      }

      const lineTotal = Number((qty * price).toFixed(2));
      subTotal += lineTotal;

      return {
        productId: product.id,
        quantity: qty,
        unitPrice: price,
        deposit: 0,
        total: lineTotal,
      };
    });

    subTotal = Number(subTotal.toFixed(2));
    const deliveryCharge = 0;
    const discountTotal = 0;
    const totalAmount = Number((subTotal + deliveryCharge - discountTotal).toFixed(2));

    // 3. Resolve and Snapshot Delivery Address inside DB Transaction
    const newOrder = await this.prisma.$transaction(async (tx) => {
      let targetAddressId: string | null = null;

      if (dto.deliveryLocationMode === 'OVERRIDE' && dto.overrideAddress) {
        // Create isolated address snapshot for this specific order
        const newAddress = await tx.address.create({
          data: {
            customerId: customer.id,
            street: dto.overrideAddress.street?.trim() || 'Delivery Address',
            houseName: dto.overrideAddress.houseName?.trim() || null,
            buildingName: dto.overrideAddress.buildingName?.trim() || null,
            area: dto.overrideAddress.area?.trim() || null,
            landmark: dto.overrideAddress.landmark?.trim() || null,
            city: dto.overrideAddress.city?.trim() || 'Kondotty',
            district: dto.overrideAddress.district?.trim() || 'Malappuram',
            state: dto.overrideAddress.state?.trim() || 'Kerala',
            zipCode: dto.overrideAddress.zipCode?.trim() || '673638',
            country: dto.overrideAddress.country || 'India',
            latitude: dto.overrideAddress.latitude || null,
            longitude: dto.overrideAddress.longitude || null,
            googleMapsUrl: dto.overrideAddress.googleMapsUrl || (dto.overrideAddress.latitude && dto.overrideAddress.longitude ? `https://www.google.com/maps/search/?api=1&query=${dto.overrideAddress.latitude},${dto.overrideAddress.longitude}` : null),
            isDefault: false,
            label: 'Order Delivery Location (Custom)',
          },
        });
        targetAddressId = newAddress.id;
      } else {
        // SAVED Profile Location snapshot
        const sourceAddr = (dto.deliveryAddressId && customer.addresses.find((a) => a.id === dto.deliveryAddressId)) ||
          customer.addresses.find((a) => a.isDefault) ||
          customer.addresses[0];

        if (sourceAddr) {
          const snapshot = await tx.address.create({
            data: {
              customerId: customer.id,
              street: sourceAddr.street || 'Main Road',
              houseName: sourceAddr.houseName,
              buildingName: sourceAddr.buildingName,
              area: sourceAddr.area,
              landmark: sourceAddr.landmark,
              city: sourceAddr.city || 'Kondotty',
              district: sourceAddr.district || 'Malappuram',
              state: sourceAddr.state || 'Kerala',
              zipCode: sourceAddr.zipCode || '673638',
              country: sourceAddr.country || 'India',
              latitude: sourceAddr.latitude,
              longitude: sourceAddr.longitude,
              googleMapsUrl: sourceAddr.googleMapsUrl,
              isDefault: false,
              label: 'Order Delivery Location (Saved Snapshot)',
            },
          });
          targetAddressId = snapshot.id;
        } else {
          // Default initial address
          const initialAddr = await tx.address.create({
            data: {
              customerId: customer.id,
              street: 'Main Road',
              city: 'Kondotty',
              district: 'Malappuram',
              state: 'Kerala',
              zipCode: '673638',
              country: 'India',
              isDefault: false,
              label: 'Order Delivery Location',
            },
          });
          targetAddressId = initialAddr.id;
        }
      }
      const order = await tx.order.create({
        data: {
          customerId: customer.id,
          orderType: OrderType.ONETIME_ORDER,
          orderSource: OrderSource.STAFF_CREATED,
          status: OrderStatus.NEW,
          subTotal,
          depositTotal: 0,
          deliveryCharge,
          discountTotal,
          totalAmount,
          deliveryAddressId: targetAddressId!,
          paymentMethod: dto.paymentMethod || 'CASH_ON_DELIVERY',
          paymentStatus: PaymentStatus.PENDING,
          adminNotes: dto.adminNotes || 'Created by Delivery Partner',
          timeSlot: dto.timeSlot || 'Standard Delivery',
          items: {
            create: orderItemsData,
          },
          history: {
            create: {
              previousStatus: OrderStatus.NEW,
              newStatus: OrderStatus.NEW,
              changedByUserId: userId,
              reason: 'Order manually created by Delivery Partner',
            },
          },
        },
        include: {
          customer: {
            include: {
              user: { select: { firstName: true, lastName: true, phone: true, email: true, id: true } },
            },
          },
          address: true,
          items: {
            include: {
              product: {
                include: {
                  images: true,
                  brand: true,
                },
              },
            },
          },
          history: true,
        },
      });

      return order;
    });

    // 5. Fire notification
    try {
      this.notificationService.notifyOrderCreated({
        orderId: newOrder.id,
        customerId: customer.id,
        customerName: `${customer.user?.firstName} ${customer.user?.lastName}`.trim(),
        customerPhone: customer.user?.phone,
        totalAmount: newOrder.totalAmount,
        paymentMethod: newOrder.paymentMethod,
      });
    } catch (e) {
      console.warn('[OrderService] notification error:', e);
    }

    return newOrder;
  }

  async updateOrderStatus(
    orderId: string,
    newStatus: OrderStatus,
    staffUserId: string,
    reason?: string,
    isAdminOverride: boolean = false,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { customer: { include: { user: true } } },
    });

    if (!order) throw new BadRequestException('Order not found');

    const validTransitions: Record<OrderStatus, OrderStatus[]> = {
      NEW: ['PENDING_PAYMENT', 'PENDING_ASSIGNMENT', 'ACCEPTED_BY_PARTNER', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'],
      PENDING_PAYMENT: ['PAYMENT_SUCCESS', 'FAILED', 'CANCELLED'],
      PAYMENT_SUCCESS: ['PENDING_ASSIGNMENT', 'ACCEPTED_BY_PARTNER', 'OUT_FOR_DELIVERY', 'CANCELLED'],
      PENDING_ASSIGNMENT: ['ASSIGNED', 'ACCEPTED_BY_PARTNER', 'OUT_FOR_DELIVERY', 'CANCELLED'],
      ASSIGNED: ['ACCEPTED_BY_PARTNER', 'OUT_FOR_DELIVERY', 'CANCELLED'],
      ACCEPTED_BY_PARTNER: ['OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'],
      OUT_FOR_DELIVERY: [
        'DELIVERED',
        'PARTIALLY_DELIVERED',
        'CUSTOMER_NOT_AVAILABLE',
        'FAILED',
        'RETURNED',
      ],
      DELIVERED: ['COMPLETED'],
      PARTIALLY_DELIVERED: ['COMPLETED'],
      CUSTOMER_NOT_AVAILABLE: ['RESCHEDULED', 'CANCELLED'],
      FAILED: ['RESCHEDULED', 'CANCELLED'],
      RESCHEDULED: ['PENDING_ASSIGNMENT'],
      RETURNED: ['COMPLETED'],
      CANCELLED: [],
      COMPLETED: [],
    };

    if (
      !isAdminOverride &&
      !validTransitions[order.status]?.includes(newStatus)
    ) {
      throw new BadRequestException(
        'Invalid status transition from ' + order.status + ' to ' + newStatus,
      );
    }

    // Use a transaction to ensure DB consistency
    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      // 1. Update order status
      const updated = await tx.order.update({
        where: { id: orderId },
        data: { status: newStatus },
      });

      // 2. Create history audit log
      await tx.orderStatusHistory.create({
        data: {
          orderId,
          previousStatus: order.status,
          newStatus,
          changedByUserId: staffUserId,
          reason: reason || `Status changed to ${newStatus}`,
        },
      });

      return updated;
    });

    // 4. Fire notifications safely outside transaction
    try {
      this.notificationService.notifyOrderStatusUpdate({
        orderId,
        customerId: order.customerId,
        userId: order.customer?.userId || order.customer?.user?.id,
        newStatus,
      });
    } catch (e) {
      console.warn('[OrderService] notification error:', e);
    }

    return updatedOrder;
  }
}
