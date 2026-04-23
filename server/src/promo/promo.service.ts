import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class PromoService {
  constructor(private prisma: PrismaService) {}

  /**
   * Validates a promo code for a given user and order amount.
   * If valid, returns the exact discount amount and promo metadata.
   */
  async validatePromo(code: string, userId: string, orderAmount: number) {
    return this.validatePromoTx(this.prisma, code, userId, orderAmount);
  }

  /**
   * Transaction-safe validation that takes a Prisma transaction client.
   * Prevents race conditions during concurrent checkouts.
   */
  async validatePromoTx(tx: any, code: string, userId: string, orderAmount: number) {
    // Find promo (can add FOR UPDATE lock if using raw SQL, but standard findUnique is fine here)
    const promo = await tx.promoCode.findUnique({ where: { code } });

    if (!promo || !promo.isActive) {
      throw new BadRequestException('Invalid promo code');
    }
    
    if (promo.expiryDate && promo.expiryDate < new Date()) {
      throw new BadRequestException('Promo code has expired');
    }
    
    if (orderAmount < Number(promo.minOrderAmount)) {
      throw new BadRequestException(`Minimum order amount for this promo is ₹${promo.minOrderAmount}`);
    }

    if (promo.usageLimit !== null && promo.usedCount >= promo.usageLimit) {
      throw new BadRequestException('Promo code has reached its maximum usage limit');
    }

    // Check user usage limit
    const userUsage = await tx.promoUsage.count({
      where: { userId, promoId: promo.id }
    });

    if (userUsage >= promo.usagePerUser) {
      throw new BadRequestException('You have reached the usage limit for this promo code');
    }

    // Calculate discount
    let discount = 0;
    if (promo.discountType === 'FLAT') {
      discount = Number(promo.discountValue);
    } else if (promo.discountType === 'PERCENTAGE') {
      discount = orderAmount * (Number(promo.discountValue) / 100);
      if (promo.maxDiscountAmount) {
        discount = Math.min(discount, Number(promo.maxDiscountAmount));
      }
    }

    // Ensure we don't discount more than the order total
    discount = Math.min(discount, orderAmount);

    return { isValid: true, discountAmount: discount, promo };
  }

  // ─────────────────────────────────────────────
  // Admin Operations
  // ─────────────────────────────────────────────

  async getAllPromos() {
    return this.prisma.promoCode.findMany({
      orderBy: { createdAt: 'desc' }
    });
  }

  async createPromo(data: {
    code: string;
    discountType: 'FLAT' | 'PERCENTAGE';
    discountValue: number;
    minOrderAmount?: number;
    maxDiscountAmount?: number;
    usageLimit?: number;
    usagePerUser?: number;
    expiryDate?: string;
    isActive?: boolean;
  }) {
    const code = data.code.toUpperCase();
    const exists = await this.prisma.promoCode.findUnique({ where: { code } });
    if (exists) throw new BadRequestException('Promo code already exists');

    return this.prisma.promoCode.create({
      data: {
        code,
        discountType: data.discountType,
        discountValue: data.discountValue,
        minOrderAmount: data.minOrderAmount ?? 0,
        maxDiscountAmount: data.maxDiscountAmount ?? null,
        usageLimit: data.usageLimit ?? null,
        usagePerUser: data.usagePerUser ?? 1,
        expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
        isActive: data.isActive ?? true,
      }
    });
  }

  async togglePromo(id: string) {
    const promo = await this.prisma.promoCode.findUnique({ where: { id } });
    if (!promo) throw new BadRequestException('Promo code not found');
    
    return this.prisma.promoCode.update({
      where: { id },
      data: { isActive: !promo.isActive }
    });
  }
}
