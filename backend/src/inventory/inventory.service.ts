import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}

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
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async addProduction(qty: number) {
    if (qty <= 0)
      throw new BadRequestException('Production quantity must be positive');

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

      // Production converts empty jars into filled jars
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

      await tx.inventoryLog.create({
        data: {
          action: 'PRODUCTION',
          filledQty: qty,
          emptyQty: -qty,
          description: `Produced ${qty} filled jars from empty stock`,
        },
      });

      return updated;
    });
  }

  async addRawStock(qty: number) {
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

      await tx.inventoryLog.create({
        data: {
          action: 'PRODUCTION',
          filledQty: qty,
          description: `Direct replenishment of ${qty} filled jars`,
        },
      });

      return updated;
    });
  }

  async reportDamage(qty: number, type: 'FILLED' | 'EMPTY') {
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

      if (type === 'FILLED') {
        if (status.filledJars < qty)
          throw new BadRequestException(
            'Insufficient filled jars to report damage',
          );
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
            description: `Reported ${qty} filled jars as damaged`,
          },
        });
        return updated;
      } else {
        if (status.emptyJars < qty)
          throw new BadRequestException(
            'Insufficient empty jars to report damage',
          );
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
            description: `Reported ${qty} empty jars as damaged`,
          },
        });
        return updated;
      }
    });
  }
}
