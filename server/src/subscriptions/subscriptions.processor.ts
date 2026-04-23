import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { SubscriptionsService } from './subscriptions.service';
import { OrdersService } from '../orders/orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';

@Processor('subscriptions')
@Injectable()
export class SubscriptionsProcessor extends WorkerHost {
  private readonly logger = new Logger(SubscriptionsProcessor.name);

  constructor(
    private readonly subscriptionsService: SubscriptionsService,
    private readonly ordersService: OrdersService,
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    switch (job.name) {
      case 'generate-daily-orders':
        return this.handleDailyOrderGeneration();
      default:
        throw new Error(`Unknown job name: ${job.name}`);
    }
  }

  // ─────────────────────────────────────────────
  // Daily Subscription Order Generator
  // Runs every day at 6AM IST via the scheduler in subscriptions.module.ts
  // ─────────────────────────────────────────────

  private async handleDailyOrderGeneration() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    this.logger.log(`[Subscription Engine] Running for date: ${today.toISOString()}`);

    // 1. Find all ACTIVE subscriptions due today or overdue
    const subscriptions = await this.prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        nextDeliveryDate: { lte: today },
        deletedAt: null,
      },
      include: {
        items: true,
        user: { include: { addresses: true } },
      },
    });

    this.logger.log(`[Subscription Engine] Found ${subscriptions.length} due subscriptions`);

    for (const sub of subscriptions) {
      try {
        await this.processSubscription(sub, today);
      } catch (error) {
        this.logger.error(
          `[Subscription Engine] Failed for subscription ${sub.id}: ${error.message}`,
          error.stack,
        );
      }
    }
  }

  private async processSubscription(sub: any, today: Date) {
    // Get the user's primary address
    const primaryAddress =
      sub.user.addresses.find((a: any) => a.isDefault) ||
      sub.user.addresses[0];

    if (!primaryAddress) {
      this.logger.warn(
        `[Subscription Engine] Sub ${sub.id}: No address found for user ${sub.userId}. Skipping.`,
      );
      return;
    }

    const totalAmount = Number(sub.totalAmount);

    // ─── WALLET BALANCE CHECK ─────────────────
    const hasFunds = await this.subscriptionsService.hasSufficientBalance(
      sub.userId,
      totalAmount,
    );

    if (!hasFunds) {
      // ⚠️ Wallet insufficient → mark as PENDING_PAYMENT (do NOT fallback to COD)
      this.logger.warn(
        `[Subscription Engine] Sub ${sub.id}: Insufficient wallet balance (needed ₹${totalAmount}). Marking as PENDING_PAYMENT.`,
      );
      await this.subscriptionsService.markAsPendingPayment(sub.id);
      // In production: send low-balance notification to user here
      return;
    }

    // ─── CREATE ORDER WITH WALLET PAYMENT ────
    await this.ordersService.create(sub.userId, {
      addressId: primaryAddress.id,
      subscriptionId: sub.id,
      type: 'SUBSCRIPTION',
      items: sub.items.map((i: any) => ({
        productId: i.productId,
        quantity: i.quantity,
      })),
      paymentMethod: 'WALLET',
      scheduledAt: today,
      notes: `Auto-generated from subscription ${sub.id}`,
    });

    // ─── ADVANCE NEXT DELIVERY DATE ──────────
    await this.subscriptionsService.advanceDeliveryDate(sub.id);

    this.logger.log(
      `[Subscription Engine] Sub ${sub.id}: Order created successfully for user ${sub.userId}`,
    );
  }
}
