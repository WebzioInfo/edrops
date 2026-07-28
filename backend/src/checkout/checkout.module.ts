import { Module } from '@nestjs/common';
import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';
import { PaymentModule } from '../payment/payment.module';
import { EventsModule } from '../events/events.module';
import { NotificationModule } from '../notification/notification.module';
import { PromoModule } from '../promo/promo.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    PaymentModule,
    EventsModule,
    NotificationModule,
    PromoModule,
    AuditModule,
  ],
  controllers: [CheckoutController],
  providers: [CheckoutService],
  exports: [CheckoutService],
})
export class CheckoutModule {}
