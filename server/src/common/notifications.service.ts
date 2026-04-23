import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  async sendWhatsApp(phone: string, template: string, params: Record<string, string>) {
    // Integration logic for WhatsApp provider (e.g., Twilio / Gupshup / InfoBip)
    this.logger.log(`[WhatsApp] Sending to ${phone}: ${template} | Params: ${JSON.stringify(params)}`);
    // Placeholder return
    return { success: true, messageId: `WA-${Date.now()}` };
  }

  async sendSMS(phone: string, message: string) {
    this.logger.log(`[SMS] Sending to ${phone}: ${message}`);
    return { success: true, messageId: `SMS-${Date.now()}` };
  }

  async sendPush(userId: string, title: string, body: string) {
    this.logger.log(`[Push] Sending to ${userId}: ${title} - ${body}`);
    return { success: true };
  }

  // Domain specific events
  async notifyOrderConfirmed(phone: string, orderId: string) {
    return this.sendWhatsApp(phone, 'order_confirmed', { orderId });
  }

  async notifyOutForDelivery(phone: string, orderId: string, partnerName: string) {
    return this.sendWhatsApp(phone, 'out_for_delivery', { orderId, partnerName });
  }

  async notifyJarShortage(phone: string, available: number) {
    return this.sendWhatsApp(phone, 'jar_shortage_alert', { available: available.toString() });
  }
}
