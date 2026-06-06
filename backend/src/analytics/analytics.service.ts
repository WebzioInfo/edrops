import { Injectable } from '@nestjs/common';
import { CreateAnalyticsDto } from './dto/create-analytics.dto';
import { UpdateAnalyticsDto } from './dto/update-analytics.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async create(createAnalyticsDto: CreateAnalyticsDto) {
    const [totalCustomers, activeSchedules, totalJarsDelivered, revenue] =
      await Promise.all([
        this.prisma.customer.count(),
        this.prisma.deliverySchedule.count({ where: { isActive: true } }),
        this.prisma.delivery.aggregate({
          _sum: { requiredQuantity: true },
          where: { status: 'DELIVERED' },
        }),
        this.prisma.packagePurchase.aggregate({
          _sum: { amount: true },
          where: { paymentStatus: 'SUCCESS' },
        }),
      ]);

    return this.prisma.analyticsSnapshot.create({
      data: {
        date: new Date(),
        totalCustomers,
        activeSchedules,
        totalJarsDelivered: totalJarsDelivered._sum.requiredQuantity ?? 0,
        totalRevenue: revenue._sum.amount ?? 0,
        ...(createAnalyticsDto as any),
      },
    });
  }

  findAll() {
    return this.prisma.analyticsSnapshot.findMany({
      orderBy: { date: 'desc' },
      take: 100,
    });
  }

  findOne(id: string | number) {
    return this.prisma.analyticsSnapshot.findUnique({
      where: { id: String(id) },
    });
  }

  update(id: string | number, updateAnalyticsDto: UpdateAnalyticsDto) {
    return this.prisma.analyticsSnapshot.update({
      where: { id: String(id) },
      data: updateAnalyticsDto as any,
    });
  }

  async getLiveSnapshot() {
    const [totalCustomers, activeSchedules, totalJarsDelivered, revenue] =
      await Promise.all([
        this.prisma.customer.count(),
        this.prisma.deliverySchedule.count({ where: { isActive: true } }),
        this.prisma.delivery.aggregate({
          _sum: { requiredQuantity: true },
          where: { status: 'DELIVERED' },
        }),
        this.prisma.packagePurchase.aggregate({
          _sum: { amount: true },
          where: { paymentStatus: 'SUCCESS' },
        }),
      ]);

    return {
      date: new Date(),
      totalCustomers,
      activeSchedules,
      totalJarsDelivered: totalJarsDelivered._sum.requiredQuantity ?? 0,
      totalRevenue: revenue._sum.amount ?? 0,
    };
  }

  remove(id: string | number) {
    return this.prisma.analyticsSnapshot.delete({ where: { id: String(id) } });
  }
}
