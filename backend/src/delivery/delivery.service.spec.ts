import { Test, TestingModule } from '@nestjs/testing';
import { DeliveryService } from './delivery.service';
import { DeliveryEngine } from '../engines/delivery.engine';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { OrderStatus } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';

describe('DeliveryService - forceVerifyByStaff', () => {
  let service: DeliveryService;
  let prisma: any;
  let deliveryEngine: any;

  const mockDeliveryId = 'del-uuid-123';
  const mockOrderId = 'ord-uuid-456';
  const mockCustomerId = 'cust-uuid-789';

  beforeEach(async () => {
    prisma = {
      delivery: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      order: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      brand: {
        findFirst: jest.fn().mockResolvedValue({ id: 'brand-1', name: 'Standard Brand' }),
        create: jest.fn().mockResolvedValue({ id: 'brand-1', name: 'Standard Brand' }),
      },
      deliveryReport: {
        upsert: jest.fn().mockResolvedValue({ id: 'report-1' }),
        update: jest.fn().mockResolvedValue({ id: 'report-1' }),
      },
      customer: {
        findUnique: jest.fn(),
      },
    };

    deliveryEngine = {
      confirmDelivery: jest.fn().mockResolvedValue({ id: mockDeliveryId, status: OrderStatus.DELIVERED }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeliveryService,
        { provide: PrismaService, useValue: prisma },
        { provide: DeliveryEngine, useValue: deliveryEngine },
        { provide: NotificationService, useValue: {} },
      ],
    }).compile();

    service = module.get<DeliveryService>(DeliveryService);
  });

  it('1. Force-verifies delivery directly by deliveryId and calls confirmDelivery with delivery.id', async () => {
    prisma.delivery.findUnique.mockResolvedValue({
      id: mockDeliveryId,
      customerId: mockCustomerId,
      requiredQuantity: 2,
      status: OrderStatus.OUT_FOR_DELIVERY,
      report: null,
    });

    const result = await service.forceVerifyByStaff(mockDeliveryId, {
      deliveredQty: 2,
      emptyCollected: 1,
      notes: 'Direct staff override',
    });

    expect(result.success).toBe(true);
    expect(result.status).toBe(OrderStatus.DELIVERED);
    expect(deliveryEngine.confirmDelivery).toHaveBeenCalledWith(
      mockDeliveryId,
      'brand-1',
      2,
      1,
      0,
      'Direct staff override',
    );
    expect(prisma.deliveryReport.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { deliveryId: mockDeliveryId },
      }),
    );
  });

  it('2. Resolves delivery via orderId and passes the resolved delivery.id to confirmDelivery', async () => {
    // Delivery not found by primary ID
    prisma.delivery.findUnique.mockResolvedValue(null);
    // But found via orderId
    prisma.delivery.findFirst.mockResolvedValue({
      id: mockDeliveryId,
      orderId: mockOrderId,
      customerId: mockCustomerId,
      requiredQuantity: 2,
      status: OrderStatus.PENDING_ASSIGNMENT,
      report: null,
    });

    const result = await service.forceVerifyByStaff(mockOrderId, {
      deliveredQty: 2,
      emptyCollected: 0,
      notes: 'Verified via order ID',
    });

    expect(result.success).toBe(true);
    // Crucial: Must pass the underlying delivery.id, NOT the orderId!
    expect(deliveryEngine.confirmDelivery).toHaveBeenCalledWith(
      mockDeliveryId,
      'brand-1',
      2,
      0,
      0,
      'Verified via order ID',
    );
  });

  it('3. Auto-materializes delivery when called with an Order ID that has no delivery record yet', async () => {
    prisma.delivery.findUnique.mockResolvedValue(null);
    prisma.delivery.findFirst.mockResolvedValue(null);

    prisma.order.findUnique.mockResolvedValue({
      id: mockOrderId,
      customerId: mockCustomerId,
      deliveryAddressId: 'addr-1',
      scheduledDate: new Date(),
      items: [{ quantity: 3, product: { isJar: true } }],
    });

    prisma.delivery.create.mockResolvedValue({
      id: 'new-del-999',
      orderId: mockOrderId,
      customerId: mockCustomerId,
      requiredQuantity: 3,
      status: OrderStatus.OUT_FOR_DELIVERY,
      report: null,
    });

    const result = await service.forceVerifyByStaff(mockOrderId, {
      deliveredQty: 3,
      emptyCollected: 2,
    });

    expect(result.success).toBe(true);
    expect(prisma.delivery.create).toHaveBeenCalled();
    expect(deliveryEngine.confirmDelivery).toHaveBeenCalledWith(
      'new-del-999',
      'brand-1',
      3,
      2,
      0,
      'Verified directly by staff override',
    );
  });

  it('4. Throws BadRequestException("Delivery not found") only when neither Delivery nor Order exists', async () => {
    prisma.delivery.findUnique.mockResolvedValue(null);
    prisma.delivery.findFirst.mockResolvedValue(null);
    prisma.order.findUnique.mockResolvedValue(null);

    await expect(
      service.forceVerifyByStaff('non-existent-id', { deliveredQty: 1, emptyCollected: 0 }),
    ).rejects.toThrow(BadRequestException);
  });
});
