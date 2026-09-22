import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
  Header,
} from '@nestjs/common';
import { OrderService } from './order.service';
import { CreatePartnerOrderDto } from './dto/create-partner-order.dto';
import {
  CreateDistributorOrderDto,
  UpdateDistributorOrderStatusDto,
  RecordDistributorPaymentDto,
  CancelDistributorOrderDto,
} from './dto/distributor-order.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/roles.guard';
import { UserRole } from '@prisma/client';

@Controller(['order', 'orders'])
@UseGuards(JwtAuthGuard)
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  // =========================================================================
  // DISTRIBUTOR ORDER ENDPOINTS
  // =========================================================================

  @Get('distributor/all')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  @UseGuards(RolesGuard)
  @Roles(UserRole.DISTRIBUTOR, UserRole.ADMIN)
  findDistributorAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('paymentStatus') paymentStatus?: string,
    @Query('datePreset') datePreset?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('customerId') customerId?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
    @Req() req?: any,
  ) {
    const userId = req.user?.sub || req.user?.id || req.user?.userId;
    return this.orderService.findDistributorOrders(userId, {
      page,
      limit,
      search,
      status,
      paymentStatus,
      datePreset,
      dateFrom,
      dateTo,
      customerId,
      sortBy,
      sortOrder,
    });
  }

  @Get('distributor/new-orders')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  @UseGuards(RolesGuard)
  @Roles(UserRole.DISTRIBUTOR, UserRole.ADMIN)
  findDistributorNewOrders(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
    @Req() req?: any,
  ) {
    const userId = req?.user?.sub || req?.user?.id || req?.user?.userId;
    return this.orderService.findDistributorNewOrders({
      page,
      limit,
      search,
      sortBy,
      sortOrder,
    }, userId);
  }

  @Post('distributor/:id/skip')
  @UseGuards(RolesGuard)
  @Roles(UserRole.DISTRIBUTOR, UserRole.ADMIN)
  skipDistributorOrder(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.sub || req.user?.id || req.user?.userId;
    return this.orderService.skipDistributorOrder(id, userId);
  }

  @Post('distributor/:id/accept')
  @UseGuards(RolesGuard)
  @Roles(UserRole.DISTRIBUTOR, UserRole.ADMIN)
  acceptDistributorOrder(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.sub || req.user?.id || req.user?.userId;
    return this.orderService.acceptDistributorOrder(id, userId);
  }

  @Get('distributor/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.DISTRIBUTOR, UserRole.ADMIN)
  findDistributorOne(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.sub || req.user?.id || req.user?.userId;
    return this.orderService.findDistributorOrder(id, userId);
  }

  @Post('distributor')
  @UseGuards(RolesGuard)
  @Roles(UserRole.DISTRIBUTOR, UserRole.ADMIN)
  createDistributorOrder(@Body() dto: CreateDistributorOrderDto, @Req() req: any) {
    const userId = req.user?.sub || req.user?.id || req.user?.userId;
    return this.orderService.createDistributorOrder(userId, dto);
  }

  @Patch('distributor/:id/status')
  @UseGuards(RolesGuard)
  @Roles(UserRole.DISTRIBUTOR, UserRole.ADMIN)
  updateDistributorStatus(
    @Param('id') id: string,
    @Body() dto: UpdateDistributorOrderStatusDto,
    @Req() req: any,
  ) {
    const userId = req.user?.sub || req.user?.id || req.user?.userId;
    return this.orderService.updateDistributorOrderStatus(id, userId, dto);
  }

  @Post('distributor/:id/payments')
  @UseGuards(RolesGuard)
  @Roles(UserRole.DISTRIBUTOR, UserRole.ADMIN)
  recordDistributorPayment(
    @Param('id') id: string,
    @Body() dto: RecordDistributorPaymentDto,
    @Req() req: any,
  ) {
    const userId = req.user?.sub || req.user?.id || req.user?.userId;
    return this.orderService.recordDistributorPayment(id, userId, dto);
  }

  @Post('distributor/:id/cancel')
  @UseGuards(RolesGuard)
  @Roles(UserRole.DISTRIBUTOR, UserRole.ADMIN)
  cancelDistributorOrder(
    @Param('id') id: string,
    @Body() dto: CancelDistributorOrderDto,
    @Req() req: any,
  ) {
    const userId = req.user?.sub || req.user?.id || req.user?.userId;
    return this.orderService.cancelDistributorOrder(id, userId, dto);
  }

  @Delete('distributor/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.DISTRIBUTOR, UserRole.ADMIN)
  deleteDistributorOrder(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.sub || req.user?.id || req.user?.userId;
    return this.orderService.deleteDistributorOrder(id, userId);
  }

  // =========================================================================
  // EXISTING STAFF / PARTNER / CUSTOMER ENDPOINTS
  // =========================================================================

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
