import { Module } from '@nestjs/common';
import { PromoService } from './promo.service';
import { PromoController } from './promo.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [PromoService],
  controllers: [PromoController],
  exports: [PromoService]
})
export class PromoModule {}
