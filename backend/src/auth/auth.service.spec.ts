import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, NotFoundException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { MailService } from '../mail/mail.service';
import * as bcrypt from 'bcrypt';

describe('AuthService - Authentication Error Handling', () => {
  let authService: AuthService;
  let prismaService: any;
  let jwtService: any;
  let mailService: any;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    phone: '9876543210',
    firstName: 'John',
    lastName: 'Doe',
    role: 'CUSTOMER',
    passwordHash: '',
    isActive: true,
  };

  beforeAll(async () => {
    mockUser.passwordHash = await bcrypt.hash('CorrectPassword123!', 10);
  });

  beforeEach(async () => {
    prismaService = {
      user: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn((cb) => cb(prismaService)),
      auditLog: {
        create: jest.fn(),
      },
    };

    jwtService = {
      sign: jest.fn().mockReturnValue('mock-jwt-token'),
      verify: jest.fn(),
    };

    mailService = {
      sendWelcomeEmail: jest.fn(),
      sendPasswordReset: jest.fn(),
      sendPasswordChanged: jest.fn(),
      sendPasswordOtp: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaService },
        { provide: JwtService, useValue: jwtService },
        { provide: MailService, useValue: mailService },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
  });

  describe('1. Nonexistent User (USER NOT FOUND)', () => {
    it('should throw UnauthorizedException with code USER_NOT_FOUND when email is not found', async () => {
      prismaService.user.findFirst.mockResolvedValue(null);

      try {
        await authService.login({
          identifier: 'nonexistent@example.com',
          password: 'Password123!',
        });
        fail('Should have thrown UnauthorizedException');
      } catch (err: any) {
        expect(err).toBeInstanceOf(UnauthorizedException);
        const res = err.getResponse();
        expect(res).toEqual({
          statusCode: 401,
          code: 'USER_NOT_FOUND',
          message: 'User not found with this email or username.',
        });
      }
    });

    it('should throw UnauthorizedException with code USER_NOT_FOUND when username is not found', async () => {
      prismaService.user.findFirst.mockResolvedValue(null);

      try {
        await authService.login({
          identifier: 'nonexistent_user',
          password: 'Password123!',
        });
        fail('Should have thrown UnauthorizedException');
      } catch (err: any) {
        expect(err).toBeInstanceOf(UnauthorizedException);
        const res = err.getResponse();
        expect(res).toEqual({
          statusCode: 401,
          code: 'USER_NOT_FOUND',
          message: 'User not found with this email or username.',
        });
      }
    });

    it('should throw UnauthorizedException with code USER_NOT_FOUND when phone is not found', async () => {
      prismaService.user.findFirst.mockResolvedValue(null);

      try {
        await authService.login({
          identifier: '9999999999',
          password: 'Password123!',
        });
        fail('Should have thrown UnauthorizedException');
      } catch (err: any) {
        expect(err).toBeInstanceOf(UnauthorizedException);
        const res = err.getResponse();
        expect(res).toEqual({
          statusCode: 401,
          code: 'USER_NOT_FOUND',
          message: 'User not found with this email or username.',
        });
      }
    });
  });

  describe('2. Existing User with Wrong Password (INCORRECT PASSWORD)', () => {
    it('should throw UnauthorizedException with code INCORRECT_PASSWORD when password is wrong (email)', async () => {
      prismaService.user.findFirst.mockResolvedValue(mockUser);

      try {
        await authService.login({
          identifier: 'test@example.com',
          password: 'WrongPassword!',
        });
        fail('Should have thrown UnauthorizedException');
      } catch (err: any) {
        expect(err).toBeInstanceOf(UnauthorizedException);
        const res = err.getResponse();
        expect(res).toEqual({
          statusCode: 401,
          code: 'INCORRECT_PASSWORD',
          message: 'Incorrect password. Please try again.',
        });
      }
    });

    it('should throw UnauthorizedException with code INCORRECT_PASSWORD when password is wrong (username)', async () => {
      prismaService.user.findFirst.mockResolvedValue(mockUser);

      try {
        await authService.login({
          identifier: 'test',
          password: 'WrongPassword!',
        });
        fail('Should have thrown UnauthorizedException');
      } catch (err: any) {
        expect(err).toBeInstanceOf(UnauthorizedException);
        const res = err.getResponse();
        expect(res).toEqual({
          statusCode: 401,
          code: 'INCORRECT_PASSWORD',
          message: 'Incorrect password. Please try again.',
        });
      }
    });

    it('should throw UnauthorizedException with code INCORRECT_PASSWORD when password is wrong (phone)', async () => {
      prismaService.user.findFirst.mockResolvedValue(mockUser);

      try {
        await authService.login({
          identifier: '9876543210',
          password: 'WrongPassword!',
        });
        fail('Should have thrown UnauthorizedException');
      } catch (err: any) {
        expect(err).toBeInstanceOf(UnauthorizedException);
        const res = err.getResponse();
        expect(res).toEqual({
          statusCode: 401,
          code: 'INCORRECT_PASSWORD',
          message: 'Incorrect password. Please try again.',
        });
      }
    });
  });

  describe('3. Existing User with Correct Password (SUCCESS)', () => {
    it('should return access token and user info when login via email succeeds', async () => {
      prismaService.user.findFirst.mockResolvedValue(mockUser);

      const result = await authService.login({
        identifier: 'test@example.com',
        password: 'CorrectPassword123!',
      });

      expect(result).toHaveProperty('access_token', 'mock-jwt-token');
      expect(result.user).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        phone: mockUser.phone,
        firstName: mockUser.firstName,
        lastName: mockUser.lastName,
        role: mockUser.role,
      });
    });

    it('should return access token and user info when login via username succeeds', async () => {
      prismaService.user.findFirst.mockResolvedValue(mockUser);

      const result = await authService.login({
        identifier: 'test',
        password: 'CorrectPassword123!',
      });

      expect(result).toHaveProperty('access_token', 'mock-jwt-token');
      expect(result.user).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        phone: mockUser.phone,
        firstName: mockUser.firstName,
        lastName: mockUser.lastName,
        role: mockUser.role,
      });
    });

    it('should return access token and user info when login via phone succeeds', async () => {
      prismaService.user.findFirst.mockResolvedValue(mockUser);

      const result = await authService.login({
        identifier: '9876543210',
        password: 'CorrectPassword123!',
      });

      expect(result).toHaveProperty('access_token', 'mock-jwt-token');
      expect(result.user).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        phone: mockUser.phone,
        firstName: mockUser.firstName,
        lastName: mockUser.lastName,
        role: mockUser.role,
      });
    });
  });

  describe('4. Unaffected Flows', () => {
    it('should maintain forgotPassword flow', async () => {
      prismaService.user.findFirst.mockResolvedValue(null);

      await expect(
        authService.forgotPassword('nonexistent@example.com'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should maintain googleAuth flow validation', async () => {
      await expect(authService.googleAuth('')).rejects.toThrow(
        'Google ID token is required',
      );
    });
  });
});
