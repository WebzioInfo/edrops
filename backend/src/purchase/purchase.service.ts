import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { UpdatePurchaseDto } from './dto/update-purchase.dto';

@Injectable()
export class PurchaseService {
  constructor(private readonly prisma: PrismaService) {}

  private async generatePurchaseNumber(): Promise<string> {
    const lastPurchase = await this.prisma.purchase.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { purchaseNumber: true },
    });

    if (!lastPurchase || !lastPurchase.purchaseNumber) {
      return 'PUR-0001';
    }

    const match = lastPurchase.purchaseNumber.match(/PUR-(\d+)/);
    if (match && match[1]) {
      const nextNum = parseInt(match[1], 10) + 1;
      return `PUR-${String(nextNum).padStart(4, '0')}`;
    }

    return `PUR-${Date.now().toString().slice(-4)}`;
  }

  async findAll(
    distributorId: string,
    query: { search?: string; status?: string },
  ) {
    const where: any = {
      distributorId,
    };

    if (query.status && query.status !== 'ALL') {
      where.paymentStatus = query.status.toUpperCase();
    }

    if (query.search && query.search.trim()) {
      const term = query.search.trim();
      where.OR = [
        { purchaseNumber: { contains: term, mode: 'insensitive' } },
        { supplierName: { contains: term, mode: 'insensitive' } },
        { referenceNumber: { contains: term, mode: 'insensitive' } },
      ];
    }

    return this.prisma.purchase.findMany({
      where,
      orderBy: { purchaseDate: 'desc' },
    });
  }

  async findOne(id: string, distributorId: string) {
    const purchase = await this.prisma.purchase.findFirst({
      where: {
        id,
        distributorId,
      },
    });

    if (!purchase) {
      throw new NotFoundException(`Purchase not found`);
    }

    return purchase;
  }

  async create(distributorId: string, dto: CreatePurchaseDto) {
    if (!dto.items || !dto.items.length) {
      throw new BadRequestException('At least one item is required');
    }

    const purchaseNumber = await this.generatePurchaseNumber();
    const purchaseDate = dto.purchaseDate
      ? new Date(dto.purchaseDate)
      : new Date();

    return this.prisma.purchase.create({
      data: {
        purchaseNumber,
        purchaseDate,
        supplierName: dto.supplierName.trim(),
        referenceNumber: dto.referenceNumber?.trim() || null,
        items: dto.items as any,
        subtotal: dto.subtotal,
        tax: dto.tax || 0,
        total: dto.total,
        paymentStatus: (dto.paymentStatus || 'PAID').toUpperCase(),
        distributorId,
        notes: dto.notes?.trim() || null,
      },
    });
  }

  async update(id: string, distributorId: string, dto: UpdatePurchaseDto) {
    const existing = await this.findOne(id, distributorId);

    const data: any = {};
    if (dto.supplierName !== undefined) data.supplierName = dto.supplierName.trim();
    if (dto.referenceNumber !== undefined) data.referenceNumber = dto.referenceNumber?.trim() || null;
    if (dto.purchaseDate !== undefined) data.purchaseDate = new Date(dto.purchaseDate);
    if (dto.items !== undefined) data.items = dto.items as any;
    if (dto.subtotal !== undefined) data.subtotal = dto.subtotal;
    if (dto.tax !== undefined) data.tax = dto.tax;
    if (dto.total !== undefined) data.total = dto.total;
    if (dto.paymentStatus !== undefined) data.paymentStatus = dto.paymentStatus.toUpperCase();
    if (dto.notes !== undefined) data.notes = dto.notes?.trim() || null;

    return this.prisma.purchase.update({
      where: { id: existing.id },
      data,
    });
  }

  async delete(id: string, distributorId: string) {
    const existing = await this.findOne(id, distributorId);

    await this.prisma.purchase.delete({
      where: { id: existing.id },
    });

    return {
      success: true,
      message: `Purchase ${existing.purchaseNumber} deleted successfully`,
    };
  }
}
