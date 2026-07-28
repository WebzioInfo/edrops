import {
  WebSocketGateway,
  WebSocketServer,
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
        include: { customer: true },
      });

      if (!user) {
        client.disconnect();
        return;
      }

      if (['STAFF', 'MANAGER', 'ADMIN'].includes(user.role)) {
        client.join('staff-notifications');
        this.logger.log(
          `Staff client connected: ${client.id} (User: ${user.id})`,
        );
      } else if (user.role === 'CUSTOMER') {
        client.join(`customer-${user.customer?.id || user.id}`);
        this.logger.log(
          `Customer client connected: ${client.id} (User: ${user.id})`,
        );
      } else {
        client.disconnect();
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

  // Method to emit events from other services
  emitNewOrder(orderData: any, notification: any) {
    this.server.to('staff-notifications').emit('NEW_ORDER', {
      order: orderData,
      notification: notification,
    });
  }

  emitOrderStatusUpdate(orderId: string, status: string, customerId: string) {
    this.server.to(`customer-${customerId}`).emit('ORDER_STATUS_CHANGED', {
      orderId,
      status,
    });
    // We can also emit to staff if we want all staff to see live status changes immediately
    this.server.to('staff-notifications').emit('ORDER_STATUS_CHANGED', {
      orderId,
      status,
    });
  }

  emitEvent(room: string, event: string, payload: any) {
    this.server.to(room).emit(event, payload);
  }
}
