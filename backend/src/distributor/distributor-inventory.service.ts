import { Prisma } from '@prisma/client';
import { InventoryTransactionsQuery } from './dto/inventory-transactions-query.dto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CloudinaryService,
  type MulterFile,
} from '../config/cloudinary.service';
import { CreateJarItemDto, UpdateJarItemDto } from './dto/distributor-jar-item.dto';

@Injectable()
export class DistributorInventoryService {
  constructor(
    private prisma: PrismaService,
    private storage: CloudinaryService,
  ) {}

  private async profile(userId: string) {
    const distributor = await this.prisma.distributor.findUnique({
      where: { userId },
      select: {
        id: true,
        companyOwnedJars: true,
        distributorOwnedJars: true,
        jarImageUrl: true,
      },
    });
    if (!distributor)
      throw new NotFoundException('Distributor profile not found');
    return distributor;
  }

  private async ensureCompanyItem(distributorId: string, companyOwnedJars: number) {
    if (!this.prisma.jarInventoryItem) return null;
    const existing = await this.prisma.jarInventoryItem.findFirst({
      where: { distributorId, ownershipType: 'COMPANY' },
    });
    if (!existing) {
      return this.prisma.jarInventoryItem.create({
        data: {
          distributorId,
          name: 'Biodrops 20L Water Jar',
          ownershipType: 'COMPANY',
          imageUrl: '/images/biodrops-jar.png',
          ownedQuantity: companyOwnedJars,
          reservedQuantity: 0,
          isActive: true,
        },
      });
    }
    return existing;
  }

  async getInventory(userId: string) {
    const profile = await this.profile(userId);
    const summary = (total: number) => ({
      total,
      available: total === 0 ? 0 : null,
      withCustomers: total === 0 ? 0 : null,
      damaged: total === 0 ? 0 : null,
    });

    // If jarInventoryItem model is available in Prisma client
    if (this.prisma.jarInventoryItem?.findMany) {
      await this.ensureCompanyItem(profile.id, profile.companyOwnedJars);

      const items = await this.prisma.jarInventoryItem.findMany({
        where: { distributorId: profile.id, isActive: true },
        orderBy: [
          { ownershipType: 'asc' }, // 'COMPANY' first, then 'DISTRIBUTOR'
          { createdAt: 'asc' },
        ],
      });

      if (items.length > 0) {
        const companyItem = items.find((i) => i.ownershipType === 'COMPANY');
        const distItems = items.filter((i) => i.ownershipType === 'DISTRIBUTOR');

        const companyTotal = companyItem ? companyItem.ownedQuantity : profile.companyOwnedJars;
        const companyReserved = companyItem ? companyItem.reservedQuantity : 0;
        const companyAvailable = Math.max(0, companyTotal - companyReserved);

        const distTotal = distItems.reduce((sum, i) => sum + i.ownedQuantity, 0);
        const distReserved = distItems.reduce((sum, i) => sum + i.reservedQuantity, 0);
        const distAvailable = Math.max(0, distTotal - distReserved);

        const mappedItems = items.map((i) => ({
          id: i.id,
          name: i.name,
          ownershipType: i.ownershipType,
          imageUrl: i.imageUrl || (i.ownershipType === 'COMPANY' ? '/images/biodrops-jar.png' : null),
          description: i.description,
          ownedQuantity: i.ownedQuantity,
          reservedQuantity: i.reservedQuantity,
          availableQuantity: Math.max(0, i.ownedQuantity - i.reservedQuantity),
          isActive: i.isActive,
          createdAt: i.createdAt,
          updatedAt: i.updatedAt,
        }));

        return {
          total: companyTotal + distTotal,
          companyOwned: {
            total: companyTotal,
            reserved: companyReserved,
            available: companyAvailable,
            withCustomers: null,
            damaged: null,
          },
          distributorOwned: {
            total: distTotal,
            reserved: distReserved,
            available: distAvailable,
            withCustomers: null,
            damaged: null,
            imageUrl: distItems[0]?.imageUrl || profile.jarImageUrl,
          },
          items: mappedItems,
        };
      }
    }

    return {
      total: profile.companyOwnedJars + profile.distributorOwnedJars,
      companyOwned: summary(profile.companyOwnedJars),
      distributorOwned: {
        ...summary(profile.distributorOwnedJars),
        imageUrl: profile.jarImageUrl,
      },
    };
  }

