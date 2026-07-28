import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { UserRole } from '@prisma/client';
import { AdminCustomersService } from './admin-customers.service';

@Controller('admin/customers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
export class AdminCustomersController {
  constructor(private readonly customersService: AdminCustomersService) {}

  @Get('search')
  searchCustomers(@Query('q') query: string) {
    if (!query || query.length < 2) return [];
    return this.customersService.searchCustomers(query);
  }

  @Post('walk-in')
  createWalkInCustomer(
    @Body('phone') phone: string,
    @Body('firstName') firstName?: string,
    @Body('lastName') lastName?: string,
  ) {
    return this.customersService.createWalkInCustomer(
      phone,
      firstName,
      lastName,
    );
  }

  @Get(':id')
  getCustomerProfile(@Param('id') id: string) {
    return this.customersService.getCustomerProfile(id);
  }
}
