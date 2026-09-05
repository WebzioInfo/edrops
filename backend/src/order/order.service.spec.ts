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
});
