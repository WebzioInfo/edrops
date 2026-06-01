import { Module } from '@nestjs/common';
import { DeliveryService } from './delivery.service';
import { DeliveryController } from './delivery.controller';
import { EnginesModule } from '../engines/engines.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, EnginesModule],
  controllers: [DeliveryController],
  providers: [DeliveryService],
})
export class DeliveryModule {}
