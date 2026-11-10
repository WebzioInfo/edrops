import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DeliveryEngine } from '../engines/delivery.engine';
import { OrderStatus } from '@prisma/client';

@Injectable()
export class DeliveryService {
  private readonly logger = new Logger(DeliveryService.name);

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
        status: OrderStatus.PENDING_ASSIGNMENT,
      },
    });
  }

  async generateToday() {
    return this.deliveryEngine.generateTodayDeliveries();
  }

  async assign(deliveryId: string, deliveryPartnerId: string) {
    return this.deliveryEngine.assignDelivery(deliveryId, deliveryPartnerId);
  }

  async assignBulk(deliveryIds: string[], deliveryPartnerId: string) {
    const results: any[] = [];
    for (const id of deliveryIds) {
      results.push(
        await this.deliveryEngine.assignDelivery(id, deliveryPartnerId),
      );
    }
    return results;
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

  async confirmDelivery(
    deliveryId: string,
    data: {
      brandId: string;
      deliveredQty: number;
      emptyCollected: number;
      damagedQty: number;
      notes?: string;
      staffId?: string;
    },
  ) {
    return this.deliveryEngine.confirmDelivery(
      deliveryId,
      data.brandId,
      data.deliveredQty,
      data.emptyCollected,
      data.damagedQty,
      data.notes,
      data.staffId,
    );
  }

  async updateStatus(deliveryId: string, status: OrderStatus, reason?: string) {
    if (
      status === OrderStatus.CANCELLED ||
      status === OrderStatus.RESCHEDULED
    ) {
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

    if (status === OrderStatus.FAILED) {
      return this.deliveryEngine.failDelivery(
        deliveryId,
        reason || 'Failed delivery',
      );
    }

    if (status === OrderStatus.DELIVERED) {
      // NOTE: For true delivery completion we usually need confirmed qtys.
      // We will assume the required quantity is fully delivered for this test endpoint.
      const delivery = await this.prisma.delivery.findUnique({
        where: { id: deliveryId },
      });
      const brand = await this.prisma.brand.findFirst();
      return this.deliveryEngine.confirmDelivery(
        deliveryId,
        brand?.id || '',
        delivery?.requiredQuantity || 1,
        0, // empty collected
        0, // damaged
        reason || 'Marked delivered via status API',
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
    const monday = new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), diff),
    );
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

    // Filter out deliveries that belong to future weeks only if no explicit year/month is filtered
    if (!year && !month) {
      whereClause.scheduledFor = {
        ...(whereClause.scheduledFor || {}),
        lte:
          whereClause.scheduledFor?.lte &&
          whereClause.scheduledFor.lte < currentWeekEnd
            ? whereClause.scheduledFor.lte
            : currentWeekEnd,
      };
    }

    const deliveries = await this.prisma.delivery.findMany({
      where: whereClause,
      include: {
        report: true,
        address: true,
      },
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
      end.setHours(23, 59, 59, 999);

      const weekKey = start.toISOString();

      if (!weeksMap.has(weekKey)) {
        // Simple ISO week calculation
        const dDate = new Date(
          Date.UTC(start.getFullYear(), start.getMonth(), start.getDate()),
        );
        const dayNum = dDate.getUTCDay() || 7;
        dDate.setUTCDate(dDate.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(dDate.getUTCFullYear(), 0, 1));
        const weekNo = Math.ceil(
          ((dDate.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
        );

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
          deliveries: [],
        });
      }

      const weekData = weeksMap.get(weekKey);
      let verification: any = null;
      if (d.report?.staffNotes) {
        try {
          verification = JSON.parse(d.report.staffNotes);
        } catch {}
      }
      weekData.deliveries.push({
        ...d,
        verification,
      });

      globalStats.totalDeliveries++;

      if (d.status === OrderStatus.DELIVERED) {
        weekData.stats.delivered++;
        globalStats.deliveredCount++;
      } else if (
        d.status === OrderStatus.FAILED ||
        d.status === OrderStatus.RESCHEDULED
      ) {
        weekData.stats.missed++;
        globalStats.missedCount++;
      } else if (d.status === OrderStatus.CANCELLED) {
        weekData.stats.cancelled++;
        globalStats.cancelledCount++;
      } else {
        weekData.stats.scheduled++;
        globalStats.scheduledCount++;
      }
    }

    const completedOrMissed =
      globalStats.deliveredCount + globalStats.missedCount;
    globalStats.successRate =
      completedOrMissed > 0
        ? Math.round((globalStats.deliveredCount / completedOrMissed) * 100)
        : 0;

    const weeks = Array.from(weeksMap.values());
    weeks.forEach((w) => {
      const total =
        w.stats.scheduled +
        w.stats.delivered +
        w.stats.missed +
        w.stats.cancelled;
      w.stats.total = total;

      const weekCompletedOrMissed = w.stats.delivered + w.stats.missed;
      w.stats.successRate =
        weekCompletedOrMissed > 0
          ? Math.round((w.stats.delivered / weekCompletedOrMissed) * 100)
          : 0;
    });

    return {
      summary: globalStats,
      weeks: weeks.sort(
        (a, b) => a.startDate.getTime() - b.startDate.getTime(),
      ),
    };
  }

  async findAll() {
    return this.prisma.delivery.findMany({
      include: {
        customer: {
          include: {
            user: true,
            jarBalances: true,
            jarDeposits: true,
            jarOwnerships: true,
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
            jarBalances: true,
            jarDeposits: true,
            jarOwnerships: true,
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

    // Query active pending verification delivery for this customer
    const pendingVerif = await this.prisma.delivery.findFirst({
      where: {
        customerId: customer.id,
        status: { notIn: [OrderStatus.DELIVERED, OrderStatus.CANCELLED] },
        report: {
          staffNotes: {
            contains: 'PENDING_VERIFICATION',
          },
        },
      },
      include: { report: true, address: true },
      orderBy: { scheduledFor: 'desc' },
    });

    const summaryResult: any = await this.getWeeklySummary(customer.id, year, month, status);
    if (pendingVerif) {
      let verification = null;
      try {
        verification = JSON.parse(pendingVerif.report?.staffNotes || '');
      } catch {}
      summaryResult.pendingVerification = {
        ...pendingVerif,
        verification,
      };
    }
    return summaryResult;
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
        customer: { include: { user: true, jarBalances: true } },
        address: true,
        assignment: {
          include: { deliveryPartner: { include: { user: true } } },
        },
        report: true,
      },
    });
  }

  async getDailyDeliveries(dateStr?: string) {
    const targetDateStr = dateStr || new Date().toISOString().split('T')[0];

    // Query +/- 1 day to catch any timezone discrepancies
    const baseDate = new Date(targetDateStr);
    const startRange = new Date(baseDate);
    startRange.setDate(startRange.getDate() - 1);
    const endRange = new Date(baseDate);
    endRange.setDate(endRange.getDate() + 1);

    const rawDeliveries = await this.prisma.delivery.findMany({
      where: {
        scheduledFor: {
          gte: startRange,
          lte: endRange,
        },
      },
      include: {
        customer: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                phone: true,
                email: true,
                isActive: true,
              },
            },
            addresses: true,
            jarBalances: true,
            jarDeposits: true,
            jarOwnerships: true,
          },
        },
        address: true,
        assignment: {
          include: { deliveryPartner: { include: { user: true } } },
        },
        report: true,
      },
      orderBy: { scheduledFor: 'asc' },
    });

    const matchesTarget = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const localStr = `${year}-${month}-${day}`;
      const isoStr = d.toISOString().split('T')[0];
      return localStr === targetDateStr || isoStr === targetDateStr;
    };

    const deliveries = rawDeliveries
      .filter((d) => matchesTarget(d.scheduledFor))
      .map((d) => {
        let verification: any = null;
        if (d.report?.staffNotes) {
          try {
            verification = JSON.parse(d.report.staffNotes);
          } catch {
            // Not a JSON verification payload
          }
        }
        return {
          ...d,
          verification,
        };
      });

    const metrics = {
      total: deliveries.length,
      delivered: deliveries.filter((d) => d.status === OrderStatus.DELIVERED).length,
      pendingVerification: deliveries.filter(
        (d) =>
          d.verification?.verificationStatus === 'PENDING_VERIFICATION' &&
          d.status !== OrderStatus.DELIVERED,
      ).length,
      pendingDispatch: deliveries.filter(
        (d) =>
          d.status !== OrderStatus.DELIVERED &&
          d.verification?.verificationStatus !== 'PENDING_VERIFICATION',
      ).length,
    };

    return {
      date: targetDateStr,
      metrics,
      deliveries,
    };
  }

  async quickDispatch(
    data: {
      customerId: string;
      scheduledFor?: string;
      deliveredQty: number;
      emptyCollected: number;
      notes?: string;
      requireVerification?: boolean;
    },
    staffUser?: any,
  ) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: data.customerId },
      include: { addresses: true, user: true },
    });
    if (!customer) throw new BadRequestException('Customer not found');

    const address =
      customer.addresses.find((a) => a.isDefault) || customer.addresses[0];
    if (!address) {
      throw new BadRequestException('Customer has no registered delivery address.');
    }

    const scheduledDate = data.scheduledFor
      ? new Date(data.scheduledFor)
      : new Date();
    scheduledDate.setHours(0, 0, 0, 0);

    const requireVerification = data.requireVerification !== false;

    let delivery = await this.prisma.delivery.findFirst({
      where: {
        customerId: data.customerId,
        scheduledFor: scheduledDate,
      },
      include: { report: true },
    });

    if (!delivery) {
      delivery = await this.prisma.delivery.create({
        data: {
          customerId: data.customerId,
          addressId: address.id,
          scheduledFor: scheduledDate,
          requiredQuantity: Number(data.deliveredQty) || 1,
          status: requireVerification
            ? OrderStatus.OUT_FOR_DELIVERY
            : OrderStatus.DELIVERED,
        },
        include: { report: true },
      });
    }

    return this.requestDeliveryVerification(delivery.id, {
      deliveredQty: data.deliveredQty,
      emptyCollected: data.emptyCollected || 0,
      notes: data.notes,
      requireVerification,
    });
  }

  async requestDeliveryVerification(
    deliveryId: string,
    data: {
      deliveredQty: number;
      emptyCollected: number;
      notes?: string;
      requireVerification?: boolean;
    },
  ) {
    const delivery = await this.prisma.delivery.findUnique({
      where: { id: deliveryId },
      include: { customer: { include: { user: true } }, report: true },
    });
    if (!delivery) throw new BadRequestException('Delivery not found');

    const requireVerification = data.requireVerification !== false;

    if (!requireVerification) {
      return this.forceVerifyByStaff(deliveryId, {
        deliveredQty: data.deliveredQty,
        emptyCollected: data.emptyCollected,
        notes: data.notes,
      });
    }

    const verificationPayload = {
      verificationStatus: 'PENDING_VERIFICATION',
      deliveredQty: Number(data.deliveredQty),
      emptyCollected: Number(data.emptyCollected) || 0,
      requestedAt: new Date().toISOString(),
      staffNotes: data.notes || '',
    };

    await this.prisma.deliveryReport.upsert({
      where: { deliveryId },
      create: {
        deliveryId,
        partnerDeliveredQty: Number(data.deliveredQty),
        partnerEmptyCollected: Number(data.emptyCollected) || 0,
        partnerNotes: data.notes,
        staffNotes: JSON.stringify(verificationPayload),
      },
      update: {
        partnerDeliveredQty: Number(data.deliveredQty),
        partnerEmptyCollected: Number(data.emptyCollected) || 0,
        partnerNotes: data.notes,
        staffNotes: JSON.stringify(verificationPayload),
      },
    });

    const updatedDelivery = await this.prisma.delivery.update({
      where: { id: deliveryId },
      data: {
        status: OrderStatus.OUT_FOR_DELIVERY,
        requiredQuantity: Number(data.deliveredQty),
      },
      include: {
        customer: { include: { user: true, addresses: true } },
        address: true,
        report: true,
      },
    });

    // Notify customer
    try {
      await this.prisma.notification.create({
        data: {
          userId: delivery.customer.userId,
          type: 'DELIVERY_UPDATE',
          title: 'Water Delivery Verification Needed',
          message: `Staff marked ${data.deliveredQty} jar(s) delivered today. Please tap to confirm your delivery receipt.`,
          link: '/customer/deliveries',
          metadata: {
            deliveryId,
            deliveredQty: Number(data.deliveredQty),
            emptyCollected: Number(data.emptyCollected) || 0,
            action: 'VERIFY_DELIVERY',
          },
        },
      });
    } catch (err) {
      this.logger.warn(`Could not create notification for customer: ${err}`);
    }

    return {
      ...updatedDelivery,
      verification: verificationPayload,
    };
  }

  async verifyDeliveryByCustomer(
    deliveryId: string,
    data: { verified: boolean; feedback?: string; reason?: string },
    user?: any,
  ) {
    const delivery = await this.prisma.delivery.findUnique({
      where: { id: deliveryId },
      include: { customer: { include: { user: true } }, report: true },
    });
    if (!delivery) throw new BadRequestException('Delivery not found');

    if (data.verified) {
      const brand = await this.prisma.brand.findFirst();
      const deliveredQty =
        delivery.report?.partnerDeliveredQty ||
        delivery.requiredQuantity ||
        1;
      const emptyCollected = delivery.report?.partnerEmptyCollected || 0;

      await this.deliveryEngine.confirmDelivery(
        deliveryId,
        brand?.id || '',
        deliveredQty,
        emptyCollected,
        0,
        data.feedback || 'Verified by Customer',
      );

      const updatedPayload = {
        verificationStatus: 'VERIFIED',
        deliveredQty,
        emptyCollected,
        verifiedAt: new Date().toISOString(),
        customerFeedback: data.feedback || 'Confirmed by customer',
      };

      await this.prisma.deliveryReport.update({
        where: { deliveryId },
        data: {
          staffNotes: JSON.stringify(updatedPayload),
          confirmedDeliveredQty: deliveredQty,
          confirmedEmptyCollected: emptyCollected,
        },
      });

      return {
        success: true,
        status: OrderStatus.DELIVERED,
        verification: updatedPayload,
      };
    } else {
      const updatedPayload = {
        verificationStatus: 'DISPUTED',
        disputeReason: data.reason || 'Customer reported delivery not received',
        disputedAt: new Date().toISOString(),
      };

      await this.deliveryEngine.failDelivery(
        deliveryId,
        data.reason || 'Customer reported delivery not received',
      );

      await this.prisma.deliveryReport.update({
        where: { deliveryId },
        data: {
          staffNotes: JSON.stringify(updatedPayload),
        },
      });

      return {
        success: true,
        status: OrderStatus.FAILED,
        verification: updatedPayload,
      };
    }
  }

  async forceVerifyByStaff(
    deliveryId: string,
    data: { deliveredQty: number; emptyCollected: number; notes?: string },
    staffUser?: any,
  ) {
    const delivery = await this.prisma.delivery.findUnique({
      where: { id: deliveryId },
      include: { report: true },
    });
    if (!delivery) throw new BadRequestException('Delivery not found');

    const brand = await this.prisma.brand.findFirst();
    const deliveredQty =
      Number(data.deliveredQty) || delivery.requiredQuantity || 1;
    const emptyCollected = Number(data.emptyCollected) || 0;

    await this.deliveryEngine.confirmDelivery(
      deliveryId,
      brand?.id || '',
      deliveredQty,
      emptyCollected,
      0,
      data.notes || 'Verified directly by staff override',
    );

    const verificationPayload = {
      verificationStatus: 'VERIFIED',
      deliveredQty,
      emptyCollected,
      verifiedAt: new Date().toISOString(),
      staffNotes: data.notes || 'Verified by staff override',
    };

    await this.prisma.deliveryReport.upsert({
      where: { deliveryId },
      create: {
        deliveryId,
        partnerDeliveredQty: deliveredQty,
        partnerEmptyCollected: emptyCollected,
        staffNotes: JSON.stringify(verificationPayload),
      },
      update: {
        partnerDeliveredQty: deliveredQty,
        partnerEmptyCollected: emptyCollected,
        staffNotes: JSON.stringify(verificationPayload),
      },
    });

    return {
      success: true,
      status: OrderStatus.DELIVERED,
      verification: verificationPayload,
    };
  }

  async remove(id: string) {
    return this.prisma.delivery.delete({ where: { id } });
  }
}
