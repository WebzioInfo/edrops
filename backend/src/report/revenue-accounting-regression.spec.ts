import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { ReportService } from './report.service';

describe('Sprint 1 Accounting Validation & Regression Test Suite', () => {
  let reportService: ReportService;
  let prisma: PrismaService;

  const mockOrders = [
    {
      id: 'ord-1',
      status: 'DELIVERED',
      paymentStatus: 'PAID',
      subTotal: 100,
      depositTotal: 200,
      deliveryCharge: 0,
      discountTotal: 0,
      totalAmount: 300,
      createdAt: new Date('2026-10-01'),
      items: [{ productId: 'p1', quantity: 1, unitPrice: 100 }],
      payments: [{ status: 'PAID', amount: 300, provider: 'CASH' }],
    },
    {
      id: 'ord-2',
      status: 'DELIVERED',
      paymentStatus: 'PAID',
      subTotal: 500,
      depositTotal: 1000,
      deliveryCharge: 50,
      discountTotal: 25,
      totalAmount: 1525,
      createdAt: new Date('2026-10-02'),
      items: [{ productId: 'p1', quantity: 5, unitPrice: 100 }],
      payments: [{ status: 'PAID', amount: 1525, provider: 'ONLINE' }],
    },
    {
      id: 'ord-cancelled',
      status: 'CANCELLED',
      paymentStatus: 'FAILED',
      subTotal: 300,
      depositTotal: 600,
      deliveryCharge: 0,
      discountTotal: 0,
      totalAmount: 900,
      createdAt: new Date('2026-10-03'),
      items: [],
      payments: [],
    },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportService,
        {
          provide: PrismaService,
          useValue: {
            order: {
              count: jest.fn().mockResolvedValue(2),
              aggregate: jest.fn().mockImplementation(({ where }) => {
                const active = mockOrders.filter(
                  (o) => !where?.status?.not || o.status !== where.status.not,
                );
                return Promise.resolve({
                  _sum: {
                    totalAmount: active.reduce((s, o) => s + o.totalAmount, 0),
                    depositTotal: active.reduce((s, o) => s + o.depositTotal, 0),
                    subTotal: active.reduce((s, o) => s + o.subTotal, 0),
                    deliveryCharge: active.reduce((s, o) => s + o.deliveryCharge, 0),
                    discountTotal: active.reduce((s, o) => s + o.discountTotal, 0),
                  },
                });
              }),
              groupBy: jest.fn().mockResolvedValue([]),
              findMany: jest.fn().mockResolvedValue(mockOrders),
            },
            packagePurchase: {
              count: jest.fn().mockResolvedValue(1),
              aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 800 } }),
              findMany: jest.fn().mockResolvedValue([]),
            },
            customer: { count: jest.fn().mockResolvedValue(10), findMany: jest.fn().mockResolvedValue([]) },
            driver: { count: jest.fn().mockResolvedValue(2), findMany: jest.fn().mockResolvedValue([]) },
            user: { count: jest.fn().mockResolvedValue(5), findMany: jest.fn().mockResolvedValue([]) },
            product: { count: jest.fn().mockResolvedValue(4), findMany: jest.fn().mockResolvedValue([]) },
            category: { count: jest.fn().mockResolvedValue(2) },
            brand: { count: jest.fn().mockResolvedValue(1) },
            package: { findMany: jest.fn().mockResolvedValue([]) },
            orderStatusHistory: { findMany: jest.fn().mockResolvedValue([]) },
            auditLog: { findMany: jest.fn().mockResolvedValue([]) },
          },
        },
      ],
    }).compile();

    reportService = module.get<ReportService>(ReportService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('1. Revenue Formula & Deposit Segregation Validation', () => {
    it('accurately separates Operating Sales from Refundable Jar Deposits', async () => {
      const analytics = await reportService.getAdminAnalytics({ preset: 'THIS_MONTH' });

      // Order 1: subTotal 100, deposit 200, del 0, disc 0 -> rev 100, billing 300
      // Order 2: subTotal 500, deposit 1000, del 50, disc 25 -> rev 525, billing 1525
      // Active Order Total: rev = 625, deposit = 1200, gross billing = 1825
      // Membership: amount = 800
      // Total Operating Sales = 625 + 800 = 1425
      // Total Gross Billing = 1825 + 800 = 2625
      // Total Deposit Liability = 1200

      expect(analytics.sales.kpis.orderSales).toBe(625);
      expect(analytics.sales.kpis.depositCollections).toBe(1200);
      expect(analytics.sales.kpis.membershipSales).toBe(800);
      expect(analytics.sales.kpis.grossSales).toBe(1425); // Net operating sales
      expect(analytics.sales.kpis.grossBilling).toBe(2625); // Total customer billing volume
      expect(analytics.sales.kpis.grossSales + analytics.sales.kpis.depositCollections).toBe(
        analytics.sales.kpis.grossBilling,
      );
    });

    it('does not mask negative returns or discounts with arbitrary clamping', async () => {
      // Mock order aggregate with negative adjustment (returns > sales)
      jest.spyOn(prisma.order, 'aggregate').mockResolvedValueOnce({
        _sum: {
          totalAmount: 100,
          depositTotal: 300,
          subTotal: -150,
          deliveryCharge: 0,
          discountTotal: 50,
        },
      } as any);

      const analytics = await reportService.getAdminAnalytics({ preset: 'THIS_MONTH' });
      // Direct revenue = subTotal (-150) + delivery (0) - discount (50) = -200
      expect(analytics.sales.kpis.orderSales).toBe(-200);
    });
  });

  describe('2. Distributor & Customer Deposit Contractual Invariants', () => {
    it('calculates gross customer billing without altering underlying transactional line items', async () => {
      const analytics = await reportService.getAdminAnalytics({ preset: 'THIS_MONTH' });
      expect(analytics.overview.kpis.totalSales.value).toBe(1425);
      expect(analytics.overview.kpis.depositLiability.value).toBe(1200);
      expect(analytics.overview.kpis.grossBilling.value).toBe(2625);
    });
  });
});
