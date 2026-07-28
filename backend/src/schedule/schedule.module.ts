import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ScheduleController } from './schedule.controller';
import { ScheduleService } from './schedule.service';
import { SubscriptionScheduler } from './subscription.scheduler';

import { EnginesModule } from '../engines/engines.module';

@Module({
  imports: [PrismaModule, EnginesModule],
  controllers: [ScheduleController],
  providers: [ScheduleService, SubscriptionScheduler],
  exports: [ScheduleService],
})
export class ScheduleModule {}
