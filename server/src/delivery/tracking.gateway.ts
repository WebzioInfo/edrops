import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards } from '@nestjs/common';
import { WsJwtGuard } from '../auth/guards/ws-jwt.guard';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: 'tracking',
})
@UseGuards(WsJwtGuard)
export class TrackingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private connectedPartners = new Map<string, string>(); // partnerId -> socketId
  private activeTrips = new Map<string, any>(); // orderId -> latestLocation

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
    // Cleanup partner mapping
    for (const [partnerId, socketId] of this.connectedPartners.entries()) {
      if (socketId === client.id) {
        this.connectedPartners.delete(partnerId);
        break;
      }
    }
  }

  @SubscribeMessage('join-as-partner')
  handleJoinAsPartner(@MessageBody() data: { partnerId: string }, @ConnectedSocket() client: Socket) {
    this.connectedPartners.set(data.partnerId, client.id);
    client.join(`partner-${data.partnerId}`);
    return { status: 'success' };
  }

  @SubscribeMessage('update-location')
  handleLocationUpdate(
    @MessageBody() data: { partnerId: string; orderId: string; lat: number; lng: number; heading?: number },
  ) {
    const locationData = {
      orderId: data.orderId,
      lat: data.lat,
      lng: data.lng,
      heading: data.heading,
      timestamp: new Date(),
    };

    this.activeTrips.set(data.orderId, locationData);

    // Broadcast to the specific order room (customers horizontal)
    this.server.to(`order-${data.orderId}`).emit('location-broadcast', locationData);
    
    // Also broadcast to admin fleet view
    this.server.to('admin-fleet-view').emit('partner-location-update', {
        partnerId: data.partnerId,
        ...locationData
    });
  }

  @SubscribeMessage('watch-order')
  handleWatchOrder(@MessageBody() data: { orderId: string }, @ConnectedSocket() client: Socket) {
    client.join(`order-${data.orderId}`);
    const lastLocation = this.activeTrips.get(data.orderId);
    if (lastLocation) {
        client.emit('location-broadcast', lastLocation);
    }
    return { status: 'subscribed' };
  }

  @SubscribeMessage('join-admin-fleet')
  handleJoinAdmin(@ConnectedSocket() client: Socket) {
    client.join('admin-fleet-view');
    return { status: 'joined-fleet-view' };
  }
}
