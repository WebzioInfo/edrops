import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ScheduleController } from './schedule.controller';
import { ScheduleService } from './schedule.service';
import { SubscriptionScheduler } from './subscription.scheduler';
import { EnginesModule } from '../engines/engines.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [PrismaModule, EnginesModule, NotificationModule],
  controllers: [ScheduleController],
  providers: [ScheduleService, SubscriptionScheduler],
  exports: [ScheduleService, SubscriptionScheduler],
})
export class ScheduleModule {}
