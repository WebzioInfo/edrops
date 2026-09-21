import { Injectable, BadRequestException, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { EventsGateway } from '../events/events.gateway';
import { OrderStatus, OrderSource, OrderType, PaymentStatus, UserRole } from '@prisma/client';

import { CreatePartnerOrderDto, CreatePartnerOrderItemDto } from './dto/create-partner-order.dto';
import {
  CreateDistributorOrderDto,
  UpdateDistributorOrderStatusDto,
  RecordDistributorPaymentDto,
  CancelDistributorOrderDto,
} from './dto/distributor-order.dto';
import { isValidTransition, isPartnerAllowedTransition, VALID_ORDER_TRANSITIONS } from './order-state-machine';

@Injectable()
export class OrderService {
  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
    private eventsGateway: EventsGateway,
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

  async findStaffAll(query?: { page?: number | string; limit?: number | string; search?: string; status?: string }) {
    const page = Math.max(1, parseInt(String(query?.page || 1), 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(String(query?.limit || 15), 10) || 15));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query?.status && query.status !== 'ALL') {
      if (query.status === 'PENDING') {
        where.status = { in: [OrderStatus.NEW, OrderStatus.PENDING_PAYMENT, OrderStatus.PENDING_ASSIGNMENT] };
      } else if (query.status === 'ACTIVE') {
        where.status = { in: [OrderStatus.ASSIGNED, OrderStatus.ACCEPTED_BY_PARTNER, OrderStatus.OUT_FOR_DELIVERY] };
      } else if (query.status === 'DELIVERED') {
        where.status = { in: [OrderStatus.DELIVERED, OrderStatus.COMPLETED] };
      } else if (query.status === 'CANCELLED') {
        where.status = OrderStatus.CANCELLED;
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

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [totalMatching, orders, allStats] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
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
          delivery: {
            include: {
              assignment: {
                include: {
                  deliveryPartner: {
                    include: { user: { select: { firstName: true, lastName: true, phone: true, id: true } } },
                  },
                },
              },
              report: true,
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
        skip,
        take: limit,
      }),
      // Independent global totals across ALL orders (not affected by pagination or filters)
      Promise.all([
        this.prisma.order.count(),
        this.prisma.order.count({
          where: {
            status: { in: [OrderStatus.NEW, OrderStatus.PENDING_PAYMENT, OrderStatus.PENDING_ASSIGNMENT] },
          },
        }),
        this.prisma.order.count({
          where: {
            status: { in: [OrderStatus.ASSIGNED, OrderStatus.ACCEPTED_BY_PARTNER, OrderStatus.OUT_FOR_DELIVERY] },
          },
        }),
        this.prisma.order.count({
          where: { createdAt: { gte: todayStart } },
        }),
        this.prisma.order.aggregate({
          _sum: { totalAmount: true },
          where: {
            OR: [
              { paymentStatus: PaymentStatus.SUCCESS },
              { status: { in: [OrderStatus.DELIVERED, OrderStatus.COMPLETED] } },
            ],
          },
        }),
      ]),
    ]);

    const [totalOrders, pendingCount, activeCount, todayCount, revenueAggregate] = allStats;

    return {
      data: orders,
      pagination: {
        total: totalMatching,
        page,
        limit,
        totalPages: Math.ceil(totalMatching / limit) || 1,
      },
      stats: {
        totalOrders,
        pendingCount,
        activeCount,
        todayCount,
        totalRevenue: Number(revenueAggregate._sum.totalAmount || 0),
      },
    };
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
        payments: {
          orderBy: { createdAt: 'desc' },
        },
        delivery: {
          include: {
            assignment: {
              include: {
                deliveryPartner: {
                  include: { user: { select: { firstName: true, lastName: true, phone: true } } },
                },
              },
            },
            report: true,
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

  async findPartnerAll(
    query?: { status?: string; search?: string },
    userId?: string,
    userRole?: string,
  ) {
    const andClauses: any[] = [];

    const isStaffOrAdmin =
      userRole === UserRole.ADMIN ||
      userRole === UserRole.MANAGER ||
      userRole === UserRole.STAFF;

    if (!isStaffOrAdmin && userId) {
      const partner = await this.prisma.deliveryPartner.findUnique({
        where: { userId },
      });

      if (!partner) {
        return [];
      }

      andClauses.push({
        OR: [
          {
            delivery: {
              assignment: {
                deliveryPartnerId: partner.id,
              },
            },
          },
          {
            history: {
              some: {
                changedByUserId: userId,
                reason: { contains: 'Delivery Partner', mode: 'insensitive' },
              },
            },
          },
          {
            history: {
              some: {
                changedByUserId: userId,
                previousStatus: OrderStatus.NEW,
                newStatus: OrderStatus.NEW,
              },
            },
          },
        ],
      });
    }

    if (query?.status && query.status !== 'ALL') {
      if (query.status === 'PENDING') {
        andClauses.push({
          status: { in: [OrderStatus.NEW, OrderStatus.ASSIGNED, OrderStatus.ACCEPTED_BY_PARTNER, OrderStatus.OUT_FOR_DELIVERY, OrderStatus.PENDING_ASSIGNMENT] },
        });
      } else if (query.status === 'DELIVERED') {
        andClauses.push({
          status: { in: [OrderStatus.DELIVERED, OrderStatus.COMPLETED] },
        });
      } else {
        andClauses.push({
          status: query.status as OrderStatus,
        });
      }
    }

    if (query?.search?.trim()) {
      const q = query.search.trim();
      andClauses.push({
        OR: [
          { id: { contains: q, mode: 'insensitive' } },
          { customer: { user: { firstName: { contains: q, mode: 'insensitive' } } } },
          { customer: { user: { lastName: { contains: q, mode: 'insensitive' } } } },
          { customer: { user: { phone: { contains: q, mode: 'insensitive' } } } },
          { customer: { companyName: { contains: q, mode: 'insensitive' } } },
          { address: { city: { contains: q, mode: 'insensitive' } } },
          { address: { street: { contains: q, mode: 'insensitive' } } },
        ],
      });
    }

    const where = andClauses.length > 0 ? { AND: andClauses } : {};

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
        delivery: {
          include: {
            assignment: {
              include: {
                deliveryPartner: {
                  include: { user: { select: { firstName: true, lastName: true, phone: true } } },
                },
              },
            },
            report: true,
          },
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

    // Check if creator is a delivery partner to snapshot their current rate if not custom specified
    const partner = await this.prisma.deliveryPartner.findUnique({
      where: { userId },
    });

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

      let itemPartnerCost: any = null;
      if (item.partnerCost !== undefined && item.partnerCost !== null && !isNaN(Number(item.partnerCost))) {
        itemPartnerCost = Number(item.partnerCost);
      } else if (partner && partner.jarUnitPrice) {
        itemPartnerCost = Number(partner.jarUnitPrice);
      }

      const lineTotal = Number((qty * price).toFixed(2));
      subTotal += lineTotal;

      return {
        productId: product.id,
        quantity: qty,
        unitPrice: price,
        partnerCost: itemPartnerCost !== null ? itemPartnerCost : null,
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
          targetAddressId = sourceAddr.id;
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
          paymentMethod: dto.paymentMethod || null,
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

      if (partner) {
        const totalQty = dto.items.reduce((sum, i) => sum + (i.quantity || 1), 0);
        const del = await tx.delivery.create({
          data: {
            orderId: order.id,
            customerId: customer.id,
            addressId: targetAddressId!,
            requiredQuantity: totalQty,
            scheduledFor: new Date(),
            timeSlot: dto.timeSlot || 'Standard Delivery',
            status: OrderStatus.ASSIGNED,
          },
        });
        await tx.deliveryAssignment.create({
          data: {
            deliveryId: del.id,
            deliveryPartnerId: partner.id,
            assignedAt: new Date(),
            rateSnapshot: partner.jarUnitPrice || 35.0,
          },
        });
        await tx.order.update({
          where: { id: order.id },
          data: { status: OrderStatus.ASSIGNED },
        });
        order.status = OrderStatus.ASSIGNED;
      }

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
        paymentMethod: newOrder.paymentMethod || 'PENDING_DELIVERY',
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
    paymentConfirmation?: {
      paymentReceived: boolean;
      paymentMethod?: string;
      amountReceived?: number;
    },
    isAdminOverride: boolean = false,
    userRole?: UserRole,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: { include: { user: true } },
        delivery: { include: { assignment: true } },
        items: true,
      },
    });

    if (!order) throw new BadRequestException('Order not found');

    // 1. Explicit same-state guard
    if (order.status === newStatus) {
      throw new BadRequestException(`Order is already in this status: ${newStatus}`);
    }

    // 2. Fetch acting user details for authorization check
    const actingUser = await this.prisma.user.findUnique({
      where: { id: staffUserId },
      include: { deliveryPartner: true },
    });

    const effectiveRole = userRole || actingUser?.role;

    // 3. Delivery partner role-scoping: must be assigned to this order and only allowed partner transitions
    if (effectiveRole === UserRole.DELIVERY_PARTNER) {
      const partner = actingUser?.deliveryPartner || await this.prisma.deliveryPartner.findUnique({
        where: { userId: staffUserId },
      });

      if (!partner) {
        throw new ForbiddenException('User is not registered as a delivery partner');
      }

      const assignedPartnerId = order.delivery?.assignment?.deliveryPartnerId || (order as any).deliveryPartnerId;
      if (!assignedPartnerId || assignedPartnerId !== partner.id) {
        throw new ForbiddenException('You are not authorized to update this order: this order is not assigned to you');
      }

      if (newStatus === OrderStatus.CANCELLED) {
        throw new ForbiddenException('Delivery partners are not permitted to cancel orders. Please contact staff or admin.');
      }

      if (newStatus === OrderStatus.COMPLETED) {
        throw new ForbiddenException('Delivery partners cannot mark orders as completed directly. Please mark as delivered.');
      }

      if (!isPartnerAllowedTransition(order.status, newStatus)) {
        throw new ForbiddenException(
          `Delivery partners are not permitted to transition order from ${order.status} to ${newStatus}`,
        );
      }
    }

    // 4. Central state machine validation
    if (!isAdminOverride && !isValidTransition(order.status, newStatus)) {
      throw new BadRequestException(
        'Invalid status transition from ' + order.status + ' to ' + newStatus,
      );
    }

    // Enforce delivery partner requirement before marking Out for Delivery
    if (newStatus === OrderStatus.OUT_FOR_DELIVERY) {
      const partnerId = order.delivery?.assignment?.deliveryPartnerId || (order as any).deliveryPartnerId;
      if (!partnerId) {
        throw new BadRequestException('Please assign a delivery partner before marking this order out for delivery');
      }
    }

    // Use a transaction to ensure DB consistency
    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      let targetPaymentStatus = order.paymentStatus;
      let targetPaymentMethod = order.paymentMethod;
      let deliveredAt = order.deliveredAt;

      const isDelivering = newStatus === OrderStatus.DELIVERED || newStatus === OrderStatus.COMPLETED;
      const isAlreadyPaid = order.paymentStatus === PaymentStatus.SUCCESS;

      if (isDelivering) {
        deliveredAt = new Date();

        if (paymentConfirmation) {
          if (paymentConfirmation.paymentReceived) {
            targetPaymentStatus = PaymentStatus.SUCCESS;
            targetPaymentMethod = paymentConfirmation.paymentMethod || order.paymentMethod || 'COD';

            const paidAmt = paymentConfirmation.amountReceived !== undefined && paymentConfirmation.amountReceived !== null
              ? Number(paymentConfirmation.amountReceived)
              : order.totalAmount;

            if (paidAmt <= 0) {
              throw new BadRequestException('Amount received must be greater than 0 when payment is received.');
            }

            // Create payment record in DB
            await tx.payment.create({
              data: {
                orderId,
                customerId: order.customerId,
                amount: paidAmt,
                currency: 'INR',
                status: PaymentStatus.SUCCESS,
                provider: targetPaymentMethod,
                receiptId: `RCP-${Date.now()}`,
                description: `Payment confirmed upon delivery`,
              },
            });
          } else {
            // Unpaid delivery
            if (!isAlreadyPaid) {
              targetPaymentStatus = PaymentStatus.PENDING;
              targetPaymentMethod = null;
            }
          }
        }
      }

      // 1. Update order status, payment fields, and deliveredAt
      const updated = await tx.order.update({
        where: { id: orderId },
        data: {
          status: newStatus,
          paymentStatus: targetPaymentStatus,
          paymentMethod: targetPaymentMethod,
          deliveredAt,
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
                include: { images: true, brand: true },
              },
            },
          },
          delivery: {
            include: {
              assignment: {
                include: {
                  deliveryPartner: {
                    include: { user: { select: { firstName: true, lastName: true, phone: true, id: true } } },
                  },
                },
              },
              report: true,
            },
          },
          history: {
            include: { user: { select: { firstName: true, lastName: true, role: true } } },
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      // 2. Create history audit log
      let historyReason = reason || `Status changed to ${newStatus}`;
      if (isDelivering) {
        if (isAlreadyPaid && !paymentConfirmation) {
          historyReason = `Delivered (Pre-verified Online Payment: ₹${order.totalAmount})`;
        } else if (paymentConfirmation?.paymentReceived) {
          historyReason = `Delivered & Payment Received: ₹${paymentConfirmation.amountReceived ?? order.totalAmount} via ${paymentConfirmation.paymentMethod}`;
        } else if (paymentConfirmation && !paymentConfirmation.paymentReceived) {
          historyReason = `Delivered (Payment Pending / Unpaid)`;
        }
      }

      await tx.orderStatusHistory.create({
        data: {
          orderId,
          previousStatus: order.status,
          newStatus,
          changedByUserId: staffUserId,
          reason: historyReason,
        },
      });

      // 3. Sync associated Delivery record if exists
      const delivery = await tx.delivery.findFirst({ where: { orderId } });
      if (delivery) {
        await tx.delivery.update({
          where: { id: delivery.id },
          data: {
            status: newStatus === OrderStatus.DELIVERED || newStatus === OrderStatus.COMPLETED
              ? OrderStatus.DELIVERED
              : newStatus === OrderStatus.CANCELLED
              ? OrderStatus.CANCELLED
              : delivery.status,
          },
        });

        if (isDelivering) {
          const totalJars = order.items.reduce((sum, item) => sum + item.quantity, 0) || 1;
          await tx.deliveryReport.upsert({
            where: { deliveryId: delivery.id },
            update: {
              partnerDeliveredQty: totalJars,
              partnerSubmittedAt: new Date(),
            },
            create: {
              deliveryId: delivery.id,
              partnerDeliveredQty: totalJars,
              partnerEmptyCollected: 0,
              partnerSubmittedAt: new Date(),
            },
          });
        }
      }

      return updated;
    });

    // 4. Fire notifications and socket broadcasts
    try {
      this.notificationService.notifyOrderStatusUpdate({
        orderId,
        customerId: order.customerId,
        userId: order.customer?.userId || order.customer?.user?.id,
        newStatus,
      });
      this.eventsGateway.emitOrderStatusUpdate(orderId, newStatus, order.customerId, updatedOrder);
    } catch (e) {
      console.warn('[OrderService] notification/socket error:', e);
    }

    return updatedOrder;
  }

  async assignDeliveryPartner(orderId: string, deliveryPartnerId: string, staffUserId?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: {
          include: {
            user: true,
            addresses: true,
          },
        },
        delivery: { include: { assignment: true } },
        items: true,
      },
    });

    if (!order) throw new NotFoundException(`Order not found: ${orderId}`);

    if (order.status === OrderStatus.CANCELLED || order.status === OrderStatus.COMPLETED) {
      throw new BadRequestException(`Cannot assign delivery partner to an order in status ${order.status}`);
    }

    const partner = await this.prisma.deliveryPartner.findUnique({
      where: { id: deliveryPartnerId },
      include: { user: true },
    });

    if (!partner) {
      throw new NotFoundException(`Delivery partner not found: ${deliveryPartnerId}`);
    }

    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      // 1. Ensure Delivery record exists
      let deliveryId = order.delivery?.id;
      const hasAssignment = !!order.delivery?.assignment;
      const assignmentId = order.delivery?.assignment?.id;

      if (!deliveryId) {
        let addressId = (order as any).addressId || (order as any).deliveryAddressId || order.customer?.addresses?.[0]?.id;
        if (!addressId) {
          const firstAddr = await tx.address.findFirst({ where: { customerId: order.customerId } });
          addressId = firstAddr?.id;
        }

        if (!addressId) {
          // Create fallback default address if customer has none
          const newAddr = await tx.address.create({
            data: {
              customerId: order.customerId,
              street: 'Default Address',
              city: 'Default City',
              state: 'Default State',
              zipCode: '000000',
              label: 'Delivery Location',
            },
          });
          addressId = newAddr.id;
        }

        const totalQty = order.items?.reduce((sum: number, item: any) => sum + (item.quantity || 1), 0) || 1;

        const newDel = await tx.delivery.create({
          data: {
            orderId: order.id,
            customerId: order.customerId,
            addressId,
            requiredQuantity: totalQty,
            scheduledFor: order.createdAt || new Date(),
            timeSlot: order.timeSlot || 'Standard Delivery',
            status: OrderStatus.ASSIGNED,
          },
        });
        deliveryId = newDel.id;
      }

      // 2. Upsert DeliveryAssignment
      if (hasAssignment && assignmentId) {
        await tx.deliveryAssignment.update({
          where: { id: assignmentId },
          data: {
            deliveryPartnerId,
            assignedAt: new Date(),
            rateSnapshot: partner.jarUnitPrice || 35.0,
          },
        });
      } else if (deliveryId) {
        await tx.deliveryAssignment.create({
          data: {
            deliveryId,
            deliveryPartnerId,
            assignedAt: new Date(),
            rateSnapshot: partner.jarUnitPrice || 35.0,
          },
        });
      }

      // 3. Update order status if currently unassigned / placed
      let targetStatus = order.status;
      if (
        order.status === OrderStatus.NEW ||
        order.status === OrderStatus.PENDING_ASSIGNMENT ||
        order.status === OrderStatus.PENDING_PAYMENT ||
        (order.status as string) === 'PENDING'
      ) {
        targetStatus = OrderStatus.ASSIGNED;
      }

      const updated = await tx.order.update({
        where: { id: orderId },
        data: {
          status: targetStatus,
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
                include: { images: true, brand: true },
              },
            },
          },
          delivery: {
            include: {
              assignment: {
                include: {
                  deliveryPartner: {
                    include: { user: { select: { firstName: true, lastName: true, phone: true, id: true } } },
                  },
                },
              },
              report: true,
            },
          },
          history: {
            include: { user: { select: { firstName: true, lastName: true, role: true } } },
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      // 4. Create audit history
      await tx.orderStatusHistory.create({
        data: {
          orderId,
          previousStatus: order.status,
          newStatus: targetStatus,
          changedByUserId: staffUserId,
          reason: `Assigned delivery partner ${partner.user.firstName} ${partner.user.lastName} (${partner.user.phone})`,
        },
      });

      return updated;
    });

    // 5. Emit real-time broadcasts
    try {
      this.eventsGateway.emitOrderAssigned(updatedOrder, deliveryPartnerId);
    } catch (e) {
      console.warn('[OrderService] Socket emit error:', e);
    }

    return updatedOrder;
  }

  // =========================================================================
  // DISTRIBUTOR COMPLETE ORDER MANAGEMENT (ERP)
  // =========================================================================

  async findDistributorOrders(
    distributorUserId: string,
    query?: {
      page?: number | string;
      limit?: number | string;
      search?: string;
      status?: string;
      paymentStatus?: string;
      datePreset?: string;
      dateFrom?: string;
      dateTo?: string;
      customerId?: string;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    },
  ) {
    const page = Math.max(1, parseInt(String(query?.page || 1), 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(String(query?.limit || 25), 10) || 25));
    const skip = (page - 1) * limit;

    // Strict Distributor assignment filter: Only orders assigned to this distributor
    const baseDistributorCondition: any = {
      distributorId: distributorUserId,
      assignmentStatus: 'ASSIGNED',
    };

    const where: any = { ...baseDistributorCondition };

    // Order Status filter
    if (query?.status && query.status !== 'ALL') {
      if (query.status === 'PENDING') {
        where.status = {
          in: [OrderStatus.NEW, OrderStatus.PENDING_PAYMENT, OrderStatus.PENDING_ASSIGNMENT],
        };
      } else if (query.status === 'CONFIRMED') {
        where.status = OrderStatus.CONFIRMED;
      } else if (query.status === 'PROCESSING') {
        where.status = OrderStatus.PROCESSING;
      } else if (query.status === 'READY') {
        where.status = OrderStatus.READY;
      } else if (query.status === 'OUT_FOR_DELIVERY') {
        where.status = OrderStatus.OUT_FOR_DELIVERY;
      } else if (query.status === 'DELIVERED') {
        where.status = { in: [OrderStatus.DELIVERED, OrderStatus.COMPLETED] };
      } else if (query.status === 'CANCELLED') {
        where.status = OrderStatus.CANCELLED;
      } else {
        where.status = query.status as OrderStatus;
      }
    }

    // Payment Status filter
    if (query?.paymentStatus && query.paymentStatus !== 'ALL') {
      if (query.paymentStatus === 'PAID') {
        where.paymentStatus = { in: [PaymentStatus.PAID, PaymentStatus.SUCCESS] };
      } else if (query.paymentStatus === 'PARTIALLY_PAID') {
        where.paymentStatus = { in: [PaymentStatus.PARTIALLY_PAID, PaymentStatus.PARTIAL_REFUND] };
      } else if (query.paymentStatus === 'UNPAID') {
        where.paymentStatus = { in: [PaymentStatus.UNPAID, PaymentStatus.PENDING, PaymentStatus.CREATED] };
      } else if (query.paymentStatus === 'REFUNDED') {
        where.paymentStatus = PaymentStatus.REFUNDED;
      } else {
        where.paymentStatus = query.paymentStatus as PaymentStatus;
      }
    }

    // Customer filter
    if (query?.customerId && query.customerId !== 'ALL') {
      where.customerId = query.customerId;
    }

    // Date Presets & Custom Ranges
    if (query?.datePreset && query.datePreset !== 'ALL') {
      const now = new Date();
      if (query.datePreset === 'TODAY') {
        const start = new Date(now.setHours(0, 0, 0, 0));
        const end = new Date(now.setHours(23, 59, 59, 999));
        where.createdAt = { gte: start, lte: end };
      } else if (query.datePreset === 'YESTERDAY') {
        const yStart = new Date(now);
        yStart.setDate(yStart.getDate() - 1);
        yStart.setHours(0, 0, 0, 0);
        const yEnd = new Date(yStart);
        yEnd.setHours(23, 59, 59, 999);
        where.createdAt = { gte: yStart, lte: yEnd };
      } else if (query.datePreset === 'THIS_WEEK') {
        const weekStart = new Date(now);
        weekStart.setDate(weekStart.getDate() - 7);
        weekStart.setHours(0, 0, 0, 0);
        where.createdAt = { gte: weekStart };
      } else if (query.datePreset === 'THIS_MONTH') {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        where.createdAt = { gte: monthStart };
      }
    } else if (query?.dateFrom || query?.dateTo) {
      where.createdAt = {};
      if (query.dateFrom) where.createdAt.gte = new Date(query.dateFrom);
      if (query.dateTo) {
        const to = new Date(query.dateTo);
        to.setHours(23, 59, 59, 999);
        where.createdAt.lte = to;
      }
    }

    // Search query
    if (query?.search?.trim()) {
      const q = query.search.trim();
      where.AND = [
        {
          OR: [
            { id: { contains: q, mode: 'insensitive' } },
            { customer: { user: { firstName: { contains: q, mode: 'insensitive' } } } },
            { customer: { user: { lastName: { contains: q, mode: 'insensitive' } } } },
            { customer: { user: { phone: { contains: q, mode: 'insensitive' } } } },
            { customer: { companyName: { contains: q, mode: 'insensitive' } } },
            { customer: { referralCode: { contains: q, mode: 'insensitive' } } },
            { address: { city: { contains: q, mode: 'insensitive' } } },
            { address: { street: { contains: q, mode: 'insensitive' } } },
          ],
        },
      ];
    }

    // Sorting
    let orderBy: any = { createdAt: 'desc' };
    const sortDir = query?.sortOrder === 'asc' ? 'asc' : 'desc';
    if (query?.sortBy === 'total') {
      orderBy = { totalAmount: sortDir };
    } else if (query?.sortBy === 'orderDate') {
      orderBy = { createdAt: sortDir };
    } else if (query?.sortBy === 'status') {
      orderBy = { status: sortDir };
    } else if (query?.sortBy === 'customer') {
      orderBy = { customer: { user: { firstName: sortDir } } };
    }

    // Run parallel queries: Paginated list + Real DB summary statistics
    const [totalMatching, orders, allStats] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
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
                select: { id: true, name: true, price: true, isJar: true },
              },
            },
          },
          payments: {
            select: { id: true, amount: true, status: true, provider: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
      // Real DB aggregates for summary header (scoped to this distributor)
      Promise.all([
        this.prisma.order.count({ where: baseDistributorCondition }),
        this.prisma.order.count({
          where: {
            ...baseDistributorCondition,
            status: { in: [OrderStatus.NEW, OrderStatus.PENDING_PAYMENT, OrderStatus.PENDING_ASSIGNMENT] },
          },
        }),
        this.prisma.order.count({
          where: {
            ...baseDistributorCondition,
            status: {
              in: [
                OrderStatus.CONFIRMED,
                OrderStatus.PROCESSING,
                OrderStatus.READY,
                OrderStatus.ASSIGNED,
                OrderStatus.ACCEPTED_BY_PARTNER,
              ],
            },
          },
        }),
        this.prisma.order.count({
          where: {
            ...baseDistributorCondition,
            status: OrderStatus.OUT_FOR_DELIVERY,
          },
        }),
        this.prisma.order.count({
          where: {
            ...baseDistributorCondition,
            status: { in: [OrderStatus.DELIVERED, OrderStatus.COMPLETED] },
          },
        }),
        this.prisma.order.count({
          where: {
            ...baseDistributorCondition,
            status: OrderStatus.CANCELLED,
          },
        }),
        this.prisma.order.count({
          where: {
            ...baseDistributorCondition,
            paymentStatus: { in: [PaymentStatus.UNPAID, PaymentStatus.PENDING, PaymentStatus.PARTIALLY_PAID] },
            status: { not: OrderStatus.CANCELLED },
          },
        }),
        this.prisma.order.aggregate({
          _sum: { totalAmount: true },
          where: {
            ...baseDistributorCondition,
            status: { not: OrderStatus.CANCELLED },
          },
        }),
        this.prisma.payment.aggregate({
          _sum: { amount: true },
          where: {
            order: baseDistributorCondition,
            status: { in: [PaymentStatus.PAID, PaymentStatus.SUCCESS] },
          },
        }),
      ]),
    ]);

    const [
      totalOrders,
      pendingCount,
      confirmedCount,
      outForDeliveryCount,
      deliveredCount,
      cancelledCount,
      pendingPaymentCount,
      revenueAgg,
      paymentsAgg,
    ] = allStats;

    const totalRevenue = Number(revenueAgg._sum.totalAmount || 0);
    const totalCollected = Number(paymentsAgg._sum.amount || 0);
    const totalDue = Math.max(0, Number((totalRevenue - totalCollected).toFixed(2)));

    // Transform orders to add computed total quantity and amount paid/due
    const transformedOrders = orders.map((o) => {
      const totalQty = o.items.reduce((sum, item) => sum + item.quantity, 0);
      const paidAmount = o.payments
        .filter((p) => p.status === PaymentStatus.PAID || p.status === PaymentStatus.SUCCESS)
        .reduce((sum, p) => sum + p.amount, 0);
      const dueAmount = Math.max(0, Number((o.totalAmount - paidAmount).toFixed(2)));

      return {
        ...o,
        totalQuantity: totalQty,
        amountPaid: paidAmount,
        amountDue: dueAmount,
      };
    });

    return {
      data: transformedOrders,
      pagination: {
        total: totalMatching,
        page,
        limit,
        totalPages: Math.ceil(totalMatching / limit) || 1,
      },
      stats: {
        totalOrders,
        pendingCount,
        confirmedCount,
        outForDeliveryCount,
        deliveredCount,
        cancelledCount,
        pendingPaymentCount,
        totalRevenue,
        totalCollected,
        totalDue,
      },
    };
  }

  async findDistributorOrder(orderId: string, distributorUserId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: {
          include: {
            user: { select: { firstName: true, lastName: true, phone: true, email: true, id: true } },
            addresses: true,
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
        payments: {
          orderBy: { createdAt: 'desc' },
        },
        history: {
          include: {
            user: { select: { firstName: true, lastName: true, phone: true, role: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order not found: ${orderId}`);
    }

    // Tenant & Distributor authorization check
    if (order.distributorId && order.distributorId !== distributorUserId) {
      throw new ForbiddenException('You are not authorized to view this order.');
    }

    const paidAmount = order.payments
      .filter((p) => p.status === PaymentStatus.PAID || p.status === PaymentStatus.SUCCESS)
      .reduce((sum, p) => sum + p.amount, 0);
    const dueAmount = Math.max(0, Number((order.totalAmount - paidAmount).toFixed(2)));

    return {
      ...order,
      amountPaid: paidAmount,
      amountDue: dueAmount,
    };
  }

  async createDistributorOrder(distributorUserId: string, dto: CreateDistributorOrderDto) {
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
      throw new BadRequestException('Order must contain at least one line item');
    }

    const productIds = dto.items.map((i) => i.productId);
    const dbProducts = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      include: { brand: true },
    });

    if (dbProducts.length !== productIds.length) {
      throw new BadRequestException('One or more selected products are invalid');
    }

    // 3. Authoritative Recalculation on Backend
    let calculatedSubTotal = 0;
    let calculatedItemDiscount = 0;
    let calculatedTaxTotal = 0;

    const orderItemsData = dto.items.map((item) => {
      const product = dbProducts.find((p) => p.id === item.productId);
      if (!product) {
        throw new BadRequestException(`Product not found: ${item.productId}`);
      }

      const qty = Math.max(1, Math.floor(Number(item.quantity) || 1));
      const unitPrice = Number(item.unitPrice);
      if (isNaN(unitPrice) || unitPrice < 0) {
        throw new BadRequestException(`Invalid unit price for product: ${product.name}`);
      }

      const lineDiscount = Math.max(0, Number(item.discount || 0));
      const taxRate = Math.max(0, Number(item.taxRate || 0));

      const rawLineTotal = qty * unitPrice;
      const discountedLine = Math.max(0, rawLineTotal - lineDiscount);
      const taxAmount = discountedLine * (taxRate / 100);
      const lineTotal = Number((discountedLine + taxAmount).toFixed(2));

      calculatedSubTotal += rawLineTotal;
      calculatedItemDiscount += lineDiscount;
      calculatedTaxTotal += taxAmount;

      return {
        productId: product.id,
        quantity: qty,
        unitPrice,
        deposit: product.depositAmount ? product.depositAmount * qty : 0,
        total: lineTotal,
      };
    });

    const deliveryCharge = Math.max(0, Number(dto.deliveryCharge || 0));
    const extraDiscount = Math.max(0, Number(dto.discountTotal || 0));
    const totalDiscount = Number((calculatedItemDiscount + extraDiscount).toFixed(2));
    const finalSubTotal = Number(calculatedSubTotal.toFixed(2));
    const finalTax = Number(calculatedTaxTotal.toFixed(2));
    const finalTotalAmount = Number(
      Math.max(0, finalSubTotal - totalDiscount + finalTax + deliveryCharge).toFixed(2),
    );

    // Initial payment resolution
    const initialPaid = Math.max(0, Number(dto.amountPaid || 0));
    let initialPaymentStatus: PaymentStatus = PaymentStatus.UNPAID;
    if (initialPaid >= finalTotalAmount && finalTotalAmount > 0) {
      initialPaymentStatus = PaymentStatus.PAID;
    } else if (initialPaid > 0) {
      initialPaymentStatus = PaymentStatus.PARTIALLY_PAID;
    }

    // 4. Resolve delivery address inside transaction
    return this.prisma.$transaction(async (tx) => {
      let targetAddressId: string | null = null;
      const sourceAddr =
        (dto.deliveryAddressId && customer.addresses.find((a) => a.id === dto.deliveryAddressId)) ||
        customer.addresses.find((a) => a.isDefault) ||
        customer.addresses[0];

      if (sourceAddr) {
        targetAddressId = sourceAddr.id;
      } else {
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

      // Create Order
      const newOrder = await tx.order.create({
        data: {
          distributorId: distributorUserId,
          assignmentStatus: 'ASSIGNED',
          acceptedAt: new Date(),
          acceptedById: distributorUserId,
          customerId: customer.id,
          orderType: OrderType.ONETIME_ORDER,
          orderSource: OrderSource.STAFF_CREATED,
          status: OrderStatus.CONFIRMED,
          subTotal: finalSubTotal,
          depositTotal: 0,
          deliveryCharge,
          discountTotal: totalDiscount,
          totalAmount: finalTotalAmount,
          deliveryAddressId: targetAddressId!,
          scheduledDate: dto.scheduledDate ? new Date(dto.scheduledDate) : new Date(),
          paymentStatus: initialPaymentStatus,
          paymentMethod: dto.paymentMethod || (initialPaid > 0 ? 'CASH' : null),
          adminNotes: dto.notes || 'Created via Distributor Order Management',
          items: {
            create: orderItemsData,
          },
          history: {
            create: {
              previousStatus: OrderStatus.NEW,
              newStatus: OrderStatus.CONFIRMED,
              changedByUserId: distributorUserId,
              reason: 'Order created by Distributor',
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
              product: true,
            },
          },
          history: true,
          payments: true,
        },
      });

      // Record initial payment if provided
      if (initialPaid > 0) {
        const paymentRecord = await tx.payment.create({
          data: {
            orderId: newOrder.id,
            customerId: customer.id,
            amount: initialPaid,
            currency: 'INR',
            status: initialPaymentStatus === PaymentStatus.PAID ? PaymentStatus.PAID : PaymentStatus.PARTIALLY_PAID,
            provider: dto.paymentMethod || 'CASH',
            receiptId: `RCP-DIST-${Date.now()}`,
            description: `Initial payment recorded on order creation: ₹${initialPaid}`,
          },
        });
        newOrder.payments.push(paymentRecord);
      }

      return newOrder;
    });
  }

  async updateDistributorOrderStatus(
    orderId: string,
    distributorUserId: string,
    dto: UpdateDistributorOrderStatusDto,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { history: true },
    });

    if (!order) {
      throw new NotFoundException(`Order not found: ${orderId}`);
    }

    if (order.distributorId && order.distributorId !== distributorUserId) {
      throw new ForbiddenException('You are not authorized to update this order');
    }

    if (order.status === dto.status) {
      throw new BadRequestException(`Order is already in status: ${dto.status}`);
    }

    // Finalized orders guard
    if (order.status === OrderStatus.DELIVERED || order.status === OrderStatus.COMPLETED) {
      throw new BadRequestException(
        'Delivered and completed orders cannot be changed back to an earlier status.',
      );
    }

    // Central state machine validation
    if (!isValidTransition(order.status, dto.status)) {
      throw new BadRequestException(
        `Invalid status transition from ${order.status} to ${dto.status}`,
      );
    }

    const deliveredAt =
      dto.status === OrderStatus.DELIVERED || dto.status === OrderStatus.COMPLETED
        ? new Date()
        : order.deliveredAt;

    const updated = await this.prisma.$transaction(async (tx) => {
      const res = await tx.order.update({
        where: { id: orderId },
        data: {
          status: dto.status,
          deliveredAt,
        },
        include: {
          customer: {
            include: {
              user: { select: { firstName: true, lastName: true, phone: true } },
            },
          },
          address: true,
          items: { include: { product: true } },
          payments: true,
          history: {
            include: { user: { select: { firstName: true, lastName: true } } },
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId,
          previousStatus: order.status,
          newStatus: dto.status,
          changedByUserId: distributorUserId,
          reason: dto.reason || `Status updated to ${dto.status} by Distributor`,
        },
      });

      return res;
    });

    try {
      this.eventsGateway.emitOrderStatusUpdate(orderId, dto.status, order.customerId, updated);
    } catch (e) {
      console.warn('[OrderService] notification/socket broadcast warning:', e);
    }

    return updated;
  }

  async recordDistributorPayment(
    orderId: string,
    distributorUserId: string,
    dto: RecordDistributorPaymentDto,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { payments: true },
    });

    if (!order) {
      throw new NotFoundException(`Order not found: ${orderId}`);
    }

    if (order.distributorId && order.distributorId !== distributorUserId) {
      throw new ForbiddenException('You are not authorized to record payment for this order');
    }

    const currentPaid = order.payments
      .filter((p) => p.status === PaymentStatus.PAID || p.status === PaymentStatus.SUCCESS)
      .reduce((sum, p) => sum + p.amount, 0);

    const remainingDue = Math.max(0, Number((order.totalAmount - currentPaid).toFixed(2)));

    if (remainingDue <= 0) {
      throw new BadRequestException('This order is already fully paid.');
    }

    const paymentAmount = Number(dto.amount);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      throw new BadRequestException('Payment amount must be greater than 0.');
    }

    if (paymentAmount > remainingDue + 0.01) {
      throw new BadRequestException(
        `Payment amount (₹${paymentAmount}) exceeds remaining balance due (₹${remainingDue}).`,
      );
    }

    const newTotalPaid = Number((currentPaid + paymentAmount).toFixed(2));
    const targetPaymentStatus =
      newTotalPaid >= order.totalAmount ? PaymentStatus.PAID : PaymentStatus.PARTIALLY_PAID;

    return this.prisma.$transaction(async (tx) => {
      // 1. Create Payment record
      const payment = await tx.payment.create({
        data: {
          orderId: order.id,
          customerId: order.customerId,
          amount: paymentAmount,
          currency: 'INR',
          status: PaymentStatus.PAID,
          provider: dto.paymentMethod || 'CASH',
          receiptId: dto.referenceNumber || `RCP-DIST-${Date.now()}`,
          description: dto.notes || `Payment recorded by distributor: ₹${paymentAmount}`,
          createdAt: dto.paymentDate ? new Date(dto.paymentDate) : new Date(),
        },
      });

      // 2. Update Order payment status and method
      const updatedOrder = await tx.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: targetPaymentStatus,
          paymentMethod: dto.paymentMethod,
        },
        include: {
          customer: {
            include: {
              user: { select: { firstName: true, lastName: true, phone: true } },
            },
          },
          address: true,
          items: { include: { product: true } },
          payments: { orderBy: { createdAt: 'desc' } },
          history: { orderBy: { createdAt: 'asc' } },
        },
      });

      // 3. Log Status History
      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          previousStatus: order.status,
          newStatus: order.status,
          changedByUserId: distributorUserId,
          reason: `Payment recorded: ₹${paymentAmount} via ${dto.paymentMethod} (New Status: ${targetPaymentStatus})`,
        },
      });

      return {
        ...updatedOrder,
        amountPaid: newTotalPaid,
        amountDue: Math.max(0, Number((updatedOrder.totalAmount - newTotalPaid).toFixed(2))),
        newPayment: payment,
      };
    });
  }

  async cancelDistributorOrder(
    orderId: string,
    distributorUserId: string,
    dto: CancelDistributorOrderDto,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException(`Order not found: ${orderId}`);
    }

    if (order.distributorId && order.distributorId !== distributorUserId) {
      throw new ForbiddenException('You are not authorized to cancel this order');
    }

    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Order is already cancelled.');
    }

    if (order.status === OrderStatus.DELIVERED || order.status === OrderStatus.COMPLETED) {
      throw new BadRequestException('Delivered orders cannot be cancelled.');
    }

    if (!dto.reason?.trim()) {
      throw new BadRequestException('Cancellation reason is required.');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.CANCELLED,
        },
        include: {
          customer: {
            include: { user: { select: { firstName: true, lastName: true, phone: true } } },
          },
          address: true,
          items: { include: { product: true } },
          payments: true,
          history: { orderBy: { createdAt: 'asc' } },
        },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          previousStatus: order.status,
          newStatus: OrderStatus.CANCELLED,
          changedByUserId: distributorUserId,
          reason: `Cancelled by distributor: ${dto.reason.trim()}`,
        },
      });

      return updated;
    });
  }

  async deleteDistributorOrder(orderId: string, distributorUserId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException(`Order not found: ${orderId}`);
    }

    if (order.distributorId && order.distributorId !== distributorUserId) {
      throw new ForbiddenException('You are not authorized to delete this order');
    }

    if (
      order.status === OrderStatus.OUT_FOR_DELIVERY ||
      order.status === OrderStatus.DELIVERED ||
      order.status === OrderStatus.COMPLETED
    ) {
      throw new BadRequestException(
        'Finalized or dispatched orders cannot be deleted. Please use cancellation instead.',
      );
    }

    await this.prisma.order.delete({
      where: { id: order.id },
    });

    return { message: 'Order successfully deleted', orderId };
  }

  // =========================================================================
  // DISTRIBUTOR NEW ORDER QUEUE & ATOMIC ACCEPTANCE
  // =========================================================================

  async findDistributorNewOrders(query?: {
    page?: number | string;
    limit?: number | string;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    const page = Math.max(1, parseInt(String(query?.page || 1), 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(String(query?.limit || 20), 10) || 20));
    const skip = (page - 1) * limit;

    const baseCondition: any = {
      assignmentStatus: 'UNASSIGNED',
      distributorId: null,
      status: {
        notIn: [OrderStatus.DELIVERED, OrderStatus.COMPLETED, OrderStatus.CANCELLED],
      },
    };

    const where: any = { ...baseCondition };

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

    let orderBy: any = { createdAt: 'desc' };
    const sortDir = query?.sortOrder === 'asc' ? 'asc' : 'desc';
    if (query?.sortBy === 'total') {
      orderBy = { totalAmount: sortDir };
    } else if (query?.sortBy === 'orderDate') {
      orderBy = { createdAt: sortDir };
    } else if (query?.sortBy === 'customer') {
      orderBy = { customer: { user: { firstName: sortDir } } };
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [totalMatching, orders, allStats] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        include: {
          customer: {
            include: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  phone: true,
                  email: true,
                  id: true,
                },
              },
            },
          },
          address: true,
          items: {
            include: {
              product: {
                select: { id: true, name: true, price: true, isJar: true },
              },
            },
          },
          payments: {
            select: { id: true, amount: true, status: true, provider: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
      Promise.all([
        this.prisma.order.count({ where: baseCondition }),
        this.prisma.order.count({
          where: {
            ...baseCondition,
            createdAt: { gte: todayStart },
          },
        }),
        this.prisma.order.aggregate({
          _sum: { totalAmount: true },
          where: baseCondition,
        }),
      ]),
    ]);

    const [queueCount, todayCount, valueAgg] = allStats;
    const totalQueueValue = Number(valueAgg._sum.totalAmount || 0);

    const transformedOrders = orders.map((o) => {
      const totalQty = o.items.reduce((sum, item) => sum + item.quantity, 0);
      const paidAmount = o.payments
        .filter((p) => p.status === PaymentStatus.PAID || p.status === PaymentStatus.SUCCESS)
        .reduce((sum, p) => sum + p.amount, 0);
      const dueAmount = Math.max(0, Number((o.totalAmount - paidAmount).toFixed(2)));

      return {
        ...o,
        totalQuantity: totalQty,
        amountPaid: paidAmount,
        amountDue: dueAmount,
      };
    });

    return {
      data: transformedOrders,
      pagination: {
        total: totalMatching,
        page,
        limit,
        totalPages: Math.ceil(totalMatching / limit) || 1,
      },
      stats: {
        queueCount,
        todayCount,
        totalQueueValue,
      },
    };
  }

  async acceptDistributorOrder(orderId: string, distributorUserId: string) {
    // 1. Verify distributor user exists
    const user = await this.prisma.user.findUnique({
      where: { id: distributorUserId },
    });
    if (!user) {
      throw new NotFoundException('Distributor user not found');
    }

    // 2. Atomic conditional SQL update to claim the order
    // Concurrency guarantee: exactly one execution can match assignmentStatus='UNASSIGNED' and distributorId IS NULL
    const rowsAffected = await this.prisma.$executeRaw`
      UPDATE "Order"
      SET "distributorId" = ${distributorUserId},
          "assignmentStatus" = 'ASSIGNED',
          "acceptedAt" = NOW(),
          "acceptedById" = ${distributorUserId},
          "status" = 'CONFIRMED'::"OrderStatus",
          "updatedAt" = NOW()
      WHERE "id" = ${orderId}
        AND "assignmentStatus" = 'UNASSIGNED'
        AND "distributorId" IS NULL
    `;

    if (rowsAffected === 0) {
      throw new ConflictException(
        'This order has already been accepted by another distributor.',
      );
    }

    // 3. Fetch the fully updated order details
    const fullOrder = await this.prisma.order.findUnique({
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
            product: true,
          },
        },
        payments: {
          orderBy: { createdAt: 'desc' },
        },
        history: {
          include: { user: { select: { firstName: true, lastName: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    // 4. Create audit status history record
    await this.prisma.orderStatusHistory.create({
      data: {
        orderId,
        previousStatus: OrderStatus.ORDER_PLACED,
        newStatus: OrderStatus.CONFIRMED,
        changedByUserId: distributorUserId,
        reason: 'Order claimed and accepted by Distributor from New Order Queue',
      },
    });

    // 5. Broadcast real-time events via WebSocket to Customer, Distributor, and Admin
    try {
      this.eventsGateway.emitOrderClaimed(orderId, distributorUserId, fullOrder);
      if (fullOrder) {
        this.eventsGateway.emitOrderStatusUpdate(
          orderId,
          OrderStatus.CONFIRMED,
          fullOrder.customerId,
          fullOrder,
        );
      }
    } catch (err) {
      console.warn('[OrderService] emitOrderClaimed / emitOrderStatusUpdate error:', err);
    }

    return fullOrder;
  }
}

