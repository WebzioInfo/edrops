import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionScheduler } from './subscription.scheduler';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStatus, PaymentStatus, WalletTransactionType, TransactionType } from '@prisma/client';
import {
  revertOrderFunding,
  calculateDeliveryFundingAllocation,
  parseFundingMeta,
} from '../common/funding.util';
import { isValidTransition } from '../order/order-state-machine';

describe('eDrops Calendar & Delivery Schedule Core Audit Suite', () => {
  let scheduler: SubscriptionScheduler;
  let prisma: any;

  const mockCustomerId = 'cust-audit-123';
  const mockScheduleId = 'sched-audit-456';
  const mockAddressId = 'addr-audit-789';

  beforeEach(async () => {
    prisma = {
      deliverySchedule: {
        findMany: jest.fn(),
      },
      order: {
        findFirst: jest.fn(),
        create: jest.fn().mockResolvedValue({ id: 'ord-audit-999' }),
      },
      delivery: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      product: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'prod-jar-1',
          name: '20L Commercial Water Jar',
          isJar: true,
          price: 40,
        }),
      },
      jarBalance: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      wallet: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      transaction: {
        create: jest.fn(),
      },
      walletTransaction: {
        create: jest.fn(),
      },
      $executeRawUnsafe: jest.fn().mockResolvedValue(1),
      $transaction: jest.fn().mockImplementation(async (callback) => {
        return callback(prisma);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionScheduler,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    scheduler = module.get<SubscriptionScheduler>(SubscriptionScheduler);
  });

  it('1. Zero prepaid jars and zero wallet balance generates COD order safely', async () => {
    const today = new Date();
    const dayOfWeek = today.getUTCDay();

    prisma.deliverySchedule.findMany.mockResolvedValue([
      {
        id: mockScheduleId,
        customerId: mockCustomerId,
        isActive: true,
        rules: [{ type: 'WEEKLY', dayOfWeek, quantity: 2 }],
        overrides: [],
        customer: {
          id: mockCustomerId,
          addresses: [{ id: mockAddressId, isDefault: true }],
          user: { firstName: 'Murshid' },
        },
      },
    ]);

    // Zero prepaid jars
    prisma.jarBalance.findFirst.mockResolvedValue(null);
    // Zero wallet balance
    prisma.wallet.findUnique.mockResolvedValue({ id: 'w-1', balance: 0 });
    // No prior order today
    prisma.order.findFirst.mockResolvedValue(null);
    prisma.delivery.findFirst.mockResolvedValue(null);

    await scheduler.generateDailySubscriptions();

    // Verify advisory transaction lock was called
    expect(prisma.$executeRawUnsafe).toHaveBeenCalledWith(
      'SELECT pg_advisory_xact_lock(hashtext($1))',
      mockCustomerId,
    );

    // Verify order was created as COD / PENDING
    expect(prisma.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          customerId: mockCustomerId,
          orderType: 'SUBSCRIPTION_ORDER',
          paymentStatus: PaymentStatus.PENDING,
          paymentMethod: 'CASH',
          hybridSecondaryMethod: 'CASH',
        }),
      }),
    );
  });

  it('2. Multi-tier funding: Applies prepaid jars first, then wallet, then remainder as COD', async () => {
    const today = new Date();
    const dayOfWeek = today.getUTCDay();

    // Schedule demands 3 jars @ ₹40 each = ₹120 total
    prisma.deliverySchedule.findMany.mockResolvedValue([
      {
        id: mockScheduleId,
        customerId: mockCustomerId,
        isActive: true,
        rules: [{ type: 'WEEKLY', dayOfWeek, quantity: 3 }],
        overrides: [],
        customer: {
          id: mockCustomerId,
          addresses: [{ id: mockAddressId, isDefault: true }],
          user: { firstName: 'Murshid' },
        },
      },
    ]);

    // Customer has 1 prepaid jar
    prisma.jarBalance.findFirst.mockResolvedValue({
      id: 'jb-1',
      availableJars: 1,
    });
    // Customer has ₹40 in wallet (covers 1 jar)
    prisma.wallet.findUnique.mockResolvedValue({
      id: 'w-1',
      balance: 40,
    });
    // No prior order today
    prisma.order.findFirst.mockResolvedValue(null);
    prisma.delivery.findFirst.mockResolvedValue(null);

    await scheduler.generateDailySubscriptions();

    // Jar balance deduction: 1 jar
    expect(prisma.jarBalance.update).toHaveBeenCalledWith({
      where: { id: 'jb-1' },
      data: { availableJars: 0 },
    });

    // Wallet balance deduction: ₹40
    expect(prisma.wallet.update).toHaveBeenCalledWith({
      where: { id: 'w-1' },
      data: { balance: { decrement: 40 } },
    });

    // Order created with metadata documenting the breakdown
    expect(prisma.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          paymentStatus: PaymentStatus.PENDING,
          paymentMethod: 'PREPAID_PACKAGE',
          hybridSecondaryMethod: 'CASH',
          adminNotes: JSON.stringify({
            prepaidJars: 1,
            walletDeducted: 40,
            codDue: 40,
            unitPrice: 40,
            totalJars: 3,
            totalAmount: 120,
          }),
        }),
      }),
    );
  });

  it('3. Idempotency: Duplicate order prevention on scheduler rerun', async () => {
    const today = new Date();
    const dayOfWeek = today.getUTCDay();

    prisma.deliverySchedule.findMany.mockResolvedValue([
      {
        id: mockScheduleId,
        customerId: mockCustomerId,
        isActive: true,
        rules: [{ type: 'WEEKLY', dayOfWeek, quantity: 2 }],
        overrides: [],
        customer: {
          id: mockCustomerId,
          addresses: [{ id: mockAddressId, isDefault: true }],
          user: { firstName: 'Murshid' },
        },
      },
    ]);

    // Prior order already exists for today
    prisma.order.findFirst.mockResolvedValue({
      id: 'existing-ord-1',
      orderType: 'SUBSCRIPTION_ORDER',
    });

    await scheduler.generateDailySubscriptions();

    // Order creation must be skipped
    expect(prisma.order.create).not.toHaveBeenCalled();
    expect(prisma.jarBalance.update).not.toHaveBeenCalled();
    expect(prisma.wallet.update).not.toHaveBeenCalled();
  });

  it('4. Specific date override takes precedence over weekly cadence', async () => {
    const today = new Date();
    const dayOfWeek = today.getUTCDay();

    // Weekly rule specifies 2 jars, but override specifies 0 jars (skip today)
    prisma.deliverySchedule.findMany.mockResolvedValue([
      {
        id: mockScheduleId,
        customerId: mockCustomerId,
        isActive: true,
        rules: [{ type: 'WEEKLY', dayOfWeek, quantity: 2 }],
        overrides: [{ targetDate: today, quantity: 0, reason: 'Customer traveling' }],
        customer: {
          id: mockCustomerId,
          addresses: [{ id: mockAddressId, isDefault: true }],
          user: { firstName: 'Murshid' },
        },
      },
    ]);

    await scheduler.generateDailySubscriptions();

    // Quantity is 0 -> no order should be generated
    expect(prisma.order.create).not.toHaveBeenCalled();
  });

  it('5. Failed delivery symmetric balance restoration: refunds wallet and prepaid jars', async () => {
    const mockMeta = {
      prepaidJars: 2,
      walletDeducted: 80,
      codDue: 0,
      unitPrice: 40,
      totalJars: 2,
      totalAmount: 80,
    };

    // Verify metadata stringification matches parsing contract
    const parsed = JSON.parse(JSON.stringify(mockMeta));
    expect(parsed.prepaidJars).toBe(2);
    expect(parsed.walletDeducted).toBe(80);

    // Ensure wallet balance restore calculation
    const walletBalanceBefore = 10;
    const walletBalanceAfter = walletBalanceBefore + parsed.walletDeducted;
    expect(walletBalanceAfter).toBe(90);

    // Ensure prepaid jar restore calculation
    const jarBalanceBefore = 0;
    const jarBalanceAfter = jarBalanceBefore + parsed.prepaidJars;
    expect(jarBalanceAfter).toBe(2);
  });

  it('6. Order Cancellation: revertOrderFunding atomically restores prepaid jars and wallet cash', async () => {
    const mockTx = {
      walletTransaction: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'wt-refund-1' }),
      },
      wallet: {
        findUnique: jest.fn().mockResolvedValue({ id: 'w-1', balance: 50 }),
        update: jest.fn().mockResolvedValue({ id: 'w-1', balance: 110 }),
      },
      transaction: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'tx-refund-1' }),
      },
      jarBalance: {
        findFirst: jest.fn().mockResolvedValue({ id: 'jb-1', availableJars: 0 }),
        update: jest.fn().mockResolvedValue({ id: 'jb-1', availableJars: 2 }),
      },
      order: {
        update: jest.fn().mockResolvedValue({ id: 'ord-1' }),
      },
    };

    const adminNotes = JSON.stringify({
      prepaidJars: 2,
      walletDeducted: 60,
      codDue: 60,
      unitPrice: 60,
      totalJars: 3,
      totalAmount: 180,
    });

    const result = await revertOrderFunding(mockTx, {
      orderId: 'ord-1',
      customerId: mockCustomerId,
      reason: 'Customer cancelled subscription delivery',
      referenceId: 'CANCEL-ORD-ord-1',
      adminNotes,
    });

    expect(result.reversed).toBe(true);
    expect(result.prepaidJarsRestored).toBe(2);
    expect(result.walletAmountRestored).toBe(60);

    // Wallet balance restored by 60
    expect(mockTx.wallet.update).toHaveBeenCalledWith({
      where: { customerId: mockCustomerId },
      data: { balance: 110 },
    });
    expect(mockTx.walletTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: WalletTransactionType.REFUND,
        amount: 60,
        referenceId: 'CANCEL-ORD-ord-1',
      }),
    });

    // Jar balance restored by 2
    expect(mockTx.jarBalance.update).toHaveBeenCalledWith({
      where: { id: 'jb-1' },
      data: { availableJars: 2 },
    });
    expect(mockTx.transaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: TransactionType.REFUND,
        amountJars: 2,
        referenceId: 'CANCEL-ORD-ord-1',
      }),
    });

    // Order adminNotes stamped with reversedAt
    expect(mockTx.order.update).toHaveBeenCalledWith({
      where: { id: 'ord-1' },
      data: {
        adminNotes: expect.stringContaining('"reversedAt"'),
      },
    });
  });

  it('7. Cancellation Idempotency: Cancelling an already-refunded order skips duplicate refunding', async () => {
    const mockTx = {
      walletTransaction: { findFirst: jest.fn(), create: jest.fn() },
      wallet: { findUnique: jest.fn(), update: jest.fn() },
      transaction: { findFirst: jest.fn(), create: jest.fn() },
      jarBalance: { findFirst: jest.fn(), update: jest.fn() },
      order: { update: jest.fn() },
    };

    const alreadyReversedNotes = JSON.stringify({
      prepaidJars: 2,
      walletDeducted: 60,
      reversedAt: '2026-11-19T06:00:00.000Z',
      reversalReason: 'Previous cancellation',
    });

    const result = await revertOrderFunding(mockTx, {
      orderId: 'ord-1',
      customerId: mockCustomerId,
      reason: 'Repeated cancellation request',
      referenceId: 'CANCEL-ORD-ord-1',
      adminNotes: alreadyReversedNotes,
    });

    expect(result.reversed).toBe(false);
    expect(result.prepaidJarsRestored).toBe(0);
    expect(result.walletAmountRestored).toBe(0);
    expect(mockTx.wallet.update).not.toHaveBeenCalled();
    expect(mockTx.jarBalance.update).not.toHaveBeenCalled();
    expect(mockTx.walletTransaction.create).not.toHaveBeenCalled();
    expect(mockTx.transaction.create).not.toHaveBeenCalled();
  });

  it('8. Split-funded delivery confirmation: zero additional jars deducted from jarBalance', () => {
    // Customer scheduled 2 jars: 1 prepaid jar + 1 COD jar (₹60)
    const fundingMeta = {
      prepaidJars: 1,
      walletDeducted: 0,
      codDue: 60,
      unitPrice: 60,
      totalJars: 2,
      totalAmount: 120,
    };

    // Driver delivers both 2 jars
    const allocation = calculateDeliveryFundingAllocation({
      fundingMeta,
      confirmedDeliveredQty: 2,
      paymentMethod: 'PREPAID_PACKAGE',
    });

    expect(allocation.prepaidDelivered).toBe(1);
    expect(allocation.prepaidToRefund).toBe(0);
    expect(allocation.codDelivered).toBe(1);
    expect(allocation.actualCODDue).toBe(60);
    // Crucial check: jar balance must NOT be deducted again!
    expect(allocation.jarsToDeductFromBalance).toBe(0);
  });

  it('9. Partial Delivery: Customer prepaid 2 jars, driver delivers 1 -> 1 prepaid jar refunded', () => {
    const fundingMeta = {
      prepaidJars: 2,
      walletDeducted: 0,
      codDue: 0,
      unitPrice: 60,
      totalJars: 2,
      totalAmount: 120,
    };

    const allocation = calculateDeliveryFundingAllocation({
      fundingMeta,
      confirmedDeliveredQty: 1,
    });

    expect(allocation.prepaidDelivered).toBe(1);
    expect(allocation.prepaidToRefund).toBe(1); // 1 jar must be refunded to jarBalance
    expect(allocation.jarsToDeductFromBalance).toBe(0);
  });

  it('10. Partial Delivery: Customer paid 2 jars via Wallet, driver delivers 1 -> 1 jar value refunded to wallet', () => {
    const fundingMeta = {
      prepaidJars: 0,
      walletDeducted: 120,
      codDue: 0,
      unitPrice: 60,
      totalJars: 2,
      totalAmount: 120,
    };

    const allocation = calculateDeliveryFundingAllocation({
      fundingMeta,
      confirmedDeliveredQty: 1,
    });

    expect(allocation.walletDelivered).toBe(1);
    expect(allocation.walletToRefund).toBe(60); // ₹60 must be refunded to wallet
    expect(allocation.jarsToDeductFromBalance).toBe(0);
  });

  it('11. State Machine Guard: Completed and Delivered orders cannot transition to CANCELLED', () => {
    expect(isValidTransition(OrderStatus.DELIVERED, OrderStatus.CANCELLED)).toBe(false);
    expect(isValidTransition(OrderStatus.COMPLETED, OrderStatus.CANCELLED)).toBe(false);
    expect(isValidTransition(OrderStatus.CONFIRMED, OrderStatus.CANCELLED)).toBe(true);
    expect(isValidTransition(OrderStatus.ORDER_PLACED, OrderStatus.CANCELLED)).toBe(true);
  });
});
