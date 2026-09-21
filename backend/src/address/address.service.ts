import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAddressDto } from './dto/address.dto';

@Injectable()
export class AddressService {
  constructor(private prisma: PrismaService) {}

  async create(customerId: string, createAddressDto: CreateAddressDto) {
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
        zipCode: createAddressDto.zipCode?.trim(),
      },
    });

    if (existing) {
      return this.prisma.address.update({
        where: { id: existing.id },
        data: {
          ...createAddressDto,
          isDefault: createAddressDto.isDefault ?? existing.isDefault,
        },
      });
    }

    return this.prisma.address.create({
      data: {
        customerId,
        ...createAddressDto,
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
