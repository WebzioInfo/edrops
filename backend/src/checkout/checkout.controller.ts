import {
  BadRequestException,
  Controller,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CheckoutService } from './checkout.service';

@Controller('checkout')
@UseGuards(JwtAuthGuard)
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Post('initialize')
  initializeCheckout(@Req() req) {
    if (!req.user.customerId) {
      throw new BadRequestException(
        'Only customer accounts can initialize checkout',
      );
    }
    return this.checkoutService.initializeCheckout(req.user.customerId);
  }
}
