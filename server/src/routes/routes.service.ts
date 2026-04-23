import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RoutesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.route.findMany({
      where: { isActive: true, deletedAt: null },
      include: {
        _count: { select: { orders: true, distributors: true, deliveryPartners: true } },
      },
    });
  }

  async findById(id: string) {
    const route = await this.prisma.route.findFirst({ where: { id, deletedAt: null } });
    if (!route) throw new NotFoundException('Route not found');
    return route;
  }

  async create(data: { name: string; area: string; district: string; pincodes: string[]; description?: string }) {
    return this.prisma.route.create({ data });
  }

  async update(id: string, data: any) {
    await this.findById(id);
    return this.prisma.route.update({ where: { id }, data });
  }

  async delete(id: string) {
    await this.findById(id);
    return this.prisma.route.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  // Find route by pincode – used for order assignment
  async findByPincode(pincode: string) {
    return this.prisma.route.findFirst({ where: { pincodes: { has: pincode }, isActive: true } });
  }
}
