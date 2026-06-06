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
