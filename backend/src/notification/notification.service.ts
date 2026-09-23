import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationDispatcher } from './notification.dispatcher';
import { NotificationChannel } from './interfaces/notification-provider.interface';
import { NotificationType, NotificationStatus } from '@prisma/client';
import * as crypto from 'crypto';

@Injectable()
export class NotificationService {
  constructor(
    private prisma: PrismaService,
    private dispatcher: NotificationDispatcher,
  ) {}

  // =====================================================================
  // CUSTOMER NOTIFICATION APIS & QUERIES
  // =====================================================================

  async getCustomerNotifications(
    userId: string,
    query: { page?: number; limit?: number; status?: string } = {},
  ) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 30));
    const skip = (page - 1) * limit;

    const where: any = { userId };
    if (query.status && query.status !== 'ALL') {
      where.status = query.status as NotificationStatus;
    }

    const [notifications, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { userId, status: 'UNREAD' } }),
    ]);

    return {
      notifications,
      total,
      unreadCount,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getUnreadCount(userId: string) {
    const unreadCount = await this.prisma.notification.count({
      where: { userId, status: 'UNREAD' },
    });
    return { unreadCount };
  }

  async markAsRead(userId: string, id: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });

    if (!notification || notification.userId !== userId) {
      throw new NotFoundException('Notification not found');
    }

    const updated = await this.prisma.notification.update({
      where: { id },
      data: { status: 'READ' },
    });

    return updated;
  }

  async markAllAsRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { userId, status: 'UNREAD' },
      data: { status: 'READ' },
    });

    return { count: result.count, success: true };
  }

  async sendCustomerNotification(params: {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    orderId?: string;
    orderNumber?: string;
    link?: string;
    metadata?: any;
    eventKey?: string;
  }) {
    try {
      const { userId, type, title, message, orderId, orderNumber, link, metadata, eventKey } = params;

      // Idempotency check: if eventKey exists, do not recreate
      if (eventKey) {
        const existing = await this.prisma.notification.findFirst({
          where: { userId, eventKey },
        });
        if (existing) {
          return existing;
        }
      }

      const notification = await this.prisma.notification.create({
        data: {
          userId,
          type,
          title,
          message,
          orderId,
          orderNumber,
          link,
          metadata: metadata || {},
          eventKey,
          status: 'UNREAD',
        },
      });

      // Emit realtime socket event to customer room
      this.dispatcher.dispatch({
        id: notification.id,
        type,
        title,
        message,
        channels: [NotificationChannel.SOCKET],
        recipients: {
          userId,
          socketRoom: `user-${userId}`,
        },
        data: {
          notification,
          orderId,
          orderNumber,
          link,
        },
      });

      return notification;
    } catch (err: any) {
      console.warn(`[NotificationService] Error sending customer notification:`, err?.message || err);
      return null;
    }
  }

  async notifyOrderPlaced(data: {
    orderId: string;
    customerId: string;
    userId?: string;
    totalAmount: number;
    paymentMethod?: string;
  }) {
    try {
      let targetUserId = data.userId;
      if (!targetUserId && data.customerId) {
        const cust = await this.prisma.customer.findUnique({
          where: { id: data.customerId },
          select: { userId: true },
        });
        targetUserId = cust?.userId;
      }
      if (!targetUserId) return;

      const orderNumber = data.orderId.substring(0, 8).toUpperCase();
      const eventKey = `order_${data.orderId}_ORDER_PLACED`;

      await this.sendCustomerNotification({
        userId: targetUserId,
        type: NotificationType.ORDER_PLACED,
        title: 'Order Placed',
        message: `Your order #${orderNumber} has been placed successfully.`,
        orderId: data.orderId,
        orderNumber: `#${orderNumber}`,
        link: `/customer/orders/${data.orderId}`,
        eventKey,
        metadata: {
          orderId: data.orderId,
          orderNumber: `#${orderNumber}`,
          totalAmount: data.totalAmount,
          paymentMethod: data.paymentMethod,
        },
      });
    } catch (e) {
      console.warn('[NotificationService] notifyOrderPlaced failed:', e);
    }
  }

  async notifyOrderAccepted(data: {
    orderId: string;
    customerId: string;
    userId?: string;
  }) {
    try {
      let targetUserId = data.userId;
      if (!targetUserId && data.customerId) {
        const cust = await this.prisma.customer.findUnique({
          where: { id: data.customerId },
          select: { userId: true },
        });
        targetUserId = cust?.userId;
      }
      if (!targetUserId) return;

      const orderNumber = data.orderId.substring(0, 8).toUpperCase();
      const eventKey = `order_${data.orderId}_ORDER_ACCEPTED`;

      await this.sendCustomerNotification({
        userId: targetUserId,
        type: NotificationType.ORDER_ACCEPTED,
        title: 'Order Accepted',
        message: `Your order #${orderNumber} has been accepted and is being prepared.`,
        orderId: data.orderId,
        orderNumber: `#${orderNumber}`,
        link: `/customer/orders/${data.orderId}`,
        eventKey,
        metadata: {
          orderId: data.orderId,
          orderNumber: `#${orderNumber}`,
        },
      });
    } catch (e) {
      console.warn('[NotificationService] notifyOrderAccepted failed:', e);
    }
  }

  async notifyOrderStatusTransition(data: {
    orderId: string;
    customerId: string;
    userId?: string;
    newStatus: string;
    previousStatus?: string;
    reason?: string;
    deliveredQty?: number;
    deliveredAt?: Date;
  }) {
    try {
      let targetUserId = data.userId;
      if (!targetUserId && data.customerId) {
        const cust = await this.prisma.customer.findUnique({
          where: { id: data.customerId },
          select: { userId: true },
        });
        targetUserId = cust?.userId;
      }
      if (!targetUserId) return;

      const orderNumber = data.orderId.substring(0, 8).toUpperCase();
      const status = data.newStatus;
      const eventKey = `order_${data.orderId}_${status}`;

      let type: NotificationType | null = null;
      let title = '';
      let message = '';
      let metadata: any = { orderId: data.orderId, orderNumber: `#${orderNumber}` };

      if (status === 'OUT_FOR_DELIVERY') {
        type = NotificationType.OUT_FOR_DELIVERY;
        title = 'Out for Delivery';
        message = `Your order #${orderNumber} is on the way.`;
      } else if (status === 'DELIVERY_STARTED') {
        type = NotificationType.DELIVERY_STARTED;
        title = 'Delivery Started';
        message = `Your order #${orderNumber} delivery has started.`;
      } else if (status === 'DELIVERED' || status === 'COMPLETED') {
        type = NotificationType.DELIVERY_COMPLETED;
        title = 'Delivery Completed';
        const formattedDate = (data.deliveredAt || new Date()).toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        });
        const qtyText = data.deliveredQty ? `${data.deliveredQty} jars delivered • ` : '';
        message = `Your order #${orderNumber} has been delivered successfully. ${qtyText}${formattedDate}`;
        metadata = {
          ...metadata,
          deliveredQty: data.deliveredQty,
          deliveredAt: data.deliveredAt?.toISOString() || new Date().toISOString(),
        };
      } else if (status === 'CANCELLED') {
        type = NotificationType.ORDER_CANCELLED;
        title = 'Order Cancelled';
        message = `Your order #${orderNumber} was cancelled.${data.reason ? ` Reason: ${data.reason}` : ''}`;
        metadata = { ...metadata, reason: data.reason };
      } else if (status === 'CONFIRMED') {
        type = NotificationType.ORDER_CONFIRMED;
        title = 'Order Confirmed';
        message = `Your order #${orderNumber} has been confirmed.`;
      } else if (status === 'ASSIGNED') {
        type = NotificationType.ORDER_ACCEPTED;
        title = 'Order Accepted';
        message = `Your order #${orderNumber} has been accepted and is being prepared.`;
      } else if (status === 'FAILED') {
        type = NotificationType.DELIVERY_FAILED;
        title = 'Delivery Update';
        message = `We couldn't complete delivery for order #${orderNumber}.${data.reason ? ` (${data.reason})` : ''}`;
        metadata = { ...metadata, reason: data.reason };
      }

      if (type) {
        await this.sendCustomerNotification({
          userId: targetUserId,
          type,
          title,
          message,
          orderId: data.orderId,
          orderNumber: `#${orderNumber}`,
          link: status === 'DELIVERED' || status === 'COMPLETED' ? '/customer/deliveries' : `/customer/orders/${data.orderId}`,
          eventKey,
          metadata,
        });
      }
    } catch (e) {
      console.warn('[NotificationService] notifyOrderStatusTransition failed:', e);
    }
  }

  async notifyPaymentEvent(data: {
    paymentId: string;
    orderId?: string;
    customerId: string;
    userId?: string;
    amount: number;
    status: 'SUCCESS' | 'FAILED' | 'REFUNDED';
    reason?: string;
  }) {
    try {
      let targetUserId = data.userId;
      if (!targetUserId && data.customerId) {
        const cust = await this.prisma.customer.findUnique({
          where: { id: data.customerId },
          select: { userId: true },
        });
        targetUserId = cust?.userId;
      }
      if (!targetUserId) return;

      const orderNumber = data.orderId ? data.orderId.substring(0, 8).toUpperCase() : undefined;
      const eventKey = `payment_${data.paymentId}_${data.status}`;
      const formattedAmount = `₹${Number(data.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

      let type: NotificationType;
      let title: string;
      let message: string;

      if (data.status === 'SUCCESS') {
        type = NotificationType.PAYMENT_SUCCESS;
        title = 'Payment Successful';
        message = `${formattedAmount} payment was received${orderNumber ? ` for order #${orderNumber}` : ''}.`;
      } else if (data.status === 'FAILED') {
        type = NotificationType.PAYMENT_FAILED;
        title = 'Payment Failed';
        message = `The payment of ${formattedAmount} for order #${orderNumber || 'your order'} could not be completed.${data.reason ? ` Reason: ${data.reason}` : ''}`;
      } else {
        type = NotificationType.PAYMENT_REFUNDED;
        title = 'Refund Processed';
        message = `${formattedAmount} has been refunded${orderNumber ? ` for order #${orderNumber}` : ''}.`;
      }

      await this.sendCustomerNotification({
        userId: targetUserId,
        type,
        title,
        message,
        orderId: data.orderId,
        orderNumber: orderNumber ? `#${orderNumber}` : undefined,
        link: data.orderId ? `/customer/orders/${data.orderId}` : '/customer/wallet',
        eventKey,
        metadata: {
          paymentId: data.paymentId,
          orderId: data.orderId,
          amount: data.amount,
          status: data.status,
          reason: data.reason,
        },
      });
    } catch (e) {
      console.warn('[NotificationService] notifyPaymentEvent failed:', e);
    }
  }

  // Keep existing methods for backward compatibility if needed by generic CRUD controllers
  create(createNotificationDto: CreateNotificationDto) {
    return this.prisma.notification.create({
      data: createNotificationDto as any,
    });
  }

  findAll() {
    return this.prisma.notification.findMany({
      include: { user: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  findOne(id: string | number) {
    return this.prisma.notification.findUnique({
      where: { id: String(id) },
      include: { user: true },
    });
  }

  update(id: string | number, updateNotificationDto: UpdateNotificationDto) {
    return this.prisma.notification.update({
      where: { id: String(id) },
      data: updateNotificationDto as any,
    });
  }

  remove(id: string | number) {
    return this.prisma.notification.delete({ where: { id: String(id) } });
  }

  // =====================================================================
  // ENTERPRISE NOTIFICATION API
  // =====================================================================

  notifyOrderCreated(data: {
    orderId: string;
    customerId: string;
    customerName: string;
    customerPhone?: string;
    totalAmount: number;
    paymentMethod: string;
    deliveryAddress?: string;
    products?: any[];
  }) {
    this.dispatcher.dispatch({
      id: crypto.randomUUID(),
      type: 'NEW_ORDER',
      title: 'New Order Received',
      message: `${data.customerName} placed Order ${data.orderId.substring(0, 8).toUpperCase()}`,
      channels: [
        NotificationChannel.SLACK,
        NotificationChannel.SOCKET,
        NotificationChannel.DATABASE,
      ],
      data: {
        'Order ID': data.orderId,
        'Customer Name': data.customerName,
        Phone: data.customerPhone || 'N/A',
        Amount: `₹${data.totalAmount}`,
        'Payment Method': data.paymentMethod,
        Address: data.deliveryAddress || 'N/A',
        // Pass original payload structure down for socket clients who expect specific format
        orderId: data.orderId,
        amount: data.totalAmount,
        customerId: data.customerId,
        customerName: data.customerName,
        time: new Date(),
      },
    });
  }

  async notifyOrderStatusUpdate(data: {
    orderId: string;
    customerId: string;
    userId?: string;
    newStatus: string;
  }) {
    let targetUserId = data.userId;
    if (!targetUserId && data.customerId) {
      try {
        const cust = await this.prisma.customer.findUnique({
          where: { id: data.customerId },
          select: { userId: true },
        });
        targetUserId = cust?.userId;
      } catch (e) {
        // Ignore lookup error
      }
    }

    this.dispatcher.dispatch({
      id: crypto.randomUUID(),
      type: 'ORDER_STATUS_CHANGED',
      title: 'Order Status Updated',
      message: `Your order ${data.orderId.substring(0, 8).toUpperCase()} is now ${data.newStatus.replace(/_/g, ' ')}.`,
      channels: targetUserId
        ? [NotificationChannel.SOCKET, NotificationChannel.DATABASE]
        : [NotificationChannel.SOCKET],
      recipients: {
        userId: targetUserId,
        socketRoom: `customer-${data.customerId}`,
      },
      data: {
        orderId: data.orderId,
        status: data.newStatus,
        link: '/customer/orders',
      },
    });

    // Also notify staff via socket
    this.dispatcher.dispatch({
      id: crypto.randomUUID(),
      type: 'ORDER_STATUS_CHANGED',
      title: 'Order Status Updated',
      message: `Order ${data.orderId.substring(0, 8).toUpperCase()} is now ${data.newStatus.replace(/_/g, ' ')}.`,
      channels: [NotificationChannel.SOCKET],
      recipients: {
        socketRoom: 'staff-notifications',
      },
      data: {
        orderId: data.orderId,
        status: data.newStatus,
      },
    });
  }

  notifyPaymentSuccess(data: {
    paymentId: string;
    orderId?: string;
    customerId: string;
    amount: number;
  }) {
    this.dispatcher.dispatch({
      id: crypto.randomUUID(),
      type: 'PAYMENT_SUCCESS',
      title: 'Payment Successful',
      message: `Payment of ₹${data.amount} received successfully.`,
      channels: [
        NotificationChannel.SLACK,
        NotificationChannel.SOCKET,
        NotificationChannel.DATABASE,
      ],
      recipients: {
        userId: data.customerId,
        socketRoom: `customer-${data.customerId}`,
      },
      data: {
        'Payment ID': data.paymentId,
        'Order ID': data.orderId || 'N/A',
        Amount: `₹${data.amount}`,
      },
    });
  }

  notifyPaymentFailure(data: {
    paymentId: string;
    reason: string;
    customerId?: string;
  }) {
    this.dispatcher.dispatch({
      id: crypto.randomUUID(),
      type: 'PAYMENT_FAILED',
      title: 'Payment Failed',
      message: `A payment attempt failed: ${data.reason}`,
      channels: [NotificationChannel.SLACK, NotificationChannel.DATABASE],
      data: {
        'Payment ID': data.paymentId,
        Reason: data.reason,
      },
    });
  }

  notifySupportTicket(data: {
    ticketId: string;
    subject: string;
    customerId: string;
  }) {
    this.dispatcher.dispatch({
      id: crypto.randomUUID(),
      type: 'NEW_TICKET',
      title: 'New Support Ticket',
      message: `Ticket #${data.ticketId.substring(0, 8)} created: ${data.subject}`,
      channels: [
        NotificationChannel.SLACK,
        NotificationChannel.SOCKET,
        NotificationChannel.DATABASE,
      ],
      data: {
        'Ticket ID': data.ticketId,
        Subject: data.subject,
      },
    });
  }

  notifySupportReply(data: { ticketId: string; message: any }) {
    this.dispatcher.dispatch({
      id: crypto.randomUUID(),
      type: 'NEW_SUPPORT_MESSAGE',
      title: 'New Reply on Ticket',
      message: `New message on ticket #${data.ticketId.substring(0, 8)}`,
      channels: [NotificationChannel.SOCKET],
      recipients: { socketRoom: `ticket_${data.ticketId}` },
      data: data.message,
    });
  }

  notifySupportStatusUpdate(data: { ticketId: string; status: string }) {
    this.dispatcher.dispatch({
      id: crypto.randomUUID(),
      type: 'TICKET_STATUS_CHANGED',
      title: 'Ticket Status Updated',
      message: `Ticket #${data.ticketId.substring(0, 8)} is now ${data.status}`,
      channels: [NotificationChannel.SOCKET],
      recipients: { socketRoom: `ticket_${data.ticketId}` },
      data: { id: data.ticketId, status: data.status },
    });
  }

  notifySupportAssigned(data: { ticketId: string; ticket: any }) {
    this.dispatcher.dispatch({
      id: crypto.randomUUID(),
      type: 'TICKET_ASSIGNED',
      title: 'Ticket Assigned',
      message: `Ticket #${data.ticketId.substring(0, 8)} has been assigned.`,
      channels: [NotificationChannel.SOCKET],
      recipients: { socketRoom: `ticket_${data.ticketId}` },
      data: data.ticket,
    });
  }

  notifyLowBalance(data: { customerId: string; balance: number }) {
    this.dispatcher.dispatch({
      id: crypto.randomUUID(),
      type: 'LOW_BALANCE',
      title: 'Low prepaid jar balance!',
      message: `You only have ${data.balance} jars remaining in your prepaid balance. Please purchase a new package to prevent delivery interruptions.`,
      channels: [NotificationChannel.SOCKET, NotificationChannel.DATABASE],
      recipients: {
        userId: data.customerId,
        socketRoom: `customer-${data.customerId}`,
      },
      data: { balance: data.balance, link: '/customer/wallet' },
    });
  }

  async notifyDeliveryCompleted(data: {
    customerId: string;
    deliveredQty: number;
    emptyCollected: number;
    balanceAfter: number;
  }) {
    try {
      const cust = await this.prisma.customer.findUnique({
        where: { id: data.customerId },
        select: { userId: true },
      });
      if (!cust?.userId) return;

      const formattedDate = new Date().toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });

      await this.sendCustomerNotification({
        userId: cust.userId,
        type: NotificationType.DELIVERY_COMPLETED,
        title: 'Delivery Completed',
        message: `Your delivery of ${data.deliveredQty} jars was successfully completed • ${formattedDate}`,
        link: '/customer/deliveries',
        eventKey: `delivery_${data.customerId}_${Date.now()}`,
        metadata: {
          deliveredQty: data.deliveredQty,
          emptyCollected: data.emptyCollected,
          balanceAfter: data.balanceAfter,
        },
      });
    } catch (e) {
      console.warn('[NotificationService] notifyDeliveryCompleted error:', e);
    }
  }

  async notifyDeliveryFailed(data: {
    customerId: string;
    deliveryId: string;
    reason: string;
  }) {
    try {
      const cust = await this.prisma.customer.findUnique({
        where: { id: data.customerId },
        select: { userId: true },
      });
      if (!cust?.userId) return;

      await this.sendCustomerNotification({
        userId: cust.userId,
        type: NotificationType.DELIVERY_FAILED,
        title: 'Delivery Update',
        message: `We couldn't complete your delivery. Reason: ${data.reason}`,
        link: '/customer/deliveries',
        eventKey: `delivery_fail_${data.deliveryId}`,
        metadata: {
          deliveryId: data.deliveryId,
          reason: data.reason,
        },
      });
    } catch (e) {
      console.warn('[NotificationService] notifyDeliveryFailed error:', e);
    }
  }

  notifyWalletRecharge(data: {
    customerId: string;
    amount: number;
    newBalance: number;
  }) {
    this.dispatcher.dispatch({
      id: crypto.randomUUID(),
      type: 'RECHARGE_SUCCESS',
      title: 'Wallet Recharge Successful',
      message: `Your wallet has been recharged with ₹${data.amount}.`,
      channels: [NotificationChannel.SOCKET, NotificationChannel.DATABASE],
      recipients: {
        userId: data.customerId,
        socketRoom: `customer-${data.customerId}`,
      },
      data: {
        amount: data.amount,
        newBalance: data.newBalance,
        link: '/customer/wallet',
      },
    });
  }

  notifyPackagePurchased(data: {
    customerId: string;
    jarsAdded: number;
    balanceAfter: number;
  }) {
    this.dispatcher.dispatch({
      id: crypto.randomUUID(),
      type: 'RECHARGE_SUCCESS',
      title: 'Prepaid Jars Recharged!',
      message: `Successfully purchased package. Added ${data.jarsAdded} jars to your balance. Your new prepaid jar balance is ${data.balanceAfter} jars.`,
      channels: [NotificationChannel.SOCKET, NotificationChannel.DATABASE],
      recipients: {
        userId: data.customerId,
        socketRoom: `customer-${data.customerId}`,
      },
      data: { link: '/customer/wallet' },
    });
  }

  notifySystemError(data: { context: string; error: string }) {
    this.dispatcher.dispatch({
      id: crypto.randomUUID(),
      type: 'SYSTEM_ERROR',
      title: 'System Error Alert',
      message: `An error occurred in ${data.context}`,
      channels: [NotificationChannel.SLACK],
      data: {
        Context: data.context,
        Error: data.error,
      },
    });
  }

  notifyCustomerCreated(data: {
    customerId: string;
    customerName: string;
    email?: string;
    phone: string;
    customerType: string;
    createdBy: string;
  }) {
    this.dispatcher.dispatch({
      id: crypto.randomUUID(),
      type: 'SYSTEM',
      title: 'New Customer Created',
      message: `Customer ${data.customerName} (${data.customerType}) was created by ${data.createdBy}.`,
      channels: [NotificationChannel.SLACK, NotificationChannel.SOCKET],
      recipients: { socketRoom: 'staff-notifications' },
      data: {
        'Customer ID': data.customerId,
        Name: data.customerName,
        Email: data.email || 'N/A',
        Phone: data.phone,
        Type: data.customerType,
        'Created By': data.createdBy,
      },
    });
  }
}
