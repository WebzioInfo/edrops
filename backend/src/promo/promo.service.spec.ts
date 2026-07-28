import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { PromoService } from './promo.service';
import { BadRequestException } from '@nestjs/common';

describe('PromoService', () => {
  let service: PromoService;
  let prismaMock: any;

  beforeEach(async () => {
    prismaMock = {
      promoCode: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      promoRedemption: {
        count: jest.fn(),
        create: jest.fn(),
      },
      order: {
        count: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PromoService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<PromoService>(PromoService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateCode', () => {
    it('should throw BadRequestException if promo code does not exist', async () => {
      prismaMock.promoCode.findUnique.mockResolvedValue(null);
      await expect(service.validateCode('INVALID', 'cust-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if promo code is inactive', async () => {
      prismaMock.promoCode.findUnique.mockResolvedValue({
        code: 'TEST',
        isActive: false,
        campaign: { isActive: true },
      });
      await expect(service.validateCode('TEST', 'cust-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if promo campaign is inactive', async () => {
      prismaMock.promoCode.findUnique.mockResolvedValue({
        code: 'TEST',
        isActive: true,
        campaign: { isActive: false },
      });
      await expect(service.validateCode('TEST', 'cust-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if promo has expired', async () => {
      const pastDate = new Date();
      pastDate.setFullYear(pastDate.getFullYear() - 1);
      prismaMock.promoCode.findUnique.mockResolvedValue({
        code: 'TEST',
        isActive: true,
        startDate: pastDate,
        endDate: pastDate,
        campaign: { isActive: true, startDate: pastDate, endDate: null },
      });
      await expect(service.validateCode('TEST', 'cust-1')).rejects.toThrow(
        'Promo code has expired',
      );
    });

    it('should throw BadRequestException if maxUses is exceeded', async () => {
      const now = new Date();
      prismaMock.promoCode.findUnique.mockResolvedValue({
        code: 'TEST',
        isActive: true,
        startDate: now,
        endDate: null,
        maxUses: 10,
        currentUses: 10,
        campaign: { isActive: true, startDate: now, endDate: null },
      });
      await expect(service.validateCode('TEST', 'cust-1')).rejects.toThrow(
        'Promo code usage limit reached',
      );
    });

    it('should throw BadRequestException if perUserLimit is exceeded', async () => {
      const now = new Date();
      prismaMock.promoCode.findUnique.mockResolvedValue({
        id: 'promo-1',
        code: 'TEST',
        isActive: true,
        startDate: now,
        endDate: null,
        maxUses: 100,
        currentUses: 5,
        perUserLimit: 1,
        campaign: { isActive: true, startDate: now, endDate: null },
      });
      prismaMock.promoRedemption.count.mockResolvedValue(1);

      await expect(service.validateCode('TEST', 'cust-1')).rejects.toThrow(
        /redemption limit/,
      );
    });

    it('should throw BadRequestException if orderAmount is below minimumOrderAmount', async () => {
      const now = new Date();
      prismaMock.promoCode.findUnique.mockResolvedValue({
        id: 'promo-1',
        code: 'TEST',
        isActive: true,
        startDate: now,
        endDate: null,
        maxUses: 100,
        currentUses: 5,
        perUserLimit: 2,
        minimumOrderAmount: 200,
        campaign: { isActive: true, startDate: now, endDate: null },
      });
      prismaMock.promoRedemption.count.mockResolvedValue(0);

      await expect(service.validateCode('TEST', 'cust-1', 150)).rejects.toThrow(
        /Minimum order amount/,
      );
    });

    it('should calculate PERCENTAGE discount correctly and apply cap', async () => {
      const now = new Date();
      prismaMock.promoCode.findUnique.mockResolvedValue({
        id: 'promo-1',
        code: 'TEST',
        type: 'PERCENTAGE',
        discountValue: 10,
        maximumDiscountAmount: 50,
        isActive: true,
        startDate: now,
        endDate: null,
        maxUses: 100,
        currentUses: 5,
        perUserLimit: 2,
        minimumOrderAmount: 100,
        campaign: { isActive: true, startDate: now, endDate: null },
      });
      prismaMock.promoRedemption.count.mockResolvedValue(0);

      const res1 = await service.validateCode('TEST', 'cust-1', 400);
      expect(res1.calculatedDiscount).toBe(40); // 10% of 400

      const res2 = await service.validateCode('TEST', 'cust-1', 600);
      expect(res2.calculatedDiscount).toBe(50); // Capped at 50
    });

    it('should calculate FIXED_DISCOUNT correctly', async () => {
      const now = new Date();
      prismaMock.promoCode.findUnique.mockResolvedValue({
        id: 'promo-1',
        code: 'TEST',
        type: 'FIXED_DISCOUNT',
        discountValue: 100,
        isActive: true,
        startDate: now,
        endDate: null,
        maxUses: 100,
        currentUses: 5,
        perUserLimit: 2,
        minimumOrderAmount: 100,
        campaign: { isActive: true, startDate: now, endDate: null },
      });
      prismaMock.promoRedemption.count.mockResolvedValue(0);

      const res = await service.validateCode('TEST', 'cust-1', 300);
      expect(res.calculatedDiscount).toBe(100);
    });

    it('should calculate FREE_SHIPPING discount correctly', async () => {
      const now = new Date();
      prismaMock.promoCode.findUnique.mockResolvedValue({
        id: 'promo-1',
        code: 'TEST',
        type: 'FREE_SHIPPING',
        isActive: true,
        startDate: now,
        endDate: null,
        maxUses: 100,
        currentUses: 5,
        perUserLimit: 2,
        minimumOrderAmount: 100,
        campaign: { isActive: true, startDate: now, endDate: null },
      });
      prismaMock.promoRedemption.count.mockResolvedValue(0);

      const res = await service.validateCode(
        'TEST',
        'cust-1',
        300,
        'ONETIME_ORDER',
        50,
      );
      expect(res.calculatedDiscount).toBe(50);
    });

    it('should validate FIRST_ORDER promo correctly', async () => {
      const now = new Date();
      prismaMock.promoCode.findUnique.mockResolvedValue({
        id: 'promo-1',
        code: 'TEST',
        type: 'FIRST_ORDER',
        discountValue: 20, // 20%
        isActive: true,
        startDate: now,
        endDate: null,
        maxUses: 100,
        currentUses: 5,
        perUserLimit: 2,
        minimumOrderAmount: 100,
        campaign: { isActive: true, startDate: now, endDate: null },
      });
      prismaMock.promoRedemption.count.mockResolvedValue(0);
      prismaMock.order.count.mockResolvedValue(1); // Already has an order

      await expect(service.validateCode('TEST', 'cust-1', 200)).rejects.toThrow(
        'This promo code is only valid for your first order',
      );
    });

    it('should validate SUBSCRIPTION promo correctly', async () => {
      const now = new Date();
      prismaMock.promoCode.findUnique.mockResolvedValue({
        id: 'promo-1',
        code: 'TEST',
        type: 'SUBSCRIPTION',
        discountValue: 20, // 20%
        isActive: true,
        startDate: now,
        endDate: null,
        maxUses: 100,
        currentUses: 5,
        perUserLimit: 2,
        minimumOrderAmount: 100,
        campaign: { isActive: true, startDate: now, endDate: null },
      });
      prismaMock.promoRedemption.count.mockResolvedValue(0);

      await expect(
        service.validateCode('TEST', 'cust-1', 200, 'ONETIME_ORDER'),
      ).rejects.toThrow(
        'This promo code is only valid for subscription orders',
      );
    });
  });
});
