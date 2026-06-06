import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RazorpayProvider } from '../payment/providers/razorpay.provider';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly razorpayProvider: RazorpayProvider,
  ) {}

  async handleEvent(rawPayload: string, payload: any, signature: string) {
    try {
      // 1. Verify Signature securely
      const isValid = this.razorpayProvider.verifyWebhookSignature({
        signature,
        payload: rawPayload,
      });

      if (!isValid) {
        this.logger.error(
          `Invalid webhook signature for event ${payload?.event}`,
        );
        return;
      }

      const eventId = payload['x-razorpay-event-id'] || payload.id;
      const eventType = payload.event;

      // 2. Persist the event idempotently
      // If the eventId already exists, Prisma will throw a unique constraint error
      // which we will catch and ignore (idempotency safety).
      await this.prisma.paymentWebhookLog.create({
        data: {
          eventId,
          eventType,
          payload: payload,
          signature,
          status: 'PENDING',
        },
      });

      // 3. Delegate to the processor asynchronously
      this.processEventSafely(eventId).catch((err) => {
        this.logger.error(
          `Error delegating event processing for ${eventId}`,
          err,
        );
      });
    } catch (error: any) {
      // P2002 is Prisma's unique constraint violation code
      if (error.code === 'P2002') {
        this.logger.warn(
          `Webhook event ${payload?.id} already exists. Skipping duplicate.`,
        );
      } else {
        this.logger.error('Failed to store webhook event', error);
      }
    }
  }

  private async processEventSafely(eventId: string) {
    const log = await this.prisma.paymentWebhookLog.findUnique({
      where: { eventId },
    });
    if (!log || log.status !== 'PENDING') return;

    try {
      const payload: any = log.payload;
      const eventType = payload.event;
      const paymentEntity = payload.payload?.payment?.entity;

      if (!paymentEntity) throw new Error('No payment entity in payload');

      if (eventType === 'payment.captured' || eventType === 'order.paid') {
        const providerId = paymentEntity.order_id;

        await this.prisma.$transaction(async (tx) => {
          const payment = await tx.payment.findFirst({
            where: { providerId },
            include: { order: true },
          });

          if (!payment)
            throw new Error(`Payment not found for providerId: ${providerId}`);

          if (payment.status === 'SUCCESS') return; // Already processed

          // Mark Payment Success
          await tx.payment.update({
            where: { id: payment.id },
            data: { status: 'SUCCESS' },
          });

          // Process Order Fulfillment
          if (payment.orderId) {
            await tx.order.update({
              where: { id: payment.orderId },
              data: { status: 'CONFIRMED', paymentStatus: 'SUCCESS' },
            });

            // Note: In production, deduct WarehouseStock here via InventoryService
          }

          // Mark webhook as processed
          await tx.paymentWebhookLog.update({
            where: { id: log.id },
            data: { status: 'PROCESSED', processedAt: new Date() },
          });
        });
      } else {
        // Other events (failed, refunds, etc)
        await this.prisma.paymentWebhookLog.update({
          where: { id: log.id },
          data: { status: 'IGNORED', processedAt: new Date() },
        });
      }
    } catch (error: any) {
      this.logger.error(`Processing failed for event ${eventId}`, error);
      await this.prisma.paymentWebhookLog.update({
        where: { id: log.id },
        data: {
          status: 'FAILED',
          errorMessage: error.message,
          retryCount: log.retryCount + 1,
        },
      });
    }
  }
}
