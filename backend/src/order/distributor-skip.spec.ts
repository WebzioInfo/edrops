import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { EventsGateway } from '../events/events.gateway';
import { OrderService } from './order.service';

describe('Distributor Skip and Accept Flow (Unit & Scenarios)', () => {
  let service: OrderService;
  let prisma: any;
  let eventsGateway: any;

  beforeEach(async () => {
    prisma = {
      order: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        aggregate: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
      distributorOrderSkip: {
        upsert: jest.fn(),
      },
      orderStatusHistory: {
        create: jest.fn(),
      },
      $executeRaw: jest.fn(),
    };

    eventsGateway = {
      emitOrderClaimed: jest.fn(),
      emitOrderStatusUpdate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationService, useValue: { notifyOrderStatusUpdate: jest.fn() } },
        { provide: EventsGateway, useValue: eventsGateway },
      ],
    }).compile();

    service = module.get<OrderService>(OrderService);
  });

  describe('Scenario 1: Distributor A skips Order 123', () => {
    it('creates skip record for Distributor A without modifying global order status', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'dist-a', role: 'DISTRIBUTOR' });
      prisma.order.findUnique.mockResolvedValue({
        id: 'order-123',
        status: OrderStatus.NEW,
        assignmentStatus: 'UNASSIGNED',
        distributorId: null,
      });
      prisma.distributorOrderSkip.upsert.mockResolvedValue({
        id: 'skip-1',
        orderId: 'order-123',
        distributorId: 'dist-a',
        action: 'SKIPPED',
      });

      const res = await service.skipDistributorOrder('order-123', 'dist-a');

      expect(res).toEqual({
        success: true,
        orderId: 'order-123',
        action: 'SKIPPED',
      });
      expect(prisma.distributorOrderSkip.upsert).toHaveBeenCalledWith({
        where: {
          orderId_distributorId: {
            orderId: 'order-123',
            distributorId: 'dist-a',
          },
        },
        update: {
          action: 'SKIPPED',
          updatedAt: expect.any(Date),
        },
        create: {
          orderId: 'order-123',
          distributorId: 'dist-a',
          action: 'SKIPPED',
        },
      });
    });

    it('filters out skipped order for Distributor A but includes it for Distributor B', async () => {
      prisma.order.count.mockResolvedValue(1);
      prisma.order.aggregate.mockResolvedValue({ _sum: { totalAmount: 500 } });
      prisma.order.findMany.mockResolvedValue([
        {
          id: 'order-123',
          totalAmount: 500,
          items: [],
          payments: [],
        },
      ]);

      // Query for Distributor A
      await service.findDistributorNewOrders({}, 'dist-a');
      expect(prisma.order.findMany).toHaveBeenLastCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            distributorSkips: {
              none: {
                distributorId: 'dist-a',
              },
            },
          }),
        }),
      );

      // Query for Distributor B
      await service.findDistributorNewOrders({}, 'dist-b');
      expect(prisma.order.findMany).toHaveBeenLastCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            distributorSkips: {
              none: {
                distributorId: 'dist-b',
              },
            },
          }),
        }),
      );
    });
  });

  describe('Scenario 2: Distributor B accepts Order 123', () => {
    it('successfully assigns Order 123 to Distributor B and broadcasts claim event', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'dist-b', role: 'DISTRIBUTOR' });
      prisma.$executeRaw.mockResolvedValue(1); // 1 row updated
      prisma.order.findUnique.mockResolvedValue({
        id: 'order-123',
        status: OrderStatus.CONFIRMED,
        assignmentStatus: 'ASSIGNED',
        distributorId: 'dist-b',
        customerId: 'cust-1',
      });
      prisma.orderStatusHistory.create.mockResolvedValue({});

      const result = await service.acceptDistributorOrder('order-123', 'dist-b');

      expect(result?.id).toBe('order-123');
      expect(prisma.$executeRaw).toHaveBeenCalled();
      expect(eventsGateway.emitOrderClaimed).toHaveBeenCalledWith(
        'order-123',
        'dist-b',
        expect.any(Object),
      );
    });
  });

  describe('Scenario 3: A and B accept simultaneously', () => {
    it('second distributor receives ConflictException if order is already claimed', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'dist-b', role: 'DISTRIBUTOR' });
      prisma.$executeRaw.mockResolvedValue(0); // 0 rows updated because another distributor won the race

      await expect(
        service.acceptDistributorOrder('order-123', 'dist-b'),
      ).rejects.toThrow(ConflictException);
    });
  });
});
