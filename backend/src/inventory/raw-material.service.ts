import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateRawMaterialDto,
  IssueRawMaterialsDto,
  RecordProductionBatchDto,
  SettleJarsDto,
} from './dto/raw-material.dto';

@Injectable()
export class RawMaterialService {
  constructor(private prisma: PrismaService) {}

  /**
   * Automatically ensure baseline default raw materials exist in the system
   */
  async ensureDefaultMaterials() {
    const defaults = [
      {
        code: 'MAT-PREFORM-20L',
        name: '20L Bottle Preform (Polycarbonate)',
        category: 'PREFORM',
        unit: 'PCS',
        centralStock: 10000,
        reorderLevel: 1000,
        unitCost: 45.0,
      },
      {
        code: 'MAT-CAP-20L',
        name: '20L Jar Non-Spill Smart Cap',
        category: 'CAP',
        unit: 'PCS',
        centralStock: 25000,
        reorderLevel: 2500,
        unitCost: 4.5,
      },
      {
        code: 'MAT-LABEL-20L',
        name: 'Edrops 20L Premium Brand Seal & Label',
        category: 'LABEL',
        unit: 'PCS',
        centralStock: 25000,
        reorderLevel: 2500,
        unitCost: 2.0,
      },
      {
        code: 'MAT-JAR-EMPTY-20L',
        name: '20L Empty Polycarbonate Water Jar (Raw)',
        category: 'EMPTY_JAR',
        unit: 'PCS',
        centralStock: 5000,
        reorderLevel: 500,
        unitCost: 150.0,
      },
    ];

    for (const item of defaults) {
      const existing = await this.prisma.rawMaterialItem.findUnique({
        where: { code: item.code },
      });
      if (!existing) {
        await this.prisma.rawMaterialItem.create({
          data: item,
        });
      }
    }
  }

  /**
   * Get all raw material items with their central stocks and total distributor allocated stock
   */
  async getMaterials() {
    await this.ensureDefaultMaterials();

    const items = await this.prisma.rawMaterialItem.findMany({
      where: { isActive: true },
      include: {
        stocks: {
          select: {
            distributorId: true,
            quantity: true,
          },
        },
      },
      orderBy: { code: 'asc' },
    });

    return items.map((m) => {
      const distributorAllocated = m.stocks.reduce((acc, s) => acc + s.quantity, 0);
      return {
        id: m.id,
        name: m.name,
        code: m.code,
        category: m.category,
        unit: m.unit,
        centralStock: m.centralStock,
        distributorAllocated,
        totalStock: m.centralStock + distributorAllocated,
        reorderLevel: m.reorderLevel,
        unitCost: m.unitCost,
        isActive: m.isActive,
        createdAt: m.createdAt,
      };
    });
  }

  /**
   * Create a new raw material item
   */
  async createMaterial(dto: CreateRawMaterialDto) {
    const existing = await this.prisma.rawMaterialItem.findUnique({
      where: { code: dto.code.trim().toUpperCase() },
    });
    if (existing) {
      throw new ConflictException(`Material with code ${dto.code} already exists`);
    }

    return this.prisma.rawMaterialItem.create({
      data: {
        name: dto.name.trim(),
        code: dto.code.trim().toUpperCase(),
        category: dto.category || 'PACKAGING',
        unit: dto.unit || 'PCS',
        centralStock: dto.centralStock ?? 0,
        reorderLevel: dto.reorderLevel ?? 100,
        unitCost: dto.unitCost ?? 0.0,
        isActive: true,
      },
    });
  }

