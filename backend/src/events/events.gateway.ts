import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_ORIGIN?.split(',').map((o) => o.trim()) || '*',
    credentials: true,
  },
})
export class EventsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private logger: Logger = new Logger('EventsGateway');

  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
  ) {}

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');
  }

  async handleConnection(client: Socket, ...args: any[]) {
    try {
      // Get token from handshake auth or headers
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.split(' ')[1];

      if (!token) {
        this.logger.warn(`Client ${client.id} disconnected: No token provided`);
        client.disconnect();
        return;
      }

      // Verify token
      const payload = this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET,
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: {
          customer: true,
          deliveryPartner: true,
          staff: true,
        },
      });

      if (!user) {
        client.disconnect();
        return;
      }

      // Room assignments based on role
      client.join(`user:${user.id}`);
      client.join(`user-${user.id}`);

      if (['STAFF', 'MANAGER', 'ADMIN'].includes(user.role)) {
        client.join('staff-notifications');
        client.join('staff:orders');
        if (user.role === 'ADMIN') {
          client.join('distributors:orders');
          client.join('distributor-notifications');
          client.join(`distributor:${user.id}`);
          client.join(`distributor-${user.id}`);
        }
        this.logger.log(
          `Staff client connected: ${client.id} (User: ${user.id}, Role: ${user.role})`,
        );
      } else if (user.role === 'DISTRIBUTOR') {
        client.join('distributors:orders');
        client.join('distributor-notifications');
        client.join(`distributor:${user.id}`);
        client.join(`distributor-${user.id}`);
        this.logger.log(
          `Distributor client connected: ${client.id} (User: ${user.id})`,
        );
      } else if (user.role === 'CUSTOMER') {
        const customerId = user.customer?.id || user.id;
        client.join(`customer-${customerId}`);
        client.join(`customer:${customerId}`);
        this.logger.log(
          `Customer client connected: ${client.id} (Customer: ${customerId})`,
        );
      } else if (user.role === 'DELIVERY_PARTNER') {
        const partnerId = user.deliveryPartner?.id;
        if (partnerId) {
          client.join(`partner-${partnerId}`);
          client.join(`partner:${partnerId}`);
        }
        this.logger.log(
          `Delivery Partner client connected: ${client.id} (Partner: ${partnerId || user.id})`,
        );
      } else {
        client.join('general');
      }
    } catch (error) {
      this.logger.error(
        `Client ${client.id} disconnected: Invalid token`,
        error,
      );
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join-order')
  handleJoinOrder(client: Socket, orderId: string) {
    if (orderId) {
      client.join(`order:${orderId}`);
      client.join(`order-${orderId}`);
      this.logger.debug(`Client ${client.id} joined room order:${orderId}`);
    }
  }

  @SubscribeMessage('leave-order')
  handleLeaveOrder(client: Socket, orderId: string) {
    if (orderId) {
      client.leave(`order:${orderId}`);
      client.leave(`order-${orderId}`);
      this.logger.debug(`Client ${client.id} left room order:${orderId}`);
    }
  }

  // Real-time broadcast when an order is created
  emitNewOrder(orderData: any, notification?: any) {
    this.server.to('staff-notifications').emit('NEW_ORDER', {
      order: orderData,
      notification: notification,
    });
    this.server.to('staff:orders').emit('NEW_ORDER', {
      order: orderData,
      notification: notification,
    });
  }

  // Broadcast status changes to customer, partner, order, and staff rooms
  emitOrderStatusUpdate(orderId: string, status: string, customerId: string, orderData?: any) {
    const payload = {
      orderId,
      status,
      order: orderData,
    };

    // Customer rooms
    if (customerId) {
      this.server.to(`customer-${customerId}`).emit('ORDER_STATUS_CHANGED', payload);
      this.server.to(`customer:${customerId}`).emit('order:updated', orderData || payload);
      this.server.to(`user:${customerId}`).emit('ORDER_STATUS_CHANGED', payload);
      this.server.to(`user-${customerId}`).emit('order:updated', orderData || payload);
    }

    // Order specific rooms
    this.server.to(`order:${orderId}`).emit('order:updated', orderData || payload);
    this.server.to(`order-${orderId}`).emit('ORDER_STATUS_CHANGED', payload);

    // Distributor rooms
    this.server.to('distributors:orders').emit('ORDER_STATUS_CHANGED', payload);
    this.server.to('distributors:orders').emit('order:updated', orderData || payload);
    this.server.to('distributor-notifications').emit('ORDER_STATUS_CHANGED', payload);
    const distributorId = orderData?.distributorId;
    if (distributorId) {
      this.server.to(`distributor:${distributorId}`).emit('ORDER_STATUS_CHANGED', payload);
      this.server.to(`distributor:${distributorId}`).emit('order:updated', orderData || payload);
    }

    // Partner rooms if assigned
    const partnerId = orderData?.delivery?.assignment?.deliveryPartnerId || orderData?.deliveryPartnerId;
    if (partnerId) {
      this.server.to(`partner-${partnerId}`).emit('ORDER_STATUS_CHANGED', payload);
      this.server.to(`partner:${partnerId}`).emit('order:updated', orderData || payload);
    }

    // Staff rooms
    this.server.to('staff-notifications').emit('ORDER_STATUS_CHANGED', payload);
    this.server.to('staff-notifications').emit('order:updated', orderData || payload);
    this.server.to('staff:orders').emit('order:updated', orderData || payload);
  }

  // Broadcast partner assignment
  emitOrderAssigned(orderData: any, partnerId: string) {
    const orderId = orderData.id;
    const customerId = orderData.customerId;

    const payload = {
      orderId,
      deliveryPartnerId: partnerId,
      status: orderData.status,
      order: orderData,
    };

    // Dedicated partner rooms
    this.server.to(`partner-${partnerId}`).emit('order:assigned', orderData);
    this.server.to(`partner:${partnerId}`).emit('order:assigned', orderData);
    this.server.to(`partner-${partnerId}`).emit('ORDER_STATUS_CHANGED', payload);

    // Order and customer rooms
    this.server.to(`order:${orderId}`).emit('order:updated', orderData);
    this.server.to(`order-${orderId}`).emit('ORDER_STATUS_CHANGED', payload);
    if (customerId) {
      this.server.to(`customer-${customerId}`).emit('ORDER_STATUS_CHANGED', payload);
      this.server.to(`customer:${customerId}`).emit('order:updated', orderData);
    }

    // Staff rooms
    this.server.to('staff-notifications').emit('order:assigned', payload);
    this.server.to('staff-notifications').emit('order:updated', orderData);
    this.server.to('staff:orders').emit('order:updated', orderData);
  }

  // Real-time broadcast to all eligible distributors when a new order enters the queue
  emitNewOrderAvailable(orderData: any, notification?: any) {
    this.server.to('distributors:orders').emit('NEW_ORDER_AVAILABLE', {
      order: orderData,
      notification,
    });
    this.server.to('distributor-notifications').emit('NEW_ORDER_AVAILABLE', {
      order: orderData,
      notification,
    });
  }

  // Broadcast when an order is claimed by a distributor
  emitOrderClaimed(orderId: string, assignedDistributorId: string, orderData?: any) {
    const payload = {
      orderId,
      assignedDistributorId,
      order: orderData,
    };
    // Inform all distributors to immediately remove from their queue
    this.server.to('distributors:orders').emit('ORDER_CLAIMED', payload);
    this.server.to('distributor-notifications').emit('ORDER_CLAIMED', payload);

    // Specifically notify the winner distributor to update their "My Orders"
    this.server.to(`distributor:${assignedDistributorId}`).emit('ORDER_ASSIGNED_TO_YOU', payload);
    this.server.to(`distributor-${assignedDistributorId}`).emit('ORDER_ASSIGNED_TO_YOU', payload);
  }

  emitEvent(room: string, event: string, payload: any) {
    this.server.to(room).emit(event, payload);
  }
}
