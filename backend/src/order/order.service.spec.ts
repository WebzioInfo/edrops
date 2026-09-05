import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { OrderStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { EventsGateway } from '../events/events.gateway';
import { OrderService } from './order.service';

describe('OrderService', () => {
  let service: OrderService;
  let prisma: any;
  let notificationService: any;
  let eventsGateway: any;

  beforeEach(async () => {
    prisma = {
      order: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
      deliveryPartner: {
        findUnique: jest.fn(),
      },
      orderStatusHistory: {
        create: jest.fn(),
      },
      delivery: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      deliveryReport: {
        upsert: jest.fn(),
      },
      payment: {
        create: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(prisma)),
    };

    notificationService = {
      notifyOrderStatusUpdate: jest.fn(),
    };

    eventsGateway = {
      emitOrderStatusUpdate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationService, useValue: notificationService },
        { provide: EventsGateway, useValue: eventsGateway },
      ],
    }).compile();

    service = module.get<OrderService>(OrderService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('updateOrderStatus - same status bug prevention', () => {
    it('should throw clear descriptive error when transitioning to same status', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'order-1',
        status: OrderStatus.ACCEPTED_BY_PARTNER,
        delivery: { assignment: { deliveryPartnerId: 'dp-1' } },
      });

      await expect(
        service.updateOrderStatus(
          'order-1',
          OrderStatus.ACCEPTED_BY_PARTNER,
          'user-1',
          'Confirm order',
        ),
      ).rejects.toThrow(
        new BadRequestException('Order is already in this status: ACCEPTED_BY_PARTNER'),
      );
    });
  });

  describe('updateOrderStatus - delivery partner permissions & scoping', () => {
    it('should throw ForbiddenException if delivery partner is not assigned to order', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'order-1',
        status: OrderStatus.ASSIGNED,
        delivery: { assignment: { deliveryPartnerId: 'partner-other' } },
      });

      prisma.user.findUnique.mockResolvedValue({
        id: 'user-partner',
        role: UserRole.DELIVERY_PARTNER,
        deliveryPartner: { id: 'partner-me', userId: 'user-partner' },
      });

      await expect(
        service.updateOrderStatus(
          'order-1',
          OrderStatus.ACCEPTED_BY_PARTNER,
          'user-partner',
          'Accept order',
          undefined,
          false,
          UserRole.DELIVERY_PARTNER,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if delivery partner attempts to CANCEL order', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'order-1',
        status: OrderStatus.ACCEPTED_BY_PARTNER,
        delivery: { assignment: { deliveryPartnerId: 'partner-me' } },
      });

      prisma.user.findUnique.mockResolvedValue({
        id: 'user-partner',
        role: UserRole.DELIVERY_PARTNER,
        deliveryPartner: { id: 'partner-me', userId: 'user-partner' },
      });

      await expect(
        service.updateOrderStatus(
          'order-1',
          OrderStatus.CANCELLED,
          'user-partner',
          'Cancel order',
          undefined,
          false,
          UserRole.DELIVERY_PARTNER,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should successfully allow assigned partner to accept order and start delivery', async () => {
      const mockOrder = {
        id: 'order-1',
        customerId: 'cust-1',
        status: OrderStatus.ASSIGNED,
        totalAmount: 100,
        paymentStatus: 'PENDING',
        paymentMethod: 'COD',
        delivery: {
          id: 'del-1',
          assignment: { deliveryPartnerId: 'partner-me' },
        },
        items: [],
      };

      prisma.order.findUnique.mockResolvedValue(mockOrder);
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-partner',
        role: UserRole.DELIVERY_PARTNER,
        deliveryPartner: { id: 'partner-me', userId: 'user-partner' },
      });
      prisma.order.update.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.ACCEPTED_BY_PARTNER,
      });

      const res = await service.updateOrderStatus(
        'order-1',
        OrderStatus.ACCEPTED_BY_PARTNER,
        'user-partner',
        'Accept order',
        undefined,
        false,
        UserRole.DELIVERY_PARTNER,
      );

      expect(res.status).toBe(OrderStatus.ACCEPTED_BY_PARTNER);
      expect(eventsGateway.emitOrderStatusUpdate).toHaveBeenCalledWith(
        'order-1',
        OrderStatus.ACCEPTED_BY_PARTNER,
        'cust-1',
        expect.anything(),
      );
    });
  });

  describe('findPartnerAll - delivery partner access scoping', () => {
    it('should scope queries to assigned partner or partner-created orders for DELIVERY_PARTNER role', async () => {
      prisma.deliveryPartner.findUnique.mockResolvedValue({
        id: 'partner-rahman',
        userId: 'user-rahman',
      });
      prisma.order.findMany.mockResolvedValue([
        { id: 'order-assigned-to-rahman' },
        { id: 'order-created-by-rahman' },
      ]);

      const results = await service.findPartnerAll(
        { status: 'PENDING' },
        'user-rahman',
        UserRole.DELIVERY_PARTNER,
      );

      expect(results).toHaveLength(2);
      expect(prisma.deliveryPartner.findUnique).toHaveBeenCalledWith({
        where: { userId: 'user-rahman' },
      });
      expect(prisma.order.findMany).toHaveBeenCalled();

      const callArg = prisma.order.findMany.mock.calls[0][0];
      expect(callArg.where.AND).toBeDefined();

      // Verify partner scope clause is present
      const partnerScope = callArg.where.AND.find((clause: any) => clause.OR && clause.OR.length > 0);
      expect(partnerScope).toBeDefined();
      expect(partnerScope.OR).toEqual(
        expect.arrayContaining([
          {
            delivery: {
              assignment: {
                deliveryPartnerId: 'partner-rahman',
              },
            },
          },
          {
            history: {
              some: {
                changedByUserId: 'user-rahman',
                reason: { contains: 'Delivery Partner', mode: 'insensitive' },
              },
            },
          },
          {
            history: {
              some: {
                changedByUserId: 'user-rahman',
                previousStatus: OrderStatus.NEW,
                newStatus: OrderStatus.NEW,
              },
            },
          },
        ]),
      );

      // Verify status clause is present
      const statusScope = callArg.where.AND.find((clause: any) => clause.status);
      expect(statusScope).toBeDefined();
    });

    it('should return empty list if delivery partner record does not exist for partner user', async () => {
      prisma.deliveryPartner.findUnique.mockResolvedValue(null);

      const results = await service.findPartnerAll(
        { status: 'PENDING' },
        'user-unknown',
        UserRole.DELIVERY_PARTNER,
      );

      expect(results).toEqual([]);
      expect(prisma.order.findMany).not.toHaveBeenCalled();
    });

    it('should NOT apply partner scoping for staff or admin roles', async () => {
      prisma.order.findMany.mockResolvedValue([
        { id: 'all-orders-1' },
        { id: 'all-orders-2' },
      ]);

      const results = await service.findPartnerAll(
        { status: 'PENDING' },
        'user-staff',
        UserRole.STAFF,
      );

      expect(results).toHaveLength(2);
      expect(prisma.deliveryPartner.findUnique).not.toHaveBeenCalled();

      const callArg = prisma.order.findMany.mock.calls[0][0];
      // Staff query should only filter by status, not partner assignment
      const partnerScope = callArg.where?.AND?.find((clause: any) => clause.OR && clause.OR.some((sub: any) => sub.delivery));
      expect(partnerScope).toBeUndefined();
    });
  });
});
