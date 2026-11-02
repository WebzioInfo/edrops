import { Test, TestingModule } from '@nestjs/testing';
import { BiodropsService } from './biodrops.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '../config/config.service';

describe('Edrops 360° Commercial Ecosystem Specification & Acceptance Tests', () => {
  let service: BiodropsService;
  let prisma: PrismaService;

  const mockProduct = {
    id: 'prod-water-20l',
    name: 'Biodrops 20L Purified Water Jar',
    sku: 'BIO-20L-JAR',
    price: 35.0,
    distributorPricePickup: 28.0,
    distributorPriceDelivery: 35.0,
    gstRate: 18.0,
    isJar: true,
    productType: 'WATER_PRODUCT',
    bulkPricingTiers: [
      {
        id: 'tier-1',
        minQuantity: 1,
        maxQuantity: 49,
        pickupPrice: 28.0,
        deliveryPrice: 35.0,
        isActive: true,
        description: 'Standard Bracket',
      },
      {
        id: 'tier-2',
        minQuantity: 50,
        maxQuantity: 99,
        pickupPrice: 26.0,
        deliveryPrice: 33.0,
        isActive: true,
        description: 'Bulk Tier 50-99',
      },
      {
        id: 'tier-3',
        minQuantity: 100,
        maxQuantity: null,
        pickupPrice: 24.0,
        deliveryPrice: 30.0,
        isActive: true,
        description: 'High Volume 100+',
      },
    ],
  };

  const mockDistributor = {
    id: 'dist-001',
    agencyName: 'Kochi Central Distribution',
    referralCode: 'DIST-KCH-01',
    companyOwnedJars: 50,
    distributorOwnedJars: 150,
    address: 'Kochi, Kerala',
    user: {
      firstName: 'Rahul',
      lastName: 'Nair',
      email: 'rahul@distributor.in',
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BiodropsService,
        {
          provide: PrismaService,
          useValue: {
            product: {
              findUnique: jest.fn().mockImplementation(({ where }) => {
                if (where.id === mockProduct.id) return Promise.resolve(mockProduct);
                return Promise.resolve(null);
              }),
              findMany: jest.fn().mockResolvedValue([mockProduct]),
            },
            distributor: {
              findUnique: jest.fn().mockImplementation(({ where }) => {
                if (where.id === mockDistributor.id) return Promise.resolve(mockDistributor);
                return Promise.resolve(null);
              }),
              update: jest.fn().mockResolvedValue(mockDistributor),
              findMany: jest.fn().mockResolvedValue([mockDistributor]),
            },
            bulkPricingTier: {
              create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'tier-new', ...data })),
              findMany: jest.fn().mockResolvedValue(mockProduct.bulkPricingTiers),
              delete: jest.fn().mockResolvedValue({ id: 'tier-1' }),
            },
            aquzioSyncLog: {
              findUnique: jest.fn(),
              create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'sync-1', ...data })),
              findMany: jest.fn().mockResolvedValue([]),
            },
            warehouse: {
              findFirst: jest.fn().mockResolvedValue({ id: 'wh-main', name: 'Central Warehouse' }),
              create: jest.fn().mockResolvedValue({ id: 'wh-main', name: 'Central Warehouse' }),
            },
            warehouseStock: {
              findFirst: jest.fn().mockResolvedValue({ id: 'ws-1', quantity: 1000 }),
              update: jest.fn().mockResolvedValue({ id: 'ws-1', quantity: 950 }),
              create: jest.fn().mockResolvedValue({ id: 'ws-1', quantity: 450 }),
              findMany: jest.fn().mockResolvedValue([{ product: mockProduct, quantity: 1000 }]),
            },
            stockMovement: {
              create: jest.fn().mockResolvedValue({ id: 'sm-1' }),
            },
            distributorSale: {
              create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'sale-001', ...data })),
              findMany: jest.fn().mockResolvedValue([
                {
                  id: 'sale-edrops-1',
                  invoiceNumber: 'INV-BULK-001',
                  saleDate: new Date(),
                  externalSource: 'EDROPS',
                  subtotal: 2400.0,
                  taxAmount: 432.0,
                  totalAmount: 2832.0,
                  amountPaid: 2832.0,
                  outstandingAmount: 0.0,
                  paymentStatus: 'PAID',
                  paymentMethod: 'BANK_TRANSFER',
                  orderStage: 'INVOICE',
                  items: [
                    {
                      product: mockProduct,
                      quantity: 100,
                      unitPrice: 24.0,
                      totalAmount: 2832.0,
                    },
                  ],
                },
              ]),
            },
            package: {
              findUnique: jest.fn().mockResolvedValue({
                id: 'pkg-premium-30',
                name: 'Premium 30 Monthly',
                jarCount: 30,
                price: 1050.0,
                planConfig: {
                  freeAccessories: [{ productId: 'prod-stand', quantity: 1 }],
                },
              }),
            },
            packagePurchase: {
              create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'purch-1', ...data })),
              findMany: jest.fn().mockResolvedValue([{ id: 'purch-1', amount: 1050.0, paymentStatus: 'PAID' }]),
            },
            customer: {
              findUnique: jest.fn().mockResolvedValue({
                id: 'cust-101',
                userId: 'usr-101',
                user: { firstName: 'Anita', lastName: 'Menon' },
              }),
            },
            accessorySale: {
              findMany: jest.fn().mockResolvedValue([]),
            },
            distributorAccessoryStock: {
              findUnique: jest.fn().mockResolvedValue({ id: 'das-1', quantity: 10 }),
              update: jest.fn().mockResolvedValue({ id: 'das-1', quantity: 9 }),
              upsert: jest.fn().mockResolvedValue({ id: 'das-1', quantity: 10 }),
            },
            $transaction: jest.fn((cb) => cb(prisma)),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(''),
          },
        },
      ],
    }).compile();

    service = module.get<BiodropsService>(BiodropsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Scenario A: Bulk Pricing Tiers Engine', () => {
    it('1. Correctly calculates Tier 1 (1-49 jars) pickup vs delivery prices', async () => {
      const calcPickup = await service.calculateBulkPricing(mockProduct.id, 20, false);
      expect(calcPickup.unitPrice).toBe(28.0);
      expect(calcPickup.taxableAmount).toBe(560.0);
      expect(calcPickup.taxAmount).toBe(100.8);
      expect(calcPickup.totalAmount).toBe(660.8);

      const calcDelivery = await service.calculateBulkPricing(mockProduct.id, 20, true);
      expect(calcDelivery.unitPrice).toBe(35.0);
      expect(calcDelivery.taxableAmount).toBe(700.0);
    });

    it('2. Correctly calculates Tier 2 (50-99 jars) volume discount', async () => {
      const calc = await service.calculateBulkPricing(mockProduct.id, 60, true);
      expect(calc.unitPrice).toBe(33.0); // Discounted from 35 to 33
      expect(calc.taxableAmount).toBe(60 * 33.0);
      expect(calc.appliedTier).toContain('50-99');
    });

    it('3. Correctly calculates Tier 3 (100+ jars) high volume discount', async () => {
      const calcPickup = await service.calculateBulkPricing(mockProduct.id, 150, false);
      expect(calcPickup.unitPrice).toBe(24.0); // Discounted from 28 to 24
      expect(calcPickup.taxableAmount).toBe(150 * 24.0);
      expect(calcPickup.appliedTier).toContain('100+');
    });
  });

  describe('Scenario B: Bulk Sale Execution & Inventory Updates', () => {
    it('4. Processes bulk sale with automatic quantity tier resolution & warehouse deduction', async () => {
      const sale = await service.processBulkSale({
        distributorId: mockDistributor.id,
        deliveryRequired: false,
        orderStage: 'INVOICE',
        items: [{ productId: mockProduct.id, quantity: 100 }],
        paymentStatus: 'PAID',
        paymentMethod: 'BANK_TRANSFER',
      });

      expect(sale.distributorId).toBe(mockDistributor.id);
      expect(sale.orderStage).toBe('INVOICE');
      expect(sale.externalSource).toBe('EDROPS');
      expect(prisma.warehouseStock.update).toHaveBeenCalled();
      expect(prisma.distributor.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { companyOwnedJars: { increment: 100 } },
        })
      );
    });
  });

  describe('Scenario C: Aquzio Idempotent Finished Goods Receipt', () => {
    it('5. Successfully admits accepted units to central stock on first receipt', async () => {
      jest.spyOn(prisma.aquzioSyncLog, 'findUnique').mockResolvedValue(null);

      const res = await service.receiveAquzioFinishedGoods({
        externalBatchId: 'BATCH-AQZ-2026-001',
        productId: mockProduct.id,
        productionQuantity: 500,
        acceptedQuantity: 450,
        rejectedQuantity: 50,
        qcApprovalStatus: 'QC_PASSED',
        idempotencyKey: 'idemp-key-batch-001',
      });

      expect(res.alreadyProcessed).toBe(false);
      expect((res as any).acceptedQuantity).toBe(450);
      expect(prisma.warehouseStock.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { quantity: { increment: 450 } },
        })
      );
      expect(prisma.aquzioSyncLog.create).toHaveBeenCalled();
    });

    it('6. Replaying the same Aquzio event is idempotent and prevents duplicate stock', async () => {
      jest.spyOn(prisma.aquzioSyncLog, 'findUnique').mockResolvedValue({
        id: 'sync-1',
        idempotencyKey: 'idemp-key-batch-001',
        acceptedQuantity: 450,
      } as any);

      const res = await service.receiveAquzioFinishedGoods({
        externalBatchId: 'BATCH-AQZ-2026-001',
        productId: mockProduct.id,
        productionQuantity: 500,
        acceptedQuantity: 450,
        rejectedQuantity: 50,
        qcApprovalStatus: 'QC_PASSED',
        idempotencyKey: 'idemp-key-batch-001',
      });

      expect(res.alreadyProcessed).toBe(true);
      expect(res.message).toContain('Duplicate stock increment prevented');
      expect(prisma.warehouseStock.update).not.toHaveBeenCalled();
    });
  });

  describe('Scenario D: Distributor Dual-Source Purchase Bills Separation', () => {
    it('7. Separates Edrops commercial invoices from Aquzio manufacturing bills', async () => {
      const bills = await service.getDistributorPurchaseBills(mockDistributor.id);

      expect(bills.distributor.id).toBe(mockDistributor.id);
      expect(bills.edropsBills.length).toBeGreaterThan(0);
      expect(bills.edropsBills[0].documentSource).toBe('EDROPS');
      expect(bills.edropsBills[0].sourceBadge).toBe('Edrops Commercial Invoice');
      expect(bills.summary.totalPurchases).toBeGreaterThan(0);
    });
  });

  describe('Scenario E: Advanced Customized Subscription with Accessories', () => {
    it('8. Successfully creates subscription with promotional free accessory and paid add-on', async () => {
      const sub = await service.createCustomizedSubscription({
        customerId: 'cust-101',
        packageId: 'pkg-premium-30',
        distributorId: mockDistributor.id,
        selectedFreeAccessories: [{ productId: 'prod-stand', quantity: 1 }],
        selectedDiscountedAccessories: [{ productId: 'prod-dispenser-elec', quantity: 1, unitPrice: 750.0 }],
      });

      expect(sub.packageName).toBe('Premium 30 Monthly');
      expect(sub.bottleCount).toBe(30);
      expect(sub.accessoryAddonsCost).toBe(750.0);
      expect(sub.totalPrice).toBe(1050.0 + 750.0);
      expect(sub.freeAccessoriesIncluded).toHaveLength(1);
      expect(prisma.packagePurchase.create).toHaveBeenCalled();
    });
  });

  describe('Scenario F: Revenue-First Commercial Dashboard Metrics', () => {
    it('9. Aggregates live commercial KPIs across bulk sales, subscriptions and jar ownership', async () => {
      const metrics = await service.getCommercialDashboardMetrics();

      expect(metrics.kpis.totalCommercialRevenue).toBeGreaterThanOrEqual(0);
      expect(metrics.kpis.jarOwnershipOutstanding).toBe(mockDistributor.companyOwnedJars * 250.0);
      expect(metrics.revenueByChannel.length).toBe(3);
    });
  });
});
