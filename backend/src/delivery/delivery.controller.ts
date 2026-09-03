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

@Controller(['delivery', 'delivery-partner'])
@UseGuards(AuthGuard('jwt'))
export class DeliveryController {
  constructor(
    private readonly deliveryService: DeliveryService,
    private readonly partnerProfitsService: PartnerProfitsService,
  ) {}

  @Post()
  create(@Body() data: any) {
    return this.deliveryService.create(data);
  }

  @Post('generate')
  generateToday() {
    return this.deliveryService.generateToday();
  }

  @Get('today')
  findToday() {
    return this.deliveryService.findToday();
  }

  @Get(['partner/my-tasks', 'my-tasks'])
  findMyTasks(@Request() req) {
    const userId = req.user?.sub || req.user?.id || req.user?.userId;
    return this.deliveryService.findByPartner(userId);
  }

  @Get(['partner/profits', 'profits'])
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
  findMyHistory(@Request() req) {
    return this.deliveryService.findHistoryByCustomerUser(req.user.id);
  }

  @Get('weekly-summary')
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
  findByCustomer(@Param('customerId') customerId: string) {
    return this.deliveryService.findByCustomer(customerId);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() body: { status: any; reason?: string },
  ) {
    return this.deliveryService.updateStatus(id, body.status, body.reason);
  }

  @Post(':id/assign')
  assign(@Param('id') id: string, @Body() body: { deliveryPartnerId: string }) {
    return this.deliveryService.assign(id, body.deliveryPartnerId);
  }

  @Post(':id/report')
  submitReport(
    @Param('id') id: string,
    @Body()
    body: { deliveredQty: number; emptyCollected: number; notes?: string },
  ) {
    return this.deliveryService.submitReport(id, body);
  }

  @Post(':id/confirm')
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
  findAll() {
    return this.deliveryService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.deliveryService.findOne(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.deliveryService.remove(id);
  }
}
