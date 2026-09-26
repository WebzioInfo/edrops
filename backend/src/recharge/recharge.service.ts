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

  // Packages / Memberships Management
  async createPackage(data: {
    name: string;
    description?: string;
    jarCount: number;
    price: number;
    originalPrice?: number;
    discountPercent?: number;
    offerLabel?: string;
    packageBadge?: string;
    packageColor?: string;
    displayOrder?: number;
    isActive?: boolean;
  }) {
    if (!data.name || typeof data.name !== 'string' || !data.name.trim()) {
      throw new BadRequestException('Membership name is required');
    }
    if (data.jarCount === undefined || Number(data.jarCount) <= 0) {
      throw new BadRequestException('Jar count must be greater than 0');
    }
    if (data.price === undefined || Number(data.price) < 0) {
      throw new BadRequestException('Selling price must be 0 or greater');
    }

    const price = Number(data.price);
    const originalPrice =
      data.originalPrice !== undefined && data.originalPrice !== null
        ? Number(data.originalPrice)
        : price;
    let discountPercent = data.discountPercent;
    if (
      discountPercent === undefined &&
      originalPrice > price &&
      originalPrice > 0
    ) {
      discountPercent = Math.round(
        ((originalPrice - price) / originalPrice) * 100,
      );
    }

    return this.prisma.package.create({
      data: {
        name: data.name.trim(),
        description: data.description?.trim() || null,
        jarCount: Number(data.jarCount),
        price,
        originalPrice,
        discountPercent: discountPercent ?? null,
        offerLabel: data.offerLabel?.trim() || null,
        packageBadge: data.packageBadge?.trim() || null,
        packageColor: data.packageColor?.trim() || 'blue',
        displayOrder: Number(data.displayOrder || 0),
        isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
      },
    });
  }

  async getPackages() {
    return this.prisma.package.findMany({
      where: { isActive: true },
      orderBy: [{ displayOrder: 'asc' }, { jarCount: 'asc' }],
    });
  }

  async getAllPackages() {
    return this.prisma.package.findMany({
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async getPackageById(id: string) {
    const pkg = await this.prisma.package.findUnique({
      where: { id },
    });
    if (!pkg) throw new NotFoundException('Membership not found');
    return pkg;
  }

  async updatePackage(id: string, data: any) {
    const existing = await this.prisma.package.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Membership not found');

    const updateData: any = {};
    if (data.name !== undefined) {
      if (!data.name || typeof data.name !== 'string' || !data.name.trim()) {
        throw new BadRequestException('Membership name cannot be empty');
      }
      updateData.name = data.name.trim();
    }
    if (data.description !== undefined) {
      updateData.description = data.description
        ? data.description.trim()
        : null;
    }
    if (data.jarCount !== undefined) {
      if (Number(data.jarCount) <= 0) {
        throw new BadRequestException('Jar count must be greater than 0');
      }
      updateData.jarCount = Number(data.jarCount);
    }
    if (data.price !== undefined) {
      if (Number(data.price) < 0) {
        throw new BadRequestException('Selling price must be 0 or greater');
      }
      updateData.price = Number(data.price);
    }
    if (data.originalPrice !== undefined) {
      updateData.originalPrice =
        data.originalPrice !== null ? Number(data.originalPrice) : null;
    }
    if (data.discountPercent !== undefined) {
      updateData.discountPercent =
        data.discountPercent !== null ? Number(data.discountPercent) : null;
    } else if (
      updateData.price !== undefined ||
      updateData.originalPrice !== undefined
    ) {
      const p =
        updateData.price !== undefined ? updateData.price : existing.price;
      const op =
        updateData.originalPrice !== undefined
          ? updateData.originalPrice
          : existing.originalPrice;
      if (op && op > p && op > 0) {
        updateData.discountPercent = Math.round(((op - p) / op) * 100);
      }
    }
    if (data.offerLabel !== undefined) {
      updateData.offerLabel = data.offerLabel ? data.offerLabel.trim() : null;
    }
    if (data.packageBadge !== undefined) {
      updateData.packageBadge = data.packageBadge
        ? data.packageBadge.trim()
        : null;
    }
    if (data.packageColor !== undefined) {
      updateData.packageColor = data.packageColor
        ? data.packageColor.trim()
        : 'blue';
    }
    if (data.displayOrder !== undefined) {
      updateData.displayOrder = Number(data.displayOrder || 0);
    }
    if (data.isActive !== undefined) {
      updateData.isActive = Boolean(data.isActive);
    }

    return this.prisma.package.update({
      where: { id },
      data: updateData,
    });
  }

  async removePackage(id: string) {
    const existing = await this.prisma.package.findUnique({
      where: { id },
      include: {
        _count: {
          select: { purchases: true },
        },
      },
    });
    if (!existing) throw new NotFoundException('Membership not found');

    // Safe delete: if purchases reference this membership, soft-deactivate to keep history
    if (existing._count?.purchases > 0) {
      return this.prisma.package.update({
        where: { id },
        data: { isActive: false },
      });
    }

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
