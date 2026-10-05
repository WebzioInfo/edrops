import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { ProfileService } from './profile.service';
import { ProfileController } from './profile.controller';
import { AvatarProcessingQueueService } from './avatar-processing-queue.service';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../config/cloudinary.service';
const sharp = require('sharp');

describe('Profile Module: ProfileService, Address CRUD, and Avatar Queue', () => {
  let profileService: ProfileService;
  let avatarQueue: AvatarProcessingQueueService;
  let prisma: any;
  let cloudinary: any;

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
    };

    cloudinary = {
      uploadImage: jest.fn().mockResolvedValue({
        secure_url: 'https://res.cloudinary.com/demo/image/upload/v1/edrops/avatars/new.jpg',
        public_id: 'edrops/avatars/new',
      }),
      deleteImage: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfileService,
        AvatarProcessingQueueService,
        { provide: PrismaService, useValue: prisma },
        { provide: CloudinaryService, useValue: cloudinary },
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

  describe('2. Profile Update with Email & Phone Normalization', () => {
    it('should update name without changing email or phone', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.user.update.mockResolvedValue({ ...mockUser, firstName: 'Jane' });

      await profileService.updateProfile(mockUserId, { firstName: 'Jane' });
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockUserId },
          data: expect.objectContaining({ firstName: 'Jane' }),
        }),
      );
    });

    it('should normalize and update Indian phone number (+91 canonical)', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.user.findFirst.mockResolvedValue(null); // No collision

      await profileService.updateProfile(mockUserId, { phone: '9812345678' });
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ phone: '+919812345678' }),
        }),
      );
    });

    it('should reject invalid phone numbers', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      await expect(profileService.updateProfile(mockUserId, { phone: '123' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject email if already used by another account', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.user.findFirst.mockResolvedValue({ id: 'other-user', email: 'taken@example.com' });

      await expect(
        profileService.updateProfile(mockUserId, { email: 'taken@example.com' }),
      ).rejects.toThrow(ConflictException);
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
      // Create a simulated ISO BMFF HEIC buffer header
      const heicBuffer = Buffer.alloc(16);
      heicBuffer.writeUInt32BE(16, 0); // box size
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
      // Create a 1200x800 sample PNG buffer using sharp
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

      // Verify dimensions are constrained to max 1024 and format is jpeg
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
