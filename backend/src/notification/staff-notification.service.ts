import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StaffNotificationService {
  constructor(private readonly prisma: PrismaService) {}

  async createNotification(data: {
    orderId: string;
    companyId?: string;
    type: string;
    title: string;
    message: string;
  }) {
    return this.prisma.staffNotification.create({
      data: {
        ...data,
        isRead: false,
      },
    });
  }

  async getUnreadNotifications() {
    return this.prisma.staffNotification.findMany({
      where: { isRead: false },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markAsRead(id: string) {
    return this.prisma.staffNotification.update({
      where: { id },
      data: { isRead: true },
    });
  }

  async markAllAsRead() {
    return this.prisma.staffNotification.updateMany({
      where: { isRead: false },
      data: { isRead: true },
    });
  }
}
