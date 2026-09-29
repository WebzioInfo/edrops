import { Injectable, Logger } from '@nestjs/common';
import {
  INotificationProvider,
  NotificationChannel,
  NotificationPayload,
} from '../interfaces/notification-provider.interface';
import { WebPushService } from '../web-push.service';

@Injectable()
export class PushProvider implements INotificationProvider {
  channel = NotificationChannel.PUSH;
  private readonly logger = new Logger(PushProvider.name);

  constructor(private readonly webPushService: WebPushService) {}

  async send(payload: NotificationPayload): Promise<void> {
    const userId = payload.recipients?.userId;
    if (!userId) {
      this.logger.debug(
        `No userId provided for payload ${payload.type}. Skipping web push notification.`,
      );
      return;
    }

    try {
      const orderId = payload.data?.orderId || payload.data?.entityId;
      let targetUrl = payload.data?.link;
      if (!targetUrl && orderId) {
        targetUrl = `/customer/orders/${orderId}`;
      } else if (!targetUrl) {
        targetUrl = '/';
      }

      await this.webPushService.sendToUser(userId, {
        title: payload.title,
        body: payload.message,
        type: payload.type,
        entityId: orderId,
        url: targetUrl,
        notificationId: payload.id,
        timestamp: new Date().toISOString(),
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        data: payload.data,
      });

      this.logger.log(
        `[WebPush] Dispatched push notification to user ${userId} for event ${payload.type}`,
      );
    } catch (err: any) {
      this.logger.error(
        `[WebPush] Failed to dispatch push notification: ${err.message}`,
      );
    }
  }
}
