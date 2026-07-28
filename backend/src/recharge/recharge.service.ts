import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RechargeEngine } from '../engines/recharge.engine';
import { PaymentStatus } from '@prisma/client';
import { PromoService } from '../promo/promo.service';

@Injectable()
export class RechargeService {
  constructor(
    private prisma: PrismaService,
    private rechargeEngine: RechargeEngine,
    private promoService: PromoService,
  ) {}

  async purchase(
    userId: string,
    data: {
      packageId: string;
      paymentId: string;
      amountPaid?: number;
      promoCode?: string | null;
    },
  ) {
    const customer = await this.prisma.customer.findUnique({
      where: { userId },
    });
    if (!customer) throw new NotFoundException('Customer profile not found');

    const pkg = await this.prisma.package.findUnique({
      where: { id: data.packageId },
    });
    if (!pkg) throw new NotFoundException('Package not found');
    if (!pkg.isActive)
      throw new BadRequestException('Package is no longer available');
    if (!data.paymentId)
      throw new BadRequestException(
        'Successful payment is required before recharge',
      );

    const payment = await this.prisma.payment.findUnique({
      where: { id: data.paymentId },
    });
    if (!payment || payment.customerId !== customer.id) {
      throw new BadRequestException('Payment does not belong to this customer');
    }
    if (payment.status !== PaymentStatus.SUCCESS) {
      throw new BadRequestException('Payment has not been captured yet');
    }
    const discount = data.promoCode
      ? (
          await this.promoService.validateCode(
            data.promoCode,
            customer.id,
            pkg.price,
            undefined,
            undefined,
            true,
          )
        ).calculatedDiscount
      : 0;
    const requiredAmount = Math.max(0, pkg.price - discount);

    if (payment.amount < requiredAmount) {
      throw new BadRequestException(
        'Payment amount does not cover selected package',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const purchase = await this.rechargeEngine.processRecharge(
        customer.id,
        pkg.id,
        requiredAmount,
        pkg.jarCount,
        payment.id,
        tx,
      );

      if (data.promoCode) {
        await this.promoService.redeemCode(
          data.promoCode,
          customer.id,
          pkg.price,
          undefined,
          undefined,
          true,
          tx,
        );
      }

      return purchase;
    });
  }

  // Packages Management
  async createPackage(data: {
    name: string;
    description?: string;
    jarCount: number;
    price: number;
  }) {
    return this.prisma.package.create({
      data: {
        name: data.name,
        description: data.description,
        jarCount: data.jarCount,
        price: data.price,
      },
    });
  }

  async getPackages() {
    return this.prisma.package.findMany({
      where: { isActive: true },
      orderBy: { jarCount: 'asc' },
    });
  }

  async getAllPackages() {
    return this.prisma.package.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async updatePackage(id: string, data: any) {
    return this.prisma.package.update({
      where: { id },
      data,
    });
  }

  async removePackage(id: string) {
    return this.prisma.package.delete({
      where: { id },
    });
  }

  // Purchase History (resolves Customer ID from User ID if provided)
  async getPurchases(userId?: string) {
    let customerId: string | undefined;
    if (userId) {
      const customer = await this.prisma.customer.findUnique({
        where: { userId },
      });
      if (!customer) throw new NotFoundException('Customer profile not found');
      customerId = customer.id;
    }

    return this.prisma.packagePurchase.findMany({
      where: customerId ? { customerId } : {},
      include: {
        customer: { include: { user: true } },
        package: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
