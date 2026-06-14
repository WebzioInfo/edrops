import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';
import { OrderStatus } from '@prisma/client';

@Injectable()
export class OrderService {
  constructor(
    private prisma: PrismaService,
    private eventsGateway: EventsGateway,
  ) {}

  findAll(customerId: string) {
    return this.prisma.order.findMany({
      where: { customerId },
      include: {
        items: {
          include: {
            product: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  findStaffAll() {
    return this.prisma.order.findMany({
      include: {
        customer: {
          include: {
            user: { select: { firstName: true, lastName: true, id: true } }
          }
        },
        items: {
          include: { product: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 100 // Limit to recent 100 for performance
    });
  }

  async updateOrderStatus(orderId: string, newStatus: OrderStatus, staffUserId: string, reason?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { customer: { include: { user: true } } },
    });

    if (!order) throw new BadRequestException('Order not found');

    const validTransitions: Record<OrderStatus, OrderStatus[]> = {
      PENDING: ['CONFIRMED', 'CANCELLED'],
      CONFIRMED: ['PROCESSING', 'CANCELLED'],
      PROCESSING: ['OUT_FOR_DELIVERY', 'CANCELLED'],
      OUT_FOR_DELIVERY: ['DELIVERED', 'RETURNED'],
      DELIVERED: [],
      CANCELLED: [],
      RETURNED: [],
    };

    if (!validTransitions[order.status]?.includes(newStatus)) {
      throw new BadRequestException('Invalid status transition from ' + order.status + ' to ' + newStatus);
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

      // 3. Create customer notification
      await tx.notification.create({
        data: {
          userId: order.customer.user.id,
          type: 'DELIVERY_UPDATE',
          title: 'Order Status Updated',
          message: 'Your order #' + orderId.substring(0, 8) + ' is now ' + newStatus.replace(/_/g, ' ') + '.',
          link: '/customer/orders',
        },
      });

      return updated;
    });

    // 4. Emit real-time event to the specific customer
    this.eventsGateway.emitOrderStatusUpdate(orderId, newStatus, order.customerId);

    return updatedOrder;
  }
}
