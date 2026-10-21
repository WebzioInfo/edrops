import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import * as crypto from 'crypto';
import { ProfileService } from './profile.service';
import { AvatarProcessingQueueService } from './avatar-processing-queue.service';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../config/cloudinary.service';
import { MailService } from '../mail/mail.service';
const sharp = require('sharp');

describe('Profile Module: ProfileService, Address CRUD, and Email OTP Profile Verification', () => {
  let profileService: ProfileService;
  let avatarQueue: AvatarProcessingQueueService;
  let prisma: any;
  let cloudinary: any;
  let mailService: any;

  const mockUserId = 'user-uuid-1';
  const mockCustomerId = 'cust-uuid-1';

  const mockUser = {
    id: mockUserId,
    email: 'user@example.com',
    firstName: 'John',
    lastName: 'Doe',
    phone: '+919876543210',
    role: 'CUSTOMER',
    accountStatus: 'ACTIVE',
    isActive: true,
    avatarUrl: 'https://res.cloudinary.com/demo/image/upload/v1/edrops/avatars/old.jpg',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-03-01'),
    customer: {
      id: mockCustomerId,
      customerType: 'RESIDENTIAL',
      wallet: { balance: 500 },
      addresses: [],
    },
    distributor: null,
    staff: null,
    deliveryPartner: null,
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      customer: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      address: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      distributor: {
        upsert: jest.fn(),
      },
      deliveryPartner: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      staff: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      profileUpdateVerification: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        delete: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation((cb) => cb(prisma)),
    };

    cloudinary = {
      uploadImage: jest.fn().mockResolvedValue({
        secure_url: 'https://res.cloudinary.com/demo/image/upload/v1/edrops/avatars/new.jpg',
        public_id: 'edrops/avatars/new',
      }),
      deleteImage: jest.fn().mockResolvedValue(true),
    };

    mailService = {
      sendProfileUpdateOtp: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfileService,
        AvatarProcessingQueueService,
        { provide: PrismaService, useValue: prisma },
        { provide: CloudinaryService, useValue: cloudinary },
        { provide: MailService, useValue: mailService },
      ],
    }).compile();

    profileService = module.get<ProfileService>(ProfileService);
    avatarQueue = module.get<AvatarProcessingQueueService>(AvatarProcessingQueueService);
  });

  describe('1. Profile Retrieval & Basic Information', () => {
    it('should return complete user profile with formatted fields and addresses', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const profile = await profileService.getProfile(mockUserId);
      expect(profile).toHaveProperty('id', mockUserId);
      expect(profile).toHaveProperty('email', 'user@example.com');
      expect(profile).toHaveProperty('phone', '+919876543210');
      expect(profile).toHaveProperty('role', 'CUSTOMER');
      expect(profile).toHaveProperty('accountStatus', 'ACTIVE');
      expect(profile).toHaveProperty('addresses');
      expect(Array.isArray(profile.addresses)).toBe(true);
    });

    it('should throw NotFoundException if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(profileService.getProfile('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('2. Email OTP Profile Verification Flow', () => {
    it('should detect no changes and return noChanges: true without sending OTP', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await profileService.requestProfileUpdateOtp(mockUserId, {
        firstName: 'John',
        lastName: 'Doe',
        email: 'user@example.com',
        phone: '+919876543210',
      });

      expect(result).toHaveProperty('noChanges', true);
      expect(mailService.sendProfileUpdateOtp).not.toHaveBeenCalled();
      expect(prisma.profileUpdateVerification.create).not.toHaveBeenCalled();
    });

    it('should initiate OTP verification and send code to OLD registered email when email is changing', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.user.findFirst.mockResolvedValue(null); // No collision on new email
      prisma.profileUpdateVerification.findFirst.mockResolvedValue(null); // Not rate limited
      prisma.profileUpdateVerification.create.mockResolvedValue({
        id: 'verif-123',
        userId: mockUserId,
      });

      const result = await profileService.requestProfileUpdateOtp(mockUserId, {
        email: 'newemail@example.com',
      });

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('verificationId', 'verif-123');
      expect(result).toHaveProperty('maskedEmail');

      // Crucial: OTP must go to OLD registered email (user@example.com), not newemail@example.com
      expect(mailService.sendProfileUpdateOtp).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'user@example.com' }),
        expect.stringMatching(/^\d{6}$/),
      );
    });

    it('should reject email change if new email is already taken by another account', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.user.findFirst.mockResolvedValue({ id: 'other-user', email: 'taken@example.com' });

      await expect(
        profileService.requestProfileUpdateOtp(mockUserId, { email: 'taken@example.com' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should rate-limit rapid repeated OTP requests within 45 seconds', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.profileUpdateVerification.findFirst.mockResolvedValue({
        id: 'recent-verif',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 200000),
      });

      await expect(
        profileService.requestProfileUpdateOtp(mockUserId, { firstName: 'Johnny' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should successfully verify valid OTP and apply updates atomically', async () => {
      const rawOtp = '654321';
      const otpHash = crypto.createHash('sha256').update(rawOtp).digest('hex');

      prisma.profileUpdateVerification.findFirst.mockResolvedValue({
        id: 'verif-123',
        userId: mockUserId,
        otpHash,
        pendingData: { firstName: 'Johnny', phone: '+919999988888' },
        expiresAt: new Date(Date.now() + 60000),
        attempts: 0,
        maxAttempts: 5,
        usedAt: null,
      });

      prisma.user.findFirst.mockResolvedValue(null); // No collision
      prisma.user.update.mockResolvedValue({
        ...mockUser,
        firstName: 'Johnny',
        phone: '+919999988888',
      });
      prisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        firstName: 'Johnny',
        phone: '+919999988888',
      });

      const updated = await profileService.verifyProfileUpdateOtp(mockUserId, {
        verificationId: 'verif-123',
        otp: rawOtp,
      });

      expect(prisma.profileUpdateVerification.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'verif-123' },
          data: expect.objectContaining({ usedAt: expect.any(Date) }),
        }),
      );
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockUserId },
          data: expect.objectContaining({ firstName: 'Johnny', phone: '+919999988888' }),
        }),
      );
      expect(updated.firstName).toBe('Johnny');
    });

    it('should reject invalid OTP and increment attempt count', async () => {
      const rawOtp = '111111';
      const otpHash = crypto.createHash('sha256').update(rawOtp).digest('hex');

      prisma.profileUpdateVerification.findFirst.mockResolvedValue({
        id: 'verif-123',
        userId: mockUserId,
        otpHash,
        pendingData: { firstName: 'Johnny' },
        expiresAt: new Date(Date.now() + 60000),
        attempts: 1,
        maxAttempts: 5,
        usedAt: null,
      });

      prisma.profileUpdateVerification.update.mockResolvedValue({
        id: 'verif-123',
        attempts: 2,
        maxAttempts: 5,
      });

      await expect(
        profileService.verifyProfileUpdateOtp(mockUserId, {
          verificationId: 'verif-123',
          otp: '999999', // Wrong OTP
        }),
      ).rejects.toThrow(/Invalid verification code/);

      expect(prisma.profileUpdateVerification.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { attempts: { increment: 1 } },
        }),
      );
    });

    it('should reject expired OTP challenge', async () => {
      prisma.profileUpdateVerification.findFirst.mockResolvedValue({
        id: 'verif-expired',
        userId: mockUserId,
        otpHash: 'hash',
        pendingData: { firstName: 'Johnny' },
        expiresAt: new Date(Date.now() - 1000), // Expired
        attempts: 0,
        maxAttempts: 5,
        usedAt: null,
      });

      await expect(
        profileService.verifyProfileUpdateOtp(mockUserId, {
          verificationId: 'verif-expired',
          otp: '123456',
        }),
      ).rejects.toThrow(/expired/);
    });

    it('should reject already used OTP challenge (prevent replay)', async () => {
      prisma.profileUpdateVerification.findFirst.mockResolvedValue({
        id: 'verif-used',
        userId: mockUserId,
        otpHash: 'hash',
        pendingData: { firstName: 'Johnny' },
        expiresAt: new Date(Date.now() + 60000),
        attempts: 0,
        maxAttempts: 5,
        usedAt: new Date(), // Already used
      });

      await expect(
        profileService.verifyProfileUpdateOtp(mockUserId, {
          verificationId: 'verif-used',
          otp: '123456',
        }),
      ).rejects.toThrow(/already been used/);
    });

    it('should reject direct updateProfile calls without OTP verification', async () => {
      await expect(
        profileService.updateProfile(mockUserId, { firstName: 'Bypasser' }),
      ).rejects.toThrow(/Email OTP verification is required/);
    });
  });

  describe('3. Address CRUD Management', () => {
    const mockAddress = {
      id: 'addr-1',
      customerId: mockCustomerId,
      label: 'Home',
      houseName: 'Flat 304',
      buildingName: 'Skyline Residency',
      street: '5th Main Road',
      area: 'Indiranagar',
      landmark: 'Near Metro',
      city: 'Bengaluru',
      district: 'Bengaluru Urban',
      state: 'Karnataka',
      zipCode: '560038',
      country: 'India',
      isDefault: true,
    };

    beforeEach(() => {
      prisma.customer.findUnique.mockResolvedValue({ id: mockCustomerId });
    });

    it('should create an address and set as default if first address', async () => {
      prisma.address.count.mockResolvedValue(0);
      prisma.address.create.mockResolvedValue(mockAddress);

      const result = await profileService.createAddress(mockUserId, {
        street: '5th Main Road',
        city: 'Bengaluru',
        state: 'Karnataka',
        zipCode: '560038',
      });

      expect(result).toHaveProperty('id', 'addr-1');
      expect(prisma.address.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isDefault: true,
            zipCode: '560038',
          }),
        }),
      );
    });

    it('should reject address creation if pincode is not 6 digits', async () => {
      await expect(
        profileService.createAddress(mockUserId, {
          street: 'Test Street',
          city: 'Bengaluru',
          state: 'Karnataka',
          zipCode: '123',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should update an existing address', async () => {
      prisma.address.findFirst.mockResolvedValue(mockAddress);
      prisma.address.update.mockResolvedValue({ ...mockAddress, houseName: 'Flat 502' });

      const updated = await profileService.updateAddress(mockUserId, 'addr-1', {
        houseName: 'Flat 502',
      });

      expect(updated.houseName).toBe('Flat 502');
      expect(prisma.address.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'addr-1' },
          data: expect.objectContaining({ houseName: 'Flat 502' }),
        }),
      );
    });

    it('should delete an address and promote remaining address to primary if default was deleted', async () => {
      prisma.address.findFirst
        .mockResolvedValueOnce(mockAddress) // existing to delete
        .mockResolvedValueOnce({ id: 'addr-2', customerId: mockCustomerId }); // fallback remaining

      await profileService.deleteAddress(mockUserId, 'addr-1');

      expect(prisma.address.delete).toHaveBeenCalledWith({ where: { id: 'addr-1' } });
      expect(prisma.address.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'addr-2' },
          data: { isDefault: true },
        }),
      );
    });

    it('should set an address as primary default and unset previous default', async () => {
      prisma.address.findFirst.mockResolvedValue(mockAddress);
      prisma.address.update.mockResolvedValue({ ...mockAddress, isDefault: true });

      await profileService.setDefaultAddress(mockUserId, 'addr-1');

      expect(prisma.address.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { customerId: mockCustomerId },
          data: { isDefault: false },
        }),
      );
      expect(prisma.address.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'addr-1' },
          data: { isDefault: true },
        }),
      );
    });
  });

  describe('4. Image Upload & HEIC Conversion Pipeline', () => {
    it('should detect HEIC/HEIF format from extension, mimetype, and magic bytes', () => {
      const heicBuffer = Buffer.alloc(16);
      heicBuffer.writeUInt32BE(16, 0);
      heicBuffer.write('ftyp', 4, 'ascii');
      heicBuffer.write('heic', 8, 'ascii');

      expect(avatarQueue.isHeicBuffer(heicBuffer)).toBe(true);

      const formatFromExt = avatarQueue.detectFormat({
        buffer: Buffer.from('test'),
        originalname: 'photo.HEIC',
        mimetype: 'application/octet-stream',
      } as any);
      expect(formatFromExt).toBe('heic');

      const formatFromMime = avatarQueue.detectFormat({
        buffer: Buffer.from('test'),
        originalname: 'upload',
        mimetype: 'image/heic',
      } as any);
      expect(formatFromMime).toBe('heic');
    });

    it('should detect JPEG, PNG, and WEBP formats properly', () => {
      expect(
        avatarQueue.detectFormat({
          buffer: Buffer.from('test'),
          originalname: 'avatar.jpg',
          mimetype: 'image/jpeg',
        } as any),
      ).toBe('jpeg');

      expect(
        avatarQueue.detectFormat({
          buffer: Buffer.from('test'),
          originalname: 'avatar.png',
          mimetype: 'image/png',
        } as any),
      ).toBe('png');

      expect(
        avatarQueue.detectFormat({
          buffer: Buffer.from('test'),
          originalname: 'avatar.webp',
          mimetype: 'image/webp',
        } as any),
      ).toBe('webp');
    });

    it('should convert and optimize a real PNG/JPEG buffer to progressive JPEG under 1024x1024', async () => {
      const samplePng = await sharp({
        create: {
          width: 1200,
          height: 800,
          channels: 3,
          background: { r: 0, g: 174, b: 239 },
        },
      })
        .png()
        .toBuffer();

      const processedJpeg = await avatarQueue.processToJpeg(samplePng, 'png');
      expect(processedJpeg).toBeInstanceOf(Buffer);

      const meta = await sharp(processedJpeg).metadata();
      expect(meta.format).toBe('jpeg');
      expect(meta.width).toBeLessThanOrEqual(1024);
      expect(meta.height).toBeLessThanOrEqual(1024);
    });

    it('should enqueue avatar upload without blocking and return job details', () => {
      const job = avatarQueue.enqueueAvatarUpload(mockUserId, {
        buffer: Buffer.from('sample-image-data'),
        originalname: 'profile.jpg',
        mimetype: 'image/jpeg',
      } as any);

      expect(job).toHaveProperty('id');
      expect(job.userId).toBe(mockUserId);
      expect(job.status).toBe('PROCESSING');

      const queriedJob = avatarQueue.getJobStatus(job.id, mockUserId);
      expect(queriedJob.id).toBe(job.id);
    });
  });
});
