import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { SupportService } from './support.service';
import { TicketStatus } from '@prisma/client';

@Controller('staff/support')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('STAFF', 'MANAGER', 'ADMIN')
export class StaffSupportController {
  constructor(private readonly supportService: SupportService) {}

  @Get('tickets')
  getTickets(@Query() query: any) {
    return this.supportService.getStaffTickets(query);
  }

  @Patch('tickets/:id/status')
  updateStatus(
    @Req() req,
    @Param('id') id: string,
    @Body('status') status: TicketStatus,
  ) {
    return this.supportService.updateTicketStatus(id, status, req.user.id);
  }

  @Patch('tickets/:id/assign')
  assignTicket(
    @Req() req,
    @Param('id') id: string,
    @Body('staffId') staffId: string,
  ) {
    return this.supportService.assignTicket(id, staffId, req.user.id);
  }
}
