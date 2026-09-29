import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { OrderService } from './order.service';
import { OrderStatus, PaymentStatus, UserRole } from '@prisma/client';

describe('Distributor Order Jar Allocation & Multi-Jar Inventory', () => {
  let service: OrderService;
  let prisma: any;
  let notificationService: any;
  let eventsGateway: any;

  const mockDistributorUserId = 'dist-user-1';
  const mockDistributorId = 'dist-profile-1';

  beforeEach(() => {
    prisma = {
      order: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      distributor: {
        findUnique: jest.fn().mockResolvedValue({ id: mockDistributorId, userId: mockDistributorUserId }),
        update: jest.fn(),
      },
      jarInventoryItem: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      orderJarAllocation: {
        create: jest.fn(),
        deleteMany: jest.fn(),
        findMany: jest.fn(),
      },
      inventoryLog: {
        create: jest.fn(),
      },
      orderStatusHistory: {
        create: jest.fn(),
      },
      distributorOrderAssignment: {
        updateMany: jest.fn(),
      },
      payment: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
      },
      paymentAuditLog: {
        create: jest.fn(),
      },
      $executeRaw: jest.fn().mockResolvedValue(1),
      $transaction: jest.fn((callback) => callback(prisma)),
    };

    notificationService = {
      notifyOrderStatusUpdate: jest.fn(),
      notifyOrderStatusTransition: jest.fn(),
    };

    eventsGateway = {
      emitOrderStatusUpdate: jest.fn(),
      emitEvent: jest.fn(),
      emitOrderAssignmentChanged: jest.fn(),
    };

    service = new OrderService(
      prisma,
      eventsGateway as any,
      notificationService as any,
    );
  });

  const baseOrder = {
    id: 'ord-12345678',
    status: OrderStatus.CONFIRMED,
    distributorId: mockDistributorUserId,
    driverId: 'driver-1',
    totalAmount: 1000,
    paymentStatus: PaymentStatus.PENDING,
    payments: [],
    history: [],
    items: [
      {
        id: 'item-1',
        productId: 'prod-20l',
        quantity: 20,
        product: { id: 'prod-20l', name: 'Biodrops 20L Jar', isJar: true },
      },
    ],
  };

  const companyJarItem = {
    id: 'item-company',
    distributorId: mockDistributorId,
    name: 'Biodrops 20L Water Jar',
    ownershipType: 'COMPANY',
    ownedQuantity: 100,
    reservedQuantity: 0,
    isActive: true,
  };

  const blueJarItem = {
    id: 'item-blue',
    distributorId: mockDistributorId,
    name: 'Distributor Jar - Blue',
    ownershipType: 'DISTRIBUTOR',
    ownedQuantity: 25,
    reservedQuantity: 0,
    isActive: true,
  };

  it('TEST 1: Valid allocation and driver assigned moves order to OUT_FOR_DELIVERY', async () => {
    prisma.order.findUnique.mockResolvedValue({ ...baseOrder });
    prisma.jarInventoryItem.findMany.mockResolvedValue([companyJarItem, blueJarItem]);
    prisma.order.update.mockResolvedValue({
      ...baseOrder,
      status: OrderStatus.OUT_FOR_DELIVERY,
      payments: [],
    });

    const result = await service.updateDistributorOrderStatus(
      baseOrder.id,
      mockDistributorUserId,
      {
        status: OrderStatus.OUT_FOR_DELIVERY,
        allocations: [
          { jarItemId: 'item-company', quantity: 10 },
          { jarItemId: 'item-blue', quantity: 10 },
        ],
      },
    );

    expect(result.status).toBe(OrderStatus.OUT_FOR_DELIVERY);
    expect(prisma.orderJarAllocation.create).toHaveBeenCalledTimes(2);
    expect(prisma.jarInventoryItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'item-company' },
        data: { reservedQuantity: { increment: 10 } },
      }),
    );
    expect(prisma.jarInventoryItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'item-blue' },
        data: { reservedQuantity: { increment: 10 } },
      }),
    );
    expect(prisma.inventoryLog.create).toHaveBeenCalledTimes(2);
  });

  it('TEST 2: Under-allocated quantity is BLOCKED with descriptive error', async () => {
    prisma.order.findUnique.mockResolvedValue({ ...baseOrder });

    await expect(
      service.updateDistributorOrderStatus(
        baseOrder.id,
        mockDistributorUserId,
        {
          status: OrderStatus.OUT_FOR_DELIVERY,
          allocations: [
            { jarItemId: 'item-company', quantity: 10 },
            { jarItemId: 'item-blue', quantity: 5 },
          ],
        },
      ),
    ).rejects.toThrow('Allocate all 20 jars before sending the order Out for Delivery.');
  });

  it('TEST 3: Over-allocated quantity is BLOCKED with descriptive error', async () => {
    prisma.order.findUnique.mockResolvedValue({ ...baseOrder });

    await expect(
      service.updateDistributorOrderStatus(
        baseOrder.id,
        mockDistributorUserId,
        {
          status: OrderStatus.OUT_FOR_DELIVERY,
          allocations: [
            { jarItemId: 'item-company', quantity: 10 },
            { jarItemId: 'item-blue', quantity: 15 },
          ],
        },
      ),
    ).rejects.toThrow('Allocated quantity cannot exceed the order quantity of 20 jars.');
  });

  it('TEST 4: Allocation exceeding available stock is BLOCKED with descriptive error', async () => {
    prisma.order.findUnique.mockResolvedValue({
      ...baseOrder,
      items: [{ quantity: 6, product: { isJar: true } }],
    });
    prisma.jarInventoryItem.findMany.mockResolvedValue([
      { ...companyJarItem, ownedQuantity: 5, reservedQuantity: 0 },
    ]);

    await expect(
      service.updateDistributorOrderStatus(
        baseOrder.id,
        mockDistributorUserId,
        {
          status: OrderStatus.OUT_FOR_DELIVERY,
          allocations: [{ jarItemId: 'item-company', quantity: 6 }],
        },
      ),
    ).rejects.toThrow('Only 5 Biodrops jars are available.');
  });

  it('TEST 5: Missing driver is BLOCKED even if allocation is valid', async () => {
    prisma.order.findUnique.mockResolvedValue({
      ...baseOrder,
      driverId: null,
    });

    await expect(
      service.updateDistributorOrderStatus(
        baseOrder.id,
        mockDistributorUserId,
        {
          status: OrderStatus.OUT_FOR_DELIVERY,
          allocations: [{ jarItemId: 'item-company', quantity: 20 }],
        },
      ),
    ).rejects.toThrow('Assign a driver before moving this order Out for Delivery.');
  });

  it('TEST 6: Cancelling an OUT_FOR_DELIVERY order releases reserved jars back to stock', async () => {
    const outOrder = {
      ...baseOrder,
      status: OrderStatus.OUT_FOR_DELIVERY,
    };
    prisma.order.findUnique.mockResolvedValue(outOrder);
    prisma.orderJarAllocation.findMany.mockResolvedValue([
      {
        id: 'alloc-1',
        jarItemId: 'item-blue',
        quantity: 20,
        jarItem: blueJarItem,
      },
    ]);
    prisma.jarInventoryItem.update.mockResolvedValue({
      ...blueJarItem,
      ownedQuantity: 25,
      reservedQuantity: 0,
    });
    prisma.order.update.mockResolvedValue({
      ...outOrder,
      status: OrderStatus.CANCELLED,
      payments: [],
    });

    const res = await service.updateDistributorOrderStatus(
      baseOrder.id,
      mockDistributorUserId,
      {
        status: OrderStatus.CANCELLED,
        reason: 'Customer cancelled delivery',
      },
    );

    expect(res.status).toBe(OrderStatus.CANCELLED);
    expect(prisma.jarInventoryItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'item-blue' },
        data: { reservedQuantity: { decrement: 20 } },
      }),
    );
    expect(prisma.inventoryLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'ALLOCATION_RELEASED',
          quantity: 20,
          balanceAfter: 25,
        }),
      }),
    );
  });
});
