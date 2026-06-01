import { Module } from '@nestjs/common';
import { BalanceEngine } from './balance.engine';
import { RechargeEngine } from './recharge.engine';
import { DeliveryEngine } from './delivery.engine';
import { PrismaModule } from '../prisma/prisma.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [PrismaModule, SettingsModule],
  providers: [BalanceEngine, RechargeEngine, DeliveryEngine],
  exports: [BalanceEngine, RechargeEngine, DeliveryEngine],
})
export class EnginesModule {}
