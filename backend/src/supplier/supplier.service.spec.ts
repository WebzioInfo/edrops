import { Test, TestingModule } from '@nestjs/testing';
import { SupplierService } from './supplier.service';
import { PrismaService } from '../prisma/prisma.service';

describe('SupplierService - Running Balance & Post-Adjustment Transactions (FIN-02)', () => {
  let service: SupplierService;
  let mockPrisma: any;

  beforeEach(async () => {
    mockPrisma = {
      supplier: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      supplierTransaction: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupplierService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<SupplierService>(SupplierService);
  });

  it('FIN-02: findAll reflects the latest running balance including post-adjustment transactions', async () => {
    // Scenario:
    // Supplier had an adjustment to 5,000, then made a purchase of 2,000 resulting in balance 7,000
    mockPrisma.supplier.findMany.mockResolvedValue([
      {
        id: 'sup-1',
        name: 'Apex Bottles',
        openingBalance: 0,
        openingBalanceType: 'PAYABLE',
        purchases: [
          { id: 'pur-1', total: 2000, amountPaid: 0, paymentStatus: 'PENDING' },
        ],
        transactions: [
          // latest transaction is the PURCHASE with running balance 7000
          {
            id: 'tx-2',
            type: 'PURCHASE',
            balance: 7000,
            createdAt: new Date('2026-10-25'),
          },
        ],
      },
    ]);

    const result = await service.findAll('dist-1', {});

    expect(result).toHaveLength(1);
    expect(result[0].balance).toBe(7000); // Does NOT freeze at 5000!
  });
});
