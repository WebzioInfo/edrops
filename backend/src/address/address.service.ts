import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAddressDto } from './dto/address.dto';

export interface ServiceabilityResult {
  deliverable: boolean;
  serviceable: boolean;
  pincode: string;
  city?: string;
  state?: string;
}

@Injectable()
export class AddressService {
  private readonly logger = new Logger(AddressService.name);

  constructor(private prisma: PrismaService) {}

  // ────────────────────────────────────────────────────────────────
  //  DISTRIBUTOR PINCODE SERVICEABILITY ENGINE
  // ────────────────────────────────────────────────────────────────

  /**
   * Check whether a customer's pincode exists in ANY active distributor's
   * configured serviceable pincodes.
   */
  async checkServiceability(pincode: string): Promise<ServiceabilityResult> {
    const normalized = (pincode || '').trim();
    if (!/^\d{6}$/.test(normalized)) {
      throw new BadRequestException('Invalid pincode format — must be 6 digits');
    }

    // Exact database match against all active distributors' configured pincodes
    const match = await this.prisma.distributorPincode.findFirst({
      where: {
        pincode: normalized,
        isActive: true,
        distributor: {
          isActive: true,
        },
      },
      select: {
        location: true,
        district: true,
        state: true,
      },
    });

    if (match) {
      this.logger.log(`Serviceability: pincode=${normalized} matched active distributor pincode`);
      return {
        deliverable: true,
        serviceable: true,
        pincode: normalized,
        city: match.location || match.district || undefined,
        state: match.state || undefined,
      };
    }

    this.logger.log(`Serviceability: pincode=${normalized} not found under any active distributor`);
    return {
      deliverable: false,
      serviceable: false,
      pincode: normalized,
    };
  }

  // ────────────────────────────────────────────────────────────────
  //  ADDRESS CRUD
  // ────────────────────────────────────────────────────────────────

  async create(customerId: string, createAddressDto: CreateAddressDto) {
    // 1. Validate pincode format
    const zipCode = (createAddressDto.zipCode || '').trim();
    if (!/^\d{6}$/.test(zipCode)) {
      throw new BadRequestException('Invalid pincode — must be a 6-digit number');
    }

    // 2. Backend-enforced serviceability check — never trust the client
    const serviceability = await this.checkServiceability(zipCode);
    if (!serviceability.serviceable) {
      throw new BadRequestException("Sorry, we couldn't deliver to this pincode.");
    }

    if (createAddressDto.isDefault) {
      await this.prisma.address.updateMany({
        where: { customerId },
        data: { isDefault: false },
      });
    }

    // Check if duplicate address already exists for customer
    const existing = await this.prisma.address.findFirst({
      where: {
        customerId,
        street: createAddressDto.street?.trim(),
        city: createAddressDto.city?.trim(),
        zipCode,
      },
    });

    if (existing) {
      return this.prisma.address.update({
        where: { id: existing.id },
        data: {
          ...createAddressDto,
          zipCode,
          isDefault: createAddressDto.isDefault ?? existing.isDefault,
        },
      });
    }

    return this.prisma.address.create({
      data: {
        customerId,
        ...createAddressDto,
        zipCode,
      },
    });
  }

  async findAll(customerId: string) {
    const list = await this.prisma.address.findMany({
      where: {
        customerId,
        NOT: {
          label: {
            startsWith: 'Order Delivery Location (',
          },
        },
      },
      orderBy: { isDefault: 'desc' },
    });

    // Fallback: If customer only had snapshot addresses, fetch them
    const sourceList =
      list.length > 0
        ? list
        : await this.prisma.address.findMany({
            where: { customerId },
            orderBy: { isDefault: 'desc' },
          });

    // Deduplicate by ID and address content
    const seenIds = new Set<string>();
    const seenContent = new Set<string>();
    const deduplicated: typeof sourceList = [];

    for (const addr of sourceList) {
      if (!addr || !addr.id || seenIds.has(addr.id)) continue;
      seenIds.add(addr.id);

      const contentKey = `${(addr.street || '').trim().toLowerCase()}_${(addr.city || '').trim().toLowerCase()}_${(addr.zipCode || '').trim()}`;
      if (contentKey && contentKey !== '__' && seenContent.has(contentKey)) {
        continue;
      }
      if (contentKey && contentKey !== '__') {
        seenContent.add(contentKey);
      }

      deduplicated.push(addr);
    }

    return deduplicated;
  }

  async remove(customerId: string, id: string) {
    const address = await this.prisma.address.findFirst({
      where: { id, customerId },
    });
    if (!address) throw new NotFoundException('Address not found');

    return this.prisma.address.delete({ where: { id } });
  }

  async setDefault(customerId: string, id: string) {
    await this.prisma.address.updateMany({
      where: { customerId },
      data: { isDefault: false },
    });

    return this.prisma.address.update({
      where: { id, customerId },
      data: { isDefault: true },
    });
  }
}
