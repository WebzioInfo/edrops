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
      include: {
        supplier: {
          select: { id: true, name: true, companyName: true },
        },
      },
      orderBy: [
        { purchaseDate: 'desc' },
        { createdAt: 'desc' },
      ],
    });
  }

  async findOne(id: string, distributorId: string) {
    const purchase = await this.prisma.purchase.findFirst({
      where: {
        id,
        distributorId,
      },
      include: {
        supplier: {
          select: { id: true, name: true, companyName: true },
        },
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

    const paymentStatus = (dto.paymentStatus || 'PAID').toUpperCase();
    let amountPaid = dto.amountPaid;
    if (amountPaid === undefined || amountPaid === null) {
      if (paymentStatus === 'PAID') amountPaid = dto.total;
      else if (paymentStatus === 'PENDING') amountPaid = 0;
      else amountPaid = 0;
    }

    const payments: any[] = [];
    if (amountPaid > 0) {
      payments.push({
        id: `pay_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        amount: amountPaid,
        date: new Date().toISOString(),
        notes: paymentStatus === 'PAID' ? 'Full initial payment' : 'Initial partial payment',
      });
    }

    const purchase = await this.prisma.purchase.create({
      data: {
        purchaseNumber,
        purchaseDate,
        supplierName: dto.supplierName.trim(),
        supplierId: dto.supplierId || null,
        referenceNumber: dto.referenceNumber?.trim() || null,
        items: dto.items as any,
        subtotal: dto.subtotal,
        tax: dto.tax || 0,
        total: dto.total,
        paymentStatus,
        amountPaid,
        payments,
        distributorId,
        notes: dto.notes?.trim() || null,
      },
    });

    // Synchronize with Supplier ledger if supplierId is linked
    if (dto.supplierId) {
      const latestTx = await this.prisma.supplierTransaction.findFirst({
        where: { supplierId: dto.supplierId },
        orderBy: [
          { createdAt: 'desc' },
          { id: 'desc' },
        ],
      });

      let previousBalance = 0;
      if (latestTx) {
        previousBalance = latestTx.balance;
      } else {
        const sup = await this.prisma.supplier.findUnique({
          where: { id: dto.supplierId },
        });
        if (sup) {
          const op = Number(sup.openingBalance) || 0;
          previousBalance = sup.openingBalanceType === 'RECEIVABLE' ? -op : op;
        }
      }

      // Net impact on amount owed:
      // dto.total is the new purchase (debit/owed)
      // amountPaid is initial payment (credit/paid)
      // Resulting balance = previousBalance + total - amountPaid
      const resultingBalance = Math.round((previousBalance + dto.total - amountPaid) * 100) / 100;
      const now = new Date();

      await this.prisma.supplierTransaction.create({
        data: {
          supplierId: dto.supplierId,
          distributorId,
          date: purchaseDate,
          createdAt: now,
          type: 'PURCHASE',
          reference: purchaseNumber,
          description:
            amountPaid > 0
              ? `Purchase ${purchaseNumber} (Paid: ₹${amountPaid.toLocaleString('en-IN')})`
              : `Purchase ${purchaseNumber}`,
          debit: dto.total,
          credit: amountPaid,
          balance: resultingBalance,
          purchaseId: purchase.id,
        },
      });
    }

    return purchase;
  }

  async update(id: string, distributorId: string, dto: UpdatePurchaseDto) {
    const existing = await this.findOne(id, distributorId);

    const data: any = {};
    if (dto.supplierName !== undefined) data.supplierName = dto.supplierName.trim();
    if (dto.supplierId !== undefined) data.supplierId = dto.supplierId || null;
    if (dto.referenceNumber !== undefined) data.referenceNumber = dto.referenceNumber?.trim() || null;
    if (dto.purchaseDate !== undefined) data.purchaseDate = new Date(dto.purchaseDate);
    if (dto.items !== undefined) data.items = dto.items as any;
    if (dto.subtotal !== undefined) data.subtotal = dto.subtotal;
    if (dto.tax !== undefined) data.tax = dto.tax;
    if (dto.total !== undefined) data.total = dto.total;
    if (dto.paymentStatus !== undefined) data.paymentStatus = dto.paymentStatus.toUpperCase();
    if (dto.amountPaid !== undefined) {
      data.amountPaid = dto.amountPaid;
    } else if (dto.paymentStatus !== undefined) {
      const status = dto.paymentStatus.toUpperCase();
      if (status === 'PAID') data.amountPaid = dto.total !== undefined ? dto.total : existing.total;
      else if (status === 'PENDING') data.amountPaid = 0;
    }

    const finalTotal = data.total !== undefined ? data.total : existing.total;
    const finalPaid = data.amountPaid !== undefined ? data.amountPaid : (existing.amountPaid ?? (existing.paymentStatus === 'PAID' ? existing.total : 0));
    if (finalPaid >= finalTotal) {
      data.paymentStatus = 'PAID';
    } else if (finalPaid > 0) {
      data.paymentStatus = 'PARTIAL';
    } else {
      data.paymentStatus = 'PENDING';
    }

    if (dto.notes !== undefined) data.notes = dto.notes?.trim() || null;

    return this.prisma.purchase.update({
      where: { id: existing.id },
      data,
    });
  }

  async recordPayment(
    id: string,
    distributorId: string,
    dto: { amount: number; notes?: string },
  ) {
    const purchase = await this.findOne(id, distributorId);

    if (dto.amount <= 0) {
      throw new BadRequestException('Payment amount must be greater than 0');
    }

    const currentPaid = purchase.amountPaid || 0;
    const pendingAmount = Math.max(0, Number((purchase.total - currentPaid).toFixed(2)));

    if (pendingAmount <= 0) {
      throw new BadRequestException('Purchase is already fully paid');
    }

    if (dto.amount > pendingAmount + 0.01) {
      throw new BadRequestException(
        `Payment amount (₹${dto.amount}) cannot exceed pending amount of ₹${pendingAmount}`,
      );
    }

    const newAmountPaid = Math.min(
      purchase.total,
      Number((currentPaid + dto.amount).toFixed(2)),
    );
    const newPending = Math.max(0, Number((purchase.total - newAmountPaid).toFixed(2)));
    const newStatus = newPending <= 0 ? 'PAID' : 'PARTIAL';

    const existingPayments = Array.isArray(purchase.payments)
      ? (purchase.payments as any[])
      : [];

    const newPaymentEntry = {
      id: `pay_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      amount: dto.amount,
      date: new Date().toISOString(),
      notes: dto.notes?.trim() || 'Collection payment',
    };

    const updated = await this.prisma.purchase.update({
      where: { id: purchase.id },
      data: {
        amountPaid: newAmountPaid,
        paymentStatus: newStatus,
        payments: [...existingPayments, newPaymentEntry],
      },
    });

    // Synchronize payment collection with supplier ledger if supplierId is linked
    if (purchase.supplierId) {
      const latestTx = await this.prisma.supplierTransaction.findFirst({
        where: { supplierId: purchase.supplierId },
        orderBy: [
          { createdAt: 'desc' },
          { id: 'desc' },
        ],
      });

      let previousBalance = 0;
      if (latestTx) {
        previousBalance = latestTx.balance;
      } else {
        const sup = await this.prisma.supplier.findUnique({
          where: { id: purchase.supplierId },
        });
        if (sup) {
          const op = Number(sup.openingBalance) || 0;
          previousBalance = sup.openingBalanceType === 'RECEIVABLE' ? -op : op;
        }
      }

      const newBalance = Math.round((previousBalance - dto.amount) * 100) / 100;
      const now = new Date();

      await this.prisma.supplierTransaction.create({
        data: {
          supplierId: purchase.supplierId,
          distributorId,
          date: now,
          createdAt: now,
          type: 'PAYMENT',
          reference: purchase.purchaseNumber,
          description: dto.notes?.trim() || `Payment collected for ${purchase.purchaseNumber}`,
          debit: 0,
          credit: dto.amount,
          balance: newBalance,
          purchaseId: purchase.id,
        },
      });
    }

    return updated;
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
