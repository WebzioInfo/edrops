import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WarehouseService {
  constructor(private prisma: PrismaService) {}

  // =====================
  // WAREHOUSES
  // =====================
  async getWarehouses() {
    return this.prisma.warehouse.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async getWarehouseById(id: string) {
    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id },
      include: {
        stock: {
          include: { product: true },
        },
      },
    });
    if (!warehouse) throw new NotFoundException('Warehouse not found');
    return warehouse;
  }

  // =====================
  // STOCK MANAGEMENT
  // =====================
  async adjustStock(params: {
    warehouseId: string;
    productId: string;
    quantity: number;
    type: string;
    reason?: string;
    referenceId?: string;
  }) {
    // Note: This needs proper transactional logic for production
    // This is the V2 architecture prototype for stock adjustments.
    // In a real scenario, type would be IN, OUT, ADJUSTMENT etc.
    // For now we will just run a basic transaction to update stock and log movement.
    // ... Implement full transactional logic ...
  }
}
