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
import { ReplyTicketDto } from './dto/reply-ticket.dto';
import { SupportService } from './support.service';
import { Param } from '@nestjs/common';

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

  @Get('tickets/:id')
  getTicket(@Req() req, @Param('id') id: string) {
    const isCustomer = req.user.role === 'CUSTOMER';
    const customerId = isCustomer ? req.user.customerId : null;
    return this.supportService.getTicketById(id, customerId);
  }

  @Post('tickets/:id/messages')
  replyTicket(
    @Req() req,
    @Param('id') id: string,
    @Body() body: ReplyTicketDto,
  ) {
    return this.supportService.addMessage(
      id,
      req.user.id,
      req.user.role,
      req.user.customerId,
      body,
    );
  }
}
