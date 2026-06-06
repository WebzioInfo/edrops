import { Module } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { RazorpayProvider } from './providers/razorpay.provider';

@Module({
  providers: [PaymentService, RazorpayProvider],
  controllers: [PaymentController],
  exports: [PaymentService, RazorpayProvider],
})
export class PaymentModule {}
