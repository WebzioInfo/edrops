import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService, MulterFile } from '../config/cloudinary.service';
import { AvatarProcessingQueueService } from './avatar-processing-queue.service';
import { UpdateProfileDto, ProfileAddressDto, UpdateProfileAddressDto } from './dto/profile.dto';
import { normalizePhoneNumber, isValidPhoneNumber } from '../common/phone-utils';

@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name);

  constructor(
    private prisma: PrismaService,
    private cloudinaryService: CloudinaryService,
    private avatarQueue: AvatarProcessingQueueService,
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

  /**
   * Update personal and role-specific profile details
   */
  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { customer: true, distributor: true },
    });

    if (!user) {
      throw new NotFoundException('User profile not found');
    }

    const userDataToUpdate: any = {};

    if (dto.firstName !== undefined) {
      userDataToUpdate.firstName = dto.firstName.trim();
    }
    if (dto.lastName !== undefined) {
      userDataToUpdate.lastName = dto.lastName.trim();
    }

    // Email check & normalization
    if (dto.email !== undefined) {
      const normalizedEmail = dto.email.trim().toLowerCase();
      if (normalizedEmail !== user.email) {
        const conflict = await this.prisma.user.findFirst({
          where: {
            email: { equals: normalizedEmail, mode: 'insensitive' },
            NOT: { id: userId },
          },
        });
        if (conflict) {
          throw new ConflictException('This email address is already in use by another account');
        }
        userDataToUpdate.email = normalizedEmail;
      }
    }

    // Phone check & normalization
    if (dto.phone !== undefined) {
      const rawPhone = dto.phone.trim();
      if (!isValidPhoneNumber(rawPhone)) {
        throw new BadRequestException('Invalid phone number format. Please provide a valid 10-digit mobile number.');
      }
      const canonicalPhone = normalizePhoneNumber(rawPhone);
      if (!canonicalPhone) {
        throw new BadRequestException('Invalid phone number format.');
      }
      if (canonicalPhone !== user.phone) {
        const conflict = await this.prisma.user.findFirst({
          where: {
            phone: canonicalPhone,
            NOT: { id: userId },
          },
        });
        if (conflict) {
          throw new ConflictException('This phone number is already registered to another account');
        }
        userDataToUpdate.phone = canonicalPhone;
      }
    }

    // Update user base record
    if (Object.keys(userDataToUpdate).length > 0) {
      await this.prisma.user.update({
        where: { id: userId },
        data: userDataToUpdate,
      });
    }

    // Role-specific: Customer updates
    if (dto.customerType || dto.companyName !== undefined || dto.gstNumber !== undefined) {
      const customerId = await this.getOrCreateCustomerId(userId);
      const customerData: any = {};
      if (dto.customerType) customerData.customerType = dto.customerType;
      if (dto.companyName !== undefined) customerData.companyName = dto.companyName.trim() || null;
      if (dto.gstNumber !== undefined) customerData.gstNumber = dto.gstNumber.trim() || null;

      await this.prisma.customer.update({
        where: { id: customerId },
        data: customerData,
      });
    }

    // Role-specific: Distributor updates
    if (
      dto.agencyName !== undefined ||
      dto.address !== undefined ||
      dto.routeOrArea !== undefined ||
      dto.vehicleType !== undefined ||
      dto.vehiclePlate !== undefined
    ) {
      await this.prisma.distributor.upsert({
        where: { userId },
        create: {
          userId,
          referralCode: `EDR-${Math.floor(1000 + Math.random() * 9000)}`,
          agencyName: dto.agencyName?.trim() || null,
          address: dto.address?.trim() || null,
          routeOrArea: dto.routeOrArea?.trim() || null,
          vehicleType: dto.vehicleType?.trim() || null,
          vehiclePlate: dto.vehiclePlate?.trim() || null,
        },
        update: {
          agencyName: dto.agencyName !== undefined ? dto.agencyName.trim() || null : undefined,
          address: dto.address !== undefined ? dto.address.trim() || null : undefined,
          routeOrArea: dto.routeOrArea !== undefined ? dto.routeOrArea.trim() || null : undefined,
          vehicleType: dto.vehicleType !== undefined ? dto.vehicleType.trim() || null : undefined,
          vehiclePlate: dto.vehiclePlate !== undefined ? dto.vehiclePlate.trim() || null : undefined,
        },
      });
    }

    return this.getProfile(userId);
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
