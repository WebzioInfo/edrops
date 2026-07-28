import { Module } from '@nestjs/common';
import { StaffService } from './staff.service';
import { StaffController } from './staff.controller';
import { StaffCheckoutController } from './staff-checkout.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { CheckoutModule } from '../checkout/checkout.module';

@Module({
  imports: [PrismaModule, CheckoutModule],
  controllers: [StaffController, StaffCheckoutController],
  providers: [StaffService],
})
export class StaffModule {}
