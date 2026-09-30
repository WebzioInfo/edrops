import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { MailService } from '../mail/mail.service';
import { CloudinaryService } from '../config/cloudinary.service';
import { AccountStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

describe('Customer Account Activation + First Password Setup Flow', () => {
  let authService: AuthService;
  let prismaService: any;
  let mailService: any;
  let jwtService: any;

  const mockUserPending = {
    id: 'user-pending-1',
    email: 'newcustomer@example.com',
    phone: '9988776655',
    firstName: 'Alex',
    lastName: 'Smith',
    role: 'CUSTOMER',
    accountStatus: AccountStatus.PENDING_PASSWORD_SETUP,
    passwordHash: '$2b$10$temporarydummyhashthatcannotbeguessed',
    isActive: true,
  };

  const mockUserActive = {
    ...mockUserPending,
    id: 'user-active-1',
    email: 'activecustomer@example.com',
    accountStatus: AccountStatus.ACTIVE,
  };

  beforeEach(async () => {
    prismaService = {
      user: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      passwordSetupToken: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        create: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(prismaService)),
    };

    mailService = {
      sendAccountSetupEmail: jest.fn().mockResolvedValue(true),
      sendPasswordChanged: jest.fn().mockResolvedValue(true),
      sendWelcomeEmail: jest.fn().mockResolvedValue(true),
    };

    jwtService = {
      sign: jest.fn().mockReturnValue('mock-jwt-token'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaService },
        { provide: JwtService, useValue: jwtService },
        { provide: MailService, useValue: mailService },
        {
          provide: CloudinaryService,
          useValue: {
            uploadImage: jest.fn(),
          },
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
  });

  describe('1. Token Validation (GET /auth/setup-password/validate)', () => {
    it('should return invalid state for empty or missing token', async () => {
      const res1 = await authService.validateSetupToken('');
      expect(res1.valid).toBe(false);
      expect(res1.reason).toBe('INVALID');

      const res2 = await authService.validateSetupToken(null as any);
      expect(res2.valid).toBe(false);
      expect(res2.reason).toBe('INVALID');
    });

    it('should return invalid state for non-existent token', async () => {
      prismaService.passwordSetupToken.findUnique.mockResolvedValue(null);

      const res = await authService.validateSetupToken('random-invalid-token-12345');
      expect(res.valid).toBe(false);
      expect(res.reason).toBe('INVALID');
    });

    it('should return expired state for an expired token', async () => {
      const expiredDate = new Date(Date.now() - 3600 * 1000); // 1 hour ago
      prismaService.passwordSetupToken.findUnique.mockResolvedValue({
        id: 'token-1',
        userId: mockUserPending.id,
        tokenHash: 'hashed',
        expiresAt: expiredDate,
        usedAt: null,
        user: mockUserPending,
      });

      const res = await authService.validateSetupToken('expired-token');
      expect(res.valid).toBe(false);
      expect(res.reason).toBe('EXPIRED');
    });

    it('should return already used state for an already used token', async () => {
      prismaService.passwordSetupToken.findUnique.mockResolvedValue({
        id: 'token-2',
        userId: mockUserPending.id,
        tokenHash: 'hashed',
        expiresAt: new Date(Date.now() + 3600 * 1000),
        usedAt: new Date(Date.now() - 600 * 1000), // used 10 mins ago
        user: mockUserPending,
      });

      const res = await authService.validateSetupToken('used-token');
      expect(res.valid).toBe(false);
      expect(res.reason).toBe('ALREADY_USED');
    });

    it('should validate a valid, unexpired, unused token and return customer metadata', async () => {
      const rawToken = 'valid-secure-32-byte-token-1234567890';
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      prismaService.passwordSetupToken.findUnique.mockResolvedValue({
        id: 'token-3',
        userId: mockUserPending.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
        usedAt: null,
        user: mockUserPending,
      });

      const result = await authService.validateSetupToken(rawToken);

      expect(result.valid).toBe(true);
      expect(result.email).toBe(mockUserPending.email);
      expect(result.firstName).toBe(mockUserPending.firstName);
    });
  });

  describe('2. First Password Setup (POST /auth/setup-password)', () => {
    const rawToken = 'valid-activation-token-sample';
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    it('should reject mismatched passwords', async () => {
      await expect(
        authService.setupPassword({
          token: rawToken,
          password: 'Password123!',
          confirmPassword: 'MismatchPassword123!',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject passwords shorter than 8 characters', async () => {
      await expect(
        authService.setupPassword({
          token: rawToken,
          password: 'short',
          confirmPassword: 'short',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should securely set password, activate account, invalidate token, and send confirmation email', async () => {
      prismaService.passwordSetupToken.findUnique.mockResolvedValue({
        id: 'token-id-100',
        userId: mockUserPending.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
        usedAt: null,
        user: mockUserPending,
      });

      prismaService.user.update.mockResolvedValue({
        ...mockUserPending,
        accountStatus: AccountStatus.ACTIVE,
      });

      const response = await authService.setupPassword({
        token: rawToken,
        password: 'NewSecurePassword88!',
        confirmPassword: 'NewSecurePassword88!',
      });

      expect(response.success).toBe(true);
      expect(response.message).toContain('Password created successfully');

      // Verify user was updated to ACTIVE
      expect(prismaService.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockUserPending.id },
          data: expect.objectContaining({
            accountStatus: AccountStatus.ACTIVE,
          }),
        }),
      );

      // Verify token was marked used
      expect(prismaService.passwordSetupToken.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'token-id-100' },
          data: expect.objectContaining({
            usedAt: expect.any(Date),
          }),
        }),
      );

      // Verify audit log
      expect(prismaService.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'PASSWORD_SETUP_COMPLETED',
            entityType: 'USER',
            entityId: mockUserPending.id,
          }),
        }),
      );

      // Verify confirmation email was sent
      expect(mailService.sendPasswordChanged).toHaveBeenCalled();
    });
  });

  describe('3. Login Prevention for Unactivated Accounts', () => {
    it('should reject login attempt if account is still PENDING_PASSWORD_SETUP', async () => {
      prismaService.user.findFirst.mockResolvedValue(mockUserPending);

      await expect(
        authService.login({
          identifier: mockUserPending.email,
          password: 'anyPassword',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should allow login once account is ACTIVE and password matches', async () => {
      const correctPassword = 'MySecretPassword123!';
      const passwordHash = await bcrypt.hash(correctPassword, 10);

      prismaService.user.findFirst.mockResolvedValue({
        ...mockUserActive,
        passwordHash,
      });

      const result = await authService.login({
        identifier: mockUserActive.email,
        password: correctPassword,
      });

      expect(result).toHaveProperty('access_token');
      expect(result.access_token).toBe('mock-jwt-token');
    });
  });

  describe('4. Resend Activation Setup Link (POST /auth/resend-activation)', () => {
    it('should return a generic friendly message without revealing email existence', async () => {
      prismaService.user.findFirst.mockResolvedValue(null);

      const result = await authService.resendActivation({
        email: 'unknown@example.com',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('If an account exists');
    });

    it('should invalidate existing tokens and send new activation email for eligible pending account', async () => {
      prismaService.user.findFirst.mockResolvedValue(mockUserPending);
      prismaService.passwordSetupToken.findFirst.mockResolvedValue(null); // No recent token within 60s

      const result = await authService.resendActivation({
        email: mockUserPending.email,
      });

      expect(result.success).toBe(true);
      expect(prismaService.passwordSetupToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: mockUserPending.id,
            usedAt: null,
          }),
        }),
      );
      expect(prismaService.passwordSetupToken.create).toHaveBeenCalled();
      expect(mailService.sendAccountSetupEmail).toHaveBeenCalled();
    });
  });
});
