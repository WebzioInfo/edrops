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
  ReleaseDistributorOrderDto,
  CancelOrderDto,
  VerifyDeliveryPinDto,
  CompleteDeliveryDto,
} from './dto/distributor-order.dto';
import { isValidTransition, isPartnerAllowedTransition, VALID_ORDER_TRANSITIONS } from './order-state-machine';
import { generateDeliveryOtp } from './utils/delivery-otp.util';

@Injectable()
export class OrderService {
  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
    private eventsGateway: EventsGateway,
  ) {}

  async findAll(customerId: string) {
    const orders = await this.prisma.order.findMany({
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
        payments: { orderBy: { createdAt: 'desc' } },
        cancelledBy: { select: { id: true, firstName: true, lastName: true, role: true } },
        history: {
          include: { user: { select: { firstName: true, lastName: true, role: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return orders.map((o) => {
      const paidAmount = (o.payments || [])
        .filter((p) => p.status === PaymentStatus.PAID || p.status === PaymentStatus.SUCCESS)
        .reduce((sum, p) => sum + p.amount, 0);
      const dueAmount = Math.max(0, Number((o.totalAmount - paidAmount).toFixed(2)));
      return { ...o, amountPaid: paidAmount, amountDue: dueAmount };
    });
  }


  async findStaffAll(query?: {
    page?: number | string;
    limit?: number | string;
    search?: string;
    status?: string;
    type?: string;
    paymentStatus?: string;
  }) {
    const page = Math.max(1, parseInt(String(query?.page || 1), 10) || 1);
    const limit = Math.max(1, Math.min(1000, parseInt(String(query?.limit || 15), 10) || 15));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query?.status && query.status !== 'ALL') {
      if (query.status === 'PENDING' || query.status === 'NEW' || query.status === 'ORDER_PLACED') {
        where.status = {
          in: [
            OrderStatus.NEW,
            OrderStatus.ORDER_PLACED,
            OrderStatus.PENDING_PAYMENT,
            OrderStatus.PENDING_ASSIGNMENT,
          ],
        };
      } else if (query.status === 'ACTIVE') {
        where.status = {
          in: [
            OrderStatus.CONFIRMED,
            OrderStatus.PROCESSING,
            OrderStatus.READY,
            OrderStatus.ASSIGNED,
            OrderStatus.ACCEPTED_BY_PARTNER,
            OrderStatus.OUT_FOR_DELIVERY,
          ],
        };
      } else if (query.status === 'DELIVERED') {
        where.status = { in: [OrderStatus.DELIVERED, OrderStatus.COMPLETED] };
      } else if (query.status === 'CANCELLED') {
        where.status = OrderStatus.CANCELLED;
      } else {
        where.status = query.status as OrderStatus;
      }
    }

    if (query?.type && query.type !== 'ALL') {
      where.orderType = query.type as OrderType;
    }

    if (query?.search?.trim()) {
      const q = query.search.trim();
      where.OR = [
        { id: { contains: q, mode: 'insensitive' } },
        { customer: { user: { firstName: { contains: q, mode: 'insensitive' } } } },
        { customer: { user: { lastName: { contains: q, mode: 'insensitive' } } } },
        { customer: { user: { phone: { contains: q, mode: 'insensitive' } } } },
        { customer: { companyName: { contains: q, mode: 'insensitive' } } },
        { distributor: { firstName: { contains: q, mode: 'insensitive' } } },
        { distributor: { lastName: { contains: q, mode: 'insensitive' } } },
        { driver: { name: { contains: q, mode: 'insensitive' } } },
        { driver: { phone: { contains: q, mode: 'insensitive' } } },
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
          distributor: {
            select: { id: true, firstName: true, lastName: true, phone: true, email: true },
          },
          driver: {
            select: {
              id: true,
              name: true,
              phone: true,
              vehicleNumber: true,
              vehicleType: true,
              isActive: true,
              routeOrArea: true,
              pincode: true,
            },
          },
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
              user: { select: { firstName: true, lastName: true, role: true } },
            },
            orderBy: { createdAt: 'asc' },
          },
          payments: { orderBy: { createdAt: 'desc' } },
          cancelledBy: { select: { id: true, firstName: true, lastName: true, role: true } },
          distributorAssignments: {
            include: {
              distributor: { select: { id: true, firstName: true, lastName: true, phone: true } },
            },
            orderBy: { acceptedAt: 'asc' },
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
            status: {
              in: [
                OrderStatus.NEW,
                OrderStatus.ORDER_PLACED,
                OrderStatus.PENDING_PAYMENT,
                OrderStatus.PENDING_ASSIGNMENT,
              ],
            },
          },
        }),
        this.prisma.order.count({
          where: {
            status: {
              in: [
                OrderStatus.CONFIRMED,
                OrderStatus.PROCESSING,
                OrderStatus.READY,
                OrderStatus.ASSIGNED,
                OrderStatus.ACCEPTED_BY_PARTNER,
                OrderStatus.OUT_FOR_DELIVERY,
              ],
            },
          },
        }),
        this.prisma.order.count({
          where: { createdAt: { gte: todayStart } },
        }),
        this.prisma.order.count({
          where: { status: { in: [OrderStatus.DELIVERED, OrderStatus.COMPLETED] } },
        }),
        this.prisma.order.count({
          where: { status: OrderStatus.CANCELLED },
        }),
        this.prisma.order.aggregate({
          _sum: { totalAmount: true },
          where: {
            OR: [
              { paymentStatus: PaymentStatus.SUCCESS },
              { paymentStatus: PaymentStatus.PAID },
              { status: { in: [OrderStatus.DELIVERED, OrderStatus.COMPLETED] } },
            ],
          },
        }),
      ]),
    ]);

    const [
      totalOrders,
      pendingCount,
      activeCount,
      todayCount,
      deliveredCount,
      cancelledCount,
      revenueAggregate,
    ] = allStats;

    const transformedOrders = (orders as any[]).map((o) => {
      const paidAmount = (o.payments || [])
        .filter((p: any) => p.status === PaymentStatus.PAID || p.status === PaymentStatus.SUCCESS)
        .reduce((sum: number, p: any) => sum + p.amount, 0);
      const dueAmount = Math.max(0, Number((o.totalAmount - paidAmount).toFixed(2)));
      return { ...o, amountPaid: paidAmount, amountDue: dueAmount };
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
        activeCount,
        todayCount,
        deliveredCount,
        cancelledCount,
        totalRevenue: Number(revenueAggregate._sum.totalAmount || 0),
      },
    };
  }

  async findOne(orderId: string, currentUser?: any) {
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
        cancelledBy: { select: { id: true, firstName: true, lastName: true, role: true } },
        distributorAssignments: {
          include: {
            distributor: { select: { id: true, firstName: true, lastName: true, phone: true } },
          },
          orderBy: { acceptedAt: 'asc' },
        },
        driver: {
          select: {
            id: true,
            name: true,
            phone: true,
            vehicleNumber: true,
            vehicleType: true,
            isActive: true,
            routeOrArea: true,
            pincode: true,
          },
        },
        jarAllocations: {
          include: {
            jarItem: true,
          },
        },
        deliveryVerification: true,
      },
    });

    if (!order) throw new NotFoundException(`Order not found: ${orderId}`);

    const paidAmount = (order.payments || [])
      .filter((p: any) => p.status === PaymentStatus.PAID || p.status === PaymentStatus.SUCCESS)
      .reduce((sum: number, p: any) => sum + p.amount, 0);
    const dueAmount = Math.max(0, Number((order.totalAmount - paidAmount).toFixed(2)));

    // Security: Only the customer who placed this order can see the raw OTP.
    const isCustomerOwner =
      currentUser &&
      (currentUser.id === order.customer?.user?.id ||
        currentUser.id === order.customer?.userId ||
        currentUser.sub === order.customer?.user?.id ||
        currentUser.sub === order.customer?.userId ||
        currentUser.customerId === order.customerId);

    let sanitizedVerification = order.deliveryVerification;
    if (sanitizedVerification && !isCustomerOwner) {
      sanitizedVerification = {
        ...sanitizedVerification,
        otp: undefined as any,
      };
    }

    return {
      ...order,
      deliveryVerification: sanitizedVerification,
      amountPaid: paidAmount,
      amountDue: dueAmount,
      orderTotal: order.totalAmount,
      totalPaid: paidAmount,
      dueAmount,
    };
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

    const orders = await this.prisma.order.findMany({
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
        payments: { orderBy: { createdAt: 'desc' } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    return orders.map((o: any) => {
      const paidAmount = (o.payments || [])
        .filter((p: any) => p.status === PaymentStatus.PAID || p.status === PaymentStatus.SUCCESS)
        .reduce((sum: number, p: any) => sum + p.amount, 0);
      const dueAmount = Math.max(0, Number((o.totalAmount - paidAmount).toFixed(2)));
      return {
        ...o,
        amountPaid: paidAmount,
        amountDue: dueAmount,
        orderTotal: o.totalAmount,
        totalPaid: paidAmount,
        dueAmount,
      };
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
          deliveryVerification: {
            create: {
              otp: generateDeliveryOtp(),
            },
          },
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
      this.notificationService.notifyOrderPlaced({
        orderId: newOrder.id,
        customerId: customer.id,
        userId: customer.user?.id || (customer as any).userId,
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

    // Cancellation mandatory reason validation
    if (newStatus === OrderStatus.CANCELLED) {
      if (!reason?.trim()) {
        throw new BadRequestException('Cancellation reason is required when cancelling an order.');
      }
    }

    // 4. Central state machine validation
    if (!isAdminOverride && !isValidTransition(order.status, newStatus)) {
      throw new BadRequestException(
        'Invalid status transition from ' + order.status + ' to ' + newStatus,
      );
    }

    // Enforce complete delivery verification & reconciliation flow for DELIVERED
    if (newStatus === OrderStatus.DELIVERED) {
      throw new BadRequestException(
        'Delivery PIN verification and jar reconciliation are mandatory before marking an order as Delivered. Please use the complete delivery flow.',
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
      // Acquire exclusive row lock on the Order to prevent concurrent race conditions
      await tx.$executeRaw`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`;

      let targetPaymentStatus = order.paymentStatus;
      let targetPaymentMethod = order.paymentMethod;
      let deliveredAt = order.deliveredAt;

      const isDelivering = (newStatus as any) === OrderStatus.DELIVERED || newStatus === OrderStatus.COMPLETED;
      const isAlreadyPaid = order.paymentStatus === PaymentStatus.SUCCESS;

      if (isDelivering) {
        deliveredAt = new Date();

        if (paymentConfirmation) {
          if (paymentConfirmation.paymentReceived) {
            const existingPayments = await tx.payment.findMany({
              where: { orderId, status: PaymentStatus.SUCCESS },
            });
            const priorPaid = existingPayments.reduce((acc, p) => acc + Number(p.amount || 0), 0);
            const remainingDue = Math.max(0, Number(order.totalAmount || 0) - priorPaid);

            const paidAmt = paymentConfirmation.amountReceived !== undefined && paymentConfirmation.amountReceived !== null
              ? Number(paymentConfirmation.amountReceived)
              : remainingDue;

            if (paidAmt <= 0 && remainingDue > 0) {
              throw new BadRequestException('Amount received must be greater than 0 when payment is received.');
            }

            if (paidAmt > remainingDue + 0.01) {
              throw new BadRequestException(`Payment amount ₹${paidAmt} exceeds remaining due balance of ₹${remainingDue.toFixed(2)}.`);
            }

            const newTotalPaid = Math.round((priorPaid + paidAmt) * 100) / 100;
            const newDue = Math.max(0, Math.round((Number(order.totalAmount || 0) - newTotalPaid) * 100) / 100);

            targetPaymentStatus = newDue <= 0 ? PaymentStatus.SUCCESS : PaymentStatus.PARTIALLY_PAID;
            targetPaymentMethod = paymentConfirmation.paymentMethod || order.paymentMethod || 'CASH';

            if (paidAmt > 0) {
              // Create payment record in DB
              const deliveryPayment = await tx.payment.create({
                data: {
                  orderId,
                  customerId: order.customerId,
                  amount: paidAmt,
                  currency: 'INR',
                  status: PaymentStatus.SUCCESS,
                  provider: targetPaymentMethod,
                  receiptId: `RCP-DELIVERY-${Date.now()}`,
                  description: `Payment collected upon delivery`,
                },
              });

              // Create PaymentAuditLog record
              await tx.paymentAuditLog.create({
                data: {
                  paymentId: deliveryPayment.id,
                  action: 'COLLECT',
                  previousStatus: order.paymentStatus,
                  newStatus: targetPaymentStatus,
                  notes: `Collected ₹${paidAmt} upon delivery. Prior paid: ₹${priorPaid}, new remaining due: ₹${newDue}. (by ${staffUserId || 'DELIVERY_PARTNER'})`,
                },
              });
            }
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
          ...(newStatus === OrderStatus.CANCELLED
            ? {
                cancelledAt: new Date(),
                cancelledById: staffUserId,
                cancellationReason: reason?.trim(),
                assignmentStatus: 'CANCELLED',
              }
            : {}),
        },
        include: {
          payments: true,
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
          cancelledBy: { select: { id: true, firstName: true, lastName: true, role: true } },
          distributorAssignments: {
            include: {
              distributor: { select: { id: true, firstName: true, lastName: true, phone: true } },
            },
            orderBy: { acceptedAt: 'asc' },
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

      // Close active distributor assignment if cancelled
      if (newStatus === OrderStatus.CANCELLED) {
        await tx.distributorOrderAssignment.updateMany({
          where: { orderId, status: 'ACCEPTED' },
          data: {
            status: 'RELEASED',
            releasedAt: new Date(),
            releaseReason: `Order cancelled by staff: ${reason?.trim()}`,
          },
        });
      } else if ((newStatus as any) === OrderStatus.DELIVERED || newStatus === OrderStatus.COMPLETED) {
        await tx.distributorOrderAssignment.updateMany({
          where: { orderId, status: 'ACCEPTED' },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
          },
        });
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
            status: (newStatus as any) === OrderStatus.DELIVERED || newStatus === OrderStatus.COMPLETED
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

      const allPayments = await tx.payment.findMany({
        where: { orderId, status: PaymentStatus.SUCCESS },
      });
      const finalPaid = allPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
      const finalDue = Math.max(0, Math.round((Number(updated.totalAmount || 0) - finalPaid) * 100) / 100);

      return {
        ...updated,
        amountPaid: finalPaid,
        amountDue: finalDue,
        orderTotal: Number(updated.totalAmount || 0),
        totalPaid: finalPaid,
        dueAmount: finalDue,
      };
    });

    // 4. Fire notifications and socket broadcasts
    try {
      this.notificationService.notifyOrderStatusUpdate({
        orderId,
        customerId: order.customerId,
        userId: order.customer?.userId || order.customer?.user?.id,
        newStatus,
      });
      const deliveredQty = updatedOrder.items?.reduce((sum: number, it: any) => sum + (it.quantity || 0), 0);
      this.notificationService.notifyOrderStatusTransition({
        orderId,
        customerId: order.customerId,
        userId: order.customer?.userId || order.customer?.user?.id,
        newStatus,
        previousStatus: order.status,
        reason,
        deliveredQty,
        deliveredAt: updatedOrder.deliveredAt || new Date(),
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

  async assignStaffDistributor(orderId: string, distributorId: string, staffUserId: string) {
    if (!distributorId) {
      throw new BadRequestException('Distributor ID is required');
    }

    // 1. Verify that target user is an active user with role DISTRIBUTOR
    const distributorUser = await this.prisma.user.findUnique({
      where: { id: distributorId },
      select: { id: true, role: true, firstName: true, lastName: true, phone: true, email: true },
    });

    if (!distributorUser || distributorUser.role !== 'DISTRIBUTOR') {
      throw new BadRequestException('The selected user is not a valid distributor.');
    }

    // 2. Fetch current order to validate assignment rules
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: { include: { user: true } },
        distributor: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`Order not found: ${orderId}`);
    }

    // Rule: Staff may assign ONLY when order status = ORDER PLACED (or unassigned initial state)
    const isOrderPlaced =
      order.status === OrderStatus.ORDER_PLACED ||
      order.status === OrderStatus.NEW ||
      order.status === OrderStatus.PENDING_ASSIGNMENT;

    if (!isOrderPlaced) {
      throw new ConflictException(
        `Cannot assign distributor: order is already in status ${order.status}. Only ORDER PLACED orders can be assigned.`,
      );
    }

    // Rule: Cannot assign/reassign if order is already assigned
    if (order.distributorId || order.assignmentStatus === 'ASSIGNED') {
      throw new ConflictException(
        'This order has already been accepted or assigned to a distributor and cannot be reassigned.',
      );
    }

    // 3. Atomic row-level conditional SQL update to prevent race conditions with simultaneous Distributor Accept
    const rowsAffected = await this.prisma.$executeRaw`
      UPDATE "Order"
      SET "distributorId" = ${distributorId},
          "assignmentStatus" = 'ASSIGNED',
          "acceptedAt" = NOW(),
          "acceptedById" = ${staffUserId},
          "status" = 'CONFIRMED'::"OrderStatus",
          "updatedAt" = NOW()
      WHERE "id" = ${orderId}
        AND ("status" = 'ORDER_PLACED'::"OrderStatus" OR "status" = 'NEW'::"OrderStatus" OR "status" = 'PENDING_ASSIGNMENT'::"OrderStatus")
        AND "distributorId" IS NULL
        AND "assignmentStatus" = 'UNASSIGNED';
    `;

    if (rowsAffected === 0) {
      throw new ConflictException(
        'This order has already been accepted or assigned to another distributor.',
      );
    }

    // 4. Fetch updated order
    const updatedOrder = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: {
          include: {
            user: { select: { firstName: true, lastName: true, phone: true, email: true, id: true } },
          },
        },
        distributor: {
          select: { id: true, firstName: true, lastName: true, phone: true, email: true },
        },
        address: true,
        items: {
          include: {
            product: { include: { images: true, brand: true } },
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

    // 5. Create audit history
    await this.prisma.orderStatusHistory.create({
      data: {
        orderId,
        previousStatus: order.status,
        newStatus: OrderStatus.CONFIRMED,
        changedByUserId: staffUserId,
        reason: `Assigned to Distributor ${distributorUser.firstName} ${distributorUser.lastName} by Staff`,
      },
    });

    // 6. Emit real-time updates across portals
    try {
      // Notify assigned distributor and remove from other distributors' new order queues
      this.eventsGateway.emitOrderClaimed(orderId, distributorId, updatedOrder);
      // Notify customer and staff channels of status transition to CONFIRMED
      this.eventsGateway.emitOrderStatusUpdate(
        orderId,
        OrderStatus.CONFIRMED,
        order.customerId,
        updatedOrder,
      );
      this.eventsGateway.server?.to(`distributor:${distributorId}`).emit('ORDER_ASSIGNED_TO_YOU', {
        orderId,
        order: updatedOrder,
      });
      this.eventsGateway.server?.to('staff-notifications').emit('order:assigned', updatedOrder);
      this.eventsGateway.server?.to('staff-notifications').emit('order:updated', updatedOrder);
      this.notificationService.notifyDistributorOrderAssigned({
        orderId,
        distributorUserId: distributorId,
      });
    } catch (e) {
      console.warn('[OrderService] Staff assign realtime broadcast warning:', e);
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
    const limit = Math.max(1, Math.min(5000, parseInt(String(query?.limit || 25), 10) || 25));
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
      } else if (['THIS_WEEK', '7D', 'LAST_7_DAYS', '7_DAYS'].includes(query.datePreset.toUpperCase())) {
        const weekStart = new Date(now);
        weekStart.setDate(weekStart.getDate() - 6);
        weekStart.setHours(0, 0, 0, 0);
        where.createdAt = { gte: weekStart };
      } else if (['30D', 'LAST_30_DAYS', '30_DAYS'].includes(query.datePreset.toUpperCase())) {
        const d30Start = new Date(now);
        d30Start.setDate(d30Start.getDate() - 29);
        d30Start.setHours(0, 0, 0, 0);
        where.createdAt = { gte: d30Start };
      } else if (['THIS_MONTH', 'MONTH'].includes(query.datePreset.toUpperCase())) {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        monthStart.setHours(0, 0, 0, 0);
        where.createdAt = { gte: monthStart };
      } else if (['PREV_MONTH', 'LAST_MONTH', 'PREVIOUS_MONTH'].includes(query.datePreset.toUpperCase())) {
        const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
        const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        where.createdAt = { gte: prevMonthStart, lte: prevMonthEnd };
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
          driver: true,
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
          cancelledBy: { select: { id: true, firstName: true, lastName: true, role: true } },
          distributorAssignments: {
            include: {
              distributor: { select: { id: true, firstName: true, lastName: true, phone: true } },
            },
            orderBy: { acceptedAt: 'asc' },
          },
          jarAllocations: {
            include: {
              jarItem: true,
            },
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
        driver: true,
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
        jarAllocations: {
          include: {
            jarItem: true,
          },
        },
        deliveryVerification: true,
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

    // Distributor must never see the customer's raw OTP
    const sanitizedVerification = order.deliveryVerification
      ? { ...order.deliveryVerification, otp: undefined as any }
      : null;

    return {
      ...order,
      deliveryVerification: sanitizedVerification,
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
          deliveryVerification: {
            create: {
              otp: generateDeliveryOtp(),
            },
          },
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
          driver: true,
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
      include: { history: true, payments: true },
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

    if (dto.status === OrderStatus.DELIVERED) {
      return this.completeDelivery(
        orderId,
        distributorUserId,
        {
          pin: dto.pin,
          items: dto.deliveredItems || [],
          shortDeliveryReason: dto.shortDeliveryReason,
          note: dto.deliveryNote,
          paymentInfo: dto.paymentInfo,
        },
        UserRole.DISTRIBUTOR,
      );
    }

    const deliveredAt =
      (dto.status as any) === OrderStatus.DELIVERED || dto.status === OrderStatus.COMPLETED
        ? new Date()
        : order.deliveredAt;

    const isDelivering = (dto.status as any) === OrderStatus.DELIVERED || dto.status === OrderStatus.COMPLETED;

    const updated = await this.prisma.$transaction(async (tx) => {
      // 1. Acquire exclusive DB row lock to serialize status and financial mutations
      await tx.$executeRaw`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`;

      // 2. Read fresh order and payment records inside the locked transaction
      const freshOrder = await tx.order.findUnique({
        where: { id: orderId },
        include: {
          payments: true,
          items: { include: { product: true } },
          driver: true,
          jarAllocations: { include: { jarItem: true } },
        },
      });

      if (!freshOrder) {
        throw new NotFoundException(`Order not found: ${orderId}`);
      }

      // Mandatory OUT_FOR_DELIVERY validations and jar allocation
      if (dto.status === OrderStatus.OUT_FOR_DELIVERY) {
        if (!freshOrder.driverId) {
          throw new BadRequestException('Assign a driver before moving this order Out for Delivery.');
        }

        const jarItems = (freshOrder.items || []).filter((i) => i.product?.isJar !== false);
        const requiredJars = jarItems.length > 0
          ? jarItems.reduce((acc, i) => acc + i.quantity, 0)
          : (freshOrder.items || []).reduce((acc, i) => acc + i.quantity, 0);

        if (!dto.allocations || !Array.isArray(dto.allocations) || dto.allocations.length === 0) {
          throw new BadRequestException(
            `Allocate all ${requiredJars} jars before sending the order Out for Delivery.`,
          );
        }

        let totalAllocated = 0;
        for (const alloc of dto.allocations) {
          const qty = Number(alloc.quantity);
          if (isNaN(qty) || qty <= 0) {
            throw new BadRequestException('Allocation quantity must be greater than 0.');
          }
          totalAllocated += qty;
        }

        if (totalAllocated < requiredJars) {
          throw new BadRequestException(
            `Allocate all ${requiredJars} jars before sending the order Out for Delivery.`,
          );
        }
        if (totalAllocated > requiredJars) {
          throw new BadRequestException(
            `Allocated quantity cannot exceed the order quantity of ${requiredJars} jars.`,
          );
        }

        const distributor = await tx.distributor.findUnique({
          where: { userId: distributorUserId },
          select: { id: true },
        });
        if (!distributor) {
          throw new NotFoundException('Distributor profile not found');
        }

        const jarItemIds = dto.allocations.map((a) => a.jarItemId);

        // Acquire exclusive row locks on the inventory items to ensure serial consistency
        await tx.$executeRaw`
          SELECT "id" FROM "jar_inventory_items"
          WHERE "id" = ANY(${jarItemIds})
          FOR UPDATE
        `;

        const dbJarItems = await tx.jarInventoryItem.findMany({
          where: { id: { in: jarItemIds } },
        });

        for (const alloc of dto.allocations) {
          const dbItem = dbJarItems.find((i) => i.id === alloc.jarItemId);
          if (!dbItem || dbItem.distributorId !== distributor.id) {
            throw new ForbiddenException('Invalid or unauthorized jar inventory item');
          }
          const availableStock = dbItem.filledYardQuantity - dbItem.reservedQuantity;
          if (alloc.quantity > availableStock) {
            const displayName = dbItem.ownershipType === 'COMPANY' ? 'Biodrops' : dbItem.name;
            throw new BadRequestException(`Only ${availableStock} ${displayName} jars are available in yard.`);
          }
        }

        // Persist jar allocations and update physical jar state:
        // Jars physically leave the yard and move to customer custody (OUT_FOR_DELIVERY)
        await tx.orderJarAllocation.deleteMany({ where: { orderId } });

        const orderRef = `ORD-${freshOrder.id.slice(0, 8).toUpperCase()}`;

        for (const alloc of dto.allocations) {
          const dbItem = dbJarItems.find((i) => i.id === alloc.jarItemId)!;

          await tx.orderJarAllocation.create({
            data: {
              orderId,
              jarItemId: dbItem.id,
              quantity: alloc.quantity,
              deliveredQuantity: null,
              undeliveredQuantity: null,
              returnedQuantity: 0,
            },
          });

          // State transition: FILLED_YARD -> CUSTOMER
          // Total ownership (ownedQuantity) is preserved!
          await tx.jarInventoryItem.update({
            where: { id: dbItem.id },
            data: {
              filledYardQuantity: { decrement: alloc.quantity },
              customerQuantity: { increment: alloc.quantity },
            },
          });

          await tx.inventoryLog.create({
            data: {
              distributorId: distributor.id,
              jarItemId: dbItem.id,
              ownership: dbItem.ownershipType === 'COMPANY' ? 'COMPANY_OWNED' : 'DISTRIBUTOR_OWNED',
              action: 'OUT_FOR_DELIVERY',
              fromState: 'FILLED_YARD',
              toState: 'CUSTOMER',
              quantity: alloc.quantity,
              balanceAfter: dbItem.ownedQuantity,
              referenceId: orderRef,
              orderId: freshOrder.id,
              customerId: freshOrder.customerId,
              description: `${alloc.quantity} jars dispatched for delivery (Yard -> Customer)`,
              createdById: distributorUserId,
            },
          });
        }
      }

      // Rollback allocations if order was OUT_FOR_DELIVERY and transitions to CANCELLED
      if (freshOrder.status === OrderStatus.OUT_FOR_DELIVERY && dto.status === OrderStatus.CANCELLED) {
        const allocations = await tx.orderJarAllocation.findMany({
          where: { orderId },
          include: { jarItem: true },
        });
        const orderRef = `ORD-${freshOrder.id.slice(0, 8).toUpperCase()}`;
        for (const alloc of allocations) {
          await tx.$executeRaw`
            SELECT "id" FROM "jar_inventory_items" WHERE "id" = ${alloc.jarItemId} FOR UPDATE
          `;
          const updatedItem = await tx.jarInventoryItem.update({
            where: { id: alloc.jarItemId },
            data: {
              customerQuantity: { decrement: alloc.quantity },
              filledYardQuantity: { increment: alloc.quantity },
            },
          });
          await tx.inventoryLog.create({
            data: {
              distributorId: alloc.jarItem.distributorId,
              jarItemId: alloc.jarItemId,
              ownership: alloc.jarItem.ownershipType === 'COMPANY' ? 'COMPANY_OWNED' : 'DISTRIBUTOR_OWNED',
              action: 'ORDER_CANCELLED',
              fromState: 'CUSTOMER',
              toState: 'FILLED_YARD',
              quantity: alloc.quantity,
              balanceAfter: updatedItem.ownedQuantity,
              referenceId: orderRef,
              orderId: freshOrder.id,
              customerId: freshOrder.customerId,
              description: `Order #${orderRef} cancelled while out for delivery: ${alloc.quantity} jars returned to yard`,
              createdById: distributorUserId,
            },
          });
        }
      }

      const currentPaid = (freshOrder.payments || [])
        .filter((p) => p.status === PaymentStatus.PAID || p.status === PaymentStatus.SUCCESS)
        .reduce((sum, p) => sum + p.amount, 0);
      const remainingDue = Math.max(0, Number((freshOrder.totalAmount - currentPaid).toFixed(2)));

      let newPaymentStatus = freshOrder.paymentStatus;
      let paymentHistoryNote = '';

      if (isDelivering && dto.paymentInfo) {
        const { paymentMode, amountPaid: requestedPaid, paymentMethod } = dto.paymentInfo;
        const method = paymentMethod || freshOrder.paymentMethod || 'CASH';

        if (paymentMode === 'PARTIAL') {
          // Validate partial amount
          if (!requestedPaid || requestedPaid <= 0) {
            throw new BadRequestException('Partial payment amount must be greater than 0.');
          }
          if (requestedPaid > remainingDue + 0.01) {
            throw new BadRequestException(
              `Payment amount (₹${requestedPaid}) exceeds remaining balance (₹${remainingDue}).`,
            );
          }

          const newTotalPaid = Number((currentPaid + requestedPaid).toFixed(2));
          newPaymentStatus = newTotalPaid >= freshOrder.totalAmount
            ? PaymentStatus.PAID
            : PaymentStatus.PARTIALLY_PAID;

          const createdPayment = await tx.payment.create({
            data: {
              orderId: freshOrder.id,
              customerId: freshOrder.customerId,
              amount: requestedPaid,
              currency: 'INR',
              status: PaymentStatus.PAID,
              provider: method,
              receiptId: `RCP-DIST-DELV-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              description: `Partial payment on delivery: ₹${requestedPaid}`,
              createdAt: new Date(),
            },
          });

          await tx.paymentAuditLog.create({
            data: {
              paymentId: createdPayment.id,
              action: 'PAYMENT_COLLECTED_ON_DELIVERY',
              previousStatus: freshOrder.paymentStatus,
              newStatus: newPaymentStatus,
              notes: `Partial collected: ₹${requestedPaid} via ${method}. PrevPaid: ₹${currentPaid}, NewPaid: ₹${newTotalPaid}, RemainingDue: ₹${Number((freshOrder.totalAmount - newTotalPaid).toFixed(2))}`,
            },
          });

          paymentHistoryNote = `Delivered · Partial payment ₹${requestedPaid} received via ${method}. Due: ₹${Number((freshOrder.totalAmount - newTotalPaid).toFixed(2))}`;
        } else {
          // FULL payment (paymentMode === 'FULL' or default)
          if (remainingDue > 0) {
            const createdPayment = await tx.payment.create({
              data: {
                orderId: freshOrder.id,
                customerId: freshOrder.customerId,
                amount: remainingDue,
                currency: 'INR',
                status: PaymentStatus.PAID,
                provider: method,
                receiptId: `RCP-DIST-DELV-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                description: `Full payment on delivery: ₹${remainingDue}`,
                createdAt: new Date(),
              },
            });

            await tx.paymentAuditLog.create({
              data: {
                paymentId: createdPayment.id,
                action: 'PAYMENT_COLLECTED_ON_DELIVERY',
                previousStatus: freshOrder.paymentStatus,
                newStatus: PaymentStatus.PAID,
                notes: `Full payment collected: ₹${remainingDue} via ${method}. Order fully settled.`,
              },
            });
          }
          newPaymentStatus = PaymentStatus.PAID;
          paymentHistoryNote = `Delivered & Fully Paid ₹${freshOrder.totalAmount} via ${method}`;
        }
      } else if (isDelivering) {
        paymentHistoryNote = `Marked as Delivered (payment recorded separately)`;
      }

      const res = await tx.order.update({
        where: { id: orderId },
        data: {
          status: dto.status,
          deliveredAt,
          ...(isDelivering && dto.paymentInfo
            ? {
                paymentStatus: newPaymentStatus,
                paymentMethod: dto.paymentInfo.paymentMethod || freshOrder.paymentMethod,
              }
            : {}),
        },
        include: {
          customer: {
            include: {
              user: { select: { id: true, firstName: true, lastName: true, phone: true } },
            },
          },
          address: true,
          items: { include: { product: true } },
          payments: { orderBy: { createdAt: 'desc' } },
          history: {
            include: { user: { select: { firstName: true, lastName: true } } },
            orderBy: { createdAt: 'asc' },
          },
          cancelledBy: { select: { id: true, firstName: true, lastName: true, role: true } },
          distributorAssignments: {
            include: {
              distributor: { select: { id: true, firstName: true, lastName: true, phone: true } },
            },
            orderBy: { acceptedAt: 'asc' },
          },
          jarAllocations: {
            include: {
              jarItem: true,
            },
          },
        },
      });

      if (isDelivering) {
        await tx.distributorOrderAssignment.updateMany({
          where: {
            orderId,
            distributorId: distributorUserId,
            status: 'ACCEPTED',
          },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
          },
        });
      }

      const historyReason = paymentHistoryNote
        || dto.reason
        || `Status updated to ${dto.status} by Distributor`;

      await tx.orderStatusHistory.create({
        data: {
          orderId,
          previousStatus: freshOrder.status,
          newStatus: dto.status,
          changedByUserId: distributorUserId,
          reason: historyReason,
        },
      });

      // Attach authoritative computed payment fields
      const totalPaid = (res.payments || [])
        .filter((p: any) => p.status === PaymentStatus.PAID || p.status === PaymentStatus.SUCCESS)
        .reduce((sum: number, p: any) => sum + p.amount, 0);
      const amountDue = Math.max(0, Number((res.totalAmount - totalPaid).toFixed(2)));

      return {
        ...res,
        amountPaid: totalPaid,
        amountDue,
        orderTotal: res.totalAmount,
        totalPaid,
        dueAmount: amountDue,
      };
    });

    try {
      const deliveredQty = updated.items?.reduce((sum: number, it: any) => sum + (it.quantity || 0), 0);
      this.notificationService?.notifyOrderStatusTransition?.({
        orderId,
        customerId: order.customerId,
        userId: updated.customer?.user?.id || (updated.customer as any)?.userId,
        newStatus: dto.status,
        previousStatus: order.status,
        reason: dto.reason,
        deliveredQty,
        deliveredAt: updated.deliveredAt || new Date(),
      });
      this.eventsGateway?.emitOrderStatusUpdate?.(orderId, dto.status, order.customerId, updated);
    } catch (e) {
      console.warn('[OrderService] notification/socket broadcast warning:', e);
    }

    return updated;
  }

  /**
   * Verify 4-digit Delivery PIN
   */
  async verifyDeliveryPin(orderId: string, pin: string, actingUserId?: string, userRole?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        deliveryVerification: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`Order not found: ${orderId}`);
    }

    if (order.status !== OrderStatus.OUT_FOR_DELIVERY) {
      throw new BadRequestException(
        `Order must be Out for Delivery to verify delivery PIN (current status: ${order.status}).`,
      );
    }

    // Legacy order check: if no verification record was created upon order creation
    if (!order.deliveryVerification) {
      return {
        success: true,
        verified: true,
        isLegacy: true,
        message: 'Legacy order - Delivery PIN not required',
      };
    }

    if (order.deliveryVerification.status === 'VERIFIED') {
      return {
        success: true,
        verified: true,
        message: 'Delivery PIN verified',
      };
    }

    const enteredPin = (pin || '').trim();
    if (!enteredPin || enteredPin.length !== 4 || !/^\d{4}$/.test(enteredPin)) {
      throw new BadRequestException('Invalid delivery PIN. Please enter the PIN provided for this order.');
    }

    if (enteredPin !== order.deliveryVerification.otp) {
      throw new BadRequestException('Invalid delivery PIN. Please enter the PIN provided for this order.');
    }

    return {
      success: true,
      verified: true,
      message: 'Delivery PIN verified',
    };
  }

  /**
   * Complete delivery with OTP verification, quantity reconciliation, and inventory ledger updates
   */
  async completeDelivery(
    orderId: string,
    actingUserId: string,
    dto: CompleteDeliveryDto,
    actingUserRole?: string,
  ) {
    const freshOrder = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: { include: { user: true } },
        driver: true,
        jarAllocations: { include: { jarItem: true } },
        deliveryVerification: true,
        payments: true,
      },
    });

    if (!freshOrder) {
      throw new NotFoundException(`Order not found: ${orderId}`);
    }

    // Order status validation & idempotency protection
    if (freshOrder.status === OrderStatus.DELIVERED || freshOrder.status === OrderStatus.COMPLETED) {
      const isCustomerOwner =
        freshOrder.customer?.userId === actingUserId ||
        freshOrder.customerId === actingUserId;
      return {
        ...freshOrder,
        deliveryVerification: freshOrder.deliveryVerification
          ? {
              ...freshOrder.deliveryVerification,
              otp: isCustomerOwner ? freshOrder.deliveryVerification.otp : undefined,
            }
          : null,
      };
    }
    if (freshOrder.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Cannot complete delivery for a cancelled order.');
    }
    if (freshOrder.status !== OrderStatus.OUT_FOR_DELIVERY) {
      throw new BadRequestException(
        `Order must be in OUT_FOR_DELIVERY status before marking as Delivered (current status: ${freshOrder.status}).`,
      );
    }

    // Role-based authorization
    if (actingUserRole === UserRole.DISTRIBUTOR) {
      if (freshOrder.distributorId && freshOrder.distributorId !== actingUserId) {
        throw new ForbiddenException('You are not authorized to deliver this order.');
      }
    }

    // Delivery PIN validation (server-side enforcement)
    if (freshOrder.deliveryVerification) {
      const enteredPin = (dto.pin || '').trim();
      if (!enteredPin || enteredPin !== freshOrder.deliveryVerification.otp) {
        throw new BadRequestException('Invalid delivery PIN. Please enter the PIN provided for this order.');
      }
    }

    // Allocations & Quantity validation
    const allocations = freshOrder.jarAllocations || [];
    if (allocations.length === 0) {
      throw new BadRequestException('No jar allocations found for this Out for Delivery order.');
    }

    const itemsDto = dto.items || [];
    const itemDeliveredMap = new Map<string, number>();

    for (const item of itemsDto) {
      const qty = Number(item.deliveredQuantity);
      if (isNaN(qty) || qty < 0 || !Number.isInteger(qty)) {
        throw new BadRequestException('Delivered quantity must be a non-negative integer.');
      }
      itemDeliveredMap.set(item.jarItemId, qty);
    }

    // Process empty returns
    const returnedDto = dto.returnedItems || [];
    const itemReturnedMap = new Map<string, number>();
    for (const r of returnedDto) {
      const q = Number(r.returnedQuantity);
      if (!isNaN(q) && q >= 0 && Number.isInteger(q)) {
        itemReturnedMap.set(r.jarItemId, q);
      }
    }
    // Flat returnedQuantity fallback
    if (returnedDto.length === 0 && dto.returnedQuantity !== undefined) {
      const q = Number(dto.returnedQuantity);
      if (!isNaN(q) && q > 0 && allocations.length > 0) {
        itemReturnedMap.set(allocations[0].jarItemId, q);
      }
    }

    let totalOut = 0;
    let totalDelivered = 0;
    let totalReturned = 0;

    for (const alloc of allocations) {
      totalOut += alloc.quantity;
      const deliveredQty = itemDeliveredMap.has(alloc.jarItemId)
        ? itemDeliveredMap.get(alloc.jarItemId)!
        : alloc.quantity;

      if (deliveredQty < 0) {
        throw new BadRequestException('Delivered quantity cannot be negative.');
      }
      if (deliveredQty > alloc.quantity) {
        const itemName = alloc.jarItem?.name || (alloc.jarItem?.ownershipType === 'COMPANY' ? 'Biodrops' : alloc.jarItemId);
        throw new BadRequestException(
          `Delivered quantity (${deliveredQty}) cannot exceed Out for Delivery quantity (${alloc.quantity}) for jar item: ${itemName}.`,
        );
      }
      totalDelivered += deliveredQty;
      totalReturned += itemReturnedMap.get(alloc.jarItemId) ?? 0;
    }

    const totalUndelivered = totalOut - totalDelivered;

    // Validate that returned jars do not exceed customer-held jars
    const heldJars = freshOrder.customer?.jarsAtCustomer ?? 0;
    if (totalReturned > heldJars + totalDelivered) {
      throw new BadRequestException(
        `Customer currently holds only ${heldJars} jar(s). Cannot return ${totalReturned} jars.`,
      );
    }

    // Short delivery validation
    if (totalDelivered < totalOut) {
      if (!dto.shortDeliveryReason || !dto.shortDeliveryReason.trim()) {
        throw new BadRequestException('Reason for short delivery is required when delivered quantity is less than out-for-delivery quantity.');
      }
    }

    const orderRef = `ORD-${freshOrder.id.slice(0, 8).toUpperCase()}`;
    const baseHistoryReason = totalDelivered < totalOut
      ? `Delivered (${totalDelivered}/${totalOut} jars) · Short delivery: ${dto.shortDeliveryReason}`
      : `Delivered fully (${totalDelivered} jars) with PIN verification`;

    // Execute ATOMIC TRANSACTION
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Exclusive row lock on the Order to prevent concurrent deliveries
      await tx.$executeRaw`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`;

      // Double-check status under lock
      const lockedOrder = await tx.order.findUnique({
        where: { id: orderId },
        select: { status: true },
      });
      if (lockedOrder?.status === OrderStatus.DELIVERED || lockedOrder?.status === OrderStatus.COMPLETED) {
        return freshOrder;
      }
      if (lockedOrder?.status !== OrderStatus.OUT_FOR_DELIVERY) {
        throw new ConflictException('Order status changed during delivery processing.');
      }

      // Lock Customer row FOR UPDATE
      await tx.$executeRaw`SELECT "id" FROM "Customer" WHERE "id" = ${freshOrder.customerId} FOR UPDATE`;

      // 2. Exclusive row locks on inventory items
      const jarItemIds = allocations.map((a) => a.jarItemId);
      if (jarItemIds.length > 0) {
        await tx.$executeRaw`
          SELECT "id" FROM "jar_inventory_items"
          WHERE "id" = ANY(${jarItemIds})
          FOR UPDATE
        `;
      }

      const dbJarItems = await tx.jarInventoryItem.findMany({
        where: { id: { in: jarItemIds } },
      });

      // 3. Process each allocation: reconcile physical jar positions without altering ownership
      for (const alloc of allocations) {
        const dbItem = dbJarItems.find((i) => i.id === alloc.jarItemId);
        if (!dbItem) continue;

        const deliveredQty = itemDeliveredMap.has(alloc.jarItemId)
          ? itemDeliveredMap.get(alloc.jarItemId)!
          : alloc.quantity;
        const undeliveredQty = alloc.quantity - deliveredQty;
        const returnedQty = itemReturnedMap.get(alloc.jarItemId) ?? 0;
        const ownership = dbItem.ownershipType === 'COMPANY' ? 'COMPANY_OWNED' : 'DISTRIBUTOR_OWNED';

        // If undelivered jars: return from CUSTOMER back to FILLED_YARD
        if (undeliveredQty > 0) {
          await tx.jarInventoryItem.update({
            where: { id: alloc.jarItemId },
            data: {
              customerQuantity: { decrement: undeliveredQty },
              filledYardQuantity: { increment: undeliveredQty },
            },
          });

          const existingReturn = await tx.inventoryLog.findFirst({
            where: {
              distributorId: dbItem.distributorId,
              jarItemId: dbItem.id,
              action: 'UNDELIVERED_RETURN',
              referenceId: orderRef,
            },
          });

          if (!existingReturn) {
            await tx.inventoryLog.create({
              data: {
                distributorId: dbItem.distributorId,
                jarItemId: dbItem.id,
                ownership,
                action: 'UNDELIVERED_RETURN',
                fromState: 'CUSTOMER',
                toState: 'FILLED_YARD',
                quantity: undeliveredQty,
                balanceAfter: dbItem.ownedQuantity,
                referenceId: orderRef,
                orderId,
                customerId: freshOrder.customerId,
                description: `${undeliveredQty} jar${undeliveredQty === 1 ? '' : 's'} returned to yard after short delivery (${dto.shortDeliveryReason || 'Short delivery'}).`,
                createdById: actingUserId,
              },
            });
          }
        }

        // If empty jars returned: move from CUSTOMER to EMPTY_YARD
        if (returnedQty > 0) {
          await tx.jarInventoryItem.update({
            where: { id: alloc.jarItemId },
            data: {
              customerQuantity: { decrement: returnedQty },
              emptyYardQuantity: { increment: returnedQty },
            },
          });

          await tx.inventoryLog.create({
            data: {
              distributorId: dbItem.distributorId,
              jarItemId: dbItem.id,
              ownership,
              action: 'CUSTOMER_RETURN',
              fromState: 'CUSTOMER',
              toState: 'EMPTY_YARD',
              quantity: returnedQty,
              balanceAfter: dbItem.ownedQuantity,
              referenceId: orderRef,
              orderId,
              customerId: freshOrder.customerId,
              description: `${returnedQty} empty jar(s) returned by customer on delivery #${orderRef}.`,
              createdById: actingUserId,
            },
          });
        }

        // Update OrderJarAllocation with actual delivered, undelivered, and returned quantities
        await tx.orderJarAllocation.update({
          where: { id: alloc.id },
          data: {
            deliveredQuantity: deliveredQty,
            undeliveredQuantity: undeliveredQty,
            returnedQuantity: returnedQty,
          },
        });
      }

      // Net customer jar balance update: + delivered - returned
      const netCustomerJarChange = totalDelivered - totalReturned;
      if (netCustomerJarChange !== 0) {
        await tx.customer.update({
          where: { id: freshOrder.customerId },
          data: {
            jarsAtCustomer: { increment: netCustomerJarChange },
          },
        });
      }

      // Update OrderDeliveryVerification
      if (freshOrder.deliveryVerification) {
        await tx.orderDeliveryVerification.update({
          where: { orderId },
          data: {
            isVerified: true,
            status: 'VERIFIED',
            verifiedAt: new Date(),
            completedAt: new Date(),
            verifiedByUserId: actingUserId,
            shortDeliveryReason: totalDelivered < totalOut ? dto.shortDeliveryReason : null,
            deliveryNotes: dto.note || null,
            outForDeliveryQty: totalOut,
            deliveredQty: totalDelivered,
            undeliveredQty: totalUndelivered,
            returnedQty: totalReturned,
          },
        });
      } else {
        await tx.orderDeliveryVerification.create({
          data: {
            orderId,
            otp: '0000',
            isVerified: true,
            status: 'VERIFIED',
            verifiedAt: new Date(),
            completedAt: new Date(),
            verifiedByUserId: actingUserId,
            shortDeliveryReason: totalDelivered < totalOut ? dto.shortDeliveryReason : null,
            deliveryNotes: dto.note || null,
            outForDeliveryQty: totalOut,
            deliveredQty: totalDelivered,
            undeliveredQty: totalUndelivered,
            returnedQty: totalReturned,
          },
        });
      }

      // Record deposit refund if empty jars were returned
      if (totalReturned > 0 && tx.depositTransaction?.create) {
        const depositRefund = totalReturned * 200;
        await tx.depositTransaction.create({
          data: {
            customerId: freshOrder.customerId,
            type: 'JAR_RETURNED',
            amount: depositRefund,
            jarsAffected: totalReturned,
            balanceBefore: 0,
            balanceAfter: 0,
            referenceId: orderRef,
            description: `Deposit credit for ${totalReturned} returned jar(s) on #${orderRef}`,
          },
        });
      }

      // Update verifiedReturnQuantity on OrderItems
      if (tx.orderItem?.updateMany) {
        await tx.orderItem.updateMany({
          where: { orderId },
          data: {
            verifiedReturnQuantity: totalReturned,
          },
        });
      }

      // 5. Handle payment info if passed
      const currentPaid = (freshOrder.payments || [])
        .filter((p) => p.status === PaymentStatus.PAID || p.status === PaymentStatus.SUCCESS)
        .reduce((sum, p) => sum + p.amount, 0);
      const remainingDue = Math.max(0, Number((freshOrder.totalAmount - currentPaid).toFixed(2)));

      let newPaymentStatus = freshOrder.paymentStatus;
      let paymentHistoryNote = '';

      if (dto.paymentInfo) {
        const { paymentMode, amountPaid: requestedPaid, paymentMethod } = dto.paymentInfo;
        const method = paymentMethod || freshOrder.paymentMethod || 'CASH';

        if (paymentMode === 'PARTIAL') {
          if (!requestedPaid || requestedPaid <= 0) {
            throw new BadRequestException('Partial payment amount must be greater than 0.');
          }
          if (requestedPaid > remainingDue + 0.01) {
            throw new BadRequestException(
              `Payment amount (₹${requestedPaid}) exceeds remaining balance (₹${remainingDue}).`,
            );
          }

          const newTotalPaid = Number((currentPaid + requestedPaid).toFixed(2));
          newPaymentStatus = newTotalPaid >= freshOrder.totalAmount
            ? PaymentStatus.PAID
            : PaymentStatus.PARTIALLY_PAID;

          const createdPayment = await tx.payment.create({
            data: {
              orderId: freshOrder.id,
              customerId: freshOrder.customerId,
              amount: requestedPaid,
              currency: 'INR',
              status: PaymentStatus.PAID,
              provider: method,
              receiptId: `RCP-DELV-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              description: `Partial payment on delivery: ₹${requestedPaid}`,
              createdAt: new Date(),
            },
          });

          await tx.paymentAuditLog.create({
            data: {
              paymentId: createdPayment.id,
              action: 'PAYMENT_COLLECTED_ON_DELIVERY',
              previousStatus: freshOrder.paymentStatus,
              newStatus: newPaymentStatus,
              notes: `Partial collected: ₹${requestedPaid} via ${method}. Remaining due: ₹${Number((freshOrder.totalAmount - newTotalPaid).toFixed(2))}`,
            },
          });

          paymentHistoryNote = `Partial payment ₹${requestedPaid} received via ${method}`;
        } else {
          // FULL payment
          if (remainingDue > 0) {
            const createdPayment = await tx.payment.create({
              data: {
                orderId: freshOrder.id,
                customerId: freshOrder.customerId,
                amount: remainingDue,
                currency: 'INR',
                status: PaymentStatus.PAID,
                provider: method,
                receiptId: `RCP-DELV-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                description: `Full payment on delivery: ₹${remainingDue}`,
                createdAt: new Date(),
              },
            });

            await tx.paymentAuditLog.create({
              data: {
                paymentId: createdPayment.id,
                action: 'PAYMENT_COLLECTED_ON_DELIVERY',
                previousStatus: freshOrder.paymentStatus,
                newStatus: PaymentStatus.PAID,
                notes: `Full payment collected: ₹${remainingDue} via ${method}.`,
              },
            });
          }
          newPaymentStatus = PaymentStatus.PAID;
          paymentHistoryNote = `Fully Paid ₹${freshOrder.totalAmount} via ${method}`;
        }
      }

      // 6. Update order status to DELIVERED
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.DELIVERED,
          deliveredAt: new Date(),
          ...(dto.paymentInfo
            ? {
                paymentStatus: newPaymentStatus,
                paymentMethod: dto.paymentInfo.paymentMethod || freshOrder.paymentMethod,
              }
            : {}),
        },
        include: {
          customer: {
            include: {
              user: { select: { id: true, firstName: true, lastName: true, phone: true } },
            },
          },
          address: true,
          items: { include: { product: true } },
          payments: { orderBy: { createdAt: 'desc' } },
          history: {
            include: { user: { select: { firstName: true, lastName: true } } },
            orderBy: { createdAt: 'asc' },
          },
          jarAllocations: { include: { jarItem: true } },
          deliveryVerification: true,
        },
      });

      // 7. Complete distributor order assignment
      await tx.distributorOrderAssignment.updateMany({
        where: {
          orderId,
          status: 'ACCEPTED',
        },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });

      // 8. Create status history
      const historyReason = totalDelivered < totalOut
        ? `Delivered (${totalDelivered}/${totalOut} jars) · Short delivery: ${dto.shortDeliveryReason}${paymentHistoryNote ? ` · ${paymentHistoryNote}` : ''}`
        : `Delivered fully (${totalDelivered} jars) with PIN verification${paymentHistoryNote ? ` · ${paymentHistoryNote}` : ''}`;

      await tx.orderStatusHistory.create({
        data: {
          orderId,
          previousStatus: freshOrder.status,
          newStatus: OrderStatus.DELIVERED,
          changedByUserId: actingUserId,
          reason: historyReason,
        },
      });

      return updatedOrder;
    });

    // 9. Send notifications & socket event
    const notifMsg = totalDelivered < totalOut
      ? `Your order #${orderRef} was partially delivered. ${totalDelivered} of ${totalOut} jars were delivered.`
      : `Your order #${orderRef} has been delivered.`;

    try {
      this.notificationService?.notifyOrderStatusTransition?.({
        orderId: freshOrder.id,
        customerId: freshOrder.customerId,
        userId: freshOrder.customer?.user?.id || (freshOrder.customer as any)?.userId,
        newStatus: OrderStatus.DELIVERED,
        previousStatus: freshOrder.status,
        reason: baseHistoryReason,
        deliveredQty: totalDelivered,
        deliveredAt: new Date(),
      });
      this.eventsGateway?.emitOrderStatusUpdate?.(freshOrder.id, OrderStatus.DELIVERED, freshOrder.customerId, result);
    } catch (e) {
      console.warn('[OrderService] notification/socket broadcast warning:', e);
    }

    // Return sanitized order (strip raw OTP for distributor/staff)
    const isCustomerOwner =
      freshOrder.customer?.userId === actingUserId ||
      freshOrder.customerId === actingUserId;

    return {
      ...result,
      deliveryVerification: result.deliveryVerification
        ? {
            ...result.deliveryVerification,
            otp: isCustomerOwner ? result.deliveryVerification.otp : undefined,
          }
        : null,
    };
  }

  async recordDistributorPayment(
    orderId: string,
    distributorUserId: string,
    dto: RecordDistributorPaymentDto,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { distributorId: true },
    });

    if (!order) {
      throw new NotFoundException(`Order not found: ${orderId}`);
    }

    if (order.distributorId && order.distributorId !== distributorUserId) {
      throw new ForbiddenException('You are not authorized to record payment for this order');
    }

    // Delegate to authoritative unified payment recording method with row-level locking & audit logs
    return this.recordOrderPayment(orderId, distributorUserId, {
      amount: dto.amount,
      paymentMethod: dto.paymentMethod || 'CASH',
      referenceNumber: dto.referenceNumber,
      notes: dto.notes || 'Payment collected by distributor',
    });
  }

  async releaseDistributorOrder(
    orderId: string,
    distributorUserId: string,
    dto: { reason: string },
  ) {
    if (!dto.reason?.trim()) {
      throw new BadRequestException('Release reason is required.');
    }

    const trimmedReason = dto.reason.trim();

    return this.prisma.$transaction(async (tx) => {
      // 1. Exclusive row lock to serialize mutations and prevent race conditions
      await tx.$executeRaw`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`;

      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: {
          customer: {
            include: { user: { select: { firstName: true, lastName: true, phone: true } } },
          },
          distributor: { select: { id: true, firstName: true, lastName: true } },
          address: true,
          items: { include: { product: true } },
          payments: true,
        },
      });

      if (!order) {
        throw new NotFoundException(`Order not found: ${orderId}`);
      }

      if (order.distributorId && order.distributorId !== distributorUserId) {
        throw new ForbiddenException('You are not authorized to release this order');
      }

      if (order.status === OrderStatus.CANCELLED) {
        throw new BadRequestException('Order is already cancelled.');
      }

      if (order.status === OrderStatus.DELIVERED || order.status === OrderStatus.COMPLETED) {
        throw new BadRequestException('Delivered orders cannot be released.');
      }

      // 2. Update active assignment in DistributorOrderAssignment to RELEASED
      await tx.distributorOrderAssignment.updateMany({
        where: {
          orderId: order.id,
          distributorId: distributorUserId,
          status: 'ACCEPTED',
        },
        data: {
          status: 'RELEASED',
          releasedAt: new Date(),
          releaseReason: trimmedReason,
        },
      });

      if (order.status === OrderStatus.OUT_FOR_DELIVERY) {
        const allocations = await tx.orderJarAllocation.findMany({
          where: { orderId: order.id },
          include: { jarItem: true },
        });
        const orderRef = `ORD-${order.id.slice(0, 8).toUpperCase()}`;
        for (const alloc of allocations) {
          await tx.$executeRaw`
            SELECT "id" FROM "jar_inventory_items" WHERE "id" = ${alloc.jarItemId} FOR UPDATE
          `;
          const updatedItem = await tx.jarInventoryItem.update({
            where: { id: alloc.jarItemId },
            data: {
              customerQuantity: { decrement: alloc.quantity },
              filledYardQuantity: { increment: alloc.quantity },
            },
          });
          await tx.inventoryLog.create({
            data: {
              distributorId: alloc.jarItem.distributorId,
              jarItemId: alloc.jarItemId,
              ownership: alloc.jarItem.ownershipType === 'COMPANY' ? 'COMPANY_OWNED' : 'DISTRIBUTOR_OWNED',
              action: 'ALLOCATION_RELEASED',
              fromState: 'CUSTOMER',
              toState: 'FILLED_YARD',
              quantity: alloc.quantity,
              balanceAfter: updatedItem.ownedQuantity,
              referenceId: orderRef,
              orderId: order.id,
              customerId: order.customerId,
              description: `Order #${orderRef} assignment released, ${alloc.quantity} jars returned to filled yard`,
              createdById: distributorUserId,
            },
          });
        }
      }

      // 3. Reset assignment fields on Order and return to live queue
      // Crucial: The customer order is NOT cancelled; status resets to ORDER_PLACED and assignmentStatus='UNASSIGNED'
      const updated = await tx.order.update({
        where: { id: order.id },
        data: {
          distributorId: null,
          assignmentStatus: 'UNASSIGNED',
          acceptedAt: null,
          acceptedById: null,
          status: OrderStatus.ORDER_PLACED,
        },
        include: {
          customer: {
            include: { user: { select: { firstName: true, lastName: true, phone: true } } },
          },
          address: true,
          items: { include: { product: true } },
          payments: true,
          history: { orderBy: { createdAt: 'asc' } },
          distributorAssignments: {
            include: { distributor: { select: { id: true, firstName: true, lastName: true, phone: true } } },
            orderBy: { acceptedAt: 'asc' },
          },
        },
      });

      // 4. Create an audit history record
      const distName = order.distributor
        ? `${order.distributor.firstName} ${order.distributor.lastName}`.trim()
        : 'Distributor';

      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          previousStatus: order.status,
          newStatus: OrderStatus.ORDER_PLACED,
          changedByUserId: distributorUserId,
          reason: `Distributor ${distName} released assignment: "${trimmedReason}". Returned to queue.`,
        },
      });

      // 5. Emit real-time WebSocket events
      try {
        // Broadcast to all eligible distributors so order immediately appears in New Orders queue
        this.eventsGateway.emitNewOrderAvailable(updated);
        // Specifically notify the releasing distributor so it leaves their active orders list
        this.eventsGateway.emitEvent(`distributor:${distributorUserId}`, 'ORDER_RELEASED_BY_YOU', {
          orderId: order.id,
        });
        this.eventsGateway.emitEvent(`distributor-${distributorUserId}`, 'ORDER_RELEASED_BY_YOU', {
          orderId: order.id,
        });
        // Notify customer and staff of state update
        this.eventsGateway.emitOrderStatusUpdate(
          order.id,
          OrderStatus.ORDER_PLACED,
          order.customerId,
          updated,
        );
      } catch (err) {
        console.warn('[OrderService] WebSocket emit error on order release:', err);
      }

      return updated;
    });
  }

  // Alias cancelDistributorOrder to releaseDistributorOrder to ensure distributor cancellation NEVER cancels customer order
  async cancelDistributorOrder(
    orderId: string,
    distributorUserId: string,
    dto: CancelDistributorOrderDto,
  ) {
    return this.releaseDistributorOrder(orderId, distributorUserId, dto);
  }

  async deleteDistributorOrder(orderId: string, distributorUserId: string) {
    // Physical deletion of orders is permanently prohibited to preserve historical records and auditability.
    throw new BadRequestException(
      'Physical deletion of orders is prohibited. Orders are permanent business records. Please use the release flow if you cannot fulfill this assignment.',
    );
  }

  async assignDriverToDistributorOrder(
    orderId: string,
    distributorUserId: string,
    driverId: string | null,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { driver: true },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    if (order.distributorId !== distributorUserId) {
      throw new ForbiddenException('You do not own this order');
    }

    // BUSINESS RULES:
    // - Driver assignment is allowed only after the Distributor has accepted/confirmed the order.
    // - Do not allow assignment to pending/unaccepted orders.
    // - Do not allow assignment to cancelled orders.
    // - Do not allow assignment to already completed/delivered orders.
    if (
      order.status === OrderStatus.CANCELLED ||
      order.status === OrderStatus.DELIVERED ||
      order.status === OrderStatus.COMPLETED
    ) {
      throw new BadRequestException(
        `Cannot assign driver to an order with status "${order.status}".`,
      );
    }

    if (order.assignmentStatus !== 'ASSIGNED' || !order.acceptedAt) {
      throw new BadRequestException(
        'Driver assignment is only allowed after the order has been accepted.',
      );
    }

    let assignedDriver: any = null;
    if (driverId) {
      assignedDriver = await this.prisma.driver.findFirst({
        where: { id: driverId, distributorId: distributorUserId },
      });
      if (!assignedDriver) {
        throw new NotFoundException('Driver not found');
      }
      if (!assignedDriver.isActive) {
        throw new BadRequestException('Cannot assign an inactive driver to an order');
      }
    }

    const previousDriverId = order.driverId;

    // Transactionally update the driver and record audit trail
    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id: orderId },
        data: { driverId: driverId || null },
        include: {
          driver: true,
          customer: {
            include: {
              user: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
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
          distributorAssignments: {
            include: {
              distributor: { select: { id: true, firstName: true, lastName: true, phone: true } },
            },
            orderBy: { acceptedAt: 'asc' },
          },
        },
      });

      if (previousDriverId !== (driverId || null)) {
        await tx.orderStatusHistory.create({
          data: {
            orderId,
            previousStatus: order.status,
            newStatus: order.status,
            changedByUserId: distributorUserId,
            reason: assignedDriver
              ? `Driver "${assignedDriver.name}" assigned by Distributor`
              : 'Driver unassigned by Distributor',
          },
        });
      }

      return updated;
    });

    if (assignedDriver && updatedOrder.customer?.user?.id) {
      this.notificationService.notifyDriverAssigned({
        orderId,
        customerId: updatedOrder.customerId,
        userId: updatedOrder.customer.user.id,
        driverName: assignedDriver.name,
        driverPhone: assignedDriver.phone,
      }).catch((e) => console.warn('[OrderService] notifyDriverAssigned error:', e));
    }

    const totalQty = updatedOrder.items.reduce((sum, item) => sum + item.quantity, 0);
    const paidAmount = updatedOrder.payments
      .filter((p) => p.status === PaymentStatus.PAID || p.status === PaymentStatus.SUCCESS)
      .reduce((sum, p) => sum + p.amount, 0);
    const dueAmount = Math.max(0, Number((updatedOrder.totalAmount - paidAmount).toFixed(2)));

    return {
      ...updatedOrder,
      totalQuantity: totalQty,
      amountPaid: paidAmount,
      amountDue: dueAmount,
    };
  }

  // =========================================================================
  // DISTRIBUTOR NEW ORDER QUEUE & ATOMIC ACCEPTANCE
  // =========================================================================

  async findDistributorNewOrders(
    query?: {
      page?: number | string;
      limit?: number | string;
      search?: string;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    },
    distributorUserId?: string,
  ) {
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

    if (distributorUserId) {
      baseCondition.distributorSkips = {
        none: {
          distributorId: distributorUserId,
        },
      };
    }

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

  async skipDistributorOrder(orderId: string, distributorUserId: string) {
    // 1. Verify distributor user exists
    const user = await this.prisma.user.findUnique({
      where: { id: distributorUserId },
    });
    if (!user) {
      throw new NotFoundException('Distributor user not found');
    }

    // 2. Verify order exists
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, status: true, assignmentStatus: true, distributorId: true },
    });
    if (!order) {
      throw new NotFoundException(`Order not found: ${orderId}`);
    }

    // 3. Upsert skip record idempotently
    await this.prisma.distributorOrderSkip.upsert({
      where: {
        orderId_distributorId: {
          orderId,
          distributorId: distributorUserId,
        },
      },
      update: {
        action: 'SKIPPED',
        updatedAt: new Date(),
      },
      create: {
        orderId,
        distributorId: distributorUserId,
        action: 'SKIPPED',
      },
    });

    return {
      success: true,
      orderId,
      action: 'SKIPPED',
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
        AND "status" NOT IN ('CANCELLED'::"OrderStatus", 'DELIVERED'::"OrderStatus", 'COMPLETED'::"OrderStatus")
    `;

    if (rowsAffected === 0) {
      throw new ConflictException(
        'This order has already been accepted by another distributor or is no longer available.',
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
        driver: true,
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

    // 4. Create persistent distributor assignment record
    await this.prisma.distributorOrderAssignment.create({
      data: {
        orderId,
        distributorId: distributorUserId,
        status: 'ACCEPTED',
        acceptedAt: new Date(),
      },
    });

    // 5. Create audit status history record
    await this.prisma.orderStatusHistory.create({
      data: {
        orderId,
        previousStatus: OrderStatus.ORDER_PLACED,
        newStatus: OrderStatus.CONFIRMED,
        changedByUserId: distributorUserId,
        reason: 'Order claimed and accepted by Distributor from New Order Queue',
      },
    });

    // 6. Broadcast real-time events via WebSocket to Customer, Distributor, and Admin
    try {
      this.eventsGateway.emitOrderClaimed(orderId, distributorUserId, fullOrder);
      if (fullOrder) {
        this.notificationService.notifyOrderAccepted({
          orderId,
          customerId: fullOrder.customerId,
          userId: fullOrder.customer?.user?.id || (fullOrder.customer as any)?.userId,
        });
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

  // ─────────────────────────────────────────────────────────────────────────
  // UNIFIED PAYMENT RECORDING — works for any portal (distributor/staff/customer)
  // ─────────────────────────────────────────────────────────────────────────
  async recordOrderPayment(
    orderId: string,
    actingUserId: string,
    dto: {
      amount: number;
      paymentMethod: string;
      referenceNumber?: string;
      notes?: string;
      idempotencyKey?: string;
    },
  ) {
    const paymentAmount = Number(dto.amount);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      throw new BadRequestException('Payment amount must be greater than 0.');
    }

    const idempotencyKey = dto.idempotencyKey || dto.referenceNumber;

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Idempotency Check: if key provided, return existing state without duplicate creation
      if (idempotencyKey) {
        const existingPayment = await tx.payment.findFirst({
          where: {
            orderId,
            receiptId: idempotencyKey,
          },
        });

        if (existingPayment) {
          const existingOrder = await tx.order.findUnique({
            where: { id: orderId },
            include: {
              customer: {
                include: {
                  user: { select: { id: true, firstName: true, lastName: true, phone: true } },
                },
              },
              address: true,
              items: { include: { product: true } },
              payments: { orderBy: { createdAt: 'desc' } },
              history: { orderBy: { createdAt: 'asc' } },
            },
          });

          if (existingOrder) {
            const paid = (existingOrder.payments || [])
              .filter((p) => p.status === PaymentStatus.PAID || p.status === PaymentStatus.SUCCESS)
              .reduce((sum, p) => sum + p.amount, 0);
            const due = Math.max(0, Number((existingOrder.totalAmount - paid).toFixed(2)));
            return {
              ...existingOrder,
              amountPaid: paid,
              amountDue: due,
              orderTotal: existingOrder.totalAmount,
              totalPaid: paid,
              dueAmount: due,
            };
          }
        }
      }

      // 2. Concurrency Control: Acquire exclusive PostgreSQL row-level lock on the Order
      await tx.$executeRaw`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`;

      // 3. Re-read authoritative order state inside transaction AFTER acquiring the lock
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: {
          payments: { orderBy: { createdAt: 'desc' } },
          customer: {
            include: {
              user: { select: { firstName: true, lastName: true, phone: true } },
            },
          },
          address: true,
          items: { include: { product: true } },
          history: { orderBy: { createdAt: 'asc' } },
        },
      });

      if (!order) {
        throw new NotFoundException(`Order not found: ${orderId}`);
      }

      const currentPaid = (order.payments || [])
        .filter((p) => p.status === PaymentStatus.PAID || p.status === PaymentStatus.SUCCESS)
        .reduce((sum, p) => sum + p.amount, 0);

      const remainingDue = Math.max(0, Number((order.totalAmount - currentPaid).toFixed(2)));

      if (remainingDue <= 0) {
        throw new BadRequestException('This order has already been fully paid.');
      }

      if (paymentAmount > remainingDue + 0.01) {
        throw new BadRequestException(
          `Payment amount (₹${paymentAmount}) exceeds remaining balance due (₹${remainingDue}).`,
        );
      }

      const newTotalPaid = Number((currentPaid + paymentAmount).toFixed(2));
      const targetPaymentStatus =
        newTotalPaid >= order.totalAmount ? PaymentStatus.PAID : PaymentStatus.PARTIALLY_PAID;
      const newDueAmount = Math.max(0, Number((order.totalAmount - newTotalPaid).toFixed(2)));

      // 4. Create single authoritative Payment record
      const finalReceiptId =
        idempotencyKey ||
        `RCP-PAY-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

      const payment = await tx.payment.create({
        data: {
          orderId: order.id,
          customerId: order.customerId,
          amount: paymentAmount,
          currency: 'INR',
          status: PaymentStatus.PAID,
          provider: dto.paymentMethod || 'CASH',
          receiptId: finalReceiptId,
          description: dto.notes || `Payment recorded: ₹${paymentAmount}`,
          createdAt: new Date(),
        },
      });

      // 5. Create audit record in PaymentAuditLog
      await tx.paymentAuditLog.create({
        data: {
          paymentId: payment.id,
          action: 'PAYMENT_COLLECTED',
          previousStatus: order.paymentStatus,
          newStatus: targetPaymentStatus,
          notes: `Amount: ₹${paymentAmount}, Method: ${dto.paymentMethod || 'CASH'}, PrevPaid: ₹${currentPaid}, NewPaid: ₹${newTotalPaid}, PrevDue: ₹${remainingDue}, NewDue: ₹${newDueAmount}, Actor: ${actingUserId}`,
        },
      });

      // 6. Update Order financial status and method
      const updatedOrder = await tx.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: targetPaymentStatus,
          paymentMethod: dto.paymentMethod || order.paymentMethod,
        },
        include: {
          customer: {
            include: {
              user: { select: { id: true, firstName: true, lastName: true, phone: true } },
            },
          },
          address: true,
          items: { include: { product: true } },
          payments: { orderBy: { createdAt: 'desc' } },
          history: { orderBy: { createdAt: 'asc' } },
        },
      });

      // 7. Create status history entry
      let validUserId: string | null = null;
      if (actingUserId) {
        const userExists = await tx.user.findUnique({ where: { id: actingUserId }, select: { id: true } });
        if (userExists) validUserId = userExists.id;
      }

      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          previousStatus: order.status,
          newStatus: order.status,
          changedByUserId: validUserId,
          reason: `Payment collected: ₹${paymentAmount} via ${dto.paymentMethod || 'CASH'} (Status: ${targetPaymentStatus}, Due: ₹${newDueAmount})`,
        },
      });

      return {
        ...updatedOrder,
        amountPaid: newTotalPaid,
        amountDue: newDueAmount,
        orderTotal: updatedOrder.totalAmount,
        totalPaid: newTotalPaid,
        dueAmount: newDueAmount,
        paymentStatus: targetPaymentStatus,
      };
    });

    try {
      this.eventsGateway.emitOrderStatusUpdate(orderId, result.status, result.customerId, result);
      this.notificationService.notifyPaymentEvent({
        paymentId: `pay_${Date.now()}`,
        orderId,
        customerId: result.customerId,
        userId: result.customer?.user?.id || (result.customer as any)?.userId,
        amount: paymentAmount,
        status: 'SUCCESS',
      });
    } catch (e) {
      console.warn('[OrderService] payment update socket/notification warning:', e);
    }

    return result;
  }
}

