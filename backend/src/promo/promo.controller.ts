import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { PromoService } from './promo.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/roles.guard';
import { UserRole } from '@prisma/client';

@Controller('promo')
@UseGuards(JwtAuthGuard)
export class PromoController {
  constructor(private readonly promoService: PromoService) {}

  @Post('validate')
  async validateCode(
    @Req() req,
    @Body()
    body: {
      code: string;
      orderAmount?: number;
      orderType?: string;
      deliveryCharge?: number;
      isRecharge?: boolean;
    },
  ) {
    const customerId = req.user.customerId || req.user.sub;
    if (!customerId) {
      throw new BadRequestException(
        'Only customer accounts can validate promo codes',
      );
    }
    return this.promoService.validateCode(
      body.code,
      customerId,
      body.orderAmount,
      body.orderType,
      body.deliveryCharge,
      body.isRecharge,
    );
  }

  @Post('redeem')
  async redeemCode(
    @Req() req,
    @Body()
    body: {
      code: string;
      orderAmount?: number;
      orderType?: string;
      deliveryCharge?: number;
      isRecharge?: boolean;
    },
  ) {
    const customerId = req.user.customerId || req.user.sub;
    if (!customerId) {
      throw new BadRequestException(
        'Only customer accounts can redeem promo codes',
      );
    }
    return this.promoService.redeemCode(
      body.code,
      customerId,
      body.orderAmount,
      body.orderType,
      body.deliveryCharge,
      body.isRecharge,
    );
  }

  // ==========================================
  // ADMIN PANEL ENDPOINTS
  // ==========================================

  @Get('admin/list')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async listAllCodes() {
    return this.promoService.listAllCodes();
  }

  @Get('admin/stats')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async getPromoStats() {
    return this.promoService.getPromoStats();
  }

  @Post('admin')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async createCode(@Req() req, @Body() body: any) {
    const creatorId = req.user.sub || req.user.userId;
    return this.promoService.createCode({
      ...body,
      createdBy: creatorId,
    });
  }

  @Patch('admin/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async updateCode(@Param('id') id: string, @Body() body: any) {
    return this.promoService.updateCode(id, body);
  }

  @Delete('admin/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async deleteCode(@Param('id') id: string) {
    return this.promoService.deleteCode(id);
  }
}
