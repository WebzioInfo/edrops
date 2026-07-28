import { Injectable, Logger } from '@nestjs/common';
import {
  INotificationProvider,
  NotificationChannel,
  NotificationPayload,
} from '../interfaces/notification-provider.interface';

@Injectable()
export class WhatsAppProvider implements INotificationProvider {
  channel = NotificationChannel.WHATSAPP;
  private readonly logger = new Logger(WhatsAppProvider.name);

  async send(payload: NotificationPayload): Promise<void> {
    const phone = payload.recipients?.phone;
    if (!phone) {
      this.logger.debug(
        `No phone number provided for payload ${payload.type}. Skipping WhatsApp notification.`,
      );
      return;
    }

    // TODO: Implement WhatsApp API Logic when infrastructure is ready
    this.logger.log(
      `[STUB] Sending WhatsApp Notification to phone ${phone}: ${payload.title}`,
    );
  }
}
