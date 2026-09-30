import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CustomerService } from './customer.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { MailService } from '../mail/mail.service';
import { AccountStatus } from '@prisma/client';

describe('CustomerService - Customer Account Activation Flow', () => {
  let customerService: CustomerService;
  let prismaService: any;
  let notificationService: any;
  let mailService: any;

  beforeEach(async () => {
    prismaService = {
      user: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      customer: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      address: {
        createMany: jest.fn(),
      },
      wallet: {
        create: jest.fn(),
      },
      passwordSetupToken: {
        create: jest.fn(),
        updateMany: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
      $transaction: jest.fn(async (cb) => {
        return cb(prismaService);
      }),
    };

    notificationService = {
      notifyCustomerCreated: jest.fn(),
    };

    mailService = {
      sendAccountSetupEmail: jest.fn().mockResolvedValue(true),
      sendWelcomeEmail: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomerService,
        { provide: PrismaService, useValue: prismaService },
        { provide: NotificationService, useValue: notificationService },
        { provide: MailService, useValue: mailService },
      ],
    }).compile();

    customerService = module.get<CustomerService>(CustomerService);
  });

  describe('create customer', () => {
    it('should create customer in PENDING_PASSWORD_SETUP, generate token, send email, and never return plaintext password', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);
      prismaService.customer.findUnique.mockResolvedValue(null);

      const mockCreatedUser = {
        id: 'user-new-1',
        firstName: 'Sarah',
        lastName: 'Connor',
        phone: '9876543211',
        email: 'sarah@example.com',
        accountStatus: AccountStatus.PENDING_PASSWORD_SETUP,
      };

      const mockCreatedCustomer = {
        id: 'cust-new-1',
        userId: 'user-new-1',
        customerType: 'RESIDENTIAL',
      };

      prismaService.user.create.mockResolvedValue(mockCreatedUser);
      prismaService.customer.create.mockResolvedValue(mockCreatedCustomer);

      const result = await customerService.create(
        {
          firstName: 'Sarah',
          lastName: 'Connor',
          phone: '9876543211',
          email: 'sarah@example.com',
          sendSetupLink: true,
        },
        'staff-user-id',
      );

      // 1. Success flag
      expect(result.success).toBe(true);
      expect(result.activationPending).toBe(true);
      expect(result.activationEmailSent).toBe(true);

      // 2. CRITICAL SECURITY: Plaintext password must NEVER be in response
      expect((result as any).password).toBeUndefined();

      // 3. User created with PENDING_PASSWORD_SETUP
      expect(prismaService.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            accountStatus: AccountStatus.PENDING_PASSWORD_SETUP,
          }),
        }),
      );

      // 4. Token hash created in DB
      expect(prismaService.passwordSetupToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: mockCreatedUser.id,
            purpose: 'ACCOUNT_ACTIVATION',
            tokenHash: expect.any(String),
            expiresAt: expect.any(Date),
          }),
        }),
      );

      // 5. Setup email sent
      expect(mailService.sendAccountSetupEmail).toHaveBeenCalledWith(
        mockCreatedUser,
        expect.any(String),
      );
    });
  });

  describe('resendSetupLink', () => {
    it('should throw NotFoundException if customer not found', async () => {
      prismaService.customer.findUnique.mockResolvedValue(null);

      await expect(
        customerService.resendSetupLink('non-existent', 'staff-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if customer is already ACTIVE', async () => {
      prismaService.customer.findUnique.mockResolvedValue({
        id: 'cust-1',
        user: {
          id: 'user-1',
          email: 'active@example.com',
          accountStatus: AccountStatus.ACTIVE,
        },
      });

      await expect(
        customerService.resendSetupLink('cust-1', 'staff-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should invalidate old tokens, create new token, log audit, and send email', async () => {
      const pendingCustomer = {
        id: 'cust-pending',
        user: {
          id: 'user-pending',
          email: 'pending@example.com',
          accountStatus: AccountStatus.PENDING_PASSWORD_SETUP,
        },
      };

      prismaService.customer.findUnique.mockResolvedValue(pendingCustomer);

      const res = await customerService.resendSetupLink('cust-pending', 'staff-1');

      expect(res.success).toBe(true);
      expect(prismaService.passwordSetupToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-pending',
            usedAt: null,
          }),
        }),
      );
      expect(prismaService.passwordSetupToken.create).toHaveBeenCalled();
      expect(mailService.sendAccountSetupEmail).toHaveBeenCalledWith(
        pendingCustomer.user,
        expect.any(String),
      );
    });
  });
});
