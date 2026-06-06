import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TicketPriority } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSupportTicketDto } from './dto/create-support-ticket.dto';

@Injectable()
export class SupportService {
  constructor(private prisma: PrismaService) {}

  async findMyTickets(customerId: string) {
    return this.prisma.supportTicket.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async createTicket(customerId: string, dto: CreateSupportTicketDto) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
    });
    if (!customer) {
      throw new NotFoundException('Customer profile not found');
    }

    const priority = dto.priority ?? TicketPriority.MEDIUM;
    if (!Object.values(TicketPriority).includes(priority)) {
      throw new BadRequestException('Invalid ticket priority');
    }

    return this.prisma.supportTicket.create({
      data: {
        customerId,
        subject: dto.subject.trim(),
        description: dto.description.trim(),
        priority,
      },
    });
  }
}
