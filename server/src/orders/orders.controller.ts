import {
  Controller, Get, Post, Patch, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { OrdersService } from './orders.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { OrderStatus, Role } from '@prisma/client';

@UseGuards(AuthGuard('jwt'))
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  // Customer: place an order
  @Post()
  createOrder(@CurrentUser() user: any, @Body() body: any) {
    return this.ordersService.create(user.userId, body);
  }

  // Customer: get my orders
  @Get('my')
  getMyOrders(@CurrentUser() user: any, @Query('status') status?: OrderStatus) {
    return this.ordersService.findAll({ userId: user.userId, status });
  }

  // Customer: cancel an order
  @Patch(':id/cancel')
  cancelOrder(@Param('id') id: string, @CurrentUser() user: any) {
    return this.ordersService.cancelOrder(id, user.userId);
  }

  // Admin/Distributor: get all orders
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.DISTRIBUTOR)
  @Get()
  getAllOrders(
    @Query('status') status?: OrderStatus,
    @Query('distributorId') distributorId?: string,
  ) {
    return this.ordersService.findAll({ status, distributorId });
  }

  @Get(':id')
  getOrder(@Param('id') id: string) {
    return this.ordersService.findById(id);
  }

  // Admin/Distributor/Delivery: update order status
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.DISTRIBUTOR, Role.DELIVERY_PARTNER)
  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() body: { status: OrderStatus; deliveryPartnerId?: string }) {
    return this.ordersService.updateStatus(id, body.status, body.deliveryPartnerId);
  }
}
