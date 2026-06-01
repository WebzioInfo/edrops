import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RechargeEngine } from '../engines/recharge.engine';
import { PaymentStatus } from '@prisma/client';

@Injectable()
export class RechargeService {
  constructor(
    private prisma: PrismaService,
    private rechargeEngine: RechargeEngine,
  ) {}

  async purchase(userId: string, data: { packageId: string; paymentId: string }) {
    const customer = await this.prisma.customer.findUnique({
      where: { userId }
    });
    if (!customer) throw new NotFoundException('Customer profile not found');

    const pkg = await this.prisma.package.findUnique({ where: { id: data.packageId } });
    if (!pkg) throw new NotFoundException('Package not found');
    if (!pkg.isActive) throw new BadRequestException('Package is no longer available');
    if (!data.paymentId) throw new BadRequestException('Successful payment is required before recharge');

    const payment = await this.prisma.payment.findUnique({ where: { id: data.paymentId } });
    if (!payment || payment.customerId !== customer.id) {
      throw new BadRequestException('Payment does not belong to this customer');
    }
    if (payment.status !== PaymentStatus.SUCCESS) {
      throw new BadRequestException('Payment has not been captured yet');
    }
    if (payment.amount < pkg.price) {
      throw new BadRequestException('Payment amount does not cover selected package');
    }

    return this.rechargeEngine.processRecharge(
      customer.id,
      pkg.id,
      pkg.price,
      pkg.jarCount,
      payment.id
    );
  }

  // Packages Management
  async createPackage(data: { name: string; description?: string; jarCount: number; price: number }) {
    return this.prisma.package.create({
      data: {
        name: data.name,
        description: data.description,
        jarCount: data.jarCount,
        price: data.price
      }
    });
  }

  async getPackages() {
    return this.prisma.package.findMany({
      where: { isActive: true },
      orderBy: { jarCount: 'asc' }
    });
  }

  async getAllPackages() {
    return this.prisma.package.findMany({
      orderBy: { createdAt: 'desc' }
    });
  }

  async updatePackage(id: string, data: any) {
    return this.prisma.package.update({
      where: { id },
      data
    });
  }

  async removePackage(id: string) {
    return this.prisma.package.delete({
      where: { id }
    });
  }

  // Purchase History (resolves Customer ID from User ID if provided)
  async getPurchases(userId?: string) {
    let customerId: string | undefined;
    if (userId) {
      const customer = await this.prisma.customer.findUnique({
        where: { userId }
      });
      if (!customer) throw new NotFoundException('Customer profile not found');
      customerId = customer.id;
    }

    return this.prisma.packagePurchase.findMany({
      where: customerId ? { customerId } : {},
      include: {
        customer: { include: { user: true } },
        package: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }
}
