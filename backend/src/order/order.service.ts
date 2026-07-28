import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { OrderStatus } from '@prisma/client';

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
        items: {
          include: {
            product: true,
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
            user: { select: { firstName: true, lastName: true, id: true } },
          },
        },
        items: {
          include: { product: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100, // Limit to recent 100 for performance
    });
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
      NEW: ['PENDING_PAYMENT', 'PENDING_ASSIGNMENT', 'CANCELLED'],
      PENDING_PAYMENT: ['PAYMENT_SUCCESS', 'FAILED', 'CANCELLED'],
      PAYMENT_SUCCESS: ['PENDING_ASSIGNMENT', 'CANCELLED'],
      PENDING_ASSIGNMENT: ['ASSIGNED', 'CANCELLED'],
      ASSIGNED: ['ACCEPTED_BY_PARTNER', 'CANCELLED'],
      ACCEPTED_BY_PARTNER: ['OUT_FOR_DELIVERY', 'CANCELLED'],
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
          reason,
        },
      });

      return updated;
    });

    // 4. Fire notifications safely outside transaction
    this.notificationService.notifyOrderStatusUpdate({
      orderId,
      customerId: order.customerId,
      newStatus,
    });

    return updatedOrder;
  }
}
