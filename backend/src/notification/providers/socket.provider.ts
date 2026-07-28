import { Injectable, Logger } from '@nestjs/common';
import {
  INotificationProvider,
  NotificationChannel,
  NotificationPayload,
} from '../interfaces/notification-provider.interface';
import { EventsGateway } from '../../events/events.gateway';

@Injectable()
export class SocketProvider implements INotificationProvider {
  channel = NotificationChannel.SOCKET;
  private readonly logger = new Logger(SocketProvider.name);

  constructor(private readonly eventsGateway: EventsGateway) {}

  async send(payload: NotificationPayload): Promise<void> {
    const room = payload.recipients?.socketRoom;
    if (!room) {
      // Default to staff-notifications if no specific room is provided
      this.eventsGateway.emitEvent(
        'staff-notifications',
        payload.type,
        payload.data,
      );
    } else {
      this.eventsGateway.emitEvent(room, payload.type, payload.data);
    }
  }
}
