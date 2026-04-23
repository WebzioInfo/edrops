import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DeliveryService {
  constructor(private readonly prisma: PrismaService) {}

  async getPartners(distributorId?: string, isFreelance?: boolean) {
    return this.prisma.deliveryPartner.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        ...(distributorId && { distributorId }),
        ...(isFreelance !== undefined && { isFreelance }),
      },
      include: {
        user: { select: { id: true, name: true, phone: true } },
        route: { select: { id: true, name: true } },
        _count: { select: { orders: true } },
      },
    });
  }

  async register(userId: string, data: {
    distributorId?: string; routeId?: string;
    vehicleType?: string; licenseNumber?: string; isFreelance?: boolean;
  }) {
    return this.prisma.deliveryPartner.create({
      data: { userId, ...data },
      include: { user: true },
    });
  }

  async getMyOrders(userId: string) {
    const partner = await this.prisma.deliveryPartner.findUnique({
      where: { userId },
    });
    if (!partner) throw new NotFoundException('Delivery partner profile not found');

    return this.prisma.order.findMany({
      where: {
        deliveryPartnerId: partner.id,
        status: { in: ['ASSIGNED', 'OUT_FOR_DELIVERY'] },
      },
      include: {
        user: { select: { name: true, phone: true } },
        address: true,
        items: { include: { product: { select: { name: true, imageUrl: true } } } },
      },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  async confirmDelivery(orderId: string, partnerId: string, data: { jarCollected?: number; notes?: string }) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId },
      include: { deliveryPartner: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.deliveryPartner?.userId !== partnerId) {
      throw new BadRequestException('Not assigned to this order');
    }

    // Mark jar collection
    if (data.jarCollected && data.jarCollected > 0) {
      await this.prisma.jarLifecycle.create({
        data: {
          customerId: order.userId,
          orderId: order.id,
          action: 'COLLECTED',
          quantity: data.jarCollected,
          performedBy: partnerId,
          notes: data.notes,
        },
      });
    }

    return this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'DELIVERED', deliveredAt: new Date() },
    });
  }

  async setAvailability(userId: string, isAvailable: boolean) {
    return this.prisma.deliveryPartner.update({
      where: { userId },
      data: { isAvailable },
    });
  }
}