  /**
   * Get raw material stocks held by a specific distributor
   */
  async getDistributorStock(distributorId: string) {
    await this.ensureDefaultMaterials();

    // Verify distributor exists
    const distributor = await this.prisma.distributor.findFirst({
      where: {
        OR: [{ id: distributorId }, { userId: distributorId }],
      },
      select: {
        id: true,
        agencyName: true,
        canManufacture: true,
        user: { select: { firstName: true, lastName: true } },
      },
    });

    if (!distributor) {
      throw new NotFoundException('Distributor not found');
    }

    const allMaterials = await this.prisma.rawMaterialItem.findMany({
      where: { isActive: true },
      orderBy: { code: 'asc' },
    });

    const distStocks = await this.prisma.distributorRawMaterialStock.findMany({
      where: { distributorId: distributor.id },
    });

    const stockMap = new Map(distStocks.map((s) => [s.materialId, s.quantity]));

    return {
      distributor: {
        id: distributor.id,
        name: distributor.agencyName || `${distributor.user.firstName} ${distributor.user.lastName}`,
        canManufacture: distributor.canManufacture,
      },
      stocks: allMaterials.map((m) => ({
        materialId: m.id,
        name: m.name,
        code: m.code,
        category: m.category,
        unit: m.unit,
        quantity: stockMap.get(m.id) || 0,
      })),
    };
  }

  /**
   * Issue raw materials from Edrops central inventory to a manufacturing distributor
   */
  async issueMaterials(dto: IssueRawMaterialsDto, actingUserId?: string) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('At least one material item must be issued');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Verify distributor and manufacturing permission
      const distributor = await tx.distributor.findFirst({
        where: {
          OR: [{ id: dto.distributorId }, { userId: dto.distributorId }],
        },
        select: {
          id: true,
          agencyName: true,
          canManufacture: true,
          user: { select: { firstName: true, lastName: true } },
        },
      });

      if (!distributor) {
        throw new NotFoundException('Distributor not found');
      }

      if (!distributor.canManufacture) {
        throw new BadRequestException(
          'Selected distributor is not authorized for manufacturing. Enable manufacturing permission first.',
        );
      }

      const issueReference =
        dto.referenceId ||
        `ISSUE-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;

      // 2. Validate and issue each material atomically
      const results: any[] = [];
      for (const item of dto.items) {
        if (item.quantity <= 0) {
          throw new BadRequestException('Issued quantity must be greater than zero');
        }

        // Lock material row
        const rows = await tx.$queryRawUnsafe<any[]>(
          `SELECT "id", "name", "code", "centralStock" FROM "raw_material_items" WHERE "id" = $1 FOR UPDATE`,
          item.materialId,
        );

        if (!rows || rows.length === 0) {
          throw new NotFoundException(`Raw material with ID ${item.materialId} not found`);
        }

        const material = rows[0];
        if (material.centralStock < item.quantity) {
          throw new BadRequestException(
            `Insufficient central stock for ${material.name} (${material.code}). Available: ${material.centralStock}, Requested: ${item.quantity}`,
          );
        }

        // Decrement central stock
        const updatedCentral = await tx.rawMaterialItem.update({
          where: { id: material.id },
          data: {
            centralStock: { decrement: item.quantity },
          },
        });

        // Increment distributor raw material stock
        const distStock = await tx.distributorRawMaterialStock.upsert({
          where: {
            distributorId_materialId: {
              distributorId: distributor.id,
              materialId: material.id,
            },
          },
          create: {
            distributorId: distributor.id,
            materialId: material.id,
            quantity: item.quantity,
          },
          update: {
            quantity: { increment: item.quantity },
          },
        });

        // Create movement ledger entry
        const movement = await tx.rawMaterialMovement.create({
          data: {
            materialId: material.id,
            distributorId: distributor.id,
            type: 'ISSUED_TO_DISTRIBUTOR',
            quantity: item.quantity,
            balanceAfter: distStock.quantity,
            referenceId: issueReference,
            notes: dto.notes || `Issued ${item.quantity} units to distributor ${distributor.agencyName || distributor.id}`,
            createdById: actingUserId || null,
          },
        });

        results.push({
          materialId: material.id,
          name: material.name,
          code: material.code,
          quantityIssued: item.quantity,
          centralStockRemaining: updatedCentral.centralStock,
          distributorHolding: distStock.quantity,
          movementId: movement.id,
        });
      }

      return {
        success: true,
        referenceId: issueReference,
        distributorId: distributor.id,
        itemsIssued: results,
      };
    });
  }

  /**
   * Record a production batch executed by a manufacturing distributor
   */
  async recordProductionBatch(
    distributorIdentifier: string,
    dto: RecordProductionBatchDto,
    actingUserId?: string,
  ) {
    if (dto.outputQuantity <= 0) {
      throw new BadRequestException('Output quantity must be greater than zero');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Verify distributor & manufacturing authorization
      const distributor = await tx.distributor.findFirst({
        where: {
          OR: [{ id: distributorIdentifier }, { userId: distributorIdentifier }],
        },
        select: {
          id: true,
          agencyName: true,
          canManufacture: true,
        },
      });

      if (!distributor) {
        throw new NotFoundException('Distributor not found');
      }

      if (!distributor.canManufacture) {
        throw new ForbiddenException(
          'Distributor is not authorized for manufacturing operations. Batch creation rejected.',
        );
      }

      const batchNumber = `BATCH-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;

