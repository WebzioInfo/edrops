import { Injectable } from '@nestjs/common';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationDispatcher } from './notification.dispatcher';
import { NotificationChannel } from './interfaces/notification-provider.interface';
import * as crypto from 'crypto';

@Injectable()
export class NotificationService {
  constructor(
    private prisma: PrismaService,
    private dispatcher: NotificationDispatcher,
  ) {}

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

  notifyDeliveryCompleted(data: {
    customerId: string;
    deliveredQty: number;
    emptyCollected: number;
    balanceAfter: number;
  }) {
    this.dispatcher.dispatch({
      id: crypto.randomUUID(),
      type: 'DELIVERY_UPDATE',
      title: 'Delivery Completed Successfully',
      message: `Your scheduled delivery of ${data.deliveredQty} water jars has been completed. Empty jars collected: ${data.emptyCollected}. Remaining prepaid balance: ${data.balanceAfter} jars.`,
      channels: [NotificationChannel.SOCKET, NotificationChannel.DATABASE],
      recipients: {
        userId: data.customerId,
        socketRoom: `customer-${data.customerId}`,
      },
      data: { link: '/customer/deliveries' },
    });
  }

  notifyDeliveryFailed(data: {
    customerId: string;
    deliveryId: string;
    reason: string;
  }) {
    this.dispatcher.dispatch({
      id: crypto.randomUUID(),
      type: 'DELIVERY_FAILED',
      title: 'Delivery Failed',
      message: `Your scheduled delivery could not be completed. Reason: ${data.reason}`,
      channels: [NotificationChannel.SOCKET, NotificationChannel.DATABASE],
      recipients: {
        userId: data.customerId,
        socketRoom: `customer-${data.customerId}`,
      },
      data: { deliveryId: data.deliveryId, reason: data.reason },
    });
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
