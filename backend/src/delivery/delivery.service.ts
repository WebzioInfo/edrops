import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DeliveryEngine } from '../engines/delivery.engine';
import { DeliveryStatus } from '@prisma/client';

@Injectable()
export class DeliveryService {
  constructor(
    private prisma: PrismaService,
    private deliveryEngine: DeliveryEngine,
  ) {}

  async create(data: any) {
    return this.prisma.delivery.create({
      data: {
        customerId: data.customerId,
        addressId: data.addressId,
        scheduledFor: new Date(data.scheduledFor),
        requiredQuantity: data.requiredQuantity,
        status: DeliveryStatus.PENDING,
      },
    });
  }

  async generateToday() {
    return this.deliveryEngine.generateTodayDeliveries();
  }

  async assign(deliveryId: string, deliveryPartnerId: string) {
    return this.deliveryEngine.assignDelivery(deliveryId, deliveryPartnerId);
  }

  async submitReport(
    deliveryId: string,
    data: { deliveredQty: number; emptyCollected: number; notes?: string },
  ) {
    return this.deliveryEngine.submitDeliveryReport(
      deliveryId,
      data.deliveredQty,
      data.emptyCollected,
      data.notes,
    );
  }

  async confirm(
    deliveryId: string,
    data: {
      deliveredQty: number;
      emptyCollected: number;
      damagedQty: number;
      notes?: string;
      staffId?: string;
    },
  ) {
    return this.deliveryEngine.confirmDelivery(
      deliveryId,
      data.deliveredQty,
      data.emptyCollected,
      data.damagedQty,
      data.notes,
      data.staffId,
    );
  }

  async updateStatus(
    deliveryId: string,
    status: DeliveryStatus,
    reason?: string,
  ) {
    if (status === DeliveryStatus.CANCELLED || status === DeliveryStatus.SKIPPED) {
      return this.prisma.delivery.update({
        where: { id: deliveryId },
        data: {
          status,
          cancelledAt: new Date(),
          report: {
            upsert: {
              create: {
                partnerDeliveredQty: 0,
                partnerEmptyCollected: 0,
                partnerNotes: reason || 'Cancelled/Skipped by user',
              },
              update: {
                partnerNotes: reason || 'Cancelled/Skipped by user',
              },
            },
          },
        },
      });
    }

    if (status === DeliveryStatus.FAILED) {
      return this.deliveryEngine.failDelivery(deliveryId, reason || 'Failed delivery');
    }

    if (status === DeliveryStatus.DELIVERED) {
      // NOTE: For true delivery completion we usually need confirmed qtys.
      // We will assume the required quantity is fully delivered for this test endpoint.
      const delivery = await this.prisma.delivery.findUnique({ where: { id: deliveryId }});
      return this.deliveryEngine.confirmDelivery(
        deliveryId,
        delivery?.requiredQuantity || 1,
        0, // empty collected
        0, // damaged
        reason || 'Marked delivered via status API'
      );
    }

    return this.prisma.delivery.update({
      where: { id: deliveryId },
      data: { status },
    });
  }

