import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CustomerService } from './customer.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { MailService } from '../mail/mail.service';
import { AccountStatus } from '@prisma/client';

describe('Quick Customer Creation - Full Onboarding & Invariants', () => {
  let customerService: CustomerService;
  let prismaService: any;
  let notificationService: any;
  let mailService: any;

  const mockDistributorUser = {
    id: 'dist-user-123',
    role: 'DISTRIBUTOR',
    firstName: 'Salim',
    lastName: 'Kumar',
    distributor: {
      id: 'dist-record-456',
      agencyName: 'Kochi Pure Waters',
      referralCode: 'EDR-6666',
    },
  };

  beforeEach(async () => {
    prismaService = {
      user: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      distributor: {
        findFirst: jest.fn(),
      },
      customer: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      address: {
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      wallet: {
        create: jest.fn().mockResolvedValue({ id: 'wallet-1', balance: 0 }),
      },
      passwordSetupToken: {
        create: jest.fn().mockResolvedValue({ id: 'tok-1' }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
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

  describe('1. Validation & Security Invariants', () => {
    it('should reject creation if distributor creates customer without an email address', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockDistributorUser);

      await expect(
        customerService.create(
          {
            firstName: 'Anoop',
            lastName: 'Menon',
            phone: '9847012345',
            referralCode: 'EDR-6666',
          } as any,
          mockDistributorUser.id,
        ),
      ).rejects.toThrow('Email address is required for customer account onboarding.');
    });

    it('should reject creation with invalid email format', async () => {
      await expect(
        customerService.create(
          {
            firstName: 'Anoop',
            lastName: 'Menon',
            phone: '9847012345',
            email: 'not-an-email',
          } as any,
          mockDistributorUser.id,
        ),
      ).rejects.toThrow('Please enter a valid email address.');
    });

    it('should reject creation with duplicate email with clear error: "This email is already registered."', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockDistributorUser);
      prismaService.user.findFirst.mockImplementation((args: any) => {
        if (args.where?.email) {
          return Promise.resolve({ id: 'existing-user', email: 'duplicate@example.com' });
        }
        return Promise.resolve(null);
      });

      await expect(
        customerService.create(
          {
            firstName: 'Anoop',
            lastName: 'Menon',
            phone: '9847012345',
            email: 'duplicate@example.com',
            referralCode: 'EDR-6666',
          } as any,
          mockDistributorUser.id,
        ),
      ).rejects.toThrow('This email is already registered.');
    });

    it('should reject creation with duplicate phone with clear error: "Phone number is already registered."', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockDistributorUser);
      prismaService.user.findFirst.mockImplementation((args: any) => {
        if (args.where?.OR) {
          return Promise.resolve({ id: 'existing-phone-user', phone: '9847012345' });
        }
        return Promise.resolve(null);
      });

      await expect(
        customerService.create(
          {
            firstName: 'Anoop',
            lastName: 'Menon',
            phone: '9847012345',
            email: 'valid@example.com',
            referralCode: 'EDR-6666',
          } as any,
          mockDistributorUser.id,
        ),
      ).rejects.toThrow('Phone number is already registered.');
    });
  });

  describe('2. Atomic Customer Account Onboarding Flow', () => {
    it('should atomically create user account, customer profile, address, wallet, and send welcome email', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockDistributorUser);
      prismaService.user.findFirst.mockResolvedValue(null);

      const mockCreatedUser = {
        id: 'user-created-1',
        firstName: 'Rahul',
        lastName: 'Sharma',
        email: 'rahul@example.com',
        phone: '9847099999',
        role: 'CUSTOMER',
        accountStatus: AccountStatus.PENDING_PASSWORD_SETUP,
      };

      const mockCreatedCustomer = {
        id: 'cust-created-1',
        userId: 'user-created-1',
        customerType: 'RESIDENTIAL',
        source: 'EDR-6666',
        createdById: mockDistributorUser.id,
        createdFrom: 'Distributor Portal',
      };

      prismaService.user.create.mockResolvedValue(mockCreatedUser);
      prismaService.customer.create.mockResolvedValue(mockCreatedCustomer);

      const res = await customerService.create(
        {
          firstName: 'Rahul',
          lastName: 'Sharma',
          phone: '9847099999',
          email: '  Rahul@Example.COM  ',
          referralCode: 'EDR-6666',
          addresses: [
            {
              street: 'Marine Drive Road',
              city: 'Kochi',
              state: 'Kerala',
              country: 'India',
              zipCode: '682001',
              isDefault: true,
            },
          ],
        },
        mockDistributorUser.id,
      );

      // Verify safe response format (Section 12)
      expect(res.success).toBe(true);
      expect(res.accountCreated).toBe(true);
      expect(res.customerId).toBe('cust-created-1');
      expect(res.accountStatus).toBe(AccountStatus.PENDING_PASSWORD_SETUP);
      expect(res.emailSent).toBe(true);
      expect(res.emailDeliveryStatus).toBe('SENT');

      // Security: verify no plaintext secrets in response
      expect((res as any).password).toBeUndefined();
      expect((res as any).passwordHash).toBeUndefined();
      expect((res as any).token).toBeUndefined();

      // Verify user creation with normalized email and role CUSTOMER
      expect(prismaService.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'rahul@example.com',
            role: 'CUSTOMER',
            accountStatus: AccountStatus.PENDING_PASSWORD_SETUP,
          }),
        }),
      );

      // Verify customer attribution
      expect(prismaService.customer.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-created-1',
            source: 'EDR-6666',
            createdById: mockDistributorUser.id,
            createdFrom: 'Distributor Portal',
          }),
        }),
      );

      // Verify delivery address creation
      expect(prismaService.address.createMany).toHaveBeenCalled();

      // Verify wallet creation
      expect(prismaService.wallet.create).toHaveBeenCalledWith({
        data: { customerId: 'cust-created-1', balance: 0 },
      });

      // Verify email was sent with distributor attribution
      expect(mailService.sendAccountSetupEmail).toHaveBeenCalledWith(
        mockCreatedUser,
        expect.any(String),
        { distributorName: 'Kochi Pure Waters' },
      );
    });

    it('should handle email delivery failure gracefully without rolling back account', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockDistributorUser);
      prismaService.user.findFirst.mockResolvedValue(null);

      const mockCreatedUser = {
        id: 'user-fail-1',
        firstName: 'Sita',
        lastName: 'Ram',
        email: 'sita@example.com',
        phone: '9847088888',
        role: 'CUSTOMER',
        accountStatus: AccountStatus.PENDING_PASSWORD_SETUP,
      };

      const mockCreatedCustomer = {
        id: 'cust-fail-1',
        userId: 'user-fail-1',
        customerType: 'RESIDENTIAL',
      };

      prismaService.user.create.mockResolvedValue(mockCreatedUser);
      prismaService.customer.create.mockResolvedValue(mockCreatedCustomer);

      // Mock email failure
      mailService.sendAccountSetupEmail.mockResolvedValue(false);

      const res = await customerService.create(
        {
          firstName: 'Sita',
          lastName: 'Ram',
          phone: '9847088888',
          email: 'sita@example.com',
          referralCode: 'EDR-6666',
        },
        mockDistributorUser.id,
      );

      // Account creation succeeded despite email failure
      expect(res.success).toBe(true);
      expect(res.accountCreated).toBe(true);
      expect(res.customerId).toBe('cust-fail-1');
      expect(res.emailSent).toBe(false);
      expect(res.emailDeliveryStatus).toBe('FAILED');
      expect(res.message).toBe('Customer account created, but the welcome email could not be sent.');

      // Verify audit log for email failure
      expect(prismaService.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'WELCOME_EMAIL_FAILED',
          }),
        }),
      );
    });
  });

  describe('3. Resend Welcome Email Flow & Permissions', () => {
    it('should reject resend if rate limit exceeded within 60 seconds', async () => {
      prismaService.customer.findUnique.mockResolvedValue({
        id: 'cust-1',
        user: { id: 'u-1', email: 'test@example.com', accountStatus: AccountStatus.PENDING_PASSWORD_SETUP },
      });
      // Simulate recent token exists
      prismaService.passwordSetupToken.findFirst.mockResolvedValue({ id: 'recent-tok' });

      await expect(
        customerService.resendSetupLink('cust-1', mockDistributorUser.id),
      ).rejects.toThrow('A welcome email was recently sent. Please wait 60 seconds before requesting another.');
    });

    it('should reject distributor if customer does not belong to them', async () => {
      prismaService.customer.findUnique.mockResolvedValue({
        id: 'cust-other',
        createdById: 'different-distributor-id',
        source: 'OTHER-CODE',
        user: { id: 'u-2', email: 'other@example.com', accountStatus: AccountStatus.PENDING_PASSWORD_SETUP },
      });
      prismaService.user.findUnique.mockResolvedValue(mockDistributorUser);
      prismaService.passwordSetupToken.findFirst.mockResolvedValue(null);

      await expect(
        customerService.resendSetupLink('cust-other', mockDistributorUser.id),
      ).rejects.toThrow('You do not have permission to resend welcome email for this customer.');
    });

    it('should successfully resend welcome email for authorized distributor', async () => {
      const ownedCustomer = {
        id: 'cust-owned',
        createdById: mockDistributorUser.id,
        source: 'EDR-6666',
        user: { id: 'u-owned', email: 'owned@example.com', accountStatus: AccountStatus.PENDING_PASSWORD_SETUP },
      };

      prismaService.customer.findUnique.mockResolvedValue(ownedCustomer);
      prismaService.user.findUnique.mockResolvedValue(mockDistributorUser);
      prismaService.passwordSetupToken.findFirst.mockResolvedValue(null);
      mailService.sendAccountSetupEmail.mockResolvedValue(true);

      const res = await customerService.resendSetupLink('cust-owned', mockDistributorUser.id);

      expect(res.success).toBe(true);
      expect(res.emailSent).toBe(true);
      expect(prismaService.passwordSetupToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: 'u-owned', usedAt: null }),
        }),
      );
      expect(prismaService.passwordSetupToken.create).toHaveBeenCalled();
      expect(mailService.sendAccountSetupEmail).toHaveBeenCalledWith(
        ownedCustomer.user,
        expect.any(String),
        { distributorName: 'Kochi Pure Waters' },
      );
    });
  });
});
