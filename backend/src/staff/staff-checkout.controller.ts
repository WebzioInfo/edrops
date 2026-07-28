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

@Controller('staff/checkout')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.STAFF)
export class StaffCheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Post(':customerId/validate')
  validateCheckout(
    @Param('customerId') customerId: string,
    @Body() dto: ValidateCheckoutDto,
  ) {
    // Staff cannot override deposits or delivery
    dto.adminOverride = undefined;
    return this.checkoutService.validateCheckout(customerId, dto);
  }

  @Post(':customerId/initiate')
  @Idempotent()
  initiateCheckout(
    @Param('customerId') customerId: string,
    @Body() dto: InitiateCheckoutDto,
  ) {
    dto.adminOverride = undefined;
    if (!dto.orderSource) dto.orderSource = 'STAFF_CREATED';
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
