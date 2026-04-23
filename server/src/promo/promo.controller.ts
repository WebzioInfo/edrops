import { Controller, Get, Post, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PromoService } from './promo.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@UseGuards(AuthGuard('jwt'))
@Controller('promo')
export class PromoController {
  constructor(private readonly promoService: PromoService) {}

  @Post('validate')
  validatePromo(@CurrentUser() user: any, @Body() body: { code: string; orderAmount: number }) {
    return this.promoService.validatePromo(body.code, user.userId, body.orderAmount);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Get()
  getAllPromos() {
    return this.promoService.getAllPromos();
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Post()
  createPromo(@Body() body: any) {
    return this.promoService.createPromo(body);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Patch(':id/toggle')
  togglePromo(@Param('id') id: string) {
    return this.promoService.togglePromo(id);
  }
}
