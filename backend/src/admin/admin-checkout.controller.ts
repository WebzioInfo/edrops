import { Controller, Post, Body, UseGuards, Param } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { UserRole } from '@prisma/client';
import { CheckoutService } from '../checkout/checkout.service';
import {
  ValidateCheckoutDto,
  InitiateCheckoutDto,
  ConfirmCheckoutDto,
} from '../checkout/dto/checkout.dto';
import { Idempotent } from '../common/decorators/idempotent.decorator';

@Controller('admin/checkout')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MANAGER)
export class AdminCheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Post(':customerId/validate')
  validateCheckout(
    @Param('customerId') customerId: string,
    @Body() dto: ValidateCheckoutDto,
  ) {
    return this.checkoutService.validateCheckout(customerId, dto);
  }

  @Post(':customerId/initiate')
  @Idempotent()
  initiateCheckout(
    @Param('customerId') customerId: string,
    @Body() dto: InitiateCheckoutDto,
  ) {
    // Force the order source if not set
    if (!dto.orderSource) dto.orderSource = 'ADMIN_CREATED';
    return this.checkoutService.initiateCheckout(customerId, dto);
  }

  @Post(':customerId/confirm')
  @Idempotent()
  confirmCheckout(
    @Param('customerId') customerId: string,
    @Body() dto: ConfirmCheckoutDto,
  ) {
    return this.checkoutService.confirmCheckout(customerId, dto);
  }
}
