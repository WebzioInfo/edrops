import { Test, TestingModule } from '@nestjs/testing';
import { PurchaseService } from './purchase.service';
import { PrismaService } from '../prisma/prisma.service';

describe('PurchaseService - Physical Stock Intake (INT-01)', () => {
  let service: PurchaseService;
  let mockPrisma: any;

  beforeEach(async () => {
    mockPrisma = {
      purchase: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockImplementation((args) => Promise.resolve({ id: 'pur-1', ...args.data })),
        delete: jest.fn().mockResolvedValue({ id: 'pur-1' }),
      },
      distributor: {
        findFirst: jest.fn().mockResolvedValue({ id: 'dist-uuid-1', userId: 'user-dist-1' }),
      },
      product: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
      },
      jarInventoryItem: {
        findFirst: jest.fn(),
        create: jest.fn().mockImplementation((args) => Promise.resolve({ id: 'jar-item-1', ...args.data })),
        update: jest.fn().mockImplementation((args) => Promise.resolve({ id: args.where.id, ...args.data })),
      },
      distributorAccessoryStock: {
        upsert: jest.fn().mockResolvedValue({}),
      },
      rawMaterialItem: {
        findFirst: jest.fn(),
      },
      distributorRawMaterialStock: {
        upsert: jest.fn().mockResolvedValue({}),
      },
      inventoryLog: {
        create: jest.fn().mockResolvedValue({}),
      },
      rawMaterialMovement: {
        create: jest.fn().mockResolvedValue({}),
      },
      supplierTransaction: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
      },
      supplier: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchaseService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<PurchaseService>(PurchaseService);
  });

  it('INT-01: creating a purchase receiving jars increments distributor JarInventoryItem empty yard and logs InventoryLog', async () => {
    mockPrisma.product.findUnique.mockResolvedValue({
      id: 'prod-jar-1',
      name: 'Biodrops 20L Jar',
      isJar: true,
    });
    mockPrisma.jarInventoryItem.findFirst.mockResolvedValue({
      id: 'dist-jar-item',
      distributorId: 'dist-uuid-1',
      ownershipType: 'DISTRIBUTOR',
      ownedQuantity: 50,
      emptyYardQuantity: 20,
    });

    const dto: any = {
      supplierName: 'National Bottle Co',
      items: [
        {
          productId: 'prod-jar-1',
          productName: 'Biodrops 20L Jar',
          quantity: 100,
          rate: 150,
          amount: 15000,
        },
      ],
      subtotal: 15000,
      total: 15000,
      paymentStatus: 'PAID',
    };

    const result = await service.create('user-dist-1', dto);

    expect(result).toBeDefined();
    expect(mockPrisma.jarInventoryItem.update).toHaveBeenCalledWith({
      where: { id: 'dist-jar-item' },
      data: {
        ownedQuantity: 150,
        emptyYardQuantity: 120,
      },
    });
    expect(mockPrisma.inventoryLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          distributorId: 'dist-uuid-1',
          ownership: 'DISTRIBUTOR',
          action: 'PURCHASE_RECEIPT',
          quantity: 100,
          emptyQty: 100,
        }),
      }),
    );
  });

  it('INT-01: creating a purchase receiving accessories increments DistributorAccessoryStock', async () => {
    mockPrisma.product.findUnique.mockResolvedValue({
      id: 'prod-dispenser-1',
      name: 'Tabletop Dispenser Tap',
      isJar: false,
    });

    const dto: any = {
      supplierName: 'Plastics Corp',
      items: [
        {
          productId: 'prod-dispenser-1',
          productName: 'Tabletop Dispenser Tap',
          quantity: 25,
          rate: 40,
          amount: 1000,
        },
      ],
      subtotal: 1000,
      total: 1000,
      paymentStatus: 'PAID',
    };

    await service.create('user-dist-1', dto);

    expect(mockPrisma.distributorAccessoryStock.upsert).toHaveBeenCalledWith({
      where: {
        distributorId_productId: {
          distributorId: 'dist-uuid-1',
          productId: 'prod-dispenser-1',
        },
      },
      create: {
        distributorId: 'dist-uuid-1',
        productId: 'prod-dispenser-1',
        quantity: 25,
      },
      update: {
        quantity: { increment: 25 },
      },
    });
  });
});
