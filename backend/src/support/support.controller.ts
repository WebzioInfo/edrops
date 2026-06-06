import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateSupportTicketDto } from './dto/create-support-ticket.dto';
import { SupportService } from './support.service';

@Controller('support')
@UseGuards(JwtAuthGuard)
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Get('tickets')
  findMyTickets(@Req() req) {
    if (!req.user.customerId) {
      throw new BadRequestException(
        'Only customer accounts can access support tickets',
      );
    }
    return this.supportService.findMyTickets(req.user.customerId);
  }

  @Post('tickets')
  createTicket(@Req() req, @Body() body: CreateSupportTicketDto) {
    if (!req.user.customerId) {
      throw new BadRequestException(
        'Only customer accounts can create support tickets',
      );
    }
    return this.supportService.createTicket(req.user.customerId, body);
  }
}
