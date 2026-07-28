import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { AdminCheckoutController } from './admin-checkout.controller';
import { AdminCustomersController } from './admin-customers.controller';
import { AdminCustomersService } from './admin-customers.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CheckoutModule } from '../checkout/checkout.module';

@Module({
  imports: [PrismaModule, CheckoutModule],
  controllers: [
    AdminController,
    AdminCheckoutController,
    AdminCustomersController,
  ],
  providers: [AdminService, AdminCustomersService],
})
export class AdminModule {}
