import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { CloudinaryService, MulterFile } from '../config/cloudinary.service';
import { AvatarProcessingQueueService } from './avatar-processing-queue.service';
import {
  UpdateProfileDto,
  RequestProfileUpdateOtpDto,
  VerifyProfileUpdateOtpDto,
  ProfileAddressDto,
  UpdateProfileAddressDto,
} from './dto/profile.dto';
import { normalizePhoneNumber, isValidPhoneNumber } from '../common/phone-utils';

@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name);

  constructor(
    private prisma: PrismaService,
    private cloudinaryService: CloudinaryService,
    private avatarQueue: AvatarProcessingQueueService,
    private mailService: MailService,
  ) {}

  /**
   * Helper to ensure any user has an associated Customer record
   * so they can store and manage structured addresses in the Address table.
   */
  private async getOrCreateCustomerId(userId: string): Promise<string> {
    const existing = await this.prisma.customer.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (existing) return existing.id;

    const newCustomer = await this.prisma.customer.create({
      data: {
        userId,
        customerType: 'RESIDENTIAL',
      },
      select: { id: true },
    });
    return newCustomer.id;
  }

  /**
   * Get full unified profile data for authenticated user
   */
  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        alternatePhone: true,
        role: true,
        avatarUrl: true,
        accountStatus: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        customer: {
          select: {
            id: true,
            referralCode: true,
            customerType: true,
            companyName: true,
            gstNumber: true,
            contactPerson: true,
            businessCategory: true,
            jarsAtCustomer: true,
            wallet: {
              select: {
                balance: true,
              },
            },
            jarBalances: true,
            jarDeposits: true,
            jarOwnerships: {
              include: { brand: true },
            },
            addresses: {
              orderBy: [
                { isDefault: 'desc' },
                { id: 'desc' },
              ],
            },
          },
        },
        staff: {
          select: {
            id: true,
            vehicleType: true,
            vehiclePlate: true,
            branch: {
              select: {
                id: true,
                name: true,
                location: true,
              },
            },
          },
        },
        admin: {
          select: {
            id: true,
            level: true,
          },
        },
        deliveryPartner: {
          select: {
            id: true,
            vehicleType: true,
            vehiclePlate: true,
            jarUnitPrice: true,
          },
        },
        distributor: {
          select: {
            id: true,
            agencyName: true,
            address: true,
            routeOrArea: true,
            vehicleType: true,
            vehiclePlate: true,
            referralCode: true,
            companyOwnedJars: true,
            distributorOwnedJars: true,
            createdAt: true,
            createdBy: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        distributorPincodes: {
          where: { isActive: true },
          select: {
            id: true,
            pincode: true,
            location: true,
            district: true,
            state: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User profile not found');
    }

    if (user.deliveryPartner && user.deliveryPartner.jarUnitPrice !== undefined && user.deliveryPartner.jarUnitPrice !== null) {
      (user.deliveryPartner as any).jarUnitPrice = Number(user.deliveryPartner.jarUnitPrice);
    }

    // Extract addresses cleanly for easy access
    const addresses = user.customer?.addresses || [];

    return {
      ...user,
      addresses,
    };
  }

  maskEmail(email: string): string {
    if (!email || !email.includes('@')) return 'registered email';
    const [name, domain] = email.split('@');
    if (!domain) return 'registered email';
    if (name.length <= 2) {
      return `${name[0]}*@${domain}`;
    }
    return `${name[0]}***${name[name.length - 1]}@${domain}`;
  }

  /**
   * Request an email OTP for profile updates.
   * Compares requested changes with current DB state; if no changes exist, returns noChanges: true.
   * OTP is ALWAYS sent to the currently registered email in the database.
   */
  async requestProfileUpdateOtp(userId: string, dto: RequestProfileUpdateOtpDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        customer: true,
        distributor: true,
        staff: true,
        deliveryPartner: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User profile not found');
    }

    if (!user.email) {
      throw new BadRequestException(
        'No registered email address found for your account. Please contact support.',
      );
    }

    const pendingData: any = {};
    let hasChanges = false;

    // First Name
    if (dto.firstName !== undefined) {
      const cleanFirst = dto.firstName.trim();
      if (!cleanFirst) {
        throw new BadRequestException('First name cannot be empty.');
      }
      if (cleanFirst !== (user.firstName || '')) {
        pendingData.firstName = cleanFirst;
        hasChanges = true;
      }
    }

    // Last Name
    if (dto.lastName !== undefined) {
      const cleanLast = dto.lastName.trim();
      if (!cleanLast) {
        throw new BadRequestException('Last name cannot be empty.');
      }
      if (cleanLast !== (user.lastName || '')) {
        pendingData.lastName = cleanLast;
        hasChanges = true;
      }
    }

    // Email
    if (dto.email !== undefined) {
      const cleanEmail = dto.email.trim().toLowerCase();
      if (cleanEmail && cleanEmail !== (user.email || '').toLowerCase()) {
        const conflict = await this.prisma.user.findFirst({
          where: {
            email: { equals: cleanEmail, mode: 'insensitive' },
            NOT: { id: userId },
          },
        });
        if (conflict) {
          throw new ConflictException('This email address is already in use by another account');
        }
        pendingData.email = cleanEmail;
        hasChanges = true;
      }
    }

    // Phone
    if (dto.phone !== undefined) {
      const rawPhone = dto.phone.trim();
      if (!isValidPhoneNumber(rawPhone)) {
        throw new BadRequestException('Invalid phone number format. Please provide a valid 10-digit mobile number.');
      }
      const canonicalPhone = normalizePhoneNumber(rawPhone);
      if (!canonicalPhone) {
        throw new BadRequestException('Invalid phone number format.');
      }
      if (canonicalPhone !== (user.phone || '')) {
        const conflict = await this.prisma.user.findFirst({
          where: {
            phone: canonicalPhone,
            NOT: { id: userId },
          },
        });
        if (conflict) {
          throw new ConflictException('This phone number is already registered to another account');
        }
        pendingData.phone = canonicalPhone;
        hasChanges = true;
      }
    }

    // Role-specific: Customer fields
    if (dto.customerType !== undefined) {
      const cleanType = dto.customerType.trim();
      if (cleanType && cleanType !== (user.customer?.customerType || '')) {
        pendingData.customerType = cleanType;
        hasChanges = true;
      }
    }
    if (dto.companyName !== undefined) {
      const cleanCompany = dto.companyName.trim();
      if (cleanCompany !== (user.customer?.companyName || '')) {
        pendingData.companyName = cleanCompany || null;
        hasChanges = true;
      }
    }
    if (dto.gstNumber !== undefined) {
      const cleanGst = dto.gstNumber.trim();
      if (cleanGst !== (user.customer?.gstNumber || '')) {
        pendingData.gstNumber = cleanGst || null;
        hasChanges = true;
      }
    }

    // Role-specific: Distributor fields
    if (dto.agencyName !== undefined) {
      const cleanAgency = dto.agencyName.trim();
      if (cleanAgency !== (user.distributor?.agencyName || '')) {
        pendingData.agencyName = cleanAgency || null;
        hasChanges = true;
      }
    }
    if (dto.address !== undefined) {
      const cleanAddr = dto.address.trim();
      if (cleanAddr !== (user.distributor?.address || '')) {
        pendingData.address = cleanAddr || null;
        hasChanges = true;
      }
    }
    if (dto.routeOrArea !== undefined) {
      const cleanRoute = dto.routeOrArea.trim();
      if (cleanRoute !== (user.distributor?.routeOrArea || '')) {
        pendingData.routeOrArea = cleanRoute || null;
        hasChanges = true;
      }
    }
    if (dto.vehicleType !== undefined) {
      const cleanVehType = dto.vehicleType.trim();
      const currentVehType =
        user.distributor?.vehicleType ||
        user.staff?.vehicleType ||
        user.deliveryPartner?.vehicleType ||
        '';
      if (cleanVehType !== currentVehType) {
        pendingData.vehicleType = cleanVehType || null;
        hasChanges = true;
      }
    }
    if (dto.vehiclePlate !== undefined) {
      const cleanVehPlate = dto.vehiclePlate.trim();
      const currentVehPlate =
        user.distributor?.vehiclePlate ||
        user.staff?.vehiclePlate ||
        user.deliveryPartner?.vehiclePlate ||
        '';
      if (cleanVehPlate !== currentVehPlate) {
        pendingData.vehiclePlate = cleanVehPlate || null;
        hasChanges = true;
      }
    }

    if (!hasChanges || Object.keys(pendingData).length === 0) {
      return {
        noChanges: true,
        message: 'No changes detected to update.',
      };
    }

    // Rate-limiting check: 45 seconds cooldown
    const recent = await this.prisma.profileUpdateVerification.findFirst({
      where: {
        userId,
        createdAt: { gt: new Date(Date.now() - 45 * 1000) },
        usedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (recent && recent.expiresAt > new Date()) {
      const secondsLeft = Math.ceil((45 * 1000 - (Date.now() - recent.createdAt.getTime())) / 1000);
      throw new BadRequestException(
        `Please wait ${secondsLeft > 0 ? secondsLeft : 45} seconds before requesting another verification code.`,
      );
    }

    // Invalidate existing unused verifications for this user
    await this.prisma.profileUpdateVerification.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    });

    // Generate cryptographically secure 6-digit OTP
    const rawOtp = crypto.randomInt(100000, 1000000).toString();
    const otpHash = crypto.createHash('sha256').update(rawOtp).digest('hex');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    const verification = await this.prisma.profileUpdateVerification.create({
      data: {
        userId,
        otpHash,
        pendingData,
        expiresAt,
        attempts: 0,
        maxAttempts: 5,
      },
    });

    // Send email to CURRENT registered email
    const emailSent = await this.mailService.sendProfileUpdateOtp(
      { email: user.email, firstName: user.firstName },
      rawOtp,
    );
    if (!emailSent) {
      await this.prisma.profileUpdateVerification.delete({ where: { id: verification.id } }).catch(() => {});
      throw new BadRequestException(
        'Unable to deliver verification code to your registered email. Please try again later.',
      );
    }

    return {
      success: true,
      verificationId: verification.id,
      maskedEmail: this.maskEmail(user.email),
      message: 'Verification code sent to your registered email.',
    };
  }

  /**
   * Verify OTP and atomically apply pending profile updates.
   */
  async verifyProfileUpdateOtp(userId: string, dto: VerifyProfileUpdateOtpDto) {
    if (!dto.verificationId) {
      throw new BadRequestException('Verification ID is required.');
    }
    const cleanOtp = (dto.otp || '').trim();
    if (!cleanOtp || cleanOtp.length !== 6 || !/^\d{6}$/.test(cleanOtp)) {
      throw new BadRequestException('Please enter a valid 6-digit verification code.');
    }

    const verification = await this.prisma.profileUpdateVerification.findFirst({
      where: { id: dto.verificationId, userId },
    });

    if (!verification) {
      throw new NotFoundException('Verification request not found.');
    }

    if (verification.usedAt) {
      throw new BadRequestException('This verification code has already been used.');
    }

    if (verification.expiresAt < new Date()) {
      throw new BadRequestException('Verification code has expired. Please request a new code.');
    }

    if (verification.attempts >= verification.maxAttempts) {
      throw new BadRequestException('Maximum verification attempts reached. Please request a new code.');
    }

    const submittedHash = crypto.createHash('sha256').update(cleanOtp).digest('hex');
    if (submittedHash !== verification.otpHash) {
      const updated = await this.prisma.profileUpdateVerification.update({
        where: { id: verification.id },
        data: { attempts: { increment: 1 } },
      });
      const remaining = updated.maxAttempts - updated.attempts;
      if (remaining <= 0) {
        throw new BadRequestException(
          'Invalid verification code. Maximum attempts reached. Please request a new code.',
        );
      }
      throw new BadRequestException(
        `Invalid verification code. ${remaining} attempt(s) remaining.`,
      );
    }

    const pendingData = verification.pendingData as any;

    // Apply changes in transaction
    await this.prisma.$transaction(async (tx) => {
      // 1. Mark verification as used
      await tx.profileUpdateVerification.update({
        where: { id: verification.id },
        data: { usedAt: new Date() },
      });

      // 2. Re-verify email uniqueness if email changed
      if (pendingData.email) {
        const conflict = await tx.user.findFirst({
          where: {
            email: { equals: pendingData.email, mode: 'insensitive' },
            NOT: { id: userId },
          },
        });
        if (conflict) {
          throw new ConflictException('This email address is already in use by another account');
        }
      }

      // 3. Re-verify phone uniqueness if phone changed
      if (pendingData.phone) {
        const conflict = await tx.user.findFirst({
          where: {
            phone: pendingData.phone,
            NOT: { id: userId },
          },
        });
        if (conflict) {
          throw new ConflictException('This phone number is already registered to another account');
        }
      }

      // 4. Update User base fields
      const userUpdates: any = {};
      if (pendingData.firstName) userUpdates.firstName = pendingData.firstName;
      if (pendingData.lastName) userUpdates.lastName = pendingData.lastName;
      if (pendingData.email) userUpdates.email = pendingData.email;
      if (pendingData.phone) userUpdates.phone = pendingData.phone;

      if (Object.keys(userUpdates).length > 0) {
        await tx.user.update({
          where: { id: userId },
          data: userUpdates,
        });
      }

      // 5. Update Customer fields if applicable
      if (
        pendingData.customerType !== undefined ||
        pendingData.companyName !== undefined ||
        pendingData.gstNumber !== undefined
      ) {
        const customer = await tx.customer.findUnique({ where: { userId } });
        if (customer) {
          const custUpdates: any = {};
          if (pendingData.customerType !== undefined) custUpdates.customerType = pendingData.customerType;
          if (pendingData.companyName !== undefined) custUpdates.companyName = pendingData.companyName;
          if (pendingData.gstNumber !== undefined) custUpdates.gstNumber = pendingData.gstNumber;

          await tx.customer.update({
            where: { id: customer.id },
            data: custUpdates,
          });
        }
      }

      // 6. Update Distributor fields if applicable
      if (
        pendingData.agencyName !== undefined ||
        pendingData.address !== undefined ||
        pendingData.routeOrArea !== undefined ||
        pendingData.vehicleType !== undefined ||
        pendingData.vehiclePlate !== undefined
      ) {
        await tx.distributor.upsert({
          where: { userId },
          create: {
            userId,
            referralCode: `EDR-${Math.floor(1000 + Math.random() * 9000)}`,
            agencyName: pendingData.agencyName || null,
            address: pendingData.address || null,
            routeOrArea: pendingData.routeOrArea || null,
            vehicleType: pendingData.vehicleType || null,
            vehiclePlate: pendingData.vehiclePlate || null,
          },
          update: {
            agencyName: pendingData.agencyName !== undefined ? pendingData.agencyName : undefined,
            address: pendingData.address !== undefined ? pendingData.address : undefined,
            routeOrArea: pendingData.routeOrArea !== undefined ? pendingData.routeOrArea : undefined,
            vehicleType: pendingData.vehicleType !== undefined ? pendingData.vehicleType : undefined,
            vehiclePlate: pendingData.vehiclePlate !== undefined ? pendingData.vehiclePlate : undefined,
          },
        });
      }

      // 7. Update Delivery Partner / Staff fields if applicable
      if (
        pendingData.vehicleType !== undefined ||
        pendingData.vehiclePlate !== undefined
      ) {
        const dp = await tx.deliveryPartner.findUnique({ where: { userId } });
        if (dp) {
          await tx.deliveryPartner.update({
            where: { userId },
            data: {
              vehicleType: pendingData.vehicleType !== undefined ? pendingData.vehicleType : undefined,
              vehiclePlate: pendingData.vehiclePlate !== undefined ? pendingData.vehiclePlate : undefined,
            },
          });
        }
        const staff = await tx.staff.findUnique({ where: { userId } });
        if (staff) {
          await tx.staff.update({
            where: { userId },
            data: {
              vehicleType: pendingData.vehicleType !== undefined ? pendingData.vehicleType : undefined,
              vehiclePlate: pendingData.vehiclePlate !== undefined ? pendingData.vehiclePlate : undefined,
            },
          });
        }
      }

      // 8. Audit log
      await tx.auditLog.create({
        data: {
          userId,
          action: 'PROFILE_UPDATED_WITH_EMAIL_OTP',
          entityType: 'USER',
          entityId: userId,
          newValues: pendingData,
        },
      });
    });

    return this.getProfile(userId);
  }

  /**
   * Update personal and role-specific profile details.
   * Requires valid email OTP verification.
   */
  async updateProfile(userId: string, dto: UpdateProfileDto) {
    if (dto.verificationId && dto.otp) {
      return this.verifyProfileUpdateOtp(userId, {
        verificationId: dto.verificationId,
        otp: dto.otp,
      });
    }

    throw new BadRequestException(
      'Email OTP verification is required to update profile details. Please request a verification code via /profile/request-update-otp.',
    );
  }

  // ────────────────────────────────────────────────────────────────
  //  ADDRESS CRUD
  // ────────────────────────────────────────────────────────────────

  async getAddresses(userId: string) {
    const customerId = await this.getOrCreateCustomerId(userId);
    return this.prisma.address.findMany({
      where: { customerId },
      orderBy: [
        { isDefault: 'desc' },
        { id: 'desc' },
      ],
    });
  }

  async createAddress(userId: string, dto: ProfileAddressDto) {
    const customerId = await this.getOrCreateCustomerId(userId);

    const zipCode = (dto.zipCode || '').trim();
    if (!/^\d{6}$/.test(zipCode)) {
      throw new BadRequestException('Pincode must be exactly 6 digits');
    }

    const count = await this.prisma.address.count({ where: { customerId } });
    const isFirst = count === 0;
    const shouldBeDefault = dto.isDefault || isFirst;

    if (shouldBeDefault) {
      await this.prisma.address.updateMany({
        where: { customerId },
        data: { isDefault: false },
      });
    }

    const created = await this.prisma.address.create({
      data: {
        customerId,
        label: dto.label?.trim() || 'Home',
        fullName: dto.fullName?.trim() || null,
        mobileNumber: dto.mobileNumber?.trim() || null,
        houseName: dto.houseName?.trim() || null,
        buildingName: dto.buildingName?.trim() || null,
        street: dto.street.trim(),
        area: dto.area?.trim() || null,
        landmark: dto.landmark?.trim() || null,
        city: dto.city.trim(),
        district: dto.district?.trim() || null,
        state: dto.state.trim(),
        zipCode,
        country: dto.country?.trim() || 'India',
        isDefault: shouldBeDefault,
        latitude: dto.latitude,
        longitude: dto.longitude,
        googleMapsUrl: dto.googleMapsUrl?.trim() || null,
        addressNotes: dto.addressNotes?.trim() || null,
      },
    });

    return created;
  }

  async updateAddress(userId: string, addressId: string, dto: UpdateProfileAddressDto) {
    const customerId = await this.getOrCreateCustomerId(userId);

    const existing = await this.prisma.address.findFirst({
      where: { id: addressId, customerId },
    });

    if (!existing) {
      throw new NotFoundException('Address not found');
    }

    if (dto.zipCode !== undefined) {
      const zip = dto.zipCode.trim();
      if (!/^\d{6}$/.test(zip)) {
        throw new BadRequestException('Pincode must be exactly 6 digits');
      }
    }

    if (dto.isDefault) {
      await this.prisma.address.updateMany({
        where: { customerId },
        data: { isDefault: false },
      });
    }

    const updated = await this.prisma.address.update({
      where: { id: addressId },
      data: {
        label: dto.label !== undefined ? dto.label.trim() || null : undefined,
        fullName: dto.fullName !== undefined ? dto.fullName.trim() || null : undefined,
        mobileNumber: dto.mobileNumber !== undefined ? dto.mobileNumber.trim() || null : undefined,
        houseName: dto.houseName !== undefined ? dto.houseName.trim() || null : undefined,
        buildingName: dto.buildingName !== undefined ? dto.buildingName.trim() || null : undefined,
        street: dto.street !== undefined ? dto.street.trim() : undefined,
        area: dto.area !== undefined ? dto.area.trim() || null : undefined,
        landmark: dto.landmark !== undefined ? dto.landmark.trim() || null : undefined,
        city: dto.city !== undefined ? dto.city.trim() : undefined,
        district: dto.district !== undefined ? dto.district.trim() || null : undefined,
        state: dto.state !== undefined ? dto.state.trim() : undefined,
        zipCode: dto.zipCode !== undefined ? dto.zipCode.trim() : undefined,
        country: dto.country !== undefined ? dto.country.trim() : undefined,
        isDefault: dto.isDefault !== undefined ? dto.isDefault : undefined,
        latitude: dto.latitude !== undefined ? dto.latitude : undefined,
        longitude: dto.longitude !== undefined ? dto.longitude : undefined,
        googleMapsUrl: dto.googleMapsUrl !== undefined ? dto.googleMapsUrl.trim() || null : undefined,
        addressNotes: dto.addressNotes !== undefined ? dto.addressNotes.trim() || null : undefined,
      },
    });

    return updated;
  }

  async deleteAddress(userId: string, addressId: string) {
    const customerId = await this.getOrCreateCustomerId(userId);

    const existing = await this.prisma.address.findFirst({
      where: { id: addressId, customerId },
    });

    if (!existing) {
      throw new NotFoundException('Address not found');
    }

    await this.prisma.address.delete({
      where: { id: addressId },
    });

    // If deleted address was primary, make the newest address primary if one exists
    if (existing.isDefault) {
      const fallback = await this.prisma.address.findFirst({
        where: { customerId },
        orderBy: { id: 'desc' },
      });
      if (fallback) {
        await this.prisma.address.update({
          where: { id: fallback.id },
          data: { isDefault: true },
        });
      }
    }

    return { success: true, message: 'Address deleted successfully' };
  }

  async setDefaultAddress(userId: string, addressId: string) {
    const customerId = await this.getOrCreateCustomerId(userId);

    const existing = await this.prisma.address.findFirst({
      where: { id: addressId, customerId },
    });

    if (!existing) {
      throw new NotFoundException('Address not found');
    }

    await this.prisma.address.updateMany({
      where: { customerId },
      data: { isDefault: false },
    });

    return this.prisma.address.update({
      where: { id: addressId },
      data: { isDefault: true },
    });
  }

  // ────────────────────────────────────────────────────────────────
  //  AVATAR PROCESSING & MANAGEMENT
  // ────────────────────────────────────────────────────────────────

  uploadAvatar(userId: string, file: MulterFile) {
    return this.avatarQueue.enqueueAvatarUpload(userId, file);
  }

  getAvatarJobStatus(userId: string, jobId: string) {
    return this.avatarQueue.getJobStatus(jobId, userId);
  }

  async removeAvatar(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, avatarUrl: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.avatarUrl) {
      this.cloudinaryService.deleteImage(user.avatarUrl).catch((err) => {
        this.logger.warn(`Failed to delete avatar from Cloudinary (${user.avatarUrl}): ${err.message}`);
      });
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: null },
    });

    return { success: true, avatarUrl: null, message: 'Profile picture removed successfully' };
  }
}
