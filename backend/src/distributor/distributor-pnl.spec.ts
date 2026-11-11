import { Test, TestingModule } from '@nestjs/testing';
import { DistributorPnlService } from './distributor-pnl.service';
import { DistributorIdentityResolver, ResolvedDistributorIdentity } from './distributor-identity.resolver';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStatus, UserRole } from '@prisma/client';

describe('DistributorPnlService & Accounting Engine', () => {
  let service: DistributorPnlService;
  let resolver: DistributorIdentityResolver;
  let prisma: any;

  const mockDistributorIdentity: ResolvedDistributorIdentity = {
    userId: 'dist-user-101',
    distributorId: 'dist-profile-202',
    agencyName: 'Green Valley Water Distributors',
    routeOrArea: 'North Zone',
    jarDepositRate: 150.0,
    companyOwnedJars: 50,
    distributorOwnedJars: 100,
    canManufacture: false,
    isAdminImpersonation: false,
  };

  const mockPrisma = {
    distributor: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    order: {
      findMany: jest.fn(),
    },
    accessorySale: {
      findMany: jest.fn(),
    },
    distributorSale: {
      findMany: jest.fn(),
    },
    purchase: {
      findMany: jest.fn(),
    },
    distributorExpense: {
      findMany: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    inventoryLog: {
      findMany: jest.fn(),
    },
    delivery: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DistributorPnlService,
        DistributorIdentityResolver,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<DistributorPnlService>(DistributorPnlService);
    resolver = module.get<DistributorIdentityResolver>(DistributorIdentityResolver);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  describe('Phase 1: Distributor Identity Resolution', () => {
    it('1. Authoritatively resolves caller identity strictly from authenticated JWT userId', async () => {
      mockPrisma.distributor.findUnique.mockResolvedValue({
        id: 'dist-profile-202',
        userId: 'dist-user-101',
        agencyName: 'Green Valley Water Distributors',
        routeOrArea: 'North Zone',
        jarDepositRate: 150.0,
        companyOwnedJars: 50,
        distributorOwnedJars: 100,
        canManufacture: false,
        user: { firstName: 'Suresh', lastName: 'Kumar' },
      });

      const identity = await resolver.resolve({ id: 'dist-user-101', role: UserRole.DISTRIBUTOR });

      expect(identity.userId).toBe('dist-user-101');
      expect(identity.distributorId).toBe('dist-profile-202');
      expect(identity.agencyName).toBe('Green Valley Water Distributors');
      expect(identity.isAdminImpersonation).toBe(false);
    });

    it('2. Rejects unauthorized access when user ID is missing', async () => {
      await expect(resolver.resolve({} as any)).rejects.toThrow();
    });

    it('3. Allows Upper Admin to resolve a specific distributor via explicit parameter', async () => {
      mockPrisma.distributor.findFirst.mockResolvedValue({
        id: 'target-dist-999',
        userId: 'target-user-888',
        agencyName: 'Target Agency',
        jarDepositRate: 150.0,
        companyOwnedJars: 20,
        distributorOwnedJars: 40,
        canManufacture: false,
        user: { firstName: 'Ramesh', lastName: 'Nair' },
      });

      const identity = await resolver.resolve(
        { id: 'admin-user-001', role: UserRole.ADMIN },
        'target-dist-999',
      );

      expect(identity.distributorId).toBe('target-dist-999');
      expect(identity.userId).toBe('target-user-888');
      expect(identity.isAdminImpersonation).toBe(true);
    });
  });

  describe('Phase 2 & 6: Revenue Recognition & Deposit Liability Isolation', () => {
    it('4. Correctly isolates customer jar deposit liabilities and excludes cancelled orders', async () => {
      // Order 1: Delivered order: ₹300 total (₹100 water + ₹200 deposit for 2 jars)
      // Order 2: Delivered order: ₹900 total (₹300 water + ₹600 deposit for 6 jars, with ₹50 discount)
      mockPrisma.order.findMany.mockResolvedValue([
        {
          id: 'ord-1',
          distributorId: 'dist-user-101',
          totalAmount: 300,
          depositTotal: 200,
          discountTotal: 0,
          subTotal: 100,
          paymentStatus: 'PAID',
          items: [
            {
              quantity: 2,
              deposit: 100,
              total: 300,
              product: { isJar: true, distributorPrice: 28.0 },
            },
          ],
          payments: [{ amount: 300, status: 'SUCCESS' }],
        },
        {
          id: 'ord-2',
          distributorId: 'dist-user-101',
          totalAmount: 900,
          depositTotal: 600,
          discountTotal: 50,
          subTotal: 350,
          paymentStatus: 'PAID',
          items: [
            {
              quantity: 6,
              deposit: 100,
              total: 900,
              product: { isJar: true, distributorPrice: 28.0 },
            },
          ],
          payments: [{ amount: 900, status: 'SUCCESS' }],
        },
      ]);

      mockPrisma.accessorySale.findMany.mockResolvedValue([]);
      mockPrisma.distributorSale.findMany.mockResolvedValue([]);
      mockPrisma.purchase.findMany.mockResolvedValue([]);
      mockPrisma.distributorExpense.findMany.mockResolvedValue([]);
      mockPrisma.inventoryLog.findMany.mockResolvedValue([]);
      mockPrisma.delivery.findMany.mockResolvedValue([]);

      const pnl = await service.getPnlStatement(mockDistributorIdentity, { preset: 'THIS_MONTH' });

      // Total Order Gross = 300 + 900 = 1200
      expect(pnl.revenueBreakdown.grossRetailRevenue).toBe(1200);

      // Customer Jar Deposits = 200 + 600 = 800 (HELD AS BALANCE SHEET LIABILITY)
      expect(pnl.summary.customerJarDepositLiability).toBe(800);
      expect(pnl.revenueBreakdown.customerJarDepositLiability).toBe(800);

      // Operating Sales = (100 - 0) + (350 - 50) = 100 + 300 = 400
      expect(pnl.summary.totalNetRevenue).toBe(400);

      // COGS = 8 water jars * 28.00 = 224
      expect(pnl.summary.totalCogs).toBe(224);
      expect(pnl.cogsBreakdown.waterJarCogs).toBe(224);

      // Gross Profit = 400 - 224 = 176
      expect(pnl.summary.grossProfit).toBe(176);
      // Gross Margin = (176 / 400) * 100 = 44.0%
      expect(pnl.summary.grossMarginPercent).toBe(44.0);
    });

    it('5. Properly includes direct accessory sales at taxable value (excluding GST)', async () => {
      mockPrisma.order.findMany.mockResolvedValue([]);
      mockPrisma.accessorySale.findMany.mockResolvedValue([
        {
          id: 'acc-1',
          distributorId: 'dist-profile-202',
          quantity: 2,
          unitPrice: 500,
          taxableAmount: 1000,
          taxAmount: 180,
          totalAmount: 1180,
          paymentStatus: 'PAID',
          product: { costPrice: 350 },
        },
      ]);
      mockPrisma.distributorSale.findMany.mockResolvedValue([]);
      mockPrisma.purchase.findMany.mockResolvedValue([]);
      mockPrisma.distributorExpense.findMany.mockResolvedValue([]);
      mockPrisma.inventoryLog.findMany.mockResolvedValue([]);
      mockPrisma.delivery.findMany.mockResolvedValue([]);

      const pnl = await service.getPnlStatement(mockDistributorIdentity, { preset: 'THIS_MONTH' });

      // Revenue = Taxable Amount (1000), not total with GST (1180)
      expect(pnl.summary.totalNetRevenue).toBe(1000);
      expect(pnl.revenueBreakdown.netAccessoryRevenue).toBe(1000);

      // COGS = 2 * 350 = 700
      expect(pnl.summary.totalCogs).toBe(700);
      expect(pnl.summary.grossProfit).toBe(300);
      expect(pnl.summary.grossMarginPercent).toBe(30.0);
    });
  });

  describe('Phase 3 & 5: COGS & Inventory Loss Accounting', () => {
    it('6. Books damaged distributor-owned jars as financial write-off in COGS', async () => {
      mockPrisma.order.findMany.mockResolvedValue([]);
      mockPrisma.accessorySale.findMany.mockResolvedValue([]);
      mockPrisma.distributorSale.findMany.mockResolvedValue([]);
      mockPrisma.purchase.findMany.mockResolvedValue([]);
      mockPrisma.distributorExpense.findMany.mockResolvedValue([]);
      mockPrisma.delivery.findMany.mockResolvedValue([]);

      // 3 damaged jars
      mockPrisma.inventoryLog.findMany.mockResolvedValue([
        {
          id: 'log-1',
          distributorId: 'dist-profile-202',
          action: 'DAMAGED',
          quantity: 3,
        },
      ]);

      const pnl = await service.getPnlStatement(mockDistributorIdentity, { preset: 'THIS_MONTH' });

      // Write-off = 3 jars * 28.00 wholesale rate = 84.00
      expect(pnl.cogsBreakdown.inventoryWriteOffs).toBe(84.00);
      expect(pnl.cogsBreakdown.damagedJarsCount).toBe(3);
      expect(pnl.summary.totalCogs).toBe(84.00);
    });
  });

  describe('Phase 4: Operating Expenses (OPEX) & Net Profit Calculation', () => {
    it('7. Accurately deducts approved distributor OPEX across categories to produce Net Operating Profit', async () => {
      // Net Revenue: 1000, COGS: 400 => Gross Profit: 600
      mockPrisma.order.findMany.mockResolvedValue([
        {
          id: 'ord-10',
          distributorId: 'dist-user-101',
          totalAmount: 1000,
          depositTotal: 0,
          discountTotal: 0,
          subTotal: 1000,
          paymentStatus: 'PAID',
          items: [
            {
              quantity: 10,
              deposit: 0,
              total: 1000,
              product: { isJar: false, costPrice: 40 },
            },
          ],
        },
      ]);
      mockPrisma.accessorySale.findMany.mockResolvedValue([]);
      mockPrisma.distributorSale.findMany.mockResolvedValue([]);
      mockPrisma.purchase.findMany.mockResolvedValue([]);
      mockPrisma.inventoryLog.findMany.mockResolvedValue([]);
      mockPrisma.delivery.findMany.mockResolvedValue([]);

      // Operating Expenses: Fuel ₹150, Vehicle Maintenance ₹100, Helper Wages ₹150 = ₹400
      mockPrisma.distributorExpense.findMany.mockResolvedValue([
        { id: 'exp-1', category: 'FUEL', amount: 150, status: 'APPROVED' },
        { id: 'exp-2', category: 'VEHICLE_MAINTENANCE', amount: 100, status: 'APPROVED' },
        { id: 'exp-3', category: 'HELPER_SALARY', amount: 150, status: 'APPROVED' },
      ]);

      const pnl = await service.getPnlStatement(mockDistributorIdentity, { preset: 'THIS_MONTH' });

      expect(pnl.summary.totalNetRevenue).toBe(1000);
      expect(pnl.summary.totalCogs).toBe(400);
      expect(pnl.summary.grossProfit).toBe(600);
      expect(pnl.summary.totalOpex).toBe(400);

      // Net Operating Profit = 600 - 400 = 200
      expect(pnl.summary.netProfitBeforeTax).toBe(200);
      expect(pnl.summary.operatingProfit).toBe(200);
      // Net Margin = (200 / 1000) * 100 = 20.0%
      expect(pnl.summary.netProfitMarginPercent).toBe(20.0);

      // Verify category breakdown
      expect(pnl.opexBreakdown.categories['FUEL'].amount).toBe(150);
      expect(pnl.opexBreakdown.categories['VEHICLE_MAINTENANCE'].amount).toBe(100);
      expect(pnl.opexBreakdown.categories['HELPER_SALARY'].amount).toBe(150);
    });

    it('8. Safe division handling: returns 0% margin when revenue is 0', async () => {
      mockPrisma.order.findMany.mockResolvedValue([]);
      mockPrisma.accessorySale.findMany.mockResolvedValue([]);
      mockPrisma.distributorSale.findMany.mockResolvedValue([]);
      mockPrisma.purchase.findMany.mockResolvedValue([]);
      mockPrisma.distributorExpense.findMany.mockResolvedValue([]);
      mockPrisma.inventoryLog.findMany.mockResolvedValue([]);
      mockPrisma.delivery.findMany.mockResolvedValue([]);

      const pnl = await service.getPnlStatement(mockDistributorIdentity, { preset: 'TODAY' });

      expect(pnl.summary.totalNetRevenue).toBe(0);
      expect(pnl.summary.grossProfit).toBe(0);
      expect(pnl.summary.grossMarginPercent).toBe(0);
      expect(pnl.summary.netProfitMarginPercent).toBe(0);
    });
  });

  describe('Phase 9: Multi-Tenant Security & Separation', () => {
    it('9. Strict filter verification: Orders are filtered by User.id, wholesale and expenses by Distributor.id', async () => {
      mockPrisma.order.findMany.mockResolvedValue([]);
      mockPrisma.accessorySale.findMany.mockResolvedValue([]);
      mockPrisma.distributorSale.findMany.mockResolvedValue([]);
      mockPrisma.purchase.findMany.mockResolvedValue([]);
      mockPrisma.distributorExpense.findMany.mockResolvedValue([]);
      mockPrisma.inventoryLog.findMany.mockResolvedValue([]);
      mockPrisma.delivery.findMany.mockResolvedValue([]);

      await service.getPnlStatement(mockDistributorIdentity, { preset: 'THIS_MONTH' });

      // Verify Order query scoped to userId
      expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            distributorId: 'dist-user-101',
          }),
        }),
      );

      // Verify DistributorExpense query scoped to distributorId (Distributor profile UUID)
      expect(mockPrisma.distributorExpense.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            distributorId: 'dist-profile-202',
          }),
        }),
      );

      // Verify Purchase query scoped to userId
      expect(mockPrisma.purchase.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            distributorId: 'dist-user-101',
          }),
        }),
      );
    });
  });
});