      // 2. Consume raw materials if specified
      const consumptionsLog: any[] = [];
      if (dto.consumptions && dto.consumptions.length > 0) {
        for (const c of dto.consumptions) {
          const totalDeduction = c.quantity + (c.wastageQuantity || 0);
          if (totalDeduction <= 0) continue;

          // Lock distributor material stock row
          const rows = await tx.$queryRawUnsafe<any[]>(
            `SELECT "id", "quantity" FROM "distributor_raw_material_stocks" WHERE "distributorId" = $1 AND "materialId" = $2 FOR UPDATE`,
            distributor.id,
            c.materialId,
          );

          if (!rows || rows.length === 0 || rows[0].quantity < totalDeduction) {
            const available = rows && rows.length > 0 ? rows[0].quantity : 0;
            throw new BadRequestException(
              `Insufficient raw material stock to consume. Available: ${available}, Required: ${totalDeduction}`,
            );
          }

          // Decrement stock
          const updatedStock = await tx.distributorRawMaterialStock.update({
            where: {
              distributorId_materialId: {
                distributorId: distributor.id,
                materialId: c.materialId,
              },
            },
            data: {
              quantity: { decrement: totalDeduction },
            },
          });

          // Log movement for consumption
          if (c.quantity > 0) {
            await tx.rawMaterialMovement.create({
              data: {
                materialId: c.materialId,
                distributorId: distributor.id,
                type: 'CONSUMED_IN_PRODUCTION',
                quantity: c.quantity,
                balanceAfter: updatedStock.quantity + (c.wastageQuantity || 0),
                referenceId: batchNumber,
                batchNumber,
                notes: `Consumed ${c.quantity} in production batch ${batchNumber}`,
                createdById: actingUserId || null,
              },
            });
          }

          // Log movement for wastage/reject
          if (c.wastageQuantity && c.wastageQuantity > 0) {
            await tx.rawMaterialMovement.create({
              data: {
                materialId: c.materialId,
                distributorId: distributor.id,
                type: 'WASTAGE_REJECT',
                quantity: c.wastageQuantity,
                balanceAfter: updatedStock.quantity,
                referenceId: batchNumber,
                batchNumber,
                notes: `Scrapped ${c.wastageQuantity} units during batch ${batchNumber}`,
                createdById: actingUserId || null,
              },
            });
          }

          consumptionsLog.push({
            materialId: c.materialId,
            consumed: c.quantity,
            wastage: c.wastageQuantity || 0,
            remainingStock: updatedStock.quantity,
          });
        }
      }

      // 3. Create production batch record
      const batch = await tx.distributorProductionBatch.create({
        data: {
          batchNumber,
          distributorId: distributor.id,
          outputQuantity: dto.outputQuantity,
          rejectedQuantity: dto.rejectedQuantity || 0,
          status: 'COMPLETED',
          consumptions: consumptionsLog,
          notes: dto.notes || `Manufactured ${dto.outputQuantity} jars (Rejects: ${dto.rejectedQuantity || 0})`,
          createdById: actingUserId || null,
        },
      });

