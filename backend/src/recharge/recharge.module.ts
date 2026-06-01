import { Module } from '@nestjs/common';
import { RechargeService } from './recharge.service';
import { RechargeController } from './recharge.controller';
import { EnginesModule } from '../engines/engines.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, EnginesModule],
  controllers: [RechargeController],
  providers: [RechargeService],
})
export class RechargeModule {}
