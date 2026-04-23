import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { DeliveryService } from './delivery.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@UseGuards(AuthGuard('jwt'))
@Controller('delivery')
export class DeliveryController {
  constructor(private readonly deliveryService: DeliveryService) {}

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.DISTRIBUTOR)
  @Get('partners')
  getPartners(
    @Query('distributorId') distributorId?: string,
    @Query('isFreelance') isFreelance?: string,
  ) {
    return this.deliveryService.getPartners(
      distributorId,
      isFreelance !== undefined ? isFreelance === 'true' : undefined,
    );
  }

  @Post('register')
  register(@CurrentUser() user: any, @Body() body: any) {
    return this.deliveryService.register(user.userId, body);
  }

  @Get('my-orders')
  getMyOrders(@CurrentUser() user: any) {
    return this.deliveryService.getMyOrders(user.userId);
  }

  @Post('orders/:orderId/confirm')
  confirmDelivery(
    @Param('orderId') orderId: string,
    @CurrentUser() user: any,
    @Body() body: { jarCollected?: number; notes?: string },
  ) {
    return this.deliveryService.confirmDelivery(orderId, user.userId, body);
  }

  @Patch('availability')
  setAvailability(@CurrentUser() user: any, @Body() body: { isAvailable: boolean }) {
    return this.deliveryService.setAvailability(user.userId, body.isAvailable);
  }
}
