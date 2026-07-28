import { Injectable, Logger } from '@nestjs/common';
import { INotificationProvider, NotificationChannel, NotificationPayload } from '../interfaces/notification-provider.interface';

@Injectable()
export class PushProvider implements INotificationProvider {
  channel = NotificationChannel.PUSH;
  private readonly logger = new Logger(PushProvider.name);

  async send(payload: NotificationPayload): Promise<void> {
    const fcmToken = payload.recipients?.fcmToken;
    if (!fcmToken) {
      this.logger.debug(`No FCM token provided for payload ${payload.type}. Skipping push notification.`);
      return;
    }

    // TODO: Implement FCM Push Logic when infrastructure is ready
    this.logger.log(`[STUB] Sending Push Notification to token ${fcmToken}: ${payload.title}`);
  }
}
