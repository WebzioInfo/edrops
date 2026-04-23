import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AnalyticsService } from './analytics.service';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.ADMIN)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard')
  getDashboard() { return this.analyticsService.getDashboardStats(); }

  @Get('revenue')
  getRevenue(@Query('days') days?: string) {
    return this.analyticsService.getRevenueChart(Number(days ?? 30));
  }

  @Get('top-products')
  getTopProducts(@Query('limit') limit?: string) {
    return this.analyticsService.getTopProducts(Number(limit ?? 10));
  }

  @Get('delivery')
  getDelivery() { return this.analyticsService.getDeliveryStats(); }
}
