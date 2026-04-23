import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StockMovementType } from '@prisma/client';

@Injectable()
export class GodownService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.godown.findMany({
      where: { isActive: true },
      include: { inventories: { include: { product: { select: { id: true, name: true, sku: true } } } } },
    });
  }

  async findById(id: string) {
    const godown = await this.prisma.godown.findFirst({ where: { id }, include: { inventories: true } });
    if (!godown) throw new NotFoundException('Godown not found');
    return godown;
  }

  async create(data: { name: string; address: string; district: string; managerId?: string }) {
    return this.prisma.godown.create({ data });
  }

  async getInventory(godownId: string) {
    return this.prisma.inventory.findMany({
      where: { godownId },
      include: { product: true },
    });
  }

  async adjustStock(godownId: string, productId: string, quantity: number, type: StockMovementType, reason?: string, performedBy?: string) {
    // Upsert inventory
    await this.prisma.inventory.upsert({
      where: { godownId_productId: { godownId, productId } },
      create: { godownId, productId, quantity: type === 'INBOUND' ? quantity : -quantity },
      update: { quantity: { increment: type === 'INBOUND' ? quantity : -quantity } },
    });

    // Record movement
    return this.prisma.stockMovement.create({
      data: { godownId, productId, type, quantity, reason, performedBy },
    });
  }

  async receiveBatch(godownId: string, data: {
    batchNumber: string; productId: string; supplier?: string;
    quantity: number; costPerUnit: number; expiryDate?: Date;
  }) {
    const batch = await this.prisma.batch.create({
      data: { godownId, batchNumber: data.batchNumber, supplier: data.supplier, quantity: data.quantity, costPerUnit: data.costPerUnit, expiryDate: data.expiryDate },
    });
    await this.adjustStock(godownId, data.productId, data.quantity, 'INBOUND', `Batch ${data.batchNumber} received`);
    return batch;
  }

  async getLowStockAlerts() {
    return this.prisma.inventory.findMany({
      where: { quantity: { lte: this.prisma.inventory.fields.minStock as any } },
      include: { product: true, godown: true },
    });
  }

  async dispatchToRoute(godownId: string, routeId: string, productId: string, quantity: number, performedBy?: string) {
    // 1. Check stock in godown
    const inventory = await this.prisma.inventory.findUnique({
      where: { godownId_productId: { godownId, productId } },
    });

    if (!inventory || inventory.quantity < quantity) {
      throw new BadRequestException('Insufficient stock in godown');
    }

    // 2. Perform transaction: decrement godown, record movement
    return this.prisma.$transaction([
      this.prisma.inventory.update({
        where: { godownId_productId: { godownId, productId } },
        data: { quantity: { decrement: quantity } },
      }),
      this.prisma.stockMovement.create({
        data: {
          godownId,
          productId,
          type: 'OUTBOUND',
          quantity,
          reason: `Dispatched to route ${routeId}`,
          performedBy,
        },
      }),
    ]);
  }
}
