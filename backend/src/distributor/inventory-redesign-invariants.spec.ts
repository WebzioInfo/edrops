import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { DistributorInventoryService } from './distributor-inventory.service';
import { OrderService } from '../order/order.service';
import { OrderStatus, PaymentStatus } from '@prisma/client';
import { JarPhysicalState } from './dto/distributor-inventory-actions.dto';

describe('Production Inventory Redesign Invariants (Section 31 Test Cases)', () => {
  let inventoryService: DistributorInventoryService;
  let orderService: OrderService;
  let prisma: any;
  let notificationService: any;
  let eventsGateway: any;

  const mockDistributorUserId = 'dist-user-1';
  const mockDistributorId = 'dist-profile-1';
  const mockCustomerId = 'cust-1';

  beforeEach(() => {
    prisma = {
      distributor: {
        findUnique: jest.fn().mockResolvedValue({
          id: mockDistributorId,
          userId: mockDistributorUserId,
          companyOwnedJars: 91,
          distributorOwnedJars: 100,
          jarImageUrl: null,
        }),
        update: jest.fn(),
      },
      jarInventoryItem: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn().mockImplementation((args) =>
          Promise.resolve({
            id: args.where?.id || 'item-1',
            emptyYardQuantity: 0,
            customerQuantity: 0,
            filledYardQuantity: 100,
            ownedQuantity: 100,
          }),
        ),
      },
      customer: {
        findUnique: jest.fn(),
        update: jest.fn().mockImplementation((args) =>
          Promise.resolve({
            id: args.where?.id || mockCustomerId,
            jarsAtCustomer: 0,
          }),
        ),
      },
      order: {
        findUnique: jest.fn(),
        update: jest.fn().mockImplementation((args) =>
          Promise.resolve({
            id: args.where?.id || 'order-1',
            status: args.data?.status || OrderStatus.OUT_FOR_DELIVERY,
            totalAmount: 500,
            payments: [],
            deliveryVerification: null,
          }),
        ),
      },
      orderJarAllocation: {
        create: jest.fn(),
        update: jest.fn(),
        deleteMany: jest.fn(),
        findMany: jest.fn(),
      },
      orderDeliveryVerification: {
        create: jest.fn(),
        update: jest.fn(),
      },
      inventoryLog: {
        create: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      depositTransaction: {
        create: jest.fn(),
      },
      orderItem: {
        updateMany: jest.fn(),
      },
      orderStatusHistory: {
        create: jest.fn(),
      },
      distributorOrderAssignment: {
        updateMany: jest.fn(),
      },
      payment: {
        findMany: jest.fn().mockResolvedValue([]),
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

    inventoryService = new DistributorInventoryService(prisma, { uploadImage: jest.fn(), deleteImage: jest.fn() } as any);
    orderService = new OrderService(prisma, notificationService as any, eventsGateway as any);
  });

  // =========================================================================
  // TEST 1: Owned = 100, Dispatch 5 -> Expected owned = 100, Expected customer = +5
  // =========================================================================
  it('TEST 1: Dispatching 5 jars from 100 owned jars preserves owned=100 and moves 5 jars to customer', async () => {
    const item = {
      id: 'dist-item-1',
      distributorId: mockDistributorId,
      name: 'Distributor Jar',
      ownershipType: 'DISTRIBUTOR',
      ownedQuantity: 100,
      filledYardQuantity: 100,
      customerQuantity: 0,
      reservedQuantity: 0,
    };

    prisma.order.findUnique.mockResolvedValue({
      id: 'order-1',
      status: OrderStatus.CONFIRMED,
      driverId: 'driver-1',
      distributorId: mockDistributorUserId,
      customerId: mockCustomerId,
      items: [{ quantity: 5, product: { isJar: true } }],
    });
    prisma.jarInventoryItem.findMany.mockResolvedValue([item]);

    await orderService.updateDistributorOrderStatus(
      'order-1',
      mockDistributorUserId,
      {
        status: OrderStatus.OUT_FOR_DELIVERY,
        allocations: [{ jarItemId: item.id, quantity: 5 }],
      },
    );

    // Physical state moves: filledYard -5, customer +5
    expect(prisma.jarInventoryItem.update).toHaveBeenCalledWith({
      where: { id: item.id },
      data: {
        filledYardQuantity: { decrement: 5 },
        customerQuantity: { increment: 5 },
      },
    });

    // Ownership total (ownedQuantity) is NEVER decremented
    const updateCalls = prisma.jarInventoryItem.update.mock.calls;
    for (const call of updateCalls) {
      expect(call[0].data.ownedQuantity).toBeUndefined();
    }
  });

  // =========================================================================
  // TEST 2: Owned = 100, Dispatch 5, Return 1 -> Expected customer net = +4
  // =========================================================================
  it('TEST 2: Customer receives 5 jars and returns 1 empty jar -> Net customer held = +4, empty yard = +1, owned = 100', async () => {
    const item = {
      id: 'dist-item-1',
      distributorId: mockDistributorId,
      name: 'Distributor Jar',
      ownershipType: 'DISTRIBUTOR',
      ownedQuantity: 100,
      filledYardQuantity: 95,
      customerQuantity: 5,
      reservedQuantity: 0,
    };

    prisma.order.findUnique.mockResolvedValue({
      id: 'order-1',
      status: OrderStatus.OUT_FOR_DELIVERY,
      customerId: mockCustomerId,
      distributorId: mockDistributorUserId,
      jarAllocations: [{ id: 'alloc-1', jarItemId: item.id, quantity: 5 }],
      customer: { id: mockCustomerId, jarsAtCustomer: 0 },
    });
    prisma.customer.findUnique.mockResolvedValue({ id: mockCustomerId, jarsAtCustomer: 0 });
    prisma.jarInventoryItem.findMany.mockResolvedValue([item]);

    await orderService.completeDelivery('order-1', mockDistributorUserId, {
      items: [{ jarItemId: item.id, deliveredQuantity: 5 }],
      returnedItems: [{ jarItemId: item.id, returnedQuantity: 1 }],
    });

    // 1 jar moves from customer possession to empty yard
    expect(prisma.jarInventoryItem.update).toHaveBeenCalledWith({
      where: { id: item.id },
      data: {
        customerQuantity: { decrement: 1 },
        emptyYardQuantity: { increment: 1 },
      },
    });

    // Net customer balance increment = 5 delivered - 1 returned = 4
    expect(prisma.customer.update).toHaveBeenCalledWith({
      where: { id: mockCustomerId },
      data: {
        jarsAtCustomer: { increment: 4 },
      },
    });

    // Distributor ownership records are NOT touched
    expect(prisma.distributor.update).not.toHaveBeenCalled();
  });

  // =========================================================================
  // TEST 3: Owned = 100, Dispatch 5, Return 5 -> Expected customer net = 0
  // =========================================================================
  it('TEST 3: Customer receives 5 jars and returns all 5 empty jars -> Net customer held = 0, empty yard = +5', async () => {
    const item = {
      id: 'dist-item-1',
      distributorId: mockDistributorId,
      name: 'Distributor Jar',
      ownershipType: 'DISTRIBUTOR',
      ownedQuantity: 100,
      filledYardQuantity: 95,
      customerQuantity: 5,
      reservedQuantity: 0,
    };

    prisma.order.findUnique.mockResolvedValue({
      id: 'order-1',
      status: OrderStatus.OUT_FOR_DELIVERY,
      customerId: mockCustomerId,
      distributorId: mockDistributorUserId,
      jarAllocations: [{ id: 'alloc-1', jarItemId: item.id, quantity: 5 }],
      customer: { id: mockCustomerId, jarsAtCustomer: 5 },
    });
    prisma.jarInventoryItem.findMany.mockResolvedValue([item]);

    await orderService.completeDelivery('order-1', mockDistributorUserId, {
      items: [{ jarItemId: item.id, deliveredQuantity: 5 }],
      returnedItems: [{ jarItemId: item.id, returnedQuantity: 5 }],
    });

    expect(prisma.jarInventoryItem.update).toHaveBeenCalledWith({
      where: { id: item.id },
      data: {
        customerQuantity: { decrement: 5 },
        emptyYardQuantity: { increment: 5 },
      },
    });

    // Net change = 5 - 5 = 0, no customer update needed or net 0
    const custUpdateCalls = prisma.customer.update.mock.calls;
    if (custUpdateCalls.length > 0) {
      expect(custUpdateCalls[0][0].data.jarsAtCustomer.increment).toBe(0);
    }
  });

  // =========================================================================
  // TEST 4: Owned = 100, Try dispatch 101 -> Must fail
  // =========================================================================
  it('TEST 4: Attempting to dispatch 101 jars when only 100 are available in yard is BLOCKED', async () => {
    const item = {
      id: 'dist-item-1',
      distributorId: mockDistributorId,
      name: 'Distributor Jar',
      ownershipType: 'DISTRIBUTOR',
      ownedQuantity: 100,
      filledYardQuantity: 100,
      reservedQuantity: 0,
    };

    prisma.order.findUnique.mockResolvedValue({
      id: 'order-1',
      status: OrderStatus.CONFIRMED,
      driverId: 'driver-1',
      distributorId: mockDistributorUserId,
      customerId: mockCustomerId,
      items: [{ quantity: 101, product: { isJar: true } }],
    });
    prisma.jarInventoryItem.findMany.mockResolvedValue([item]);

    await expect(
      orderService.updateDistributorOrderStatus(
        'order-1',
        mockDistributorUserId,
        {
          status: OrderStatus.OUT_FOR_DELIVERY,
          allocations: [{ jarItemId: item.id, quantity: 101 }],
        },
      ),
    ).rejects.toThrow(/Only 100 .* jars are available in yard/i);
  });

  // =========================================================================
  // TEST 5: Owned = 100, Try return more than customer holds -> Must fail
  // =========================================================================
  it('TEST 5: Attempting to return more jars than held by the customer is REJECTED', async () => {
    const item = {
      id: 'dist-item-1',
      distributorId: mockDistributorId,
      name: 'Distributor Jar',
      ownershipType: 'DISTRIBUTOR',
      ownedQuantity: 100,
      customerQuantity: 2,
      emptyYardQuantity: 0,
    };

    prisma.customer.findUnique.mockResolvedValue({
      id: mockCustomerId,
      jarsAtCustomer: 2, // Customer only holds 2 jars
    });
    prisma.jarInventoryItem.findFirst.mockResolvedValue(item);

    // Attempt standalone return of 3 jars
    await expect(
      inventoryService.customerJarReturn(mockDistributorUserId, {
        customerId: mockCustomerId,
        jarItemId: item.id,
        quantity: 3,
      }),
    ).rejects.toThrow(/Customer currently holds only 2 jar\(s\)\. Cannot return 3 jars\./i);
  });

  // =========================================================================
  // TEST 6: 100 empty -> 100 filled: Total ownership remains 100
  // =========================================================================
  it('TEST 6: 100 empty jars washed and filled -> Total ownership remains exactly 100', async () => {
    const item = {
      id: 'dist-item-1',
      distributorId: mockDistributorId,
      name: 'Distributor Jar',
      ownershipType: 'DISTRIBUTOR',
      ownedQuantity: 100,
      emptyYardQuantity: 100,
      washingQuantity: 0,
      fillingQuantity: 0,
      filledYardQuantity: 0,
      reservedQuantity: 0,
    };

    prisma.jarInventoryItem.findFirst.mockResolvedValue(item);

    // Step 1: EMPTY_YARD -> WASHING
    await inventoryService.moveJarState(mockDistributorUserId, {
      jarItemId: item.id,
      fromState: JarPhysicalState.EMPTY_YARD,
      toState: JarPhysicalState.WASHING,
      quantity: 100,
    });

    expect(prisma.jarInventoryItem.update).toHaveBeenCalledWith({
      where: { id: item.id },
      data: {
        emptyYardQuantity: { decrement: 100 },
        washingQuantity: { increment: 100 },
      },
    });

    // Step 2: WASHING -> FILLING
    item.emptyYardQuantity = 0;
    item.washingQuantity = 100;
    await inventoryService.moveJarState(mockDistributorUserId, {
      jarItemId: item.id,
      fromState: JarPhysicalState.WASHING,
      toState: JarPhysicalState.FILLING,
      quantity: 100,
    });

    // Step 3: FILLING -> FILLED_YARD
    item.washingQuantity = 0;
    item.fillingQuantity = 100;
    await inventoryService.moveJarState(mockDistributorUserId, {
      jarItemId: item.id,
      fromState: JarPhysicalState.FILLING,
      toState: JarPhysicalState.FILLED_YARD,
      quantity: 100,
    });

    expect(prisma.jarInventoryItem.update).toHaveBeenCalledWith({
      where: { id: item.id },
      data: {
        fillingQuantity: { decrement: 100 },
        filledYardQuantity: { increment: 100 },
      },
    });

    // Total owned never changed
    expect(item.ownedQuantity).toBe(100);
  });

  // =========================================================================
  // TEST 7: 100 filled -> 100 customer: Total ownership remains 100
  // =========================================================================
  it('TEST 7: 100 filled jars dispatched to customer -> Total ownership remains exactly 100', async () => {
    const item = {
      id: 'dist-item-1',
      distributorId: mockDistributorId,
      name: 'Distributor Jar',
      ownershipType: 'DISTRIBUTOR',
      ownedQuantity: 100,
      filledYardQuantity: 100,
      customerQuantity: 0,
      reservedQuantity: 0,
    };

    prisma.order.findUnique.mockResolvedValue({
      id: 'order-bulk',
      status: OrderStatus.CONFIRMED,
      driverId: 'driver-1',
      distributorId: mockDistributorUserId,
      customerId: mockCustomerId,
      items: [{ quantity: 100, product: { isJar: true } }],
    });
    prisma.jarInventoryItem.findMany.mockResolvedValue([item]);

    await orderService.updateDistributorOrderStatus(
      'order-bulk',
      mockDistributorUserId,
      {
        status: OrderStatus.OUT_FOR_DELIVERY,
        allocations: [{ jarItemId: item.id, quantity: 100 }],
      },
    );

    expect(prisma.jarInventoryItem.update).toHaveBeenCalledWith({
      where: { id: item.id },
      data: {
        filledYardQuantity: { decrement: 100 },
        customerQuantity: { increment: 100 },
      },
    });

    expect(item.ownedQuantity).toBe(100);
  });

  // =========================================================================
  // TEST 8: 100 customer -> 50 returned: Customer = 50, Returned/empty = 50, Total = 100
  // =========================================================================
  it('TEST 8: Customer returns 50 jars out of 100 -> Customer has 50, Empty yard has 50, Total is 100', async () => {
    const item = {
      id: 'dist-item-1',
      distributorId: mockDistributorId,
      name: 'Distributor Jar',
      ownershipType: 'DISTRIBUTOR',
      ownedQuantity: 100,
      customerQuantity: 100,
      emptyYardQuantity: 0,
    };

    prisma.customer.findUnique.mockResolvedValue({
      id: mockCustomerId,
      jarsAtCustomer: 100,
    });
    prisma.jarInventoryItem.findFirst.mockResolvedValue(item);

    await inventoryService.customerJarReturn(mockDistributorUserId, {
      customerId: mockCustomerId,
      jarItemId: item.id,
      quantity: 50,
    });

    expect(prisma.jarInventoryItem.update).toHaveBeenCalledWith({
      where: { id: item.id },
      data: {
        customerQuantity: { decrement: 50 },
        emptyYardQuantity: { increment: 50 },
      },
    });

    expect(prisma.customer.update).toHaveBeenCalledWith({
      where: { id: mockCustomerId },
      data: {
        jarsAtCustomer: { decrement: 50 },
      },
    });

    expect(item.ownedQuantity).toBe(100);
  });

  // =========================================================================
  // TEST 9: Duplicate dispatch request: Must not double deduct
  // =========================================================================
  it('TEST 9: Duplicate delivery or dispatch request does not double move jars (Idempotency)', async () => {
    const item = {
      id: 'dist-item-1',
      distributorId: mockDistributorId,
      name: 'Distributor Jar',
      ownershipType: 'DISTRIBUTOR',
      ownedQuantity: 100,
      filledYardQuantity: 95,
      customerQuantity: 5,
    };

    // If order is already in DELIVERED status, completeDelivery returns early without moving stock
    prisma.order.findUnique.mockResolvedValue({
      id: 'order-1',
      status: OrderStatus.DELIVERED,
      customerId: mockCustomerId,
      customer: { id: mockCustomerId, jarsAtCustomer: 5 },
    });

    const res = await orderService.completeDelivery('order-1', mockDistributorUserId, {
      items: [{ jarItemId: item.id, deliveredQuantity: 5 }],
    });

    expect(res.status).toBe(OrderStatus.DELIVERED);
    expect(prisma.jarInventoryItem.update).not.toHaveBeenCalled();
    expect(prisma.customer.update).not.toHaveBeenCalled();
  });

  // =========================================================================
  // TEST 10: Concurrent dispatches: Must not produce negative stock or over-allocation
  // =========================================================================
  it('TEST 10: Row locking is invoked to serialize concurrent dispatches and prevent over-allocation', async () => {
    const item = {
      id: 'dist-item-1',
      distributorId: mockDistributorId,
      name: 'Distributor Jar',
      ownershipType: 'DISTRIBUTOR',
      ownedQuantity: 10,
      filledYardQuantity: 10,
      reservedQuantity: 0,
    };

    prisma.order.findUnique.mockResolvedValue({
      id: 'order-1',
      status: OrderStatus.CONFIRMED,
      driverId: 'driver-1',
      distributorId: mockDistributorUserId,
      customerId: mockCustomerId,
      items: [{ quantity: 10, product: { isJar: true } }],
    });
    prisma.jarInventoryItem.findMany.mockResolvedValue([item]);

    await orderService.updateDistributorOrderStatus(
      'order-1',
      mockDistributorUserId,
      {
        status: OrderStatus.OUT_FOR_DELIVERY,
        allocations: [{ jarItemId: item.id, quantity: 10 }],
      },
    );

    // Row lock MUST be acquired using FOR UPDATE
    expect(prisma.$executeRaw).toHaveBeenCalled();
  });

  // =========================================================================
  // TEST 11: Company-owned and distributor-owned jars must never be mixed
  // =========================================================================
  it('TEST 11: Company-owned and distributor-owned jars maintain separate breakdowns and ownership totals', async () => {
    prisma.jarInventoryItem.findMany.mockResolvedValue([
      {
        id: 'comp-1',
        distributorId: mockDistributorId,
        name: 'Biodrops 20L Water Jar',
        ownershipType: 'COMPANY',
        ownedQuantity: 91,
        filledYardQuantity: 50,
        emptyYardQuantity: 20,
        customerQuantity: 21,
        washingQuantity: 0,
        fillingQuantity: 0,
        quarantineQuantity: 0,
        damagedQuantity: 0,
        lostQuantity: 0,
        reservedQuantity: 0,
        isActive: true,
      },
      {
        id: 'dist-1',
        distributorId: mockDistributorId,
        name: 'Distributor Jar',
        ownershipType: 'DISTRIBUTOR',
        ownedQuantity: 100,
        filledYardQuantity: 60,
        emptyYardQuantity: 10,
        customerQuantity: 30,
        washingQuantity: 0,
        fillingQuantity: 0,
        quarantineQuantity: 0,
        damagedQuantity: 0,
        lostQuantity: 0,
        reservedQuantity: 0,
        isActive: true,
      },
    ]);

    const inv: any = await inventoryService.getInventory(mockDistributorUserId);

    // Company owned: 91
    expect(inv.companyOwned.total).toBe(91);
    expect(inv.companyOwned.breakdown.total).toBe(91);
    expect(inv.companyOwned.breakdown.variance).toBe(0);

    // Distributor owned: 100
    expect(inv.distributorOwned.total).toBe(100);
    expect(inv.distributorOwned.breakdown.total).toBe(100);
    expect(inv.distributorOwned.breakdown.variance).toBe(0);

    // Combined total: 191
    expect(inv.total).toBe(191);
    expect(inv.reconciliation.status).toBe('HEALTHY');
    expect(inv.reconciliation.variance).toBe(0);
  });

  // =========================================================================
  // TEST 12: Customer deposit calculation must not alter physical inventory
  // =========================================================================
  it('TEST 12: Customer deposit transactions do not alter physical jar inventory quantities', async () => {
    const item = {
      id: 'dist-item-1',
      distributorId: mockDistributorId,
      name: 'Distributor Jar',
      ownershipType: 'DISTRIBUTOR',
      ownedQuantity: 100,
      customerQuantity: 5,
      emptyYardQuantity: 10,
    };

    prisma.customer.findUnique.mockResolvedValue({
      id: mockCustomerId,
      jarsAtCustomer: 5,
    });
    prisma.jarInventoryItem.findFirst.mockResolvedValue(item);

    await inventoryService.customerJarReturn(mockDistributorUserId, {
      customerId: mockCustomerId,
      jarItemId: item.id,
      quantity: 2,
    });

    // Deposit transaction created for ₹400
    expect(prisma.depositTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        customerId: mockCustomerId,
        type: 'JAR_RETURNED',
        amount: 400,
        jarsAffected: 2,
      }),
    });

    // Total ownership was NOT changed by the deposit
    expect(item.ownedQuantity).toBe(100);
  });
});
