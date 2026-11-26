import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Patch,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { DeliveryService } from './delivery.service';
import { PartnerProfitsService } from './partner-profits.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard, Roles } from '../auth/roles.guard';
import { UserRole } from '@prisma/client';

@Controller(['delivery', 'delivery-partner'])
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class DeliveryController {
  constructor(
    private readonly deliveryService: DeliveryService,
    private readonly partnerProfitsService: PartnerProfitsService,
  ) { }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  create(@Body() data: any) {
    return this.deliveryService.create(data);
  }

  @Post('generate')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  generateToday() {
    return this.deliveryService.generateToday();
  }

  @Get('today')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF, UserRole.DISTRIBUTOR, UserRole.DELIVERY_PARTNER)
  findToday() {
    return this.deliveryService.findToday();
  }

  @Get('daily')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF, UserRole.DISTRIBUTOR, UserRole.DELIVERY_PARTNER)
  getDailyDeliveries(@Query('date') date?: string) {
    return this.deliveryService.getDailyDeliveries(date);
  }

  @Post('quick-dispatch')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF, UserRole.DISTRIBUTOR, UserRole.DELIVERY_PARTNER)
  quickDispatch(
    @Body()
    body: {
      customerId: string;
      scheduledFor?: string;
      deliveredQty: number;
      emptyCollected: number;
      notes?: string;
      requireVerification?: boolean;
    },
    @Request() req,
  ) {
    return this.deliveryService.quickDispatch(body, req.user);
  }

  @Post(':id/request-verification')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF, UserRole.DISTRIBUTOR, UserRole.DELIVERY_PARTNER)
  requestVerification(
    @Param('id') id: string,
    @Body()
    body: {
      deliveredQty: number;
      emptyCollected: number;
      notes?: string;
      requireVerification?: boolean;
    },
  ) {
    return this.deliveryService.requestDeliveryVerification(id, body);
  }

  @Post(':id/customer-verify')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  customerVerify(
    @Param('id') id: string,
    @Body() body: { verified: boolean; feedback?: string; reason?: string },
    @Request() req,
  ) {
    return this.deliveryService.verifyDeliveryByCustomer(id, body, req.user);
  }

  @Post(':id/dispatch')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF, UserRole.DISTRIBUTOR, UserRole.DELIVERY_PARTNER)
  dispatch(
    @Param('id') id: string,
    @Body()
    body: {
      deliveredQty?: number;
      emptyCollected?: number;
      notes?: string;
    },
  ) {
    return this.deliveryService.dispatchDelivery(id, body);
  }

  @Post(':id/force-verify')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  forceVerify(
    @Param('id') id: string,
    @Body()
    body: {
      deliveredQty: number;
      emptyCollected: number;
      notes?: string;
      pin?: string;
    },
    @Request() req,
  ) {
    return this.deliveryService.forceVerifyByStaff(id, body, req.user);
  }

  @Get(['partner/my-tasks', 'my-tasks'])
  @Roles(UserRole.DELIVERY_PARTNER, UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  findMyTasks(@Request() req) {
    const userId = req.user?.sub || req.user?.id || req.user?.userId;
    return this.deliveryService.findByPartner(userId);
  }

  @Get(['partner/profits', 'profits'])
  @Roles(UserRole.DELIVERY_PARTNER, UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  getPartnerProfits(
    @Request() req,
    @Query('period') period?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('paymentStatus') paymentStatus?: string,
  ) {
    const userId = req.user?.sub || req.user?.id || req.user?.userId;
    return this.partnerProfitsService.getPartnerProfits(userId, {
      period,
      startDate,
      endDate,
      paymentStatus,
    });
  }

  @Get('history')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  findMyHistory(@Request() req) {
    return this.deliveryService.findHistoryByCustomerUser(req.user.id);
  }

  @Get('weekly-summary')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  findMyWeeklySummary(
    @Request() req,
    @Query('year') year?: string,
    @Query('month') month?: string,
    @Query('status') status?: string,
  ) {
    return this.deliveryService.findWeeklySummaryByCustomerUser(
      req.user.id,
      year ? parseInt(year, 10) : undefined,
      month ? parseInt(month, 10) : undefined,
      status,
    );
  }

  @Get('customer/:customerId/weekly-summary')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF, UserRole.DISTRIBUTOR, UserRole.DELIVERY_PARTNER)
  getWeeklySummary(
    @Param('customerId') customerId: string,
    @Query('year') year?: string,
    @Query('month') month?: string,
    @Query('status') status?: string,
  ) {
    return this.deliveryService.getWeeklySummary(
      customerId,
      year ? parseInt(year, 10) : undefined,
      month ? parseInt(month, 10) : undefined,
      status,
    );
  }

  @Get('customer/:customerId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF, UserRole.DISTRIBUTOR, UserRole.DELIVERY_PARTNER)
  findByCustomer(@Param('customerId') customerId: string) {
    return this.deliveryService.findByCustomer(customerId);
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF, UserRole.DISTRIBUTOR, UserRole.DELIVERY_PARTNER)
  updateStatus(
    @Param('id') id: string,
    @Body() body: { status: any; reason?: string },
  ) {
    return this.deliveryService.updateStatus(id, body.status, body.reason);
  }

  @Post(':id/assign')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF, UserRole.DISTRIBUTOR)
  assign(@Param('id') id: string, @Body() body: { deliveryPartnerId: string }) {
    return this.deliveryService.assign(id, body.deliveryPartnerId);
  }

  @Post(':id/report')
  @Roles(UserRole.DELIVERY_PARTNER, UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  submitReport(
    @Param('id') id: string,
    @Body()
    body: { deliveredQty: number; emptyCollected: number; notes?: string },
  ) {
    return this.deliveryService.submitReport(id, body);
  }

  @Post(':id/confirm')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF, UserRole.DISTRIBUTOR)
  confirmDelivery(
    @Param('id') id: string,
    @Body()
    body: {
      brandId: string;
      deliveredQty: number;
      emptyCollected: number;
      damagedQty: number;
      notes?: string;
    },
    @Request() req,
  ) {
    return this.deliveryService.confirmDelivery(id, {
      ...body,
      staffId: req.user.id, // Staff identifier from JWT token context
    });
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF, UserRole.DISTRIBUTOR)
  findAll() {
    return this.deliveryService.findAll();
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF, UserRole.DISTRIBUTOR, UserRole.DELIVERY_PARTNER)
  findOne(@Param('id') id: string) {
    return this.deliveryService.findOne(id);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  remove(@Param('id') id: string) {
    return this.deliveryService.remove(id);
  }
}
