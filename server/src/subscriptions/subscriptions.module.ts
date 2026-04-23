import { Module, OnModuleInit, forwardRef } from '@nestjs/common';
import { Injectable, Logger } from '@nestjs/common';
import { BullModule, InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionsProcessor } from './subscriptions.processor';
import { OrdersModule } from '../orders/orders.module';
import { WalletModule } from '../wallet/wallet.module';

/**
 * Schedules the daily subscription order generation job at 6AM IST (UTC+5:30 = 00:30 UTC)
 * Uses BullMQ's built-in repeatable jobs with a cron pattern.
 */
@Injectable()
export class SubscriptionScheduler implements OnModuleInit {
  private readonly logger = new Logger(SubscriptionScheduler.name);

  constructor(
    @InjectQueue('subscriptions') private readonly subscriptionsQueue: Queue,
  ) {}

  async onModuleInit() {
    // Remove any existing repeatable jobs to avoid duplicates on restart
    const repeatableJobs = await this.subscriptionsQueue.getRepeatableJobs();
    for (const job of repeatableJobs) {
      if (job.name === 'generate-daily-orders') {
        await this.subscriptionsQueue.removeRepeatableByKey(job.key);
        this.logger.log('[Scheduler] Removed existing repeatable job');
      }
    }

    // Schedule: Every day at 6:00 AM IST = 00:30 UTC
    await this.subscriptionsQueue.add(
      'generate-daily-orders',
      {},
      {
        repeat: {
          pattern: '30 0 * * *', // 6:00 AM IST = 00:30 UTC daily
          tz: 'Asia/Kolkata',
        },
        jobId: 'subscription-daily-scheduler',
      },
    );

    this.logger.log(
      '[Scheduler] Daily subscription order generator scheduled at 6:00 AM IST',
    );
  }
}

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'subscriptions',
      defaultJobOptions: {
        removeOnComplete: 100,  // Keep last 100 completed jobs
        removeOnFail: 50,       // Keep last 50 failed jobs for debugging
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      },
    }),
    OrdersModule,
    forwardRef(() => WalletModule),
  ],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService, SubscriptionsProcessor, SubscriptionScheduler],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}

