import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RazorpayProvider } from '../payment/providers/razorpay.provider';
import { NotificationService } from '../notification/notification.service';
import { RechargeEngine } from '../engines/recharge.engine';
import {
  OrderStatus,
  PaymentStatus,
  WalletTransactionType,
} from '@prisma/client';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly razorpayProvider: RazorpayProvider,
    private readonly notificationService: NotificationService,
    private readonly rechargeEngine: RechargeEngine,
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
      const orderEntity = payload.payload?.order?.entity;

      if (!paymentEntity && !orderEntity) {
        throw new Error('No payment or order entity found in payload');
      }

      const providerOrderId = paymentEntity?.order_id || orderEntity?.id;
      const providerPaymentId = paymentEntity?.id;

      if (eventType === 'payment.captured' || eventType === 'order.paid') {
        await this.prisma.$transaction(async (tx) => {
          const payment = await tx.payment.findFirst({
            where: {
              OR: [
                ...(providerOrderId ? [{ providerId: providerOrderId }] : []),
                ...(providerPaymentId ? [{ receiptId: providerPaymentId }] : []),
              ],
            },
            include: { order: true, customer: { include: { user: true } } },
          });

          if (!payment) {
            this.logger.warn(
              `Payment record not found for providerOrderId: ${providerOrderId}, providerPaymentId: ${providerPaymentId}`,
            );
            await tx.paymentWebhookLog.update({
              where: { id: log.id },
              data: {
                status: 'IGNORED',
                errorMessage: 'Payment record not found in system',
                processedAt: new Date(),
              },
            });
            return;
          }

          // Concurrency lock on Payment row
          await tx.$executeRawUnsafe(
            `SELECT id FROM "Payment" WHERE id = $1 FOR UPDATE`,
            payment.id,
          );

          // Record payment attempt if providerPaymentId exists
          if (providerPaymentId) {
            const existingAttempt = await tx.paymentAttempt.findFirst({
              where: { paymentId: payment.id, providerId: providerPaymentId },
            });
            if (!existingAttempt) {
              await tx.paymentAttempt.create({
                data: {
                  paymentId: payment.id,
                  providerId: providerPaymentId,
                  status: 'SUCCESS',
                },
              });
            }
          }

          // 1. Direct Order Fulfillment
          if (payment.orderId) {
            await tx.order.update({
              where: { id: payment.orderId },
              data: {
                status: OrderStatus.PENDING_ASSIGNMENT,
                paymentStatus: PaymentStatus.SUCCESS,
              },
            });
          }
          // 2. Prepaid Package Purchase Fulfillment
          else if (payment.description?.startsWith('Package Purchase:')) {
            const packageId = payment.description
              .replace('Package Purchase:', '')
              .trim();

            const existingPurchase = await tx.packagePurchase.findUnique({
              where: { paymentId: payment.id },
            });

            if (!existingPurchase && packageId) {
              const pkg = await tx.package.findUnique({
                where: { id: packageId },
              });
              if (pkg) {
                await this.rechargeEngine.processRecharge(
                  payment.customerId,
                  pkg.id,
                  payment.amount,
                  pkg.jarCount,
                  payment.id,
                  tx,
                );
              }
            }
          }
          // 3. Wallet Recharge Fulfillment
          else if (!payment.orderId) {
            let wallet = await tx.wallet.findUnique({
              where: { customerId: payment.customerId },
            });
            if (!wallet) {
              wallet = await tx.wallet.create({
                data: { customerId: payment.customerId, balance: 0.0 },
              });
            }

            await tx.$executeRawUnsafe(
              `SELECT id FROM "Wallet" WHERE id = $1 FOR UPDATE`,
              wallet.id,
            );
            const lockedWallet = await tx.wallet.findUnique({
              where: { id: wallet.id },
            });
            if (!lockedWallet) {
              throw new Error(`Wallet not found for id ${wallet.id}`);
            }

            const existingTx = await tx.walletTransaction.findFirst({
              where: {
                walletId: lockedWallet.id,
                referenceId: payment.id,
                type: WalletTransactionType.TOP_UP,
              },
            });

            if (!existingTx) {
              const balanceBefore = lockedWallet.balance;
              const balanceAfter = balanceBefore + payment.amount;

              await tx.wallet.update({
                where: { id: lockedWallet.id },
                data: { balance: balanceAfter },
              });

              await tx.walletTransaction.create({
                data: {
                  walletId: lockedWallet.id,
                  type: WalletTransactionType.TOP_UP,
                  amount: payment.amount,
                  balanceBefore,
                  balanceAfter,
                  referenceId: payment.id,
                  description:
                    payment.description ||
                    `Direct Wallet Recharge (₹${payment.amount})`,
                },
              });

              // Dispatch notifications asynchronously after transaction commit
              setImmediate(() => {
                try {
                  this.notificationService.notifyPaymentEvent({
                    paymentId: providerPaymentId || payment.id,
                    customerId: payment.customerId,
                    userId: payment.customer?.userId || '',
                    amount: payment.amount,
                    status: 'SUCCESS',
                  });
                  this.notificationService.notifyWalletRecharge({
                    customerId: payment.customerId,
                    amount: payment.amount,
                    newBalance: balanceAfter,
                  });
                } catch (e: any) {
                  this.logger.warn(
                    `Failed to dispatch wallet webhook notification: ${e.message}`,
                  );
                }
              });
            }
          }

          // Mark payment record SUCCESS if not already
          if (payment.status !== PaymentStatus.SUCCESS) {
            await tx.payment.update({
              where: { id: payment.id },
              data: { status: PaymentStatus.SUCCESS },
            });

            await tx.paymentAuditLog.create({
              data: {
                paymentId: payment.id,
                action: 'WEBHOOK_PAYMENT_CAPTURED',
                previousStatus: payment.status,
                newStatus: PaymentStatus.SUCCESS,
                notes: `Captured via webhook event ${eventType} (${providerPaymentId || providerOrderId})`,
              },
            });
          }

          // Mark webhook log as PROCESSED
          await tx.paymentWebhookLog.update({
            where: { id: log.id },
            data: { status: 'PROCESSED', processedAt: new Date() },
          });
        });
      } else if (eventType === 'payment.failed') {
        await this.prisma.$transaction(async (tx) => {
          const payment = await tx.payment.findFirst({
            where: {
              OR: [
                ...(providerOrderId ? [{ providerId: providerOrderId }] : []),
                ...(providerPaymentId ? [{ receiptId: providerPaymentId }] : []),
              ],
            },
          });

          if (payment && payment.status !== PaymentStatus.SUCCESS) {
            await tx.payment.update({
              where: { id: payment.id },
              data: { status: PaymentStatus.FAILED },
            });

            if (providerPaymentId) {
              await tx.paymentAttempt.create({
                data: {
                  paymentId: payment.id,
                  providerId: providerPaymentId,
                  status: 'FAILED',
                  errorMessage:
                    paymentEntity?.error_description || 'Payment failed',
                  errorCode: paymentEntity?.error_code || null,
                },
              });
            }

            await tx.paymentAuditLog.create({
              data: {
                paymentId: payment.id,
                action: 'WEBHOOK_PAYMENT_FAILED',
                previousStatus: payment.status,
                newStatus: PaymentStatus.FAILED,
                notes: `Failed via webhook event ${eventType}: ${paymentEntity?.error_description || 'Unknown error'}`,
              },
            });
          }

          await tx.paymentWebhookLog.update({
            where: { id: log.id },
            data: { status: 'PROCESSED', processedAt: new Date() },
          });
        });
      } else {
        // Other events (refunds, etc)
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
