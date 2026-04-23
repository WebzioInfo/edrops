import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CrmService } from './crm.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@UseGuards(AuthGuard('jwt'))
@Controller('crm')
export class CrmController {
  constructor(private readonly crmService: CrmService) {}

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Get('customers')
  getCustomers(@Query('search') search?: string) {
    return this.crmService.getCustomerList(search);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Get('customers/:id')
  getProfile(@Param('id') id: string) {
    return this.crmService.getCustomerProfile(id);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Get('tickets')
  getTickets(@Query('status') status?: string) {
    return this.crmService.getAllTickets(status);
  }

  @Post('tickets')
  createTicket(@CurrentUser() user: any, @Body() body: any) {
    return this.crmService.createTicket(user.userId, body);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Patch('tickets/:id')
  updateTicket(@Param('id') id: string, @Body() body: any) {
    return this.crmService.updateTicket(id, body);
  }
}
