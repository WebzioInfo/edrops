import { Module } from '@nestjs/common';
import { StaffService } from './staff.service';
import { StaffController } from './staff.controller';
import { StaffCheckoutController } from './staff-checkout.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { CheckoutModule } from '../checkout/checkout.module';
import { OrderModule } from '../order/order.module';

@Module({
  imports: [PrismaModule, CheckoutModule, OrderModule],
  controllers: [StaffController, StaffCheckoutController],
  providers: [StaffService],
})
export class StaffModule {}
