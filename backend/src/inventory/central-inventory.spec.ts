import { InventoryService } from './inventory.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('Central Inventory & Distributor Stock Management - Test Matrix (Section 47)', () => {
  let service: InventoryService;

  const mockDistributorId = 'dist-abc-123';
  const mockCompanyJarItemId = 'jar-item-company-1';

  let mockCompanyInventory: any;
  let mockDistributor: any;
  let mockJarItem: any;

  const mockPrisma: any = {
    inventory: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    distributor: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    jarInventoryItem: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    inventoryLog: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    product: {
      findMany: jest.fn(),
    },
    $queryRawUnsafe: jest.fn(),
    $transaction: jest.fn().mockImplementation((cb) => cb(mockPrisma)),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockCompanyInventory = {
      id: 'inv-comp-1',
      filledJars: 1000,
      emptyJars: 200,
      damagedJars: 5,
      updatedAt: new Date(),
    };

    mockDistributor = {
      id: mockDistributorId,
      userId: 'user-dist-1',
      agencyName: 'ABC Distributors',
      referralCode: 'DISTABC',
      companyOwnedJars: 120,
      distributorOwnedJars: 0,
      user: {
        id: 'user-dist-1',
        firstName: 'John',
        lastName: 'Doe',
        phone: '9876543210',
        email: 'abc@edrops.com',
        isActive: true,
      },
      jarItems: [],
    };

    mockJarItem = {
      id: mockCompanyJarItemId,
      distributorId: mockDistributorId,
      name: 'Biodrops 20L Water Jar',
      ownershipType: 'COMPANY',
      ownedQuantity: 120,
      reservedQuantity: 0,
      filledYardQuantity: 120,
      emptyYardQuantity: 0,
      customerQuantity: 0,
      washingQuantity: 0,
      fillingQuantity: 0,
      quarantineQuantity: 0,
      damagedQuantity: 0,
      lostQuantity: 0,
      isActive: true,
    };

    mockPrisma.inventory.findFirst.mockResolvedValue(mockCompanyInventory);
    mockPrisma.inventory.update.mockImplementation((args: any) => {
      mockCompanyInventory = { ...mockCompanyInventory, ...args.data };
      return Promise.resolve(mockCompanyInventory);
    });

    mockPrisma.distributor.findUnique.mockResolvedValue(mockDistributor);
    mockPrisma.distributor.update.mockImplementation((args: any) => {
      if (args.data?.companyOwnedJars?.increment) {
        mockDistributor.companyOwnedJars += args.data.companyOwnedJars.increment;
      }
      if (args.data?.companyOwnedJars?.decrement) {
        mockDistributor.companyOwnedJars -= args.data.companyOwnedJars.decrement;
      }
      return Promise.resolve(mockDistributor);
    });

    mockPrisma.jarInventoryItem.findFirst.mockResolvedValue(mockJarItem);
    mockPrisma.jarInventoryItem.create.mockImplementation((args: any) => Promise.resolve(args.data));
    mockPrisma.jarInventoryItem.update.mockImplementation((args: any) => {
      if (args.data?.filledYardQuantity?.increment) {
        mockJarItem.filledYardQuantity += args.data.filledYardQuantity.increment;
      }
      if (args.data?.filledYardQuantity?.decrement) {
        mockJarItem.filledYardQuantity -= args.data.filledYardQuantity.decrement;
      }
      if (args.data?.emptyYardQuantity?.increment) {
        mockJarItem.emptyYardQuantity += args.data.emptyYardQuantity.increment;
      }
      if (args.data?.emptyYardQuantity?.decrement) {
        mockJarItem.emptyYardQuantity -= args.data.emptyYardQuantity.decrement;
      }
      if (args.data?.ownedQuantity?.increment) {
        mockJarItem.ownedQuantity += args.data.ownedQuantity.increment;
      }
      if (args.data?.ownedQuantity?.decrement) {
        mockJarItem.ownedQuantity -= args.data.ownedQuantity.decrement;
      }
      if (typeof args.data?.filledYardQuantity === 'number') {
        mockJarItem.filledYardQuantity = args.data.filledYardQuantity;
      }
      if (typeof args.data?.emptyYardQuantity === 'number') {
        mockJarItem.emptyYardQuantity = args.data.emptyYardQuantity;
      }
      return Promise.resolve(mockJarItem);
    });

    mockPrisma.$queryRawUnsafe.mockResolvedValue([mockCompanyInventory]);
    mockPrisma.inventoryLog.create.mockImplementation((args: any) => Promise.resolve({ id: 'log-1', ...args.data }));

    service = new InventoryService(mockPrisma);
  });

  // =========================================================================
  // TEST 1: Add Company Stock (Direct replenishment)
  // =========================================================================
  it('TEST 1: Add company stock increases warehouse filled jars and logs REPLENISH', async () => {
    const res = await service.addRawStock(100, 'staff-user-1');
    expect(res.filledJars).toBe(1100);
    expect(mockPrisma.inventoryLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'REPLENISH',
          filledQty: 100,
          toState: 'FILLED_YARD',
        }),
      }),
    );
  });

  // =========================================================================
  // TEST 2, 3, 4: Transfer 50 to Distributor -> Company -50, Distributor +50
  // =========================================================================
  it('TEST 2, 3, 4: Transfer 50 jars decreases company stock by 50 and increases distributor stock by 50', async () => {
    const transferRes = await service.transferStockToDistributor(
      {
        distributorId: mockDistributorId,
        quantity: 50,
        notes: 'Morning dispatch delivery',
      },
      'staff-user-1',
    );

    expect(transferRes.transferredQty).toBe(50);
    expect(transferRes.companyAvailableAfter).toBe(950);
    expect(transferRes.distributorAvailableAfter).toBe(170);

    // Verify atomic updates on both models
    expect(mockCompanyInventory.filledJars).toBe(950);
    expect(mockJarItem.filledYardQuantity).toBe(170);
    expect(mockJarItem.ownedQuantity).toBe(170);
    expect(mockDistributor.companyOwnedJars).toBe(170);

    // Verify 2 ledger logs (one distributor-side, one company-side)
    expect(mockPrisma.inventoryLog.create).toHaveBeenCalledTimes(2);
    expect(mockPrisma.inventoryLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          distributorId: mockDistributorId,
          action: 'STOCK_TRANSFER',
          quantity: 50,
          fromState: 'COMPANY_WAREHOUSE',
          toState: 'FILLED_YARD',
        }),
      }),
    );
  });

  // =========================================================================
  // TEST 5, 6: Refresh Page / Query -> Consistent Stock Projection
  // =========================================================================
  it('TEST 5, 6: Refresh dashboard yields identical verified stock positions', async () => {
    mockPrisma.jarInventoryItem.findMany.mockResolvedValue([mockJarItem]);
    mockPrisma.distributor.count.mockResolvedValue(1);
    mockPrisma.product.findMany.mockResolvedValue([
      { id: 'prod-1', name: 'Biodrops 20L Jar', price: 100, depositAmount: 200, isJar: true },
    ]);

    const dashboard = await service.getCentralDashboard();
    expect(dashboard.companyStock.filledJars).toBe(1000);
    expect(dashboard.networkSummary.availableAtCompany).toBe(1000);
    expect(dashboard.networkSummary.withDistributors).toBe(120);
    expect(dashboard.networkSummary.totalCompanyJarsInEcosystem).toBe(1000 + 200 + 5 + 120);

    // Refresh query again
    const refreshed = await service.getCentralDashboard();
    expect(refreshed.networkSummary.withDistributors).toBe(120);
  });

  // =========================================================================
  // TEST 7: Insufficient Company Stock is Blocked
  // =========================================================================
  it('TEST 7: Attempting to transfer more stock than company possesses throws BadRequestException', async () => {
    await expect(
      service.transferStockToDistributor(
        {
          distributorId: mockDistributorId,
          quantity: 2000, // Company only has 1000
        },
        'staff-user-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  // =========================================================================
  // TEST 8, 9: Return Stock from Distributor (Empty and Filled)
  // =========================================================================
  it('TEST 8, 9: Returning 10 empty jars decreases distributor empty yard and increases company empty return pool', async () => {
    mockJarItem.emptyYardQuantity = 20;

    const returnRes = await service.receiveReturnFromDistributor(
      {
        distributorId: mockDistributorId,
        stockType: 'EMPTY',
        quantity: 10,
        notes: 'Collected empty bottles batch',
      },
      'staff-user-1',
    );

    expect(returnRes.returnedQty).toBe(10);
    expect(returnRes.distributorEmptyAfter).toBe(10);
    expect(returnRes.companyEmptyAfter).toBe(210);

    expect(mockCompanyInventory.emptyJars).toBe(210);
    expect(mockJarItem.emptyYardQuantity).toBe(10);
    expect(mockDistributor.companyOwnedJars).toBe(110);
  });

  // =========================================================================
  // TEST 10: Manual Distributor Stock Adjustment with Physical Count
  // =========================================================================
  it('TEST 10: Physical count adjustment creates an auditable manual adjustment transaction', async () => {
    // Current filled yard = 120, physical count = 118
    const adjRes = await service.adjustDistributorStock(
      {
        distributorId: mockDistributorId,
        state: 'FILLED_YARD',
        newQuantity: 118,
        reason: 'Monthly physical stock audit variance',
      },
      'admin-user-1',
    );

    expect(adjRes.delta).toBe(-2);
    expect(adjRes.newQuantity).toBe(118);
    expect(mockPrisma.inventoryLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'MANUAL_ADJUSTMENT',
          quantity: -2,
          balanceAfter: 118,
          fromState: 'PHYSICAL_AUDIT',
          toState: 'FILLED_YARD',
          description: expect.stringContaining('Monthly physical stock audit variance'),
        }),
      }),
    );
  });

  // =========================================================================
  // TEST 11: Damaged Jars Reporting
  // =========================================================================
  it('TEST 11: Reporting damage removes jars from available stock and increments damaged stock', async () => {
    const dmgRes = await service.reportDamage(3, 'FILLED', 'staff-user-1', 'Cracked jar during handling');
    expect(dmgRes.filledJars).toBe(997);
    expect(dmgRes.damagedJars).toBe(8);
  });

  // =========================================================================
  // TEST 12: Production converts empty jars to filled jars
  // =========================================================================
  it('TEST 12: Plant production converts empty return jars into filled jars', async () => {
    const prodRes = await service.addProduction(25, 'staff-user-1');
    expect(prodRes.filledJars).toBe(1025);
    expect(prodRes.emptyJars).toBe(175);
  });

  // =========================================================================
  // TEST 13, 14, 15: Distributor List Breakdown
  // =========================================================================
  it('TEST 13, 14, 15: Distributor stock list groups company-owned and distributor-owned quantities accurately', async () => {
    mockDistributor.jarItems = [
      mockJarItem,
      {
        id: 'dist-owned-item',
        distributorId: mockDistributorId,
        name: 'Distributor 20L Custom Jar',
        ownershipType: 'DISTRIBUTOR',
        ownedQuantity: 50,
        filledYardQuantity: 40,
        emptyYardQuantity: 10,
        customerQuantity: 0,
        damagedQuantity: 0,
        isActive: true,
      },
    ];

    mockPrisma.distributor.findMany.mockResolvedValue([mockDistributor]);

    const list = await service.getDistributorStockList();
    expect(list).toHaveLength(1);
    expect(list[0].companyOwned.available).toBe(120);
    expect(list[0].distributorOwned.available).toBe(40);
    expect(list[0].totalManaged).toBe(170); // 120 + 50
  });

  // =========================================================================
  // TEST 16: Multi-Product Safety
  // =========================================================================
  it('TEST 16: System safely supports multiple product lines without hardcoded schemas', async () => {
    mockPrisma.jarInventoryItem.findMany.mockResolvedValue([
      mockJarItem,
      {
        id: 'item-2',
        distributorId: mockDistributorId,
        name: 'Biodrops 1L Pure Water',
        ownershipType: 'COMPANY',
        ownedQuantity: 500,
        filledYardQuantity: 500,
        emptyYardQuantity: 0,
        customerQuantity: 0,
        damagedQuantity: 0,
        isActive: true,
      },
    ]);

    mockPrisma.distributor.count.mockResolvedValue(1);
    mockPrisma.product.findMany.mockResolvedValue([
      { id: 'p1', name: 'Biodrops 20L Jar', price: 100, depositAmount: 200, isJar: true },
      { id: 'p2', name: 'Biodrops 1L Bottle', price: 20, depositAmount: 0, isJar: false },
    ]);

    const dash = await service.getCentralDashboard();
    expect(dash.products).toHaveLength(2);
    expect(dash.networkSummary.totalCompanyJarsInEcosystem).toBe(1000 + 200 + 5 + 120 + 500);
  });

  // =========================================================================
  // TEST 18: Idempotency Key Preservation
  // =========================================================================
  it('TEST 18: Transfer with explicit idempotency key persists client reference key', async () => {
    const clientKey = 'IDEM-KEY-9999';
    const res = await service.transferStockToDistributor(
      {
        distributorId: mockDistributorId,
        quantity: 10,
        idempotencyKey: clientKey,
      },
      'staff-1',
    );
    expect(res.referenceId).toBe(clientKey);
  });

  // =========================================================================
  // TEST 23, 24: Ledger / Projection Reconciliation Invariant
  // =========================================================================
  it('TEST 23, 24: Total network jars must strictly equal company warehouse + distributor held + customer held + damaged', async () => {
    // Invariant: Company total + With Distributors + Customer + Empty + Damaged
    mockJarItem.filledYardQuantity = 80;
    mockJarItem.customerQuantity = 30;
    mockJarItem.emptyYardQuantity = 10;
    mockJarItem.ownedQuantity = 120; // 80 + 30 + 10 = 120

    mockPrisma.jarInventoryItem.findMany.mockResolvedValue([mockJarItem]);
    mockPrisma.distributor.count.mockResolvedValue(1);
    mockPrisma.product.findMany.mockResolvedValue([]);

    const dash = await service.getCentralDashboard();
    const expectedTotal =
      mockCompanyInventory.filledJars +
      mockCompanyInventory.emptyJars +
      mockCompanyInventory.damagedJars +
      mockJarItem.ownedQuantity;

    expect(dash.networkSummary.totalCompanyJarsInEcosystem).toBe(expectedTotal);
    expect(dash.networkSummary.customerHolding).toBe(30);
    expect(dash.networkSummary.withDistributors).toBe(80);
    expect(dash.networkSummary.distributorEmptyPool).toBe(10);
  });
});
