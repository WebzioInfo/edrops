import { Controller, Post, Body, Req, UseGuards } from '@nestjs/common';
import { PromoService } from './promo.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('promo')
@UseGuards(JwtAuthGuard)
export class PromoController {
  constructor(private readonly promoService: PromoService) {}

  @Post('validate')
  async validateCode(@Req() req, @Body() body: { code: string }) {
    const customerId = req.user.customerId || req.user.sub;
    return this.promoService.validateCode(body.code, customerId);
  }

  @Post('redeem')
  async redeemCode(@Req() req, @Body() body: { code: string }) {
    const customerId = req.user.customerId || req.user.sub;
    return this.promoService.redeemCode(body.code, customerId);
  }
}
