import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  TransferStockDto,
  ReturnStockDto,
  AdjustDistributorStockDto,
  AdjustCompanyStockDto,
  CentralInventoryMovementQueryDto,
} from './dto/central-inventory.dto';

const jarStateToColumn: Record<string, string> = {
  FILLED_YARD: 'filledYardQuantity',
  EMPTY_YARD: 'emptyYardQuantity',
  CUSTOMER: 'customerQuantity',
  WASHING: 'washingQuantity',
  FILLING: 'fillingQuantity',
  QUARANTINE: 'quarantineQuantity',
  DAMAGED: 'damagedQuantity',
  LOST: 'lostQuantity',
};

@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}

  // =========================================================================
  // EXISTING METHODS (PRESERVED FOR COMPATIBILITY)
  // =========================================================================

  async getStatus() {
    let status = await this.prisma.inventory.findFirst();
    if (!status) {
      status = await this.prisma.inventory.create({
        data: { filledJars: 0, emptyJars: 0, damagedJars: 0 },
      });
    }
    return status;
  }

  async getLogs() {
    return this.prisma.inventoryLog.findMany({
      // Warehouse audit logs
      where: { distributorId: null, ownership: null },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async addProduction(qty: number, userId?: string) {
    if (qty <= 0) throw new BadRequestException('Production quantity must be positive');

    return this.prisma.$transaction(async (tx) => {
      const statusRows = await tx.$queryRawUnsafe<any[]>(
        `SELECT * FROM "Inventory" FOR UPDATE LIMIT 1`,
      );
      let status = statusRows[0];
      if (!status) {
        status = await tx.inventory.create({
          data: { filledJars: 0, emptyJars: 0, damagedJars: 0 },
        });
      }

      if (status.emptyJars < qty) {
        throw new BadRequestException(
          `Insufficient empty jars in warehouse (Available: ${status.emptyJars}, Required: ${qty})`,
        );
      }

      const updated = await tx.inventory.update({
        where: { id: status.id },
        data: {
          filledJars: status.filledJars + qty,
          emptyJars: status.emptyJars - qty,
        },
      });

      const ref = `PROD-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;

      await tx.inventoryLog.create({
        data: {
          action: 'PRODUCTION',
          filledQty: qty,
          emptyQty: -qty,
          balanceAfter: updated.filledJars,
          fromState: 'EMPTY_YARD',
          toState: 'FILLED_YARD',
          referenceId: ref,
          description: `Manufactured ${qty} filled jars from warehouse empty return pool`,
          createdById: userId,
          eventTimestamp: new Date(),
        },
      });

      return updated;
    });
  }

  async addRawStock(qty: number, userId?: string) {
    if (qty <= 0) throw new BadRequestException('Quantity must be positive');

    return this.prisma.$transaction(async (tx) => {
      const statusRows = await tx.$queryRawUnsafe<any[]>(
        `SELECT * FROM "Inventory" FOR UPDATE LIMIT 1`,
      );
      let status = statusRows[0];
      if (!status) {
        status = await tx.inventory.create({
          data: { filledJars: 0, emptyJars: 0, damagedJars: 0 },
        });
      }

      const updated = await tx.inventory.update({
        where: { id: status.id },
        data: {
          filledJars: status.filledJars + qty,
        },
      });

      const ref = `REPL-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;

      await tx.inventoryLog.create({
        data: {
          action: 'REPLENISH',
          filledQty: qty,
          balanceAfter: updated.filledJars,
          fromState: 'EXTERNAL',
          toState: 'FILLED_YARD',
          referenceId: ref,
          description: `Direct replenishment of ${qty} filled jars to warehouse`,
          createdById: userId,
          eventTimestamp: new Date(),
        },
      });

      return updated;
    });
  }

  async reportDamage(qty: number, type: 'FILLED' | 'EMPTY', userId?: string, reason?: string) {
    if (qty <= 0) throw new BadRequestException('Quantity must be positive');

    return this.prisma.$transaction(async (tx) => {
      const statusRows = await tx.$queryRawUnsafe<any[]>(
        `SELECT * FROM "Inventory" FOR UPDATE LIMIT 1`,
      );
      let status = statusRows[0];
      if (!status) {
        status = await tx.inventory.create({
          data: { filledJars: 0, emptyJars: 0, damagedJars: 0 },
        });
      }

      const ref = `DMG-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;

      if (type === 'FILLED') {
        if (status.filledJars < qty) {
          throw new BadRequestException('Insufficient filled jars to report damage');
        }
        const updated = await tx.inventory.update({
          where: { id: status.id },
          data: {
            filledJars: status.filledJars - qty,
            damagedJars: status.damagedJars + qty,
          },
        });
        await tx.inventoryLog.create({
          data: {
            action: 'DAMAGE_REMOVAL',
            filledQty: -qty,
            damagedQty: qty,
            balanceAfter: updated.filledJars,
            fromState: 'FILLED_YARD',
            toState: 'DAMAGED',
            referenceId: ref,
            description: `Reported ${qty} filled jars as damaged/discarded. ${reason ? 'Reason: ' + reason : ''}`,
            createdById: userId,
            eventTimestamp: new Date(),
          },
        });
        return updated;
      } else {
        if (status.emptyJars < qty) {
          throw new BadRequestException('Insufficient empty jars to report damage');
        }
        const updated = await tx.inventory.update({
          where: { id: status.id },
          data: {
            emptyJars: status.emptyJars - qty,
            damagedJars: status.damagedJars + qty,
          },
        });
        await tx.inventoryLog.create({
          data: {
            action: 'DAMAGE_REMOVAL',
            emptyQty: -qty,
            damagedQty: qty,
            balanceAfter: updated.emptyJars,
            fromState: 'EMPTY_YARD',
            toState: 'DAMAGED',
            referenceId: ref,
            description: `Reported ${qty} empty jars as damaged/discarded. ${reason ? 'Reason: ' + reason : ''}`,
            createdById: userId,
            eventTimestamp: new Date(),
          },
        });
        return updated;
      }
    });
  }

  // =========================================================================
  // CENTRAL INVENTORY CONTROL CENTER — BUSINESS METHODS
  // =========================================================================

  private async ensureCompanyJarItem(tx: any, distributorId: string) {
    let item = await tx.jarInventoryItem.findFirst({
      where: { distributorId, ownershipType: 'COMPANY' },
    });
    if (!item) {
      item = await tx.jarInventoryItem.create({
        data: {
          distributorId,
          name: 'Biodrops 20L Water Jar',
          ownershipType: 'COMPANY',
          imageUrl: '/images/biodrops-jar.png',
          ownedQuantity: 0,
          reservedQuantity: 0,
          filledYardQuantity: 0,
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
    return item;
  }

  /**
   * Authoritative Central Dashboard KPI Aggregates
   * Reconciles Company Warehouse Stock + Network Distributor Holdings + Customer Holding
   */
  async getCentralDashboard() {
    const companyStock = await this.getStatus();

    const [jarItems, activeDistributorsCount, products] = await Promise.all([
      this.prisma.jarInventoryItem.findMany({
        where: { isActive: true },
        include: {
          distributor: {
            include: { user: { select: { isActive: true } } },
          },
        },
      }),
      this.prisma.distributor.count({
        where: { user: { isActive: true } },
      }),
      this.prisma.product.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, name: true, price: true, depositAmount: true, isJar: true },
      }),
    ]);

    // Aggregate company-owned jars across all distributors
    const companyJarItems = jarItems.filter((i) => i.ownershipType === 'COMPANY');
    const distJarItems = jarItems.filter((i) => i.ownershipType === 'DISTRIBUTOR');

    const withDistributorsFilled = companyJarItems.reduce((acc, i) => acc + (i.filledYardQuantity || 0), 0);
    const withDistributorsEmpty = companyJarItems.reduce((acc, i) => acc + (i.emptyYardQuantity || 0), 0);
    const customerHolding = companyJarItems.reduce((acc, i) => acc + (i.customerQuantity || 0), 0);
    const distributorDamaged = companyJarItems.reduce((acc, i) => acc + (i.damagedQuantity || 0), 0);
    const totalCompanyWithDistributors = companyJarItems.reduce((acc, i) => acc + (i.ownedQuantity || 0), 0);

    const distributorOwnedAvailable = distJarItems.reduce((acc, i) => acc + (i.filledYardQuantity || 0), 0);
    const distributorOwnedCustomer = distJarItems.reduce((acc, i) => acc + (i.customerQuantity || 0), 0);
    const distributorOwnedTotal = distJarItems.reduce((acc, i) => acc + (i.ownedQuantity || 0), 0);

    const totalCompanyJarsInEcosystem =
      companyStock.filledJars +
      companyStock.emptyJars +
      companyStock.damagedJars +
      totalCompanyWithDistributors;

    const productBreakdown = products.map((prod) => ({
      id: prod.id,
      name: prod.name,
      price: prod.price,
      depositAmount: prod.depositAmount,
      isJar: prod.isJar,
      companyFilled: prod.isJar ? companyStock.filledJars : 0,
      companyEmpty: prod.isJar ? companyStock.emptyJars : 0,
      companyDamaged: prod.isJar ? companyStock.damagedJars : 0,
      withDistributors: prod.isJar ? withDistributorsFilled : 0,
      withCustomers: prod.isJar ? customerHolding : 0,
      distributorEmptyPool: prod.isJar ? withDistributorsEmpty : 0,
    }));

    return {
      companyStock: {
        filledJars: companyStock.filledJars,
        emptyJars: companyStock.emptyJars,
        damagedJars: companyStock.damagedJars,
        total: companyStock.filledJars + companyStock.emptyJars + companyStock.damagedJars,
      },
      networkSummary: {
        availableAtCompany: companyStock.filledJars,
        withDistributors: withDistributorsFilled,
        customerHolding,
        distributorEmptyPool: withDistributorsEmpty,
        companyEmptyPool: companyStock.emptyJars,
        totalEmptyPool: companyStock.emptyJars + withDistributorsEmpty,
        companyDamaged: companyStock.damagedJars,
        distributorDamaged,
        totalDamaged: companyStock.damagedJars + distributorDamaged,
        totalCompanyJarsInEcosystem,
        distributorOwnedTotal,
        distributorOwnedAvailable,
        distributorOwnedCustomer,
        activeDistributorsCount,
      },
      products: productBreakdown,
    };
  }

  /**
   * Retrieves all distributors with full inventory breakdown and real-time ledger stats
   */
  async getDistributorStockList(search?: string) {
    const distributors = await this.prisma.distributor.findMany({
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
            isActive: true,
          },
        },
        jarItems: {
          where: { isActive: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const formatted = distributors.map((d) => {
      const companyItem = d.jarItems.find((i) => i.ownershipType === 'COMPANY');
      const distItems = d.jarItems.filter((i) => i.ownershipType === 'DISTRIBUTOR');

      const companyOwned = {
        available: companyItem?.filledYardQuantity ?? 0,
        empty: companyItem?.emptyYardQuantity ?? 0,
        customerHolding: companyItem?.customerQuantity ?? 0,
        damaged: companyItem?.damagedQuantity ?? 0,
        washing: companyItem?.washingQuantity ?? 0,
        filling: companyItem?.fillingQuantity ?? 0,
        quarantine: companyItem?.quarantineQuantity ?? 0,
        total: companyItem?.ownedQuantity ?? d.companyOwnedJars ?? 0,
      };

      const distributorOwned = {
        available: distItems.reduce((acc, i) => acc + (i.filledYardQuantity || 0), 0),
        empty: distItems.reduce((acc, i) => acc + (i.emptyYardQuantity || 0), 0),
        customerHolding: distItems.reduce((acc, i) => acc + (i.customerQuantity || 0), 0),
        damaged: distItems.reduce((acc, i) => acc + (i.damagedQuantity || 0), 0),
        total: distItems.reduce((acc, i) => acc + (i.ownedQuantity || 0), 0) || d.distributorOwnedJars || 0,
      };

      const fullName = `${d.user.firstName || ''} ${d.user.lastName || ''}`.trim() || 'Distributor';
      const agencyName = d.agencyName || fullName;

      return {
        id: d.id,
        userId: d.userId,
        name: fullName,
        agencyName,
        phone: d.user.phone,
        email: d.user.email,
        referralCode: d.referralCode,
        routeOrArea: d.routeOrArea,
        status: d.user.isActive ? 'ACTIVE' : 'INACTIVE',
        canManufacture: d.canManufacture ?? false,
        jarDepositRate: d.jarDepositRate ?? 150.0,
        pendingSettlementAmount: (companyOwned.total) * (d.jarDepositRate ?? 150.0),
        physicalStock: companyOwned.total + distributorOwned.total,
        companyOwned,
        distributorOwned,
        totalManaged: companyOwned.total + distributorOwned.total,
      };
    });

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      return formatted.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.agencyName.toLowerCase().includes(q) ||
          d.phone.toLowerCase().includes(q) ||
          d.referralCode.toLowerCase().includes(q),
      );
    }

    return formatted;
  }

  /**
   * Retrieves single distributor detail including all jar items and recent transaction history
   */
  async getDistributorDetail(distributorId: string) {
    const distributor = await this.prisma.distributor.findUnique({
      where: { id: distributorId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
            isActive: true,
          },
        },
        jarItems: {
          where: { isActive: true },
        },
      },
    });

    if (!distributor) throw new NotFoundException('Distributor not found');

    const recentLogs = await this.prisma.inventoryLog.findMany({
      where: { distributorId },
      orderBy: { createdAt: 'desc' },
      take: 25,
      include: {
        createdBy: {
          select: { firstName: true, lastName: true, role: true },
        },
      },
    });

    return {
      distributor: {
        id: distributor.id,
        userId: distributor.userId,
        name: `${distributor.user.firstName} ${distributor.user.lastName}`.trim(),
        agencyName: distributor.agencyName || `${distributor.user.firstName} ${distributor.user.lastName}`,
        phone: distributor.user.phone,
        email: distributor.user.email,
        referralCode: distributor.referralCode,
        address: distributor.address,
        routeOrArea: distributor.routeOrArea,
        status: distributor.user.isActive ? 'ACTIVE' : 'INACTIVE',
        canManufacture: distributor.canManufacture ?? false,
        jarDepositRate: distributor.jarDepositRate ?? 150.0,
        companyOwnedJars: distributor.companyOwnedJars ?? 0,
        distributorOwnedJars: distributor.distributorOwnedJars ?? 0,
      },
      jarItems: distributor.jarItems,
      recentMovements: recentLogs.map((l) => ({
        id: l.id,
        sequence: l.sequence,
        action: l.action,
        quantity: l.quantity,
        balanceAfter: l.balanceAfter,
        fromState: l.fromState,
        toState: l.toState,
        referenceId: l.referenceId,
        description: l.description,
        performedBy: l.createdBy ? `${l.createdBy.firstName} ${l.createdBy.lastName}`.trim() : 'System',
        timestamp: l.eventTimestamp || l.createdAt,
      })),
    };
  }

  /**
   * Atomic Company -> Distributor Stock Transfer
   * Deducts company filled stock and increments distributor filled stock in one transaction
   */
  async transferStockToDistributor(dto: TransferStockDto, actingUserId: string) {
    const qty = Math.floor(Number(dto.quantity));
    if (qty <= 0) throw new BadRequestException('Transfer quantity must be at least 1 jar.');

    return this.prisma.$transaction(async (tx) => {
      // 1. Row-lock central company inventory
      const statusRows = await tx.$queryRawUnsafe<any[]>(
        `SELECT * FROM "Inventory" FOR UPDATE LIMIT 1`,
      );
      let companyInv = statusRows[0];
      if (!companyInv) {
        companyInv = await tx.inventory.create({
          data: { filledJars: 0, emptyJars: 0, damagedJars: 0 },
        });
      }

      if (companyInv.filledJars < qty) {
        throw new BadRequestException(
          `Insufficient filled stock at company warehouse. Available: ${companyInv.filledJars}, Requested to transfer: ${qty}`,
        );
      }

      // 2. Fetch distributor and row-lock company jar item
      const distributor = await tx.distributor.findUnique({
        where: { id: dto.distributorId },
        include: { user: true },
      });
      if (!distributor) throw new NotFoundException('Distributor not found.');

      const companyJarItem = await this.ensureCompanyJarItem(tx, distributor.id);

      // 3. Atomically update Company Inventory
      const updatedCompany = await tx.inventory.update({
        where: { id: companyInv.id },
        data: {
          filledJars: companyInv.filledJars - qty,
        },
      });

      // 4. Atomically update Distributor Jar Item and Distributor Profile
      const updatedJarItem = await tx.jarInventoryItem.update({
        where: { id: companyJarItem.id },
        data: {
          filledYardQuantity: { increment: qty },
          ownedQuantity: { increment: qty },
        },
      });

      await tx.distributor.update({
        where: { id: distributor.id },
        data: {
          companyOwnedJars: { increment: qty },
        },
      });

      const ref =
        dto.idempotencyKey ||
        `STK-TRF-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;

      const distLabel = distributor.agencyName || `${distributor.user.firstName} ${distributor.user.lastName}`.trim();

      // 5. Create authoritative ledger entries on both sides
      // Distributor-side ledger log
      await tx.inventoryLog.create({
        data: {
          distributorId: distributor.id,
          ownership: 'COMPANY_OWNED',
          jarItemId: updatedJarItem.id,
          action: 'STOCK_TRANSFER',
          quantity: qty,
          balanceAfter: updatedJarItem.filledYardQuantity,
          fromState: 'COMPANY_WAREHOUSE',
          toState: 'FILLED_YARD',
          referenceId: ref,
          description: `Received ${qty} filled jars transferred from company central stock. ${dto.notes ? 'Notes: ' + dto.notes : ''}`,
          createdById: actingUserId,
          eventTimestamp: new Date(),
        },
      });

      // Company warehouse ledger log
      await tx.inventoryLog.create({
        data: {
          distributorId: null,
          ownership: null,
          action: 'STOCK_TRANSFER',
          filledQty: -qty,
          balanceAfter: updatedCompany.filledJars,
          fromState: 'COMPANY_WAREHOUSE',
          toState: 'FILLED_YARD',
          referenceId: ref,
          description: `Transferred ${qty} filled jars to distributor ${distLabel}. ${dto.notes ? 'Notes: ' + dto.notes : ''}`,
          createdById: actingUserId,
          eventTimestamp: new Date(),
        },
      });

      return {
        success: true,
        referenceId: ref,
        transferredQty: qty,
        companyAvailableAfter: updatedCompany.filledJars,
        distributorAvailableAfter: updatedJarItem.filledYardQuantity,
        distributorAgency: distLabel,
      };
    });
  }

  /**
   * Atomic Distributor -> Company Stock Return
   * Returns empty jars or filled jars from distributor back into company warehouse pool
   */
  async receiveReturnFromDistributor(dto: ReturnStockDto, actingUserId: string) {
    const qty = Math.floor(Number(dto.quantity));
    if (qty <= 0) throw new BadRequestException('Return quantity must be at least 1 jar.');

    return this.prisma.$transaction(async (tx) => {
      const distributor = await tx.distributor.findUnique({
        where: { id: dto.distributorId },
        include: { user: true },
      });
      if (!distributor) throw new NotFoundException('Distributor not found.');

      const companyJarItem = await this.ensureCompanyJarItem(tx, distributor.id);

      const statusRows = await tx.$queryRawUnsafe<any[]>(
        `SELECT * FROM "Inventory" FOR UPDATE LIMIT 1`,
      );
      let companyInv = statusRows[0];
      if (!companyInv) {
        companyInv = await tx.inventory.create({
          data: { filledJars: 0, emptyJars: 0, damagedJars: 0 },
        });
      }

      const distLabel = distributor.agencyName || `${distributor.user.firstName} ${distributor.user.lastName}`.trim();
      const ref =
        dto.idempotencyKey ||
        `STK-RET-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;

      if (dto.stockType === 'EMPTY') {
        if (companyJarItem.emptyYardQuantity < qty) {
          throw new BadRequestException(
            `Insufficient empty jars at distributor yard. Available: ${companyJarItem.emptyYardQuantity}, Requested: ${qty}`,
          );
        }

        const updatedJarItem = await tx.jarInventoryItem.update({
          where: { id: companyJarItem.id },
          data: {
            emptyYardQuantity: { decrement: qty },
            ownedQuantity: { decrement: qty },
          },
        });

        await tx.distributor.update({
          where: { id: distributor.id },
          data: {
            companyOwnedJars: { decrement: qty },
          },
        });

        const updatedCompany = await tx.inventory.update({
          where: { id: companyInv.id },
          data: {
            emptyJars: companyInv.emptyJars + qty,
          },
        });

        // Ledger logs
        await tx.inventoryLog.create({
          data: {
            distributorId: distributor.id,
            ownership: 'COMPANY_OWNED',
            jarItemId: updatedJarItem.id,
            action: 'STOCK_RETURN',
            quantity: -qty,
            balanceAfter: updatedJarItem.emptyYardQuantity,
            fromState: 'EMPTY_YARD',
            toState: 'COMPANY_WAREHOUSE',
            referenceId: ref,
            description: `Returned ${qty} empty jars to central company return pool. ${dto.notes ? 'Notes: ' + dto.notes : ''}`,
            createdById: actingUserId,
            eventTimestamp: new Date(),
          },
        });

        await tx.inventoryLog.create({
          data: {
            distributorId: null,
            ownership: null,
            action: 'STOCK_RETURN',
            emptyQty: qty,
            balanceAfter: updatedCompany.emptyJars,
            fromState: 'EMPTY_YARD',
            toState: 'COMPANY_WAREHOUSE',
            referenceId: ref,
            description: `Received ${qty} empty jars return from distributor ${distLabel}. ${dto.notes ? 'Notes: ' + dto.notes : ''}`,
            createdById: actingUserId,
            eventTimestamp: new Date(),
          },
        });

        return {
          success: true,
          referenceId: ref,
          returnedQty: qty,
          stockType: 'EMPTY',
          companyEmptyAfter: updatedCompany.emptyJars,
          distributorEmptyAfter: updatedJarItem.emptyYardQuantity,
        };
      } else {
        // FILLED RETURN
        if (companyJarItem.filledYardQuantity < qty) {
          throw new BadRequestException(
            `Insufficient filled jars at distributor yard. Available: ${companyJarItem.filledYardQuantity}, Requested: ${qty}`,
          );
        }

        const updatedJarItem = await tx.jarInventoryItem.update({
          where: { id: companyJarItem.id },
          data: {
            filledYardQuantity: { decrement: qty },
            ownedQuantity: { decrement: qty },
          },
        });

        await tx.distributor.update({
          where: { id: distributor.id },
          data: {
            companyOwnedJars: { decrement: qty },
          },
        });

        const updatedCompany = await tx.inventory.update({
          where: { id: companyInv.id },
          data: {
            filledJars: companyInv.filledJars + qty,
          },
        });

        // Ledger logs
        await tx.inventoryLog.create({
          data: {
            distributorId: distributor.id,
            ownership: 'COMPANY_OWNED',
            jarItemId: updatedJarItem.id,
            action: 'STOCK_RETURN',
            quantity: -qty,
            balanceAfter: updatedJarItem.filledYardQuantity,
            fromState: 'FILLED_YARD',
            toState: 'COMPANY_WAREHOUSE',
            referenceId: ref,
            description: `Returned ${qty} filled jars to company warehouse. ${dto.notes ? 'Notes: ' + dto.notes : ''}`,
            createdById: actingUserId,
            eventTimestamp: new Date(),
          },
        });

        await tx.inventoryLog.create({
          data: {
            distributorId: null,
            ownership: null,
            action: 'STOCK_RETURN',
            filledQty: qty,
            balanceAfter: updatedCompany.filledJars,
            fromState: 'FILLED_YARD',
            toState: 'COMPANY_WAREHOUSE',
            referenceId: ref,
            description: `Received ${qty} filled jars return from distributor ${distLabel}. ${dto.notes ? 'Notes: ' + dto.notes : ''}`,
            createdById: actingUserId,
            eventTimestamp: new Date(),
          },
        });

        return {
          success: true,
          referenceId: ref,
          returnedQty: qty,
          stockType: 'FILLED',
          companyFilledAfter: updatedCompany.filledJars,
          distributorFilledAfter: updatedJarItem.filledYardQuantity,
        };
      }
    });
  }

  /**
   * Adjust distributor stock with reason and physical verification audit trail
   */
  async adjustDistributorStock(dto: AdjustDistributorStockDto, actingUserId: string) {
    if (!dto.reason?.trim()) {
      throw new BadRequestException('Adjustment reason is required when correcting inventory.');
    }
    const newQty = Math.floor(Number(dto.newQuantity));
    if (newQty < 0) throw new BadRequestException('Stock quantity cannot be negative.');

    const col = jarStateToColumn[dto.state];
    if (!col) throw new BadRequestException(`Invalid jar physical state: ${dto.state}`);

    return this.prisma.$transaction(async (tx) => {
      const distributor = await tx.distributor.findUnique({
        where: { id: dto.distributorId },
        include: { user: true },
      });
      if (!distributor) throw new NotFoundException('Distributor not found.');

      let jarItem: any = null;
      if (dto.jarItemId) {
        jarItem = await tx.jarInventoryItem.findFirst({
          where: { id: dto.jarItemId, distributorId: distributor.id },
        });
      } else {
        const ownership = dto.ownershipType || 'COMPANY';
        jarItem = await tx.jarInventoryItem.findFirst({
          where: { distributorId: distributor.id, ownershipType: ownership },
        });
        if (!jarItem && ownership === 'COMPANY') {
          jarItem = await this.ensureCompanyJarItem(tx, distributor.id);
        }
      }

      if (!jarItem) throw new NotFoundException('Jar inventory item not found for adjustment.');

      const currentQty = Number(jarItem[col] || 0);
      const delta = newQty - currentQty;

      if (delta === 0) {
        return {
          success: true,
          message: 'No change in quantity.',
          balanceAfter: currentQty,
        };
      }

      const updateData: any = {
        [col]: newQty,
        ownedQuantity: { increment: delta },
      };

      const updatedJarItem = await tx.jarInventoryItem.update({
        where: { id: jarItem.id },
        data: updateData,
      });

      if (jarItem.ownershipType === 'COMPANY') {
        await tx.distributor.update({
          where: { id: distributor.id },
          data: { companyOwnedJars: { increment: delta } },
        });
      } else {
        await tx.distributor.update({
          where: { id: distributor.id },
          data: { distributorOwnedJars: { increment: delta } },
        });
      }

      const ref = `ADJ-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;

      await tx.inventoryLog.create({
        data: {
          distributorId: distributor.id,
          ownership: jarItem.ownershipType === 'COMPANY' ? 'COMPANY_OWNED' : 'DISTRIBUTOR_OWNED',
          jarItemId: jarItem.id,
          action: 'MANUAL_ADJUSTMENT',
          quantity: delta,
          balanceAfter: newQty,
          fromState: 'PHYSICAL_AUDIT',
          toState: dto.state,
          referenceId: ref,
          description: `Adjusted ${dto.state} by ${delta > 0 ? '+' : ''}${delta} jars (From ${currentQty} to ${newQty}). Reason: ${dto.reason.trim()}. ${dto.notes ? 'Notes: ' + dto.notes : ''}`,
          createdById: actingUserId,
          eventTimestamp: new Date(),
        },
      });

      return {
        success: true,
        referenceId: ref,
        previousQuantity: currentQty,
        newQuantity: newQty,
        delta,
        distributorAvailableAfter: updatedJarItem.filledYardQuantity,
      };
    });
  }

  /**
   * Adjust central company warehouse stock with reason and physical verification audit trail
   */
  async adjustCompanyStock(dto: AdjustCompanyStockDto, actingUserId: string) {
    if (!dto.reason?.trim()) {
      throw new BadRequestException('Adjustment reason is required when correcting central inventory.');
    }

    return this.prisma.$transaction(async (tx) => {
      const statusRows = await tx.$queryRawUnsafe<any[]>(
        `SELECT * FROM "Inventory" FOR UPDATE LIMIT 1`,
      );
      let companyInv = statusRows[0];
      if (!companyInv) {
        companyInv = await tx.inventory.create({
          data: { filledJars: 0, emptyJars: 0, damagedJars: 0 },
        });
      }

      const updates: any = {};
      const changes: string[] = [];

      if (dto.filledJars !== undefined && dto.filledJars !== null) {
        const val = Math.floor(Number(dto.filledJars));
        if (val < 0) throw new BadRequestException('Filled jars cannot be negative.');
        const delta = val - companyInv.filledJars;
        if (delta !== 0) {
          updates.filledJars = val;
          changes.push(`Filled: ${companyInv.filledJars} -> ${val} (${delta > 0 ? '+' : ''}${delta})`);
        }
      }

      if (dto.emptyJars !== undefined && dto.emptyJars !== null) {
        const val = Math.floor(Number(dto.emptyJars));
        if (val < 0) throw new BadRequestException('Empty jars cannot be negative.');
        const delta = val - companyInv.emptyJars;
        if (delta !== 0) {
          updates.emptyJars = val;
          changes.push(`Empty: ${companyInv.emptyJars} -> ${val} (${delta > 0 ? '+' : ''}${delta})`);
        }
      }

      if (dto.damagedJars !== undefined && dto.damagedJars !== null) {
        const val = Math.floor(Number(dto.damagedJars));
        if (val < 0) throw new BadRequestException('Damaged jars cannot be negative.');
        const delta = val - companyInv.damagedJars;
        if (delta !== 0) {
          updates.damagedJars = val;
          changes.push(`Damaged: ${companyInv.damagedJars} -> ${val} (${delta > 0 ? '+' : ''}${delta})`);
        }
      }

      if (Object.keys(updates).length === 0) {
        return {
          success: true,
          message: 'No changes submitted.',
          currentStock: companyInv,
        };
      }

      const updated = await tx.inventory.update({
        where: { id: companyInv.id },
        data: updates,
      });

      const ref = `ADJ-CENTRAL-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;

      await tx.inventoryLog.create({
        data: {
          distributorId: null,
          ownership: null,
          action: 'MANUAL_ADJUSTMENT',
          balanceAfter: updated.filledJars,
          fromState: 'PHYSICAL_AUDIT',
          toState: 'CENTRAL_WAREHOUSE',
          referenceId: ref,
          description: `Company inventory adjustment: ${changes.join(', ')}. Reason: ${dto.reason.trim()}. ${dto.notes ? 'Notes: ' + dto.notes : ''}`,
          createdById: actingUserId,
          eventTimestamp: new Date(),
        },
      });

      return {
        success: true,
        referenceId: ref,
        updatedStock: updated,
      };
    });
  }

  /**
   * Searchable and paginated movement history for Central Inventory
   */
  async getMovementHistory(query: CentralInventoryMovementQueryDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(5, Number(query.limit) || 30));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.distributorId) {
      if (query.distributorId === 'COMPANY') {
        where.distributorId = null;
      } else {
        where.distributorId = query.distributorId;
      }
    }

    if (query.action && query.action !== 'ALL') {
      where.action = query.action;
    }

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) {
        where.createdAt.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        const end = new Date(query.endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    if (query.search && query.search.trim()) {
      const q = query.search.trim();
      where.OR = [
        { referenceId: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { action: { contains: q, mode: 'insensitive' } },
        { distributor: { agencyName: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [total, logs] = await Promise.all([
      this.prisma.inventoryLog.count({ where }),
      this.prisma.inventoryLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          distributor: {
            include: {
              user: { select: { firstName: true, lastName: true, phone: true } },
            },
          },
          jarItem: {
            select: { name: true, ownershipType: true },
          },
          createdBy: {
            select: { firstName: true, lastName: true, role: true },
          },
        },
      }),
    ]);

    const formattedMovements = logs.map((l) => {
      const distName = l.distributor
        ? l.distributor.agencyName || `${l.distributor.user.firstName} ${l.distributor.user.lastName}`.trim()
        : 'Company Central Warehouse';

      const performedBy = l.createdBy
        ? `${l.createdBy.firstName} ${l.createdBy.lastName}`.trim()
        : 'System';

      const productName = l.jarItem?.name || 'Biodrops 20L Water Jar';

      return {
        id: l.id,
        sequence: l.sequence,
        action: l.action,
        productName,
        distributorId: l.distributorId,
        distributorName: distName,
        fromState: l.fromState || 'EXTERNAL',
        toState: l.toState || (l.distributorId ? 'FILLED_YARD' : 'COMPANY_WAREHOUSE'),
        quantity: l.quantity !== null && l.quantity !== undefined ? l.quantity : l.filledQty || l.emptyQty || 0,
        balanceAfter: l.balanceAfter,
        referenceId: l.referenceId || `LOG-${l.sequence}`,
        description: l.description,
        performedBy,
        timestamp: l.eventTimestamp || l.createdAt,
      };
    });

    return {
      movements: formattedMovements,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