  private getMonday(d: Date) {
    const day = d.getUTCDay();
    const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), diff));
    return monday;
  }

  async getWeeklySummary(
    customerId: string,
    year?: number,
    month?: number,
    status?: string,
  ) {
    const whereClause: any = { customerId };

    if (year) {
      const start = new Date(year, month ? month - 1 : 0, 1);
      const end = new Date(year, month ? month : 12, 0, 23, 59, 59, 999);
      whereClause.scheduledFor = { gte: start, lte: end };
    }

    if (status && status !== 'ALL') {
      if (status === 'SCHEDULED') {
        whereClause.status = { in: ['PENDING', 'ASSIGNED', 'IN_TRANSIT'] };
      } else if (status === 'MISSED') {
        whereClause.status = { in: ['FAILED', 'SKIPPED'] };
      } else {
        whereClause.status = status;
      }
    }

    const now = new Date();
    const currentWeekStart = this.getMonday(now);
    const currentWeekEnd = new Date(currentWeekStart);
    currentWeekEnd.setDate(currentWeekEnd.getDate() + 6);
    currentWeekEnd.setHours(23, 59, 59, 999);

    // Filter out deliveries that belong to future weeks
    whereClause.scheduledFor = {
      ...(whereClause.scheduledFor || {}),
      lte: whereClause.scheduledFor?.lte && whereClause.scheduledFor.lte < currentWeekEnd 
        ? whereClause.scheduledFor.lte 
        : currentWeekEnd
    };

    const deliveries = await this.prisma.delivery.findMany({
      where: whereClause,
      orderBy: { scheduledFor: 'asc' },
    });

    const weeksMap = new Map();
    const globalStats = {
      totalDeliveries: 0,
      deliveredCount: 0,
      missedCount: 0,
      cancelledCount: 0,
      scheduledCount: 0,
      successRate: 0,
    };

    for (const d of deliveries) {
      const start = this.getMonday(d.scheduledFor);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      
      const weekKey = start.toISOString();
      
      if (!weeksMap.has(weekKey)) {
        // Simple ISO week calculation
        const dDate = new Date(Date.UTC(start.getFullYear(), start.getMonth(), start.getDate()));
        const dayNum = dDate.getUTCDay() || 7;
        dDate.setUTCDate(dDate.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(dDate.getUTCFullYear(),0,1));
        const weekNo = Math.ceil((((dDate.getTime() - yearStart.getTime()) / 86400000) + 1)/7);

        weeksMap.set(weekKey, {
          startDate: start,
          endDate: end,
          label: `Week #${weekNo}`,
          stats: {
            scheduled: 0,
            delivered: 0,
            missed: 0,
            cancelled: 0,
          },
          deliveries: []
        });
      }

      const weekData = weeksMap.get(weekKey);
      weekData.deliveries.push(d);
      
      globalStats.totalDeliveries++;

      if (d.status === DeliveryStatus.DELIVERED) {
        weekData.stats.delivered++;
        globalStats.deliveredCount++;
      }
      else if (d.status === DeliveryStatus.FAILED || d.status === DeliveryStatus.SKIPPED) {
        weekData.stats.missed++;
        globalStats.missedCount++;
      }
      else if (d.status === DeliveryStatus.CANCELLED) {
        weekData.stats.cancelled++;
        globalStats.cancelledCount++;
      }
      else {
        weekData.stats.scheduled++; 
        globalStats.scheduledCount++;
      }
    }

    const completedOrMissed = globalStats.deliveredCount + globalStats.missedCount;
    globalStats.successRate = completedOrMissed > 0 
      ? Math.round((globalStats.deliveredCount / completedOrMissed) * 100) 
      : 0;

    const weeks = Array.from(weeksMap.values());
    weeks.forEach(w => {
      const total = w.stats.scheduled + w.stats.delivered + w.stats.missed + w.stats.cancelled;
      w.stats.total = total;
      
      const weekCompletedOrMissed = w.stats.delivered + w.stats.missed;
      w.stats.successRate = weekCompletedOrMissed > 0 
        ? Math.round((w.stats.delivered / weekCompletedOrMissed) * 100) 
        : 0;
    });

    return {
      summary: globalStats,
      weeks: weeks.sort((a, b) => b.startDate.getTime() - a.startDate.getTime())
    };
  }

  async findAll() {
    return this.prisma.delivery.findMany({
      include: {
        customer: {
          include: {
            user: true,
            jarBalance: true,
            jarDeposit: true,
            jarOwnership: true,
          },
        },
        address: true,
        assignment: {
          include: { deliveryPartner: { include: { user: true } } },
        },
        report: true,
      },
      orderBy: { scheduledFor: 'desc' },
      take: 100,
    });
  }

  async findToday() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    return this.prisma.delivery.findMany({
      where: {
        scheduledFor: {
          gte: start,
          lte: end,
        },
      },
      include: {
        customer: {
          include: {
            user: true,
            jarBalance: true,
            jarDeposit: true,
            jarOwnership: true,
          },
        },
        address: true,
        assignment: {
          include: { deliveryPartner: { include: { user: true } } },
        },
        report: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByPartner(partnerUserId: string) {
    // Find the partner record by user id
    const partner = await this.prisma.deliveryPartner.findUnique({
      where: { userId: partnerUserId },
    });
    if (!partner) return [];

    return this.prisma.delivery.findMany({
      where: {
        assignment: {
          deliveryPartnerId: partner.id,
        },
      },
      include: {
        customer: { include: { user: true } },
        address: true,
        report: true,
      },
      orderBy: { scheduledFor: 'asc' },
    });
  }

  async findByCustomer(customerId: string) {
    return this.prisma.delivery.findMany({
      where: { customerId },
      include: { address: true, report: true },
      orderBy: { scheduledFor: 'desc' },
    });
  }

  async findWeeklySummaryByCustomerUser(
    userId: string,
    year?: number,
    month?: number,
    status?: string,
  ) {
    const customer = await this.prisma.customer.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!customer) return { summary: {}, weeks: [] };
    return this.getWeeklySummary(customer.id, year, month, status);
  }

  async findHistoryByCustomerUser(userId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!customer) return [];

    const deliveries = await this.findByCustomer(customer.id);
    return deliveries.map((delivery) => ({
      id: delivery.id,
      scheduledFor: delivery.scheduledFor,
      deliveredAt:
        delivery.report?.confirmedAt ??
        delivery.report?.partnerSubmittedAt ??
        null,
      status: delivery.status,
      quantity:
        delivery.report?.confirmedDeliveredQty ??
        delivery.report?.partnerDeliveredQty ??
        delivery.requiredQuantity,
      emptyJarsCollected:
        delivery.report?.confirmedEmptyCollected ??
        delivery.report?.partnerEmptyCollected ??
        0,
      notes:
        delivery.report?.staffNotes ?? delivery.report?.partnerNotes ?? null,
    }));
  }

  async findOne(id: string) {
    return this.prisma.delivery.findUnique({
      where: { id },
      include: {
        customer: { include: { user: true, jarBalance: true } },
        address: true,
        assignment: {
          include: { deliveryPartner: { include: { user: true } } },
        },
        report: true,
      },
    });
  }

  async remove(id: string) {
    return this.prisma.delivery.delete({ where: { id } });
  }
}
