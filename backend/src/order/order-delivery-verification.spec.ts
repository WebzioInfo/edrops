import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { OrderService } from './order.service';
import { OrderStatus, PaymentStatus, UserRole } from '@prisma/client';
import { generateDeliveryOtp } from './utils/delivery-otp.util';

describe('Order Delivery OTP, Quantity Reconciliation & Inventory Ledger', () => {
  let service: OrderService;
  let prisma: any;
  let notificationService: any;
  let eventsGateway: any;

  const mockDistributorUserId = 'dist-user-1';
  const mockCustomerUserId = 'cust-user-1';

  beforeEach(() => {
    prisma = {
      order: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      distributor: {
        findUnique: jest.fn().mockResolvedValue({ id: 'dist-profile-1', userId: mockDistributorUserId }),
        findFirst: jest.fn().mockResolvedValue({ id: 'dist-profile-1', userId: mockDistributorUserId }),
        update: jest.fn().mockResolvedValue({ id: 'dist-profile-1' }),
      },
      customer: {
        update: jest.fn().mockResolvedValue({ id: 'cust-1' }),
      },
      jarInventoryItem: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      orderJarAllocation: {
        update: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
      },
      orderDeliveryVerification: {
        update: jest.fn(),
        create: jest.fn(),
      },
      inventoryLog: {
        create: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(null),
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
    };

    service = new OrderService(prisma, notificationService as any, eventsGateway as any);
  });

  describe('PART 2 & 4: Secure Delivery PIN Utility', () => {
    it('generates a 4-digit numeric OTP between 1000 and 9999', () => {
      for (let i = 0; i < 50; i++) {
        const otp = generateDeliveryOtp();
        expect(otp).toHaveLength(4);
        expect(/^\d{4}$/.test(otp)).toBe(true);
        const num = Number(otp);
        expect(num).toBeGreaterThanOrEqual(1000);
        expect(num).toBeLessThanOrEqual(9999);
      }
    });
  });

  describe('PART 6, 7 & 8: PIN Verification Backend', () => {
    const mockOrder = {
      id: 'ord-12345678',
      status: OrderStatus.OUT_FOR_DELIVERY,
      deliveryVerification: {
        otp: '4827',
        status: 'PENDING',
      },
    };

    it('verifies PIN successfully when correct PIN is provided', async () => {
      prisma.order.findUnique.mockResolvedValue(mockOrder);

      const res = await service.verifyDeliveryPin('ord-12345678', '4827');
      expect(res.success).toBe(true);
      expect(res.verified).toBe(true);
    });

    it('rejects incorrect PIN with generic message and does not leak raw PIN', async () => {
      prisma.order.findUnique.mockResolvedValue(mockOrder);

      await expect(service.verifyDeliveryPin('ord-12345678', '9999')).rejects.toThrow(
        'Invalid delivery PIN. Please enter the PIN provided for this order.',
      );
    });

    it('rejects invalid length or non-numeric PIN', async () => {
      prisma.order.findUnique.mockResolvedValue(mockOrder);

      await expect(service.verifyDeliveryPin('ord-12345678', '12')).rejects.toThrow(
        'Invalid delivery PIN. Please enter the PIN provided for this order.',
      );
      await expect(service.verifyDeliveryPin('ord-12345678', 'abcd')).rejects.toThrow(
        'Invalid delivery PIN. Please enter the PIN provided for this order.',
      );
    });

    it('rejects verification if order is not in OUT_FOR_DELIVERY status', async () => {
      prisma.order.findUnique.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.CONFIRMED,
      });

      await expect(service.verifyDeliveryPin('ord-12345678', '4827')).rejects.toThrow(
        'Order must be Out for Delivery to verify delivery PIN',
      );
    });

    it('handles legacy orders without verification record safely', async () => {
      prisma.order.findUnique.mockResolvedValue({
        ...mockOrder,
        deliveryVerification: null,
      });

      const res = await service.verifyDeliveryPin('ord-12345678', '0000');
      expect(res.success).toBe(true);
      expect(res.isLegacy).toBe(true);
    });
  });

  describe('PART 9 to 18 & 32: Manual ERP Scenario & Delivery Reconciliation', () => {
    // Scenario from PART 32:
    // Order: 5 x 20L jars
    // OUT FOR DELIVERY: Biodrops = 3, Distributor Jar A = 2 (Total = 5)
    // DELIVER: Biodrops = 3, Distributor Jar A = 1 (Total = 4, Undelivered = 1)
    // Reason: Customer requested partial delivery
    // 1 Distributor Jar A reconciled back to Distributor A stock with NO double deduction!
    const biodropsItemId = 'item-biodrops';
    const distAItemId = 'item-dist-a';

    const mockOrder = {
      id: 'ord-test-scenario-123',
      status: OrderStatus.OUT_FOR_DELIVERY,
      distributorId: mockDistributorUserId,
      customerId: 'cust-1',
      totalAmount: 400,
      paymentStatus: PaymentStatus.SUCCESS,
      customer: { userId: mockCustomerUserId },
      deliveryVerification: {
        otp: '4827',
        status: 'PENDING',
      },
      jarAllocations: [
        {
          id: 'alloc-1',
          jarItemId: biodropsItemId,
          quantity: 3,
          jarItem: {
            id: biodropsItemId,
            name: 'Biodrops Standard',
            ownershipType: 'COMPANY',
            distributorId: 'dist-profile-1',
          },
        },
        {
          id: 'alloc-2',
          jarItemId: distAItemId,
          quantity: 2,
          jarItem: {
            id: distAItemId,
            name: 'Distributor Jar A',
            ownershipType: 'DISTRIBUTOR',
            distributorId: 'dist-profile-1',
          },
        },
      ],
      payments: [{ status: PaymentStatus.SUCCESS, amount: 400 }],
    };

    const mockDbJarItems = [
      {
        id: biodropsItemId,
        name: 'Biodrops Standard',
        ownershipType: 'COMPANY',
        distributorId: 'dist-profile-1',
        ownedQuantity: 100,
        reservedQuantity: 3, // 3 currently out for delivery
      },
      {
        id: distAItemId,
        name: 'Distributor Jar A',
        ownershipType: 'DISTRIBUTOR',
        distributorId: 'dist-profile-1',
        ownedQuantity: 50,
        reservedQuantity: 2, // 2 currently out for delivery
      },
    ];

    it('rejects delivery if incorrect PIN is provided', async () => {
      prisma.order.findUnique.mockResolvedValue(mockOrder);

      await expect(
        service.completeDelivery(mockOrder.id, mockDistributorUserId, {
          pin: '0000',
          items: [
            { jarItemId: biodropsItemId, deliveredQuantity: 3 },
            { jarItemId: distAItemId, deliveredQuantity: 1 },
          ],
          shortDeliveryReason: 'Customer requested partial delivery',
        }),
      ).rejects.toThrow('Invalid delivery PIN. Please enter the PIN provided for this order.');
    });

    it('rejects if deliveredQuantity exceeds Out for Delivery quantity for any item', async () => {
      prisma.order.findUnique.mockResolvedValue(mockOrder);

      await expect(
        service.completeDelivery(mockOrder.id, mockDistributorUserId, {
          pin: '4827',
          items: [
            { jarItemId: biodropsItemId, deliveredQuantity: 4 }, // Exceeds 3 OOD!
            { jarItemId: distAItemId, deliveredQuantity: 1 },
          ],
          shortDeliveryReason: 'Customer requested partial delivery',
        }),
      ).rejects.toThrow('Delivered quantity (4) cannot exceed Out for Delivery quantity (3)');
    });

    it('rejects if deliveredQuantity is negative', async () => {
      prisma.order.findUnique.mockResolvedValue(mockOrder);

      await expect(
        service.completeDelivery(mockOrder.id, mockDistributorUserId, {
          pin: '4827',
          items: [
            { jarItemId: biodropsItemId, deliveredQuantity: -1 },
            { jarItemId: distAItemId, deliveredQuantity: 2 },
          ],
        }),
      ).rejects.toThrow('Delivered quantity must be a non-negative integer.');
    });

    it('rejects short delivery when reason is missing', async () => {
      prisma.order.findUnique.mockResolvedValue(mockOrder);

      await expect(
        service.completeDelivery(mockOrder.id, mockDistributorUserId, {
          pin: '4827',
          items: [
            { jarItemId: biodropsItemId, deliveredQuantity: 3 },
            { jarItemId: distAItemId, deliveredQuantity: 1 },
          ],
          shortDeliveryReason: '', // Empty reason!
        }),
      ).rejects.toThrow('Reason for short delivery is required');
    });

    it('successfully reconciles partial delivery (PART 32 Scenario) with auditable inventory ledger', async () => {
      prisma.order.findUnique.mockResolvedValue(mockOrder);
      prisma.jarInventoryItem.findMany.mockResolvedValue(mockDbJarItems);

      // Biodrops: owned 100 -> 97, reserved 3 -> 0 (available = 97)
      // Dist A: owned 50 -> 49, reserved 2 -> 0 (available = 49)
      prisma.jarInventoryItem.update
        .mockResolvedValueOnce({
          ...mockDbJarItems[0],
          ownedQuantity: 97,
          reservedQuantity: 0,
        })
        .mockResolvedValueOnce({
          ...mockDbJarItems[1],
          ownedQuantity: 49,
          reservedQuantity: 0,
        });

      prisma.order.update.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.DELIVERED,
      });

      const res = await service.completeDelivery(mockOrder.id, mockDistributorUserId, {
        pin: '4827',
        items: [
          { jarItemId: biodropsItemId, deliveredQuantity: 3 },
          { jarItemId: distAItemId, deliveredQuantity: 1 },
        ],
        shortDeliveryReason: 'Customer requested partial delivery',
        note: 'Customer took 1 jar, will take remaining next week',
      });

      expect(res.status).toBe(OrderStatus.DELIVERED);

      // 1. Verify exclusive row lock on Order
      expect(prisma.$executeRaw).toHaveBeenCalled();

      // 2. Verify inventory updates:
      // Dist A had short delivery: 2 dispatched, 1 delivered -> 1 undelivered jar returned to filled yard
      expect(prisma.jarInventoryItem.update).toHaveBeenCalledWith({
        where: { id: distAItemId },
        data: {
          customerQuantity: { decrement: 1 },
          filledYardQuantity: { increment: 1 },
        },
      });

      // 3. Verify InventoryLog records created
      // Only UNDELIVERED_RETURN is logged for Dist A (1 undelivered jar).
      expect(prisma.inventoryLog.create).toHaveBeenCalledTimes(1);
      expect(prisma.inventoryLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            jarItemId: distAItemId,
            action: 'UNDELIVERED_RETURN',
            quantity: 1,
            ownership: 'DISTRIBUTOR_OWNED',
            fromState: 'CUSTOMER',
            toState: 'FILLED_YARD',
            description: expect.stringContaining('1 jar returned to yard after short delivery'),
          }),
        }),
      );

      // 4. Verify OrderJarAllocation updated with actual delivered, undelivered, and returned quantities
      expect(prisma.orderJarAllocation.update).toHaveBeenCalledWith({
        where: { id: 'alloc-1' },
        data: {
          deliveredQuantity: 3,
          undeliveredQuantity: 0,
          returnedQuantity: 0,
        },
      });
      expect(prisma.orderJarAllocation.update).toHaveBeenCalledWith({
        where: { id: 'alloc-2' },
        data: {
          deliveredQuantity: 1,
          undeliveredQuantity: 1,
          returnedQuantity: 0,
        },
      });

      // 5. Verify OrderDeliveryVerification updated
      expect(prisma.orderDeliveryVerification.update).toHaveBeenCalledWith({
        where: { orderId: mockOrder.id },
        data: expect.objectContaining({
          isVerified: true,
          status: 'VERIFIED',
          outForDeliveryQty: 5,
          deliveredQty: 4,
          undeliveredQty: 1,
          shortDeliveryReason: 'Customer requested partial delivery',
        }),
      });

      // 6. Verify status history created
      expect(prisma.orderStatusHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            orderId: mockOrder.id,
            previousStatus: OrderStatus.OUT_FOR_DELIVERY,
            newStatus: OrderStatus.DELIVERED,
            reason: expect.stringContaining('Short delivery: Customer requested partial delivery'),
          }),
        }),
      );
    });

    it('CASE 1: Full delivery (Dispatch=5, Deliver=5) -> Stock stays 95, no return transaction created', async () => {
      prisma.order.findUnique.mockResolvedValue(mockOrder);
      prisma.jarInventoryItem.findMany.mockResolvedValue(mockDbJarItems);
      prisma.jarInventoryItem.update
        .mockResolvedValueOnce({ ...mockDbJarItems[0], ownedQuantity: 97, reservedQuantity: 0 })
        .mockResolvedValueOnce({ ...mockDbJarItems[1], ownedQuantity: 48, reservedQuantity: 0 });
      prisma.order.update.mockResolvedValue({ ...mockOrder, status: OrderStatus.DELIVERED });

      const res = await service.completeDelivery(mockOrder.id, mockDistributorUserId, {
        pin: '4827',
        items: [
          { jarItemId: biodropsItemId, deliveredQuantity: 3 },
          { jarItemId: distAItemId, deliveredQuantity: 2 },
        ],
      });

      expect(res.status).toBe(OrderStatus.DELIVERED);
      // No UNDELIVERED_RETURN transaction should be logged when all jars delivered
      expect(prisma.inventoryLog.create).not.toHaveBeenCalled();
    });

    it('CASE 3: Multi-item partial return: BioDrops=3 dispatched, 2 delivered -> 1 BioDrops returned', async () => {
      prisma.order.findUnique.mockResolvedValue(mockOrder);
      prisma.jarInventoryItem.findMany.mockResolvedValue(mockDbJarItems);
      prisma.jarInventoryItem.update
        .mockResolvedValueOnce({ ...mockDbJarItems[0], ownedQuantity: 98, reservedQuantity: 0 })
        .mockResolvedValueOnce({ ...mockDbJarItems[1], ownedQuantity: 48, reservedQuantity: 0 });
      prisma.order.update.mockResolvedValue({ ...mockOrder, status: OrderStatus.DELIVERED });

      await service.completeDelivery(mockOrder.id, mockDistributorUserId, {
        pin: '4827',
        items: [
          { jarItemId: biodropsItemId, deliveredQuantity: 2 },
          { jarItemId: distAItemId, deliveredQuantity: 2 },
        ],
        shortDeliveryReason: 'Customer requested partial delivery',
      });

      // Exactly 1 return transaction for BioDrops
      expect(prisma.inventoryLog.create).toHaveBeenCalledTimes(1);
      expect(prisma.inventoryLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            jarItemId: biodropsItemId,
            action: 'UNDELIVERED_RETURN',
            quantity: 1,
            ownership: 'COMPANY_OWNED',
          }),
        }),
      );
    });

    it('CASE 7 & 8: Duplicate delivery completion or refresh returns order idempotently without posting duplicate return', async () => {
      prisma.order.findUnique.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.DELIVERED,
      });

      const res = await service.completeDelivery(mockOrder.id, mockDistributorUserId, {
        pin: '4827',
        items: [{ jarItemId: biodropsItemId, deliveredQuantity: 3 }],
      });

      expect(res.status).toBe(OrderStatus.DELIVERED);
      expect(prisma.inventoryLog.create).not.toHaveBeenCalled();
      expect(prisma.jarInventoryItem.update).not.toHaveBeenCalled();
    });
  });
});
