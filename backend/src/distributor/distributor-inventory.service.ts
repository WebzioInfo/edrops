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
import {
  MoveJarStateDto,
  AdjustJarStockDto,
  CustomerJarReturnDto,
  JarPhysicalState,
} from './dto/distributor-inventory-actions.dto';

const stateToColumnMap: Record<JarPhysicalState, keyof Prisma.JarInventoryItemUpdateInput> = {
  [JarPhysicalState.FILLED_YARD]: 'filledYardQuantity',
  [JarPhysicalState.EMPTY_YARD]: 'emptyYardQuantity',
  [JarPhysicalState.CUSTOMER]: 'customerQuantity',
  [JarPhysicalState.WASHING]: 'washingQuantity',
  [JarPhysicalState.FILLING]: 'fillingQuantity',
  [JarPhysicalState.QUARANTINE]: 'quarantineQuantity',
  [JarPhysicalState.DAMAGED]: 'damagedQuantity',
  [JarPhysicalState.LOST]: 'lostQuantity',
};

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
          filledYardQuantity: companyOwnedJars,
          emptyYardQuantity: 0,
          customerQuantity: 0,
          washingQuantity: 0,
          fillingQuantity: 0,
          quarantineQuantity: 0,
          damagedQuantity: 0,
          lostQuantity: 0,
          isActive: true,
        },
      });
    }

    // Auto-reconcile company item if total states don't equal ownedQuantity
    const totalBreakdown =
      existing.filledYardQuantity +
      existing.emptyYardQuantity +
      existing.customerQuantity +
      existing.washingQuantity +
      existing.fillingQuantity +
      existing.quarantineQuantity +
      existing.damagedQuantity +
      existing.lostQuantity;

    if (totalBreakdown !== existing.ownedQuantity) {
      const diff = existing.ownedQuantity - (
        existing.emptyYardQuantity +
        existing.customerQuantity +
        existing.washingQuantity +
        existing.fillingQuantity +
        existing.quarantineQuantity +
        existing.damagedQuantity +
        existing.lostQuantity
      );
      return this.prisma.jarInventoryItem.update({
        where: { id: existing.id },
        data: { filledYardQuantity: Math.max(0, diff) },
      });
    }

    return existing;
  }

  async getInventory(userId: string) {
    const profile = await this.profile(userId);

    if (!this.prisma.jarInventoryItem?.findMany) {
      const summary = (total: number) => ({
        total,
        available: total === 0 ? 0 : null,
        withCustomers: total === 0 ? 0 : null,
        damaged: total === 0 ? 0 : null,
      });
      return {
        total: profile.companyOwnedJars + profile.distributorOwnedJars,
        companyOwned: summary(profile.companyOwnedJars),
        distributorOwned: {
          ...summary(profile.distributorOwnedJars),
          imageUrl: profile.jarImageUrl,
        },
      };
    }

    await this.ensureCompanyItem(profile.id, profile.companyOwnedJars);

    const items = await this.prisma.jarInventoryItem.findMany({
      where: { distributorId: profile.id, isActive: true },
      orderBy: [
        { ownershipType: 'asc' }, // 'COMPANY' first, then 'DISTRIBUTOR'
        { createdAt: 'asc' },
      ],
    });

    const companyItem = items.find((i) => i.ownershipType === 'COMPANY');
    const distItems = items.filter((i) => i.ownershipType === 'DISTRIBUTOR');

    const companyTotal = companyItem ? companyItem.ownedQuantity : profile.companyOwnedJars;
    const companyReserved = companyItem ? companyItem.reservedQuantity : 0;
    const companyFilled = companyItem ? companyItem.filledYardQuantity : 0;
    const companyEmpty = companyItem ? companyItem.emptyYardQuantity : 0;
    const companyCustomer = companyItem ? companyItem.customerQuantity : 0;
    const companyWashing = companyItem ? companyItem.washingQuantity : 0;
    const companyFilling = companyItem ? companyItem.fillingQuantity : 0;
    const companyQuarantine = companyItem ? companyItem.quarantineQuantity : 0;
    const companyDamaged = companyItem ? companyItem.damagedQuantity : 0;
    const companyLost = companyItem ? companyItem.lostQuantity : 0;
    const companyAvailable = Math.max(0, companyFilled - companyReserved);
    const companyBreakdownTotal =
      companyFilled +
      companyEmpty +
      companyCustomer +
      companyWashing +
      companyFilling +
      companyQuarantine +
      companyDamaged +
      companyLost;
    const companyVariance = companyTotal - companyBreakdownTotal;

    const distTotal = distItems.reduce((sum, i) => sum + i.ownedQuantity, 0);
    const distReserved = distItems.reduce((sum, i) => sum + i.reservedQuantity, 0);
    const distFilled = distItems.reduce((sum, i) => sum + i.filledYardQuantity, 0);
    const distEmpty = distItems.reduce((sum, i) => sum + i.emptyYardQuantity, 0);
    const distCustomer = distItems.reduce((sum, i) => sum + i.customerQuantity, 0);
    const distWashing = distItems.reduce((sum, i) => sum + i.washingQuantity, 0);
    const distFilling = distItems.reduce((sum, i) => sum + i.fillingQuantity, 0);
    const distQuarantine = distItems.reduce((sum, i) => sum + i.quarantineQuantity, 0);
    const distDamaged = distItems.reduce((sum, i) => sum + i.damagedQuantity, 0);
    const distLost = distItems.reduce((sum, i) => sum + i.lostQuantity, 0);
    const distAvailable = Math.max(0, distFilled - distReserved);
    const distBreakdownTotal =
      distFilled +
      distEmpty +
      distCustomer +
      distWashing +
      distFilling +
      distQuarantine +
      distDamaged +
      distLost;
    const distVariance = distTotal - distBreakdownTotal;

    const mappedItems = items.map((i) => {
      const itemBreakdownTotal =
        i.filledYardQuantity +
        i.emptyYardQuantity +
        i.customerQuantity +
        i.washingQuantity +
        i.fillingQuantity +
        i.quarantineQuantity +
        i.damagedQuantity +
        i.lostQuantity;
      return {
        id: i.id,
        name: i.name,
        ownershipType: i.ownershipType,
        imageUrl: i.imageUrl || (i.ownershipType === 'COMPANY' ? '/images/biodrops-jar.png' : null),
        description: i.description,
        ownedQuantity: i.ownedQuantity,
        reservedQuantity: i.reservedQuantity,
        availableQuantity: Math.max(0, i.filledYardQuantity - i.reservedQuantity),
        filledYardQuantity: i.filledYardQuantity,
        emptyYardQuantity: i.emptyYardQuantity,
        customerQuantity: i.customerQuantity,
        washingQuantity: i.washingQuantity,
        fillingQuantity: i.fillingQuantity,
        quarantineQuantity: i.quarantineQuantity,
        damagedQuantity: i.damagedQuantity,
        lostQuantity: i.lostQuantity,
        breakdownTotal: itemBreakdownTotal,
        variance: i.ownedQuantity - itemBreakdownTotal,
        isActive: i.isActive,
        createdAt: i.createdAt,
        updatedAt: i.updatedAt,
      };
    });

    const totalOwned = companyTotal + distTotal;
    const totalPhysical = companyBreakdownTotal + distBreakdownTotal;
    const totalVariance = totalOwned - totalPhysical;

    return {
      total: totalOwned,
      available: companyAvailable + distAvailable,
      companyOwned: {
        total: companyTotal,
        reserved: companyReserved,
        available: companyAvailable,
        breakdown: {
          filledYard: companyFilled,
          emptyYard: companyEmpty,
          withCustomers: companyCustomer,
          washing: companyWashing,
          filling: companyFilling,
          quarantine: companyQuarantine,
          damaged: companyDamaged,
          lost: companyLost,
          total: companyBreakdownTotal,
          variance: companyVariance,
        },
        withCustomers: companyCustomer,
        damaged: companyDamaged,
      },
      distributorOwned: {
        total: distTotal,
        reserved: distReserved,
        available: distAvailable,
        imageUrl: distItems[0]?.imageUrl || profile.jarImageUrl,
        breakdown: {
          filledYard: distFilled,
          emptyYard: distEmpty,
          withCustomers: distCustomer,
          washing: distWashing,
          filling: distFilling,
          quarantine: distQuarantine,
          damaged: distDamaged,
          lost: distLost,
          total: distBreakdownTotal,
          variance: distVariance,
        },
        withCustomers: distCustomer,
        damaged: distDamaged,
      },
      reconciliation: {
        status: totalVariance === 0 ? 'HEALTHY' : 'DISCREPANCY',
        totalOwned,
        totalPhysical,
        variance: totalVariance,
      },
      items: mappedItems,
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
      availableQuantity: Math.max(0, i.filledYardQuantity - i.reservedQuantity),
      filledYardQuantity: i.filledYardQuantity,
      emptyYardQuantity: i.emptyYardQuantity,
      customerQuantity: i.customerQuantity,
      washingQuantity: i.washingQuantity,
      fillingQuantity: i.fillingQuantity,
      quarantineQuantity: i.quarantineQuantity,
      damagedQuantity: i.damagedQuantity,
      lostQuantity: i.lostQuantity,
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
            filledYardQuantity: openingStock,
            emptyYardQuantity: 0,
            customerQuantity: 0,
            washingQuantity: 0,
            fillingQuantity: 0,
            quarantineQuantity: 0,
            damagedQuantity: 0,
            lostQuantity: 0,
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
              fromState: 'EXTERNAL',
              toState: 'FILLED_YARD',
              quantity: openingStock,
              balanceAfter: openingStock,
              description: `Opening balance for ${item.name}`,
              createdById: userId,
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

  async moveJarState(userId: string, dto: MoveJarStateDto) {
    if (!dto.quantity || dto.quantity <= 0 || !Number.isInteger(Number(dto.quantity))) {
      throw new BadRequestException('Quantity must be a positive integer');
    }
    if (dto.fromState === dto.toState) {
      throw new BadRequestException('Source and destination states must be different');
    }

    const profile = await this.profile(userId);
    const fromCol = stateToColumnMap[dto.fromState];
    const toCol = stateToColumnMap[dto.toState];

    if (!fromCol || !toCol) {
      throw new BadRequestException('Invalid state specified');
    }

    return this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`
          SELECT "id" FROM "jar_inventory_items"
          WHERE "id" = ${dto.jarItemId} AND "distributorId" = ${profile.id}
          FOR UPDATE
        `;

        const item = await tx.jarInventoryItem.findFirst({
          where: { id: dto.jarItemId, distributorId: profile.id },
        });

        if (!item) {
          throw new NotFoundException('Jar item not found or unauthorized');
        }

        const currentSource = (item as any)[fromCol] as number;

        // Check availability if moving out of filled yard
        if (dto.fromState === JarPhysicalState.FILLED_YARD) {
          const availableInYard = item.filledYardQuantity - item.reservedQuantity;
          if (dto.quantity > availableInYard) {
            throw new BadRequestException(
              `Insufficient unreserved filled jars. Available: ${availableInYard}, Requested: ${dto.quantity} (Reserved: ${item.reservedQuantity})`,
            );
          }
        }

        if (currentSource < dto.quantity) {
          throw new BadRequestException(
            `Insufficient jars in ${dto.fromState.replace(/_/g, ' ')}. Available: ${currentSource}, Requested: ${dto.quantity}`,
          );
        }

        // Atomic physical movement
        const updated = await tx.jarInventoryItem.update({
          where: { id: item.id },
          data: {
            [fromCol]: { decrement: dto.quantity },
            [toCol]: { increment: dto.quantity },
          },
        });

        let action = 'STATE_TRANSITION';
        if (dto.fromState === JarPhysicalState.EMPTY_YARD && dto.toState === JarPhysicalState.WASHING) {
          action = 'JAR_WASHING';
        } else if (dto.fromState === JarPhysicalState.WASHING && dto.toState === JarPhysicalState.FILLING) {
          action = 'JAR_FILLING';
        } else if (dto.fromState === JarPhysicalState.FILLING && dto.toState === JarPhysicalState.FILLED_YARD) {
          action = 'JAR_FILLED';
        } else if (dto.toState === JarPhysicalState.QUARANTINE) {
          action = 'JAR_QUARANTINED';
        } else if (dto.fromState === JarPhysicalState.QUARANTINE) {
          action = 'JAR_RELEASED';
        } else if (dto.toState === JarPhysicalState.DAMAGED) {
          action = 'JAR_DAMAGED';
        }

        const logDesc =
          dto.notes ||
          `${dto.quantity} jars moved from ${dto.fromState.replace(/_/g, ' ')} to ${dto.toState.replace(/_/g, ' ')}${dto.reason ? ` (${dto.reason})` : ''}`;

        await tx.inventoryLog.create({
          data: {
            distributorId: profile.id,
            jarItemId: item.id,
            ownership: item.ownershipType === 'COMPANY' ? 'COMPANY_OWNED' : 'DISTRIBUTOR_OWNED',
            action,
            fromState: dto.fromState,
            toState: dto.toState,
            quantity: dto.quantity,
            balanceAfter: item.ownedQuantity,
            description: logDesc,
            createdById: userId,
          },
        });

        return {
          success: true,
          item: updated,
          movement: {
            from: dto.fromState,
            to: dto.toState,
            quantity: dto.quantity,
            action,
          },
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async customerJarReturn(userId: string, dto: CustomerJarReturnDto) {
    if (!dto.quantity || dto.quantity <= 0 || !Number.isInteger(Number(dto.quantity))) {
      throw new BadRequestException('Return quantity must be a positive integer');
    }
    const profile = await this.profile(userId);

    return this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`
          SELECT "id" FROM "Customer" WHERE "id" = ${dto.customerId} FOR UPDATE
        `;

        const customer = await tx.customer.findUnique({
          where: { id: dto.customerId },
          include: { user: { select: { firstName: true, lastName: true } } },
        });

        if (!customer) {
          throw new NotFoundException('Customer not found');
        }

        if (customer.jarsAtCustomer < dto.quantity) {
          throw new BadRequestException(
            `Customer currently holds only ${customer.jarsAtCustomer} jar(s). Cannot return ${dto.quantity} jars.`,
          );
        }

        await tx.$executeRaw`
          SELECT "id" FROM "jar_inventory_items"
          WHERE "id" = ${dto.jarItemId} AND "distributorId" = ${profile.id}
          FOR UPDATE
        `;

        const item = await tx.jarInventoryItem.findFirst({
          where: { id: dto.jarItemId, distributorId: profile.id },
        });

        if (!item) {
          throw new NotFoundException('Jar item not found or unauthorized');
        }

        const updatedItem = await tx.jarInventoryItem.update({
          where: { id: item.id },
          data: {
            customerQuantity: { decrement: dto.quantity },
            emptyYardQuantity: { increment: dto.quantity },
          },
        });

        const updatedCustomer = await tx.customer.update({
          where: { id: customer.id },
          data: {
            jarsAtCustomer: { decrement: dto.quantity },
          },
        });

        const orderRef = `RET-${Date.now().toString(36).toUpperCase()}`;
        const custName = customer.user ? `${customer.user.firstName} ${customer.user.lastName}`.trim() : 'Customer';

        await tx.inventoryLog.create({
          data: {
            distributorId: profile.id,
            jarItemId: item.id,
            customerId: customer.id,
            ownership: item.ownershipType === 'COMPANY' ? 'COMPANY_OWNED' : 'DISTRIBUTOR_OWNED',
            action: 'CUSTOMER_RETURN',
            fromState: 'CUSTOMER',
            toState: 'EMPTY_YARD',
            quantity: dto.quantity,
            balanceAfter: item.ownedQuantity,
            referenceId: orderRef,
            description: `${dto.quantity} empty jar(s) returned by ${custName}${dto.notes ? ` (${dto.notes})` : ''}`,
            createdById: userId,
          },
        });

        const depositRefund = dto.quantity * 200;
        await tx.depositTransaction.create({
          data: {
            customerId: customer.id,
            type: 'JAR_RETURNED',
            amount: depositRefund,
            jarsAffected: dto.quantity,
            balanceBefore: 0,
            balanceAfter: 0,
            referenceId: orderRef,
            description: `Deposit credit for ${dto.quantity} returned jar(s)`,
          },
        });

        return {
          success: true,
          returnedQuantity: dto.quantity,
          remainingCustomerJars: updatedCustomer.jarsAtCustomer,
          emptyYardQuantity: updatedItem.emptyYardQuantity,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async adjustJarStock(userId: string, dto: AdjustJarStockDto) {
    if (!dto.reason?.trim()) {
      throw new BadRequestException('Reason is required for manual stock adjustments');
    }
    const profile = await this.profile(userId);
    const col = stateToColumnMap[dto.state];
    if (!col) {
      throw new BadRequestException('Invalid inventory state');
    }

    return this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`
          SELECT "id" FROM "jar_inventory_items"
          WHERE "id" = ${dto.jarItemId} AND "distributorId" = ${profile.id}
          FOR UPDATE
        `;

        const item = await tx.jarInventoryItem.findFirst({
          where: { id: dto.jarItemId, distributorId: profile.id },
        });

        if (!item) throw new NotFoundException('Jar item not found');

        const currentVal = (item as any)[col] as number;
        const delta = Number(dto.quantity);

        if (delta === 0) {
          throw new BadRequestException('Adjustment quantity must be non-zero');
        }

        if (currentVal + delta < 0) {
          throw new BadRequestException(`Cannot adjust below zero. Current ${dto.state}: ${currentVal}`);
        }

        if (dto.isOwnershipChange) {
          if (item.ownedQuantity + delta < 0) {
            throw new BadRequestException('Cannot adjust total ownership below zero');
          }

          const updated = await tx.jarInventoryItem.update({
            where: { id: item.id },
            data: {
              ownedQuantity: { increment: delta },
              [col]: { increment: delta },
            },
          });

          if (item.ownershipType === 'COMPANY') {
            await tx.distributor.update({
              where: { id: profile.id },
              data: { companyOwnedJars: { increment: delta } },
            });
          } else {
            await tx.distributor.update({
              where: { id: profile.id },
              data: { distributorOwnedJars: { increment: delta } },
            });
          }

          await tx.inventoryLog.create({
            data: {
              distributorId: profile.id,
              jarItemId: item.id,
              ownership: item.ownershipType === 'COMPANY' ? 'COMPANY_OWNED' : 'DISTRIBUTOR_OWNED',
              action: 'MANUAL_ADJUSTMENT',
              fromState: delta > 0 ? 'EXTERNAL' : dto.state,
              toState: delta > 0 ? dto.state : 'EXTERNAL',
              quantity: delta,
              balanceAfter: updated.ownedQuantity,
              description: `Ownership adjustment (${delta > 0 ? '+' : ''}${delta}): ${dto.reason}`,
              createdById: userId,
            },
          });

          return { success: true, item: updated };
        } else {
          throw new BadRequestException(
            'Physical movement between states must specify fromState and toState via /move endpoint to preserve ownership reconciliation.',
          );
        }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async getReconciliation(userId: string) {
    const inv = await this.getInventory(userId);
    return {
      reconciliation: inv.reconciliation,
      companyOwned: inv.companyOwned,
      distributorOwned: inv.distributorOwned,
      items: inv.items,
    };
  }

  async getTransactions(userId: string, query: InventoryTransactionsQuery) {
    if (query.from && query.to && query.from > query.to) {
      throw new BadRequestException('Start date must be on or before end date');
    }
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
            fromState: true,
            toState: true,
            orderId: true,
            customerId: true,
          },
        });
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
            case 'CUSTOMER_RETURN':
            case 'RETURN':
              return 'Customer return';
            case 'ADJUSTMENT':
              return 'Ownership adjustment';
            case 'JAR_WASHING':
              return 'Sent to washing';
            case 'JAR_FILLING':
              return 'Sent to filling';
            case 'JAR_FILLED':
              return 'Filled in yard';
            case 'JAR_QUARANTINED':
              return 'Quarantined';
            case 'JAR_RELEASED':
              return 'Released from quarantine';
            case 'JAR_DAMAGED':
              return 'Damaged';
            case 'STATE_TRANSITION':
              return 'State Movement';
            case 'MANUAL_ADJUSTMENT':
              return 'Manual adjustment';
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
            { value: 'CUSTOMER_RETURN', label: 'Customer return' },
            { value: 'JAR_WASHING', label: 'Sent to washing' },
            { value: 'JAR_FILLING', label: 'Sent to filling' },
            { value: 'JAR_FILLED', label: 'Filled in yard' },
            { value: 'JAR_QUARANTINED', label: 'Quarantined' },
            { value: 'JAR_DAMAGED', label: 'Damaged' },
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
