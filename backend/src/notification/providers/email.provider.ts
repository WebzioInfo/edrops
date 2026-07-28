import { Injectable, Logger } from '@nestjs/common';
import { INotificationProvider, NotificationChannel, NotificationPayload } from '../interfaces/notification-provider.interface';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class EmailProvider implements INotificationProvider {
  channel = NotificationChannel.EMAIL;
  private readonly logger = new Logger(EmailProvider.name);

  constructor(private readonly mailerService: MailerService) {}

  async send(payload: NotificationPayload): Promise<void> {
    const email = payload.recipients?.email;
    if (!email) {
      this.logger.warn(`No email provided for payload ${payload.type}. Skipping.`);
      return;
    }

    try {
      await this.mailerService.sendMail({
        to: email,
        subject: payload.title,
        text: payload.message,
        // Optional HTML template implementation
        // html: `<b>${payload.title}</b><p>${payload.message}</p>`
      });
    } catch (error: any) {
      this.logger.error(`Failed to send email to ${email}: ${error.message}`, error.stack);
      throw error;
    }
  }
}
