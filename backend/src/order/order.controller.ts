import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { OrderService } from './order.service';
import { CreatePartnerOrderDto } from './dto/create-partner-order.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/roles.guard';
import { UserRole } from '@prisma/client';

@Controller(['order', 'orders'])
@UseGuards(JwtAuthGuard)
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Get()
  findAll(@Req() req) {
    return this.orderService.findAll(req.user.customerId || req.user.sub || req.user.id);
  }

  @Get('staff/all')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF, UserRole.DELIVERY_PARTNER)
  findStaffAll() {
    return this.orderService.findStaffAll();
  }

  @Get('partner/all')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF, UserRole.DELIVERY_PARTNER)
  findPartnerAll(
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.orderService.findPartnerAll({ status, search });
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF, UserRole.DELIVERY_PARTNER)
  createDirectOrder(
    @Body() dto: CreatePartnerOrderDto,
    @Req() req,
  ) {
    const userId = req.user?.sub || req.user?.id || req.user?.userId;
    return this.orderService.createPartnerOrder(dto, userId);
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF, UserRole.DELIVERY_PARTNER)
  findOne(@Param('id') id: string) {
    return this.orderService.findOne(id);
  }

  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF, UserRole.DELIVERY_PARTNER)
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: any,
    @Body('reason') reason: string,
    @Req() req,
  ) {
    const userId = req.user?.sub || req.user?.id || req.user?.userId;
    return this.orderService.updateOrderStatus(id, status, userId, reason);
  }
}
