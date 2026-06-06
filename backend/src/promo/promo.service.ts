import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PromoService {
  constructor(private prisma: PrismaService) {}

  async validateCode(code: string, customerId: string) {
    const promo = await this.prisma.promoCode.findUnique({
      where: { code: code.toUpperCase() },
      include: { campaign: true },
    });

    if (!promo || !promo.isActive || !promo.campaign.isActive) {
      throw new NotFoundException('Invalid or inactive promo code');
    }

    const now = new Date();
    if (promo.campaign.startDate > now) {
      throw new BadRequestException('Promo campaign has not started yet');
    }
    if (promo.campaign.endDate && promo.campaign.endDate < now) {
      throw new BadRequestException('Promo campaign has ended');
    }

    if (promo.maxUses && promo.currentUses >= promo.maxUses) {
      throw new BadRequestException('Promo code usage limit reached');
    }

    // Check if user already used it
    const existingRedemption = await this.prisma.promoRedemption.findFirst({
      where: { promoCodeId: promo.id, customerId },
    });

    if (existingRedemption) {
      throw new BadRequestException(
        'You have already redeemed this promo code',
      );
    }

    return promo;
  }

  async redeemCode(code: string, customerId: string) {
    const promo = await this.validateCode(code, customerId);

    return this.prisma.$transaction(async (tx) => {
      // Create redemption
      const redemption = await tx.promoRedemption.create({
        data: {
          promoCodeId: promo.id,
          customerId,
        },
      });

      // Increment usage
      await tx.promoCode.update({
        where: { id: promo.id },
        data: { currentUses: { increment: 1 } },
      });

      return redemption;
    });
  }
}
