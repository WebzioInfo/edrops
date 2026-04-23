import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CrmService {
  constructor(private readonly prisma: PrismaService) {}

  async getCustomerProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        addresses: true,
        orders: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: { items: { include: { product: true } } },
        },
        subscriptions: { include: { items: { include: { product: true } } } },
        wallet: true,
        supportTickets: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
    });

    if (!user) return null;

    const totalOrders = await this.prisma.order.count({ where: { userId } });
    const totalSpend = await this.prisma.order.aggregate({
      where: { userId, status: 'DELIVERED' },
      _sum: { payableAmount: true },
    });

    const { password, ...safeUser } = user as any;
    return {
      ...safeUser,
      stats: {
        totalOrders,
        totalSpend: totalSpend._sum.payableAmount ?? 0,
      },
    };
  }

  async getAllTickets(status?: string) {
    return this.prisma.supportTicket.findMany({
      where: { deletedAt: null, ...(status && { status: status as any }) },
      include: { user: { select: { id: true, name: true, phone: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createTicket(userId: string, data: { subject: string; description: string; priority?: string }) {
    return this.prisma.supportTicket.create({
      data: { userId, ...data },
    });
  }

  async updateTicket(id: string, data: { status?: string; resolvedAt?: Date }) {
    return this.prisma.supportTicket.update({ where: { id }, data: data as any });
  }

  async getCustomerList(search?: string) {
    return this.prisma.user.findMany({
      where: {
        role: 'CUSTOMER',
        deletedAt: null,
        ...(search && {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search } },
          ],
        }),
      },
      select: {
        id: true, name: true, phone: true, email: true, isActive: true, createdAt: true,
        _count: { select: { orders: true, subscriptions: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
