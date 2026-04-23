import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DistributorsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.distributor.findMany({
      where: { isActive: true, deletedAt: null },
      include: {
        user: { select: { id: true, name: true, phone: true, email: true } },
        route: { select: { id: true, name: true, district: true } },
        _count: { select: { orders: true, deliveryPartners: true } },
      },
    });
  }

  async findById(id: string) {
    const dist = await this.prisma.distributor.findFirst({
      where: { id, deletedAt: null },
      include: {
        user: { select: { id: true, name: true, phone: true } },
        route: true,
        deliveryPartners: { include: { user: { select: { id: true, name: true, phone: true } } } },
      },
    });
    if (!dist) throw new NotFoundException('Distributor not found');
    return dist;
  }

  async create(data: { userId: string; routeId?: string; commissionRate?: number }) {
    return this.prisma.distributor.create({
      data: { ...data },
      include: { user: true },
    });
  }

  async update(id: string, data: { routeId?: string; commissionRate?: number; isActive?: boolean }) {
    await this.findById(id);
    return this.prisma.distributor.update({ where: { id }, data });
  }

  async getPendingOrders(distributorId: string) {
    return this.prisma.order.findMany({
      where: { distributorId, status: 'PENDING' },
      include: {
        user: { select: { id: true, name: true, phone: true } },
        address: true,
        items: { include: { product: true } },
      },
    });
  }
}
