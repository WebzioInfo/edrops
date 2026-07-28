import { Injectable, Logger } from '@nestjs/common';
import {
  INotificationProvider,
  NotificationChannel,
  NotificationPayload,
} from '../interfaces/notification-provider.interface';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DatabaseProvider implements INotificationProvider {
  channel = NotificationChannel.DATABASE;
  private readonly logger = new Logger(DatabaseProvider.name);

  constructor(private readonly prisma: PrismaService) {}

  async send(payload: NotificationPayload): Promise<void> {
    const userId = payload.recipients?.userId;

    if (userId) {
      // It's a targeted user notification
      await this.prisma.notification.create({
        data: {
          userId,
          type: 'SYSTEM', // Map from payload.type as needed
          title: payload.title,
          message: payload.message,
          link: payload.data?.link,
          status: 'UNREAD',
        },
      });
    } else {
      // If no specific user, treat as a staff broadcast
      await this.prisma.staffNotification.create({
        data: {
          type: payload.type,
          title: payload.title,
          message: payload.message,
          orderId: payload.data?.orderId || 'system',
          isRead: false,
        },
      });
    }
  }
}
