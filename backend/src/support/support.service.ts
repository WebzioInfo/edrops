import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TicketPriority } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TicketStatus } from '@prisma/client';
import { CreateSupportTicketDto } from './dto/create-support-ticket.dto';
import { NotificationService } from '../notification/notification.service';
import { ReplyTicketDto } from './dto/reply-ticket.dto';
import { EventsGateway } from '../events/events.gateway';

@Injectable()
export class SupportService {
  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
    private eventsGateway: EventsGateway,
  ) {}

  async getOrCreateCustomerLiveChat(customerId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      include: { user: true },
    });
    if (!customer) {
      throw new NotFoundException('Customer profile not found');
    }

    let ticket = await this.prisma.supportTicket.findFirst({
      where: {
        customerId,
        category: 'LIVE_CHAT',
        status: {
          in: [
            TicketStatus.OPEN,
            TicketStatus.ASSIGNED,
            TicketStatus.IN_PROGRESS,
            TicketStatus.WAITING_FOR_CUSTOMER,
          ],
        },
      },
      include: {
        customer: { include: { user: true } },
        assignedTo: true,
        messages: {
          where: { isInternal: false },
          include: { user: true, attachments: true },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (!ticket) {
      const newTicket = await this.prisma.supportTicket.create({
        data: {
          customerId,
          subject: 'Live Support Chat',
          description: `Customer live chat initiated by ${customer.user?.firstName || 'Customer'}`,
          category: 'LIVE_CHAT',
          priority: TicketPriority.MEDIUM,
          status: TicketStatus.OPEN,
        },
      });

      // Send initial welcome message from staff/system
      await this.prisma.supportMessage.create({
        data: {
          ticketId: newTicket.id,
          userId: customer.userId,
          message: 'Hello! I need assistance with my water delivery service.',
          isInternal: false,
        },
      });

      ticket = await this.prisma.supportTicket.findUnique({
        where: { id: newTicket.id },
        include: {
          customer: { include: { user: true } },
          assignedTo: true,
          messages: {
            where: { isInternal: false },
            include: { user: true, attachments: true },
            orderBy: { createdAt: 'asc' },
          },
        },
      });
    }

    if (ticket?.messages) {
      ticket.messages = ticket.messages.filter((m) => !m.isInternal);
    }

    return ticket;
  }

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

    const ticket = await this.prisma.supportTicket.create({
      data: {
        customerId,
        subject: dto.subject.trim(),
        description: dto.description.trim(),
        category: dto.category?.trim(),
        imageUrl: dto.imageUrl?.trim(),
        invoiceUrl: dto.invoiceUrl?.trim(),
        priority,
      },
    });

    this.notificationService.notifySupportTicket({
      ticketId: ticket.id,
      subject: ticket.subject,
      customerId,
    });

    return ticket;
  }

  async getTicketById(ticketId: string, customerId?: string | null) {
    const where: any = { id: ticketId };
    if (customerId) {
      where.customerId = customerId;
    }

    const ticket = await this.prisma.supportTicket.findUnique({
      where,
      include: {
        customer: true,
        assignedTo: true,
        messages: {
          include: {
            user: true,
            attachments: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        activities: {
          include: { user: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    // Filter out internal messages if customer
    if (customerId) {
      ticket.messages = ticket.messages.filter((m) => !m.isInternal);
      ticket.activities = []; // customers don't need activity log
    }

    return ticket;
  }

  async addMessage(
    ticketId: string,
    userId: string,
    userRole: string,
    customerId: string | null,
    dto: ReplyTicketDto,
  ) {
    const cleanText = dto.message?.trim();
    if (!cleanText) {
      throw new BadRequestException('Message content cannot be empty');
    }

    const ticket = await this.getTicketById(ticketId, customerId);

    // If it's a customer, they can only send public messages
    const isInternal = userRole === 'CUSTOMER' ? false : !!dto.isInternal;

    const message = await this.prisma.supportMessage.create({
      data: {
        ticketId,
        userId,
        message: cleanText,
        isInternal,
        attachments: {
          create:
            dto.attachments?.map((a) => ({
              fileUrl: a.fileUrl,
              fileName: a.fileName,
              fileType: a.fileType,
            })) || [],
        },
      },
      include: {
        user: true,
        attachments: true,
      },
    });

    // Update ticket updatedAt and reopen if customer sends a message on resolved or closed ticket
    const shouldReopen =
      userRole === 'CUSTOMER' &&
      (ticket.status === TicketStatus.RESOLVED || ticket.status === TicketStatus.CLOSED);

    await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        updatedAt: new Date(),
        ...(shouldReopen ? { status: TicketStatus.OPEN } : {}),
      },
    });

    if (shouldReopen) {
      this.notificationService.notifySupportStatusUpdate({
        ticketId,
        status: TicketStatus.OPEN,
      });
    }

    // Emit event via notification service
    this.notificationService.notifySupportReply({
      ticketId,
      message,
    });

    // Direct multi-room broadcast
    this.eventsGateway.emitSupportReply(ticketId, ticket.customerId, message);

    return message;
  }

  async getStaffTickets(query: any) {
    const { status, priority, category, search } = query;
    const where: any = {};

    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (category) where.category = category;

    if (search) {
      where.OR = [
        { id: { contains: search, mode: 'insensitive' } },
        { subject: { contains: search, mode: 'insensitive' } },
        {
          customer: {
            user: {
              OR: [
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search, mode: 'insensitive' } },
              ],
            },
          },
        },
      ];
    }

    return this.prisma.supportTicket.findMany({
      where,
      include: {
        customer: { include: { user: true } },
        assignedTo: true,
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { user: true },
        },
        _count: {
          select: { messages: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async updateTicketStatus(id: string, status: TicketStatus, userId: string) {
    const ticket = await this.prisma.supportTicket.update({
      where: { id },
      data: { status, updatedAt: new Date() },
    });

    await this.prisma.supportActivityLog.create({
      data: {
        ticketId: id,
        userId,
        action: 'STATUS_CHANGED',
        details: status,
      },
    });

    this.notificationService.notifySupportStatusUpdate({
      ticketId: id,
      status,
    });

    return ticket;
  }

  async assignTicket(id: string, staffId: string, userId: string) {
    const ticket = await this.prisma.supportTicket.update({
      where: { id },
      data: {
        assignedToId: staffId,
        status: TicketStatus.ASSIGNED,
        updatedAt: new Date(),
      },
      include: { assignedTo: true },
    });

    await this.prisma.supportActivityLog.create({
      data: {
        ticketId: id,
        userId,
        action: 'ASSIGNED',
        details: staffId,
      },
    });

    this.notificationService.notifySupportAssigned({
      ticketId: id,
      ticket,
    });

    return ticket;
  }

  async deleteStaffMessage(messageId: string, userId: string, userRole: string) {
    const message = await this.prisma.supportMessage.findUnique({
      where: { id: messageId },
    });
    if (!message) {
      throw new NotFoundException('Message not found');
    }

    // Admins can delete any message. Staff can delete any internal note or their own message.
    if (userRole !== 'ADMIN' && message.userId !== userId && !message.isInternal) {
      throw new ForbiddenException('You do not have permission to delete this message');
    }

    await this.prisma.supportMessage.delete({
      where: { id: messageId },
    });

    // Notify staff in real time
    this.eventsGateway.emitEvent('staff-notifications', 'SUPPORT_MESSAGE_DELETED', {
      ticketId: message.ticketId,
      messageId,
    });
    this.eventsGateway.emitEvent(`ticket_${message.ticketId}`, 'SUPPORT_MESSAGE_DELETED', {
      ticketId: message.ticketId,
      messageId,
    });

    return { success: true, messageId, ticketId: message.ticketId };
  }

  async getAdminAnalytics() {
    const total = await this.prisma.supportTicket.count();
    const open = await this.prisma.supportTicket.count({
      where: { status: 'OPEN' },
    });

    // Simple mock logic for overdue (In real app, check createdAt + SLAs)
    // High = 4h, Med = 24h, Low = 48h
    const now = new Date();
    const highLimit = new Date(now.getTime() - 4 * 60 * 60 * 1000);

    const overdue = await this.prisma.supportTicket.count({
      where: {
        status: { notIn: ['RESOLVED', 'CLOSED'] },
        priority: 'HIGH',
        createdAt: { lt: highLimit },
      },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const resolvedToday = await this.prisma.supportTicket.count({
      where: {
        status: 'RESOLVED',
        updatedAt: { gte: today },
      },
    });

    const byCategory = await this.prisma.supportTicket.groupBy({
      by: ['category'],
      _count: { _all: true },
    });

    const byStatus = await this.prisma.supportTicket.groupBy({
      by: ['status'],
      _count: { _all: true },
    });

    return {
      totalTickets: total,
      openTickets: open,
      overdueTickets: overdue,
      resolvedToday,
      byCategory,
      byStatus,
    };
  }
}
