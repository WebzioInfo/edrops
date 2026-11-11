import { Test, TestingModule } from '@nestjs/testing';
import { DistributorExpensesService } from './distributor-expenses.service';
import { PrismaService } from '../prisma/prisma.service';

describe('DistributorExpensesService', () => {
  let service: DistributorExpensesService;
  let prisma: any;

  const mockPrisma = {
    distributorExpense: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DistributorExpensesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<DistributorExpensesService>(DistributorExpensesService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  it('1. Successfully creates an approved distributor expense', async () => {
    mockPrisma.distributorExpense.create.mockResolvedValue({
      id: 'exp-101',
      distributorId: 'dist-profile-1',
      category: 'FUEL',
      title: 'Diesel for Tata Ace Delivery Van',
      amount: 1500,
      paymentMethod: 'UPI',
      paymentStatus: 'PAID',
      status: 'APPROVED',
      vendorName: 'HP Fuel Station',
      createdAt: new Date(),
    });

    const res = await service.create(
      'dist-profile-1',
      {
        category: 'FUEL',
        title: 'Diesel for Tata Ace Delivery Van',
        amount: 1500,
        paymentMethod: 'UPI',
        vendorName: 'HP Fuel Station',
      },
      'user-1',
    );

    expect(res.id).toBe('exp-101');
    expect(res.amount).toBe(1500);
    expect(mockPrisma.distributorExpense.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          distributorId: 'dist-profile-1',
          category: 'FUEL',
          amount: 1500,
        }),
      }),
    );
  });

  it('2. Soft-cancels approved expenses to maintain historical P&L auditability', async () => {
    mockPrisma.distributorExpense.findFirst.mockResolvedValue({
      id: 'exp-101',
      distributorId: 'dist-profile-1',
      status: 'APPROVED',
    });

    mockPrisma.distributorExpense.update.mockResolvedValue({
      id: 'exp-101',
      status: 'CANCELLED',
    });

    const res = await service.delete('exp-101', 'dist-profile-1');
    expect(res.status).toBe('CANCELLED');
    expect(mockPrisma.distributorExpense.update).toHaveBeenCalledWith({
      where: { id: 'exp-101' },
      data: { status: 'CANCELLED' },
    });
    expect(mockPrisma.distributorExpense.delete).not.toHaveBeenCalled();
  });
});
