import { Module } from '@nestjs/common';
import { DeliveryService } from './delivery.service';
import { PartnerProfitsService } from './partner-profits.service';
import { DeliveryController } from './delivery.controller';
import { EnginesModule } from '../engines/engines.module';
import { PrismaModule } from '../prisma/prisma.module';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [PrismaModule, EnginesModule, EventsModule],
  controllers: [DeliveryController],
  providers: [DeliveryService, PartnerProfitsService],
  exports: [DeliveryService, PartnerProfitsService],
})
export class DeliveryModule {}
