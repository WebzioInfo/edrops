import { Module } from '@nestjs/common';
import { BalanceEngine } from './balance.engine';
import { RechargeEngine } from './recharge.engine';
import { DeliveryEngine } from './delivery.engine';
import { PrismaModule } from '../prisma/prisma.module';
import { SettingsModule } from '../settings/settings.module';

import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [PrismaModule, SettingsModule, NotificationModule],
  providers: [BalanceEngine, RechargeEngine, DeliveryEngine],
  exports: [BalanceEngine, RechargeEngine, DeliveryEngine],
})
export class EnginesModule {}
