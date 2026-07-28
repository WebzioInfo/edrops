import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PromoService {
  constructor(private prisma: PrismaService) {}

  async validateCode(
    code: string,
    customerId: string,
    orderAmount?: number,
    orderType?: string,
    deliveryCharge?: number,
    isRecharge: boolean = false,
  ) {
    const promo = await this.prisma.promoCode.findUnique({
      where: { code: code.toUpperCase() },
      include: { campaign: true },
    });

    if (!promo || !promo.isActive || !promo.campaign.isActive) {
      throw new BadRequestException('Invalid or inactive promo code');
    }

    const now = new Date();
    // Check individual promo code dates
    if (promo.startDate > now) {
      throw new BadRequestException('Promo code is not active yet');
    }
    if (promo.endDate && promo.endDate < now) {
      throw new BadRequestException('Promo code has expired');
    }

    // Check campaign dates
    if (promo.campaign.startDate > now) {
      throw new BadRequestException('Promo campaign has not started yet');
    }
    if (promo.campaign.endDate && promo.campaign.endDate < now) {
      throw new BadRequestException('Promo campaign has ended');
    }

    // Check usage limits
    if (promo.maxUses !== null && promo.currentUses >= promo.maxUses) {
      throw new BadRequestException('Promo code usage limit reached');
    }

    // Check per-user usage limits
    const redemptionCount = await this.prisma.promoRedemption.count({
      where: { promoCodeId: promo.id, customerId },
    });

    if (redemptionCount >= promo.perUserLimit) {
      throw new BadRequestException(
        `You have already reached the redemption limit (${promo.perUserLimit}) for this promo code`,
      );
    }

    // If order details are provided, validate thresholds and calculate discount
    let calculatedDiscount = 0;

    if (orderAmount !== undefined) {
      if (orderAmount < promo.minimumOrderAmount) {
        throw new BadRequestException(
          `Minimum order amount of ₹${promo.minimumOrderAmount} is required to use this promo code`,
        );
      }

      // Calculate discount depending on code type
      switch (promo.type) {
        case 'PERCENTAGE': {
          const discount = orderAmount * ((promo.discountValue ?? 0) / 100);
          calculatedDiscount = promo.maximumDiscountAmount
            ? Math.min(discount, promo.maximumDiscountAmount)
            : discount;
          break;
        }
        case 'FIXED_DISCOUNT': {
          calculatedDiscount = promo.discountValue ?? 0;
          break;
        }
        case 'FREE_SHIPPING': {
          calculatedDiscount = deliveryCharge ?? 0;
          break;
        }
        case 'FIRST_ORDER': {
          // Verify customer has 0 active/completed orders
          const orderCount = await this.prisma.order.count({
            where: {
              customerId,
              status: { not: 'CANCELLED' },
            },
          });
          if (orderCount > 0) {
            throw new BadRequestException(
              'This promo code is only valid for your first order',
            );
          }
          // Treat first order discount as percentage if discountValue <= 100, otherwise fixed discount
          const val = promo.discountValue ?? 0;
          if (val <= 100) {
            const discount = orderAmount * (val / 100);
            calculatedDiscount = promo.maximumDiscountAmount
              ? Math.min(discount, promo.maximumDiscountAmount)
              : discount;
          } else {
            calculatedDiscount = val;
          }
          break;
        }
        case 'SUBSCRIPTION': {
          if (isRecharge) {
            throw new BadRequestException(
              'Subscription discount is not valid for wallet recharges',
            );
          }
          if (orderType !== 'SUBSCRIPTION_ORDER') {
            throw new BadRequestException(
              'This promo code is only valid for subscription orders',
            );
          }
          const val = promo.discountValue ?? 0;
          if (val <= 100) {
            const discount = orderAmount * (val / 100);
            calculatedDiscount = promo.maximumDiscountAmount
              ? Math.min(discount, promo.maximumDiscountAmount)
              : discount;
          } else {
            calculatedDiscount = val;
          }
          break;
        }
        default:
          calculatedDiscount = 0;
      }

      // Ensure discount does not exceed the order amount
      calculatedDiscount = Math.min(orderAmount, calculatedDiscount);
    }

    return {
      id: promo.id,
      code: promo.code,
      type: promo.type,
      discountValue: promo.discountValue,
      minimumOrderAmount: promo.minimumOrderAmount,
      maximumDiscountAmount: promo.maximumDiscountAmount,
      perUserLimit: promo.perUserLimit,
      description: promo.description,
      calculatedDiscount,
    };
  }

  async redeemCode(
    code: string,
    customerId: string,
    orderAmount?: number,
    orderType?: string,
    deliveryCharge?: number,
    isRecharge: boolean = false,
    tx?: any,
  ) {
    const execute = async (prismaTx: any) => {
      // 1. Re-validate inside transaction using fresh db transaction client to prevent race conditions
      // By calling a local validation checking query inside transaction
      const promo = await prismaTx.promoCode.findUnique({
        where: { code: code.toUpperCase() },
        include: { campaign: true },
      });

      if (!promo || !promo.isActive || !promo.campaign.isActive) {
        throw new BadRequestException('Invalid or inactive promo code');
      }

      const now = new Date();
      if (promo.startDate > now || (promo.endDate && promo.endDate < now)) {
        throw new BadRequestException('Promo code is not currently active');
      }
      if (
        promo.campaign.startDate > now ||
        (promo.campaign.endDate && promo.campaign.endDate < now)
      ) {
        throw new BadRequestException('Promo campaign is not currently active');
      }

      if (promo.maxUses !== null && promo.currentUses >= promo.maxUses) {
        throw new BadRequestException('Promo code usage limit reached');
      }

      const redemptionCount = await prismaTx.promoRedemption.count({
        where: { promoCodeId: promo.id, customerId },
      });

      if (redemptionCount >= promo.perUserLimit) {
        throw new BadRequestException(
          `You have already reached the redemption limit (${promo.perUserLimit}) for this promo code`,
        );
      }

      if (orderAmount !== undefined && orderAmount < promo.minimumOrderAmount) {
        throw new BadRequestException(
          `Minimum order amount of ₹${promo.minimumOrderAmount} is required`,
        );
      }

      // 2. Create the redemption record
      const redemption = await prismaTx.promoRedemption.create({
        data: {
          promoCodeId: promo.id,
          customerId,
        },
      });

      // 3. Increment current uses count on the code
      await prismaTx.promoCode.update({
        where: { id: promo.id },
        data: { currentUses: { increment: 1 } },
      });

      return redemption;
    };

    return tx ? execute(tx) : this.prisma.$transaction(execute);
  }

  // Admin Management Endpoints
  async listAllCodes() {
    return this.prisma.promoCode.findMany({
      include: { campaign: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createCode(data: any) {
    const {
      campaignName,
      campaignDescription,
      campaignStartDate,
      campaignEndDate,
      ...codeData
    } = data;

    return this.prisma.$transaction(async (tx) => {
      // Find or create campaign
      let campaign = await tx.promoCampaign.findFirst({
        where: { name: campaignName },
      });

      if (!campaign) {
        campaign = await tx.promoCampaign.create({
          data: {
            name: campaignName,
            description: campaignDescription,
            startDate: campaignStartDate
              ? new Date(campaignStartDate)
              : new Date(),
            endDate: campaignEndDate ? new Date(campaignEndDate) : null,
            isActive: true,
          },
        });
      }

      return tx.promoCode.create({
        data: {
          ...codeData,
          campaignId: campaign.id,
          startDate: codeData.startDate
            ? new Date(codeData.startDate)
            : new Date(),
          endDate: codeData.endDate ? new Date(codeData.endDate) : null,
        },
        include: { campaign: true },
      });
    });
  }

  async updateCode(id: string, data: any) {
    const { campaignId, ...codeData } = data;
    return this.prisma.promoCode.update({
      where: { id },
      data: {
        ...codeData,
        startDate: codeData.startDate
          ? new Date(codeData.startDate)
          : undefined,
        endDate:
          codeData.endDate !== undefined
            ? codeData.endDate
              ? new Date(codeData.endDate)
              : null
            : undefined,
      },
      include: { campaign: true },
    });
  }

  async deleteCode(id: string) {
    return this.prisma.promoCode.delete({
      where: { id },
    });
  }

  async getPromoStats() {
    const totalCodes = await this.prisma.promoCode.count();
    const activeCodes = await this.prisma.promoCode.count({
      where: { isActive: true },
    });
    const redemptions = await this.prisma.promoRedemption.findMany({
      include: {
        customer: { include: { user: true } },
        promoCode: true,
      },
      orderBy: { redeemedAt: 'desc' },
      take: 50,
    });

    const usageCount = await this.prisma.promoRedemption.count();

    return {
      totalCodes,
      activeCodes,
      usageCount,
      redemptions,
    };
  }
}
