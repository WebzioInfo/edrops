import {
  BadRequestException,
  Controller,
  Post,
  Get,
  Req,
  Body,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CheckoutService } from './checkout.service';
import { ValidateCheckoutDto, InitiateCheckoutDto, ConfirmCheckoutDto } from './dto/checkout.dto';

@Controller('checkout')
@UseGuards(JwtAuthGuard)
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Get('slots')
  getDeliverySlots() {
    return this.checkoutService.getDeliverySlots();
  }

  @Post('validate')
  validateCheckout(@Req() req, @Body() dto: ValidateCheckoutDto) {
    if (!req.user.customerId) {
      throw new BadRequestException('Only customer accounts can validate checkout');
    }
    return this.checkoutService.validateCheckout(req.user.customerId, dto);
  }

  @Post('initiate')
  initiateCheckout(@Req() req, @Body() dto: InitiateCheckoutDto) {
    if (!req.user.customerId) {
      throw new BadRequestException('Only customer accounts can initialize checkout');
    }
    return this.checkoutService.initiateCheckout(req.user.customerId, dto);
  }

  @Post('confirm')
  confirmCheckout(@Req() req, @Body() dto: ConfirmCheckoutDto) {
    if (!req.user.customerId) {
      throw new BadRequestException('Only customer accounts can confirm checkout');
    }
    return this.checkoutService.confirmCheckout(req.user.customerId, dto);
  }
}
