import { Test, TestingModule } from '@nestjs/testing';
import { DistributorWalletService } from './distributor-wallet.service';
import { PrismaService } from '../prisma/prisma.service';
import { DistributorIdentityResolver } from './distributor-identity.resolver';
import { BadRequestException } from '@nestjs/common';
import { DistributorWalletTxType } from '@prisma/client';

describe('DistributorWalletService', () => {
  let service: DistributorWalletService;

  const mockIdentity = {
    userId: 'user-dist-1',
    distributorId: 'dist-profile-1',
    agencyName: 'Malappuram Water Agency',
    routeOrArea: 'Kottakkal',
    jarDepositRate: 150,
    companyOwnedJars: 100,
    distributorOwnedJars: 50,
    canManufacture: false,
    isAdminImpersonation: false,
  };

  const mockIdentityResolver = {
    resolve: jest.fn().mockResolvedValue(mockIdentity),
  };

  const mockPrisma = {
    distributorWallet: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    distributorWalletTransaction: {
      groupBy: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
    purchase: {
      aggregate: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn((cb) => cb(mockPrisma)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DistributorWalletService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: DistributorIdentityResolver, useValue: mockIdentityResolver },
      ],
    }).compile();

    service = module.get<DistributorWalletService>(DistributorWalletService);
    jest.clearAllMocks();
  });

  it('1. Retrieves wallet overview with aggregated stats and balance', async () => {
    mockPrisma.distributorWallet.findUnique.mockResolvedValue({
      id: 'wallet-1',
      distributorId: 'dist-profile-1',
      balance: 5400.5,
      currency: 'INR',
      updatedAt: new Date(),
    });

    mockPrisma.distributorWalletTransaction.groupBy.mockResolvedValue([
      { type: DistributorWalletTxType.TOP_UP, _sum: { amount: 10000 }, _count: { id: 2 } },
      { type: DistributorWalletTxType.PURCHASE_PAYMENT, _sum: { amount: 4000 }, _count: { id: 1 } },
      { type: DistributorWalletTxType.COMMISSION_CREDIT, _sum: { amount: 1200 }, _count: { id: 5 } },
    ]);

    mockPrisma.purchase.aggregate.mockResolvedValue({
      _sum: { total: 3000, amountPaid: 1000 },
      _count: { id: 1 },
    });

    const overview = await service.getWalletOverview({ id: 'user-dist-1', role: 'DISTRIBUTOR' });

    expect(overview.wallet.balance).toBe(5400.5);
    expect(overview.stats.totalTopUp).toBe(10000);
    expect(overview.stats.totalPurchasePaid).toBe(4000);
    expect(overview.stats.totalCommission).toBe(1200);
    expect(overview.stats.pendingPurchasesDue).toBe(2000);
  });

  it('2. Successfully tops up distributor wallet and creates transaction record', async () => {
    mockPrisma.distributorWallet.findUnique.mockResolvedValue({
      id: 'wallet-1',
      balance: 1000,
    });
    mockPrisma.distributorWallet.update.mockResolvedValue({
      id: 'wallet-1',
      balance: 3500,
    });
    mockPrisma.distributorWalletTransaction.create.mockResolvedValue({
      id: 'tx-101',
      type: DistributorWalletTxType.TOP_UP,
      amount: 2500,
      balanceBefore: 1000,
      balanceAfter: 3500,
      referenceId: 'TOPUP-REF-99',
    });

    const result = await service.topUp(
      { id: 'user-dist-1', role: 'DISTRIBUTOR' },
      { amount: 2500, paymentMethod: 'UPI', referenceId: 'TOPUP-REF-99' },
    );

    expect(result.success).toBe(true);
    expect(result.wallet.balance).toBe(3500);
    expect(mockPrisma.distributorWallet.update).toHaveBeenCalledWith({
      where: { id: 'wallet-1' },
      data: { balance: 3500 },
    });
  });

  it('3. Successfully pays wholesale purchase order from wallet', async () => {
    mockPrisma.distributorWallet.findUnique.mockResolvedValue({
      id: 'wallet-1',
      balance: 5000,
    });
    mockPrisma.purchase.findFirst.mockResolvedValue({
      id: 'pur-1',
      purchaseNumber: 'PO-2026-001',
      supplierName: 'Aquzio Spring Plant',
      total: 2000,
      amountPaid: 0,
      paymentStatus: 'DUE',
      payments: [],
    });
    mockPrisma.distributorWallet.update.mockResolvedValue({
      id: 'wallet-1',
      balance: 3000,
    });
    mockPrisma.distributorWalletTransaction.create.mockResolvedValue({
      id: 'tx-pur-1',
      type: DistributorWalletTxType.PURCHASE_PAYMENT,
      amount: 2000,
      balanceBefore: 5000,
      balanceAfter: 3000,
    });
    mockPrisma.purchase.update.mockResolvedValue({
      id: 'pur-1',
      amountPaid: 2000,
      paymentStatus: 'PAID',
    });

    const result = await service.payPurchase(
      { id: 'user-dist-1', role: 'DISTRIBUTOR' },
      { purchaseId: 'pur-1' },
    );

    expect(result.success).toBe(true);
    expect(result.wallet.balance).toBe(3000);
    expect(result.purchase.paymentStatus).toBe('PAID');
  });

  it('4. Rejects purchase payment when wallet balance is insufficient', async () => {
    mockPrisma.distributorWallet.findUnique.mockResolvedValue({
      id: 'wallet-1',
      balance: 500, // Only 500 available
    });
    mockPrisma.purchase.findFirst.mockResolvedValue({
      id: 'pur-1',
      purchaseNumber: 'PO-2026-001',
      supplierName: 'Aquzio Spring Plant',
      total: 2000, // 2000 required
      amountPaid: 0,
      paymentStatus: 'DUE',
    });

    await expect(
      service.payPurchase(
        { id: 'user-dist-1', role: 'DISTRIBUTOR' },
        { purchaseId: 'pur-1' },
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('5. Successfully processes bank withdrawal request and debits wallet', async () => {
    mockPrisma.distributorWallet.findUnique.mockResolvedValue({
      id: 'wallet-1',
      balance: 8000,
    });
    mockPrisma.distributorWallet.update.mockResolvedValue({
      id: 'wallet-1',
      balance: 5000,
    });
    mockPrisma.distributorWalletTransaction.create.mockResolvedValue({
      id: 'tx-wd-1',
      type: DistributorWalletTxType.WITHDRAWAL,
      amount: 3000,
      balanceBefore: 8000,
      balanceAfter: 5000,
    });

    const res = await service.requestWithdrawal(
      { id: 'user-dist-1', role: 'DISTRIBUTOR' },
      {
        amount: 3000,
        bankName: 'HDFC Bank',
        accountNumber: '50100234567890',
        ifscCode: 'HDFC0001234',
      },
    );

    expect(res.success).toBe(true);
    expect(res.wallet.balance).toBe(5000);
  });
});
