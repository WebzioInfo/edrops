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
  findStaffAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    return this.orderService.findStaffAll({ page, limit, search, status });
  }

  @Get('partner/all')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF, UserRole.DELIVERY_PARTNER)
  findPartnerAll(
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Req() req?: any,
  ) {
    const userId = req?.user?.sub || req?.user?.id || req?.user?.userId;
    const userRole = req?.user?.role;
    return this.orderService.findPartnerAll({ status, search }, userId, userRole);
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
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF, UserRole.DELIVERY_PARTNER, UserRole.CUSTOMER)
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
    @Body('paymentConfirmation') paymentConfirmation: any,
    @Req() req,
  ) {
    const userId = req.user?.sub || req.user?.id || req.user?.userId;
    const userRole = req.user?.role;
    return this.orderService.updateOrderStatus(id, status, userId, reason, paymentConfirmation, false, userRole);
  }

  @Patch(':id/assign')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  assignPartner(
    @Param('id') id: string,
    @Body('deliveryPartnerId') deliveryPartnerId: string,
    @Req() req,
  ) {
    const userId = req.user?.sub || req.user?.id || req.user?.userId;
    return this.orderService.assignDeliveryPartner(id, deliveryPartnerId, userId);
  }
}