  async getJarItems(userId: string) {
    const profile = await this.profile(userId);
    await this.ensureCompanyItem(profile.id, profile.companyOwnedJars);

    const items = await this.prisma.jarInventoryItem.findMany({
      where: { distributorId: profile.id, isActive: true },
      orderBy: [
        { ownershipType: 'asc' },
        { createdAt: 'asc' },
      ],
    });

    return items.map((i) => ({
      id: i.id,
      name: i.name,
      ownershipType: i.ownershipType,
      imageUrl: i.imageUrl || (i.ownershipType === 'COMPANY' ? '/images/biodrops-jar.png' : null),
      description: i.description,
      ownedQuantity: i.ownedQuantity,
      reservedQuantity: i.reservedQuantity,
      availableQuantity: Math.max(0, i.ownedQuantity - i.reservedQuantity),
      isActive: i.isActive,
      createdAt: i.createdAt,
      updatedAt: i.updatedAt,
    }));
  }

  async createJarItem(
    userId: string,
    file: MulterFile | undefined,
    dto: CreateJarItemDto,
  ) {
    if (!dto.name?.trim()) {
      throw new BadRequestException('Jar name is required');
    }
    const profile = await this.profile(userId);

    if (!file) {
      throw new BadRequestException('Jar image is required');
    }

    const upload = await this.storage.uploadImage(
      file,
      'edrops/distributor-jars',
    );

    const openingStock = Math.max(0, Number(dto.openingQuantity) || 0);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const item = await tx.jarInventoryItem.create({
          data: {
            distributorId: profile.id,
            name: dto.name.trim(),
            ownershipType: 'DISTRIBUTOR',
            imageUrl: upload.secure_url,
            description: dto.description?.trim() || null,
            ownedQuantity: openingStock,
            reservedQuantity: 0,
            isActive: true,
          },
        });

        if (openingStock > 0) {
          await tx.inventoryLog.create({
            data: {
              distributorId: profile.id,
              jarItemId: item.id,
              ownership: 'DISTRIBUTOR_OWNED',
              action: 'OPENING_BALANCE',
              quantity: openingStock,
              balanceAfter: openingStock,
              description: `Opening balance for ${item.name}`,
            },
          });

          await tx.distributor.update({
            where: { id: profile.id },
            data: {
              distributorOwnedJars: { increment: openingStock },
            },
          });
        }

        return {
          ...item,
          availableQuantity: openingStock,
        };
      });
    } catch (error) {
      await this.storage.deleteImage(upload.public_id).catch(() => {});
      throw error;
    }
  }

  async updateJarItem(
    userId: string,
    itemId: string,
    dto: UpdateJarItemDto,
  ) {
    const profile = await this.profile(userId);
    const item = await this.prisma.jarInventoryItem.findFirst({
      where: { id: itemId, distributorId: profile.id },
    });
    if (!item) throw new NotFoundException('Jar item not found');
    if (item.ownershipType === 'COMPANY') {
      throw new BadRequestException('Company owned item cannot be modified');
    }

    const data: Prisma.JarInventoryItemUpdateInput = {};
    if (dto.name?.trim()) data.name = dto.name.trim();
    if (dto.description !== undefined) data.description = dto.description?.trim() || null;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    return this.prisma.jarInventoryItem.update({
      where: { id: itemId },
      data,
    });
  }

  async uploadJarItemImage(
    userId: string,
    itemId: string,
    file: MulterFile,
  ) {
    const profile = await this.profile(userId);
    const item = await this.prisma.jarInventoryItem.findFirst({
      where: { id: itemId, distributorId: profile.id },
    });
    if (!item) throw new NotFoundException('Jar item not found');
    if (item.ownershipType === 'COMPANY') {
      throw new BadRequestException('Company owned jar image cannot be modified');
    }

    const upload = await this.storage.uploadImage(
      file,
      'edrops/distributor-jars',
    );
    try {
      return await this.prisma.jarInventoryItem.update({
        where: { id: itemId },
        data: { imageUrl: upload.secure_url },
      });
    } catch (error) {
      await this.storage.deleteImage(upload.public_id).catch(() => {});
      throw error;
    }
  }

  async getTransactions(userId: string, query: InventoryTransactionsQuery) {
    if (query.from && query.to && query.from > query.to) {
      throw new BadRequestException('Start date must be on or before end date');
    }
    // Scope through the authenticated user's Distributor relation; never accept an ID.
    await this.profile(userId);
    const scope: Prisma.InventoryLogWhereInput = {
      distributor: { userId },
      ...(query.ownership ? { ownership: query.ownership } : {}),
      ...(query.jarItemId ? { jarItemId: query.jarItemId } : {}),
      quantity: { not: null },
      balanceAfter: { not: null },
    };
    const until = query.to ? new Date(query.to + 'T00:00:00.000Z') : undefined;
    if (until) until.setUTCDate(until.getUTCDate() + 1);
    const where: Prisma.InventoryLogWhereInput = {
      ...scope,
      ...(query.type ? { action: query.type } : {}),
      ...(query.from || until
        ? {
            createdAt: {
              ...(query.from
                ? { gte: new Date(query.from + 'T00:00:00.000Z') }
                : {}),
              ...(until ? { lt: until } : {}),
            },
          }
        : {}),
      ...(query.search?.trim()
        ? {
            OR: [
              {
                referenceId: {
                  contains: query.search.trim(),
                  mode: 'insensitive',
                },
              },
              {
                description: {
                  contains: query.search.trim(),
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
    };
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    return this.prisma.$transaction(
      async (tx) => {
        const total = await tx.inventoryLog.count({ where });
        const rows = await tx.inventoryLog.findMany({
          where,
          orderBy: { sequence: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          select: {
            id: true,
            createdAt: true,
            action: true,
            quantity: true,
            balanceAfter: true,
            referenceId: true,
            description: true,
          },
        });
        // Activity follows the filters but excludes the opening snapshot from flow totals.
        const incoming = await tx.inventoryLog.aggregate({
          where: {
            AND: [
              where,
              { action: { not: 'OPENING_BALANCE' }, quantity: { gt: 0 } },
            ],
          },
          _sum: { quantity: true },
        });
        const outgoing = await tx.inventoryLog.aggregate({
          where: {
            AND: [
              where,
              { action: { not: 'OPENING_BALANCE' }, quantity: { lt: 0 } },
            ],
          },
          _sum: { quantity: true },
        });
        const first = await tx.inventoryLog.findFirst({
          where: scope,
          orderBy: { sequence: 'asc' },
          select: { createdAt: true },
        });

        const getActionLabel = (action: string) => {
          switch (action) {
            case 'OPENING_BALANCE':
              return 'Opening balance';
            case 'OUT_FOR_DELIVERY':
              return 'Out for delivery';
            case 'UNDELIVERED_RETURN':
              return 'Undelivered Return';
            case 'ALLOCATION_RELEASED':
            case 'ORDER_CANCELLED':
              return 'Allocation released';
            case 'RETURN':
              return 'Customer return';
            case 'ADJUSTMENT':
              return 'Ownership adjustment';
            default:
              return action.replace(/_/g, ' ');
          }
        };

        return {
          items: rows.map((row) => ({
            ...row,
            label: getActionLabel(row.action),
          })),
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
          incoming: incoming._sum.quantity ?? 0,
          outgoing: Math.abs(outgoing._sum.quantity ?? 0),
          trackingSince: first?.createdAt ?? null,
          types: [
            { value: 'OPENING_BALANCE', label: 'Opening balance' },
            { value: 'OUT_FOR_DELIVERY', label: 'Out for delivery' },
            { value: 'UNDELIVERED_RETURN', label: 'Undelivered Return' },
            { value: 'ALLOCATION_RELEASED', label: 'Allocation released' },
            { value: 'RETURN', label: 'Customer return' },
            { value: 'ADJUSTMENT', label: 'Ownership adjustment' },
          ],
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async uploadImage(userId: string, file: MulterFile) {
    await this.profile(userId);
    const upload = await this.storage.uploadImage(
      file,
      'edrops/distributor-jars',
    );
    try {
      return await this.prisma.distributor.update({
        where: { userId },
        data: { jarImageUrl: upload.secure_url },
        select: { jarImageUrl: true },
      });
    } catch (error) {
      await this.storage.deleteImage(upload.public_id);
      throw error;
    }
  }
}
