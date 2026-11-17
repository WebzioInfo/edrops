import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { RazorpayProvider } from '../payment/providers/razorpay.provider';
import { NotificationService } from '../notification/notification.service';
import { RechargeEngine } from '../engines/recharge.engine';
import { WebhookService } from './webhook.service';

describe('WebhookService', () => {
  let service: WebhookService;
  const prismaService = {
    paymentWebhookLog: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    payment: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    paymentAttempt: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    paymentAuditLog: {
      create: jest.fn(),
    },
    wallet: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    walletTransaction: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    order: {
      update: jest.fn(),
    },
    package: {
      findUnique: jest.fn(),
    },
    packagePurchase: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn((cb) => cb(prismaService)),
    $executeRawUnsafe: jest.fn(),
  };

  const razorpayProvider = {
    verifyWebhookSignature: jest.fn().mockReturnValue(true),
  };

  const notificationService = {
    notifyPaymentEvent: jest.fn(),
    notifyWalletRecharge: jest.fn(),
  };

  const rechargeEngine = {
    processRecharge: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookService,
        { provide: PrismaService, useValue: prismaService },
        { provide: RazorpayProvider, useValue: razorpayProvider },
        { provide: NotificationService, useValue: notificationService },
        { provide: RechargeEngine, useValue: rechargeEngine },
      ],
    }).compile();

    service = module.get<WebhookService>(WebhookService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should verify signature and persist event in handleEvent', async () => {
    const rawPayload = JSON.stringify({ id: 'evt_123', event: 'payment.captured' });
    const payload = { id: 'evt_123', event: 'payment.captured' };
    const signature = 'valid_sig';

    await service.handleEvent(rawPayload, payload, signature);

    expect(razorpayProvider.verifyWebhookSignature).toHaveBeenCalledWith({
      signature,
      payload: rawPayload,
    });
    expect(prismaService.paymentWebhookLog.create).toHaveBeenCalledWith({
      data: {
        eventId: 'evt_123',
        eventType: 'payment.captured',
        payload,
        signature,
        status: 'PENDING',
      },
    });
  });

  it('should reject invalid signatures without storing log', async () => {
    razorpayProvider.verifyWebhookSignature.mockReturnValueOnce(false);
    const rawPayload = JSON.stringify({ id: 'evt_bad', event: 'payment.captured' });
    const payload = { id: 'evt_bad', event: 'payment.captured' };

    await service.handleEvent(rawPayload, payload, 'bad_sig');

    expect(prismaService.paymentWebhookLog.create).not.toHaveBeenCalled();
  });

  it('should fulfill wallet recharge when payment.orderId is null (browser dropped scenario)', async () => {
    const eventId = 'evt_wallet_topup';
    prismaService.paymentWebhookLog.findUnique.mockResolvedValueOnce({
      id: 'log_1',
      eventId,
      status: 'PENDING',
      payload: {
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: 'pay_123',
              order_id: 'order_rzp_456',
              amount: 50000,
            },
          },
        },
      },
    });

    prismaService.payment.findFirst.mockResolvedValueOnce({
      id: 'pay_local_1',
      providerId: 'order_rzp_456',
      customerId: 'cust_1',
      orderId: null,
      amount: 500,
      description: 'Wallet Recharge (₹500)',
      status: 'PENDING',
      customer: { userId: 'user_1' },
    });

    prismaService.paymentAttempt.findFirst.mockResolvedValueOnce(null);
    prismaService.wallet.findUnique.mockResolvedValue({
      id: 'wallet_1',
      customerId: 'cust_1',
      balance: 100,
    });
    prismaService.walletTransaction.findFirst.mockResolvedValueOnce(null); // Not yet credited

    await (service as any).processEventSafely(eventId);

    // Verify row locks and atomic balance increment
    expect(prismaService.$executeRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('SELECT id FROM "Payment" WHERE id = $1 FOR UPDATE'),
      'pay_local_1',
    );
    expect(prismaService.$executeRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('SELECT id FROM "Wallet" WHERE id = $1 FOR UPDATE'),
      'wallet_1',
    );
    expect(prismaService.wallet.update).toHaveBeenCalledWith({
      where: { id: 'wallet_1' },
      data: { balance: 600 },
    });
    expect(prismaService.walletTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        walletId: 'wallet_1',
        amount: 500,
        balanceBefore: 100,
        balanceAfter: 600,
        referenceId: 'pay_local_1',
      }),
    });
    expect(prismaService.payment.update).toHaveBeenCalledWith({
      where: { id: 'pay_local_1' },
      data: { status: 'SUCCESS' },
    });
    expect(prismaService.paymentWebhookLog.update).toHaveBeenCalledWith({
      where: { id: 'log_1' },
      data: expect.objectContaining({ status: 'PROCESSED' }),
    });
  });

  it('should skip duplicate wallet crediting if already credited (idempotency)', async () => {
    const eventId = 'evt_duplicate_topup';
    prismaService.paymentWebhookLog.findUnique.mockResolvedValueOnce({
      id: 'log_2',
      eventId,
      status: 'PENDING',
      payload: {
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: 'pay_already_credited',
              order_id: 'order_rzp_789',
              amount: 50000,
            },
          },
        },
      },
    });

    prismaService.payment.findFirst.mockResolvedValueOnce({
      id: 'pay_local_2',
      providerId: 'order_rzp_789',
      customerId: 'cust_1',
      orderId: null,
      amount: 500,
      description: 'Wallet Recharge (₹500)',
      status: 'SUCCESS',
      customer: { userId: 'user_1' },
    });

    prismaService.wallet.findUnique.mockResolvedValue({
      id: 'wallet_1',
      customerId: 'cust_1',
      balance: 600,
    });
    // Already credited by client confirmRecharge
    prismaService.walletTransaction.findFirst.mockResolvedValueOnce({
      id: 'tx_existing',
      referenceId: 'pay_local_2',
    });

    await (service as any).processEventSafely(eventId);

    // Verify wallet balance is NOT updated again
    expect(prismaService.wallet.update).not.toHaveBeenCalled();
    expect(prismaService.walletTransaction.create).not.toHaveBeenCalled();
    expect(prismaService.paymentWebhookLog.update).toHaveBeenCalledWith({
      where: { id: 'log_2' },
      data: expect.objectContaining({ status: 'PROCESSED' }),
    });
  });
});
