import { Injectable, Logger } from '@nestjs/common';
import {
  INotificationProvider,
  NotificationChannel,
  NotificationPayload,
} from '../interfaces/notification-provider.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationType } from '@prisma/client';

@Injectable()
export class DatabaseProvider implements INotificationProvider {
  channel = NotificationChannel.DATABASE;
  private readonly logger = new Logger(DatabaseProvider.name);

  constructor(private readonly prisma: PrismaService) {}

  async send(payload: NotificationPayload): Promise<void> {
    const userId = payload.recipients?.userId;

    if (userId) {
      // It's a targeted customer/user notification
      const eventKey = payload.data?.eventKey;
      if (eventKey) {
        const existing = await this.prisma.notification.findFirst({
          where: { userId, eventKey },
        });
        if (existing) {
          this.logger.debug(`Skipping duplicate notification for user ${userId}, eventKey: ${eventKey}`);
          return;
        }
      }

      await this.prisma.notification.create({
        data: {
          userId,
          type: (payload.type in NotificationType ? payload.type : 'SYSTEM') as any,
          title: payload.title,
          message: payload.message,
          link: payload.data?.link,
          orderId: payload.data?.orderId,
          orderNumber: payload.data?.orderNumber,
          metadata: payload.data?.metadata || payload.data,
          eventKey,
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