      return {
        success: true,
        batch,
      };
    });
  }

  /**
   * Get production batches for a distributor or globally
   */
  async getProductionBatches(distributorIdentifier?: string) {
    const where: any = {};
    if (distributorIdentifier) {
      const dist = await this.prisma.distributor.findFirst({
        where: {
          OR: [{ id: distributorIdentifier }, { userId: distributorIdentifier }],
        },
        select: { id: true },
      });
      if (dist) where.distributorId = dist.id;
    }

    return this.prisma.distributorProductionBatch.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        distributor: {
          select: {
            id: true,
            agencyName: true,
            user: { select: { firstName: true, lastName: true } },
          },
        },
        createdBy: {
          select: { firstName: true, lastName: true, role: true },
        },
      },
    });
  }

  /**
   * Get raw material movement ledger entries
   */
  async getMovements(distributorIdentifier?: string) {
    const where: any = {};
    if (distributorIdentifier) {
      const dist = await this.prisma.distributor.findFirst({
        where: {
          OR: [{ id: distributorIdentifier }, { userId: distributorIdentifier }],
        },
        select: { id: true },
      });
      if (dist) where.distributorId = dist.id;
    }

    return this.prisma.rawMaterialMovement.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        material: { select: { name: true, code: true, unit: true } },
        distributor: {
          select: {
            id: true,
            agencyName: true,
            user: { select: { firstName: true, lastName: true } },
          },
        },
        createdBy: {
          select: { firstName: true, lastName: true, role: true },
        },
      },
    });
  }

  /**
   * SETTLEMENT: Transfer Jar Ownership from Edrops-Owned to Distributor-Owned
   * 
   * CORE INVARIANT:
   * Total Physical Jars = Company Owned + Distributor Owned.
   * Settlement DOES NOT CREATE OR DESTROY PHYSICAL JARS.
   * It transfers N jars from company ownership to distributor ownership.
   */
  async settleJars(
    distributorIdentifier: string,
    dto: SettleJarsDto,
    actingUserId?: string,
  ) {
    if (dto.jarsToSettle <= 0) {
      throw new BadRequestException('Settlement quantity must be greater than zero');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Lock distributor record for concurrency control
      const distLookup = await tx.distributor.findFirst({
        where: {
          OR: [{ id: distributorIdentifier }, { userId: distributorIdentifier }],
        },
        select: { id: true },
      });

      if (!distLookup) {
        throw new NotFoundException('Distributor not found');
      }

      const rows = await tx.$queryRawUnsafe<any[]>(
        `SELECT "id", "companyOwnedJars", "distributorOwnedJars", "jarDepositRate"
         FROM "Distributor"
         WHERE "id" = $1
         FOR UPDATE`,
        distLookup.id,
      );

      if (!rows || rows.length === 0) {
        throw new NotFoundException('Distributor not found');
      }

      const dist = rows[0];
      const companyBefore = Number(dist.companyOwnedJars || 0);
      const distributorBefore = Number(dist.distributorOwnedJars || 0);
      const physicalJarsTotal = companyBefore + distributorBefore;

      // 2. Validate eligible company-owned jars
      if (companyBefore < dto.jarsToSettle) {
        throw new BadRequestException(
          `Insufficient company-owned jars to settle. Outstanding: ${companyBefore}, Requested: ${dto.jarsToSettle}`,
        );
      }

      // Check idempotency if payment reference is provided
      if (dto.paymentReference) {
        const existingSettlement = await tx.distributorJarSettlement.findFirst({
          where: {
            distributorId: dist.id,
            paymentReference: dto.paymentReference.trim(),
          },
        });
        if (existingSettlement) {
          return {
            success: true,
            settlement: existingSettlement,
            message: 'Settlement already recorded for this payment reference (idempotent)',
            companyJarsBefore: existingSettlement.companyJarsBefore,
            companyJarsAfter: existingSettlement.companyJarsAfter,
            distributorJarsBefore: existingSettlement.distributorJarsBefore,
            distributorJarsAfter: existingSettlement.distributorJarsAfter,
            physicalJarsTotal: existingSettlement.physicalJarsTotal,
          };
        }
      }

      const unitPrice = dto.unitPrice ?? Number(dist.jarDepositRate || 150.0);
      const totalAmount = dto.jarsToSettle * unitPrice;

      const companyAfter = companyBefore - dto.jarsToSettle;
      const distributorAfter = distributorBefore + dto.jarsToSettle;

      // Verify physical total invariant
      if (companyAfter + distributorAfter !== physicalJarsTotal) {
        throw new BadRequestException('Physical jar total invariant violation detected');
      }

      // 3. Update Distributor model (Postgres trigger auto-logs ownership transition)
      await tx.distributor.update({
        where: { id: dist.id },
        data: {
          companyOwnedJars: companyAfter,
          distributorOwnedJars: distributorAfter,
        },
      });

      // 4. Update JarInventoryItems so individual item records reconcile
      const companyItem = await tx.jarInventoryItem.findFirst({
        where: { distributorId: dist.id, ownershipType: 'COMPANY' },
      });

      if (companyItem) {
        const deductYard = Math.min(companyItem.filledYardQuantity, dto.jarsToSettle);
        const remainingDeduct = dto.jarsToSettle - deductYard;
        const deductEmpty = Math.min(companyItem.emptyYardQuantity, remainingDeduct);

        await tx.jarInventoryItem.update({
          where: { id: companyItem.id },
          data: {
            ownedQuantity: { decrement: dto.jarsToSettle },
            filledYardQuantity: { decrement: deductYard },
            emptyYardQuantity: { decrement: deductEmpty },
          },
        });

        // Find or create primary distributor jar item
        let distItem = await tx.jarInventoryItem.findFirst({
          where: { distributorId: dist.id, ownershipType: 'DISTRIBUTOR' },
        });

        if (!distItem) {
          distItem = await tx.jarInventoryItem.create({
            data: {
              distributorId: dist.id,
              name: 'Distributor 20L Water Jar',
              ownershipType: 'DISTRIBUTOR',
              ownedQuantity: dto.jarsToSettle,
              filledYardQuantity: deductYard,
              emptyYardQuantity: deductEmpty,
              reservedQuantity: 0,
              customerQuantity: 0,
              washingQuantity: 0,
              fillingQuantity: 0,
              quarantineQuantity: 0,
              damagedQuantity: 0,
              lostQuantity: 0,
              isActive: true,
            },
          });
        } else {
          await tx.jarInventoryItem.update({
            where: { id: distItem.id },
            data: {
              ownedQuantity: { increment: dto.jarsToSettle },
              filledYardQuantity: { increment: deductYard },
              emptyYardQuantity: { increment: deductEmpty },
            },
          });
        }
      }

      // 5. Generate settlement number and save settlement record
      const settlementNumber = `SETTLE-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

      const settlement = await tx.distributorJarSettlement.create({
        data: {
          settlementNumber,
          distributorId: dist.id,
          jarsSettled: dto.jarsToSettle,
          unitPrice,
          totalAmount,
          paymentStatus: 'PAID',
          paymentMethod: dto.paymentMethod || 'BANK_TRANSFER',
          paymentReference: dto.paymentReference || null,
          companyJarsBefore: companyBefore,
          companyJarsAfter: companyAfter,
          distributorJarsBefore: distributorBefore,
          distributorJarsAfter: distributorAfter,
          physicalJarsTotal,
          notes: dto.notes || `Settlement of ${dto.jarsToSettle} jars transferred to distributor ownership`,
          createdById: actingUserId || null,
        },
      });

      return {
        success: true,
        settlement,
        companyJarsBefore: companyBefore,
        companyJarsAfter: companyAfter,
        distributorJarsBefore: distributorBefore,
        distributorJarsAfter: distributorAfter,
        physicalJarsTotal,
      };
    });
  }

  /**
   * Get settlement records for a distributor or globally
   */
  async getSettlements(distributorIdentifier?: string) {
    const where: any = {};
    if (distributorIdentifier) {
      const dist = await this.prisma.distributor.findFirst({
        where: {
          OR: [{ id: distributorIdentifier }, { userId: distributorIdentifier }],
        },
        select: { id: true },
      });
      if (dist) where.distributorId = dist.id;
    }

    return this.prisma.distributorJarSettlement.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        distributor: {
          select: {
            id: true,
            agencyName: true,
            user: { select: { firstName: true, lastName: true } },
          },
        },
        createdBy: {
          select: { firstName: true, lastName: true, role: true },
        },
      },
    });
  }
}
