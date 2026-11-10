import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { PaymentService } from '../payment/payment.service';
import { NotificationService } from '../notification/notification.service';
import { WalletService } from './wallet.service';
import { DepositTransactionType } from '@prisma/client';

describe('WalletService', () => {
  let service: WalletService;
  let mockPrisma: any;
  const settingsService = {};
  const paymentService = {};
  const notificationService = {};

  beforeEach(async () => {
    mockPrisma = {
      wallet: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { balance: 12500 } }),
      },
      jarDeposit: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { depositPaid: 8000 } }),
      },
      depositTransaction: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 1600 } }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: SettingsService, useValue: settingsService },
        { provide: PaymentService, useValue: paymentService },
        { provide: NotificationService, useValue: notificationService },
      ],
    }).compile();

    service = module.get<WalletService>(WalletService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('FIN-04: getAdminLedger calculates refunded deposits from depositTransaction table', async () => {
    const result = await service.getAdminLedger();

    expect(mockPrisma.depositTransaction.aggregate).toHaveBeenCalledWith({
      _sum: { amount: true },
      where: { type: DepositTransactionType.DEPOSIT_REFUNDED },
    });
    expect(result).toEqual({
      totalRechargeBalances: 12500,
      totalDepositsHeld: 8000,
      depositsRefunded: 1600,
      pendingSettlements: 0,
    });
  });
});
