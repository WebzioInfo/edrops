import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { WalletModule } from '../wallet/wallet.module';
import { PromoModule } from '../promo/promo.module';

@Module({
  imports: [WalletModule, PromoModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
