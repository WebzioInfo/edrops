import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { startOfDay, endOfDay, startOfMonth, endOfMonth, subDays } from 'date-fns';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardStats() {
    const today = new Date();

    const [
      totalOrders,
      todayOrders,
      totalRevenue,
      todayRevenue,
      activeSubscriptions,
      totalCustomers,
      pendingOrders,
      deliveredToday,
    ] = await Promise.all([
      this.prisma.order.count({ where: { deletedAt: null } }),
      this.prisma.order.count({ where: { createdAt: { gte: startOfDay(today), lte: endOfDay(today) } } }),
      this.prisma.order.aggregate({ where: { status: 'DELIVERED' }, _sum: { payableAmount: true } }),
      this.prisma.order.aggregate({
        where: { status: 'DELIVERED', deliveredAt: { gte: startOfDay(today), lte: endOfDay(today) } },
        _sum: { payableAmount: true },
      }),
      this.prisma.subscription.count({ where: { status: 'ACTIVE', deletedAt: null } }),
      this.prisma.user.count({ where: { role: 'CUSTOMER', deletedAt: null } }),
      this.prisma.order.count({ where: { status: 'PENDING' } }),
      this.prisma.order.count({ where: { status: 'DELIVERED', deliveredAt: { gte: startOfDay(today), lte: endOfDay(today) } } }),
    ]);

    return {
      totalOrders,
      todayOrders,
      totalRevenue: totalRevenue._sum.payableAmount ?? 0,
      todayRevenue: todayRevenue._sum.payableAmount ?? 0,
      activeSubscriptions,
      totalCustomers,
      pendingOrders,
      deliveredToday,
    };
  }

  async getRevenueChart(days = 30) {
    const from = subDays(new Date(), days);
    const orders = await this.prisma.order.findMany({
      where: { status: 'DELIVERED', deliveredAt: { gte: from } },
      select: { deliveredAt: true, payableAmount: true },
    });

    // Group by date
    const map = new Map<string, number>();
    for (const o of orders) {
      const d = o.deliveredAt?.toISOString().split('T')[0] ?? '';
      map.set(d, (map.get(d) ?? 0) + Number(o.payableAmount));
    }

    return Array.from(map.entries()).map(([date, revenue]) => ({ date, revenue })).sort((a, b) => a.date.localeCompare(b.date));
  }

  async getTopProducts(limit = 10) {
    const items = await this.prisma.orderItem.groupBy({
      by: ['productId'],
      _sum: { quantity: true, totalPrice: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: limit,
    });

    const productIds = items.map(i => i.productId);
    const products = await this.prisma.product.findMany({ where: { id: { in: productIds } } });

    return items.map(item => ({
      product: products.find(p => p.id === item.productId),
      totalQuantity: item._sum.quantity,
      totalRevenue: item._sum.totalPrice,
    }));
  }

  async getDeliveryStats() {
    const [total, delivered, failed, pending] = await Promise.all([
      this.prisma.order.count(),
      this.prisma.order.count({ where: { status: 'DELIVERED' } }),
      this.prisma.order.count({ where: { status: 'FAILED' } }),
      this.prisma.order.count({ where: { status: 'PENDING' } }),
    ]);

    return {
      total,
      delivered,
      failed,
      pending,
      successRate: total > 0 ? ((delivered / total) * 100).toFixed(1) : '0',
    };
  }
}
