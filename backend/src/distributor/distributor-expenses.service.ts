import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateDistributorExpenseDto,
  UpdateDistributorExpenseDto,
  QueryDistributorExpenseDto,
} from './dto/distributor-expense.dto';

@Injectable()
export class DistributorExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    distributorId: string,
    dto: CreateDistributorExpenseDto,
    createdById?: string,
  ) {
    if (!dto.amount || dto.amount <= 0) {
      throw new BadRequestException('Expense amount must be greater than zero.');
    }

    const expenseDate = dto.expenseDate ? new Date(dto.expenseDate) : new Date();

    return this.prisma.distributorExpense.create({
      data: {
        distributorId,
        category: dto.category.toUpperCase(),
        title: dto.title.trim(),
        amount: Number(Number(dto.amount).toFixed(2)),
        expenseDate,
        paymentMethod: dto.paymentMethod || 'CASH',
        paymentStatus: dto.paymentStatus || 'PAID',
        status: dto.status || 'APPROVED',
        vendorName: dto.vendorName?.trim() || null,
        invoiceNumber: dto.invoiceNumber?.trim() || null,
        receiptUrl: dto.receiptUrl?.trim() || null,
        description: dto.description?.trim() || null,
        createdById: createdById || null,
      },
    });
  }

  async findAll(distributorId: string, query?: QueryDistributorExpenseDto) {
    const page = Math.max(1, parseInt(String(query?.page || 1), 10) || 1);
    const limit = Math.max(1, Math.min(200, parseInt(String(query?.limit || 25), 10) || 25));
    const skip = (page - 1) * limit;

    const where: any = { distributorId };

    if (query?.category && query.category !== 'ALL') {
      where.category = query.category.toUpperCase();
    }

    if (query?.status && query.status !== 'ALL') {
      where.status = query.status.toUpperCase();
    }

    if (query?.startDate || query?.endDate) {
      where.expenseDate = {};
      if (query.startDate) where.expenseDate.gte = new Date(query.startDate);
      if (query.endDate) {
        const end = new Date(query.endDate);
        if (query.endDate.length <= 10) end.setHours(23, 59, 59, 999);
        where.expenseDate.lte = end;
      }
    }

    if (query?.search && query.search.trim()) {
      const term = query.search.trim();
      where.OR = [
        { title: { contains: term, mode: 'insensitive' } },
        { vendorName: { contains: term, mode: 'insensitive' } },
        { invoiceNumber: { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
      ];
    }

    const [total, data, categoryAgg] = await Promise.all([
      this.prisma.distributorExpense.count({ where }),
      this.prisma.distributorExpense.findMany({
        where,
        orderBy: [{ expenseDate: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.distributorExpense.groupBy({
        by: ['category'],
        where: { ...where, status: 'APPROVED' },
        _sum: { amount: true },
        _count: { id: true },
      }),
    ]);

    const totalAmount = categoryAgg.reduce((acc, curr) => acc + (curr._sum.amount || 0), 0);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
        totalAmount: Number(totalAmount.toFixed(2)),
      },
      categoryBreakdown: categoryAgg.map((c) => ({
        category: c.category,
        amount: Number((c._sum.amount || 0).toFixed(2)),
        count: c._count.id,
      })),
    };
  }

  async findOne(id: string, distributorId: string) {
    const expense = await this.prisma.distributorExpense.findFirst({
      where: { id, distributorId },
    });

    if (!expense) {
      throw new NotFoundException(`Expense record "${id}" not found.`);
    }

    return expense;
  }

  async update(id: string, distributorId: string, dto: UpdateDistributorExpenseDto) {
    await this.findOne(id, distributorId);

    const data: any = {};
    if (dto.category !== undefined) data.category = dto.category.toUpperCase();
    if (dto.title !== undefined) data.title = dto.title.trim();
    if (dto.amount !== undefined) {
      if (dto.amount <= 0) throw new BadRequestException('Amount must be positive.');
      data.amount = Number(Number(dto.amount).toFixed(2));
    }
    if (dto.expenseDate !== undefined) data.expenseDate = new Date(dto.expenseDate);
    if (dto.paymentMethod !== undefined) data.paymentMethod = dto.paymentMethod;
    if (dto.paymentStatus !== undefined) data.paymentStatus = dto.paymentStatus;
    if (dto.status !== undefined) data.status = dto.status.toUpperCase();
    if (dto.vendorName !== undefined) data.vendorName = dto.vendorName.trim() || null;
    if (dto.invoiceNumber !== undefined) data.invoiceNumber = dto.invoiceNumber.trim() || null;
    if (dto.receiptUrl !== undefined) data.receiptUrl = dto.receiptUrl.trim() || null;
    if (dto.description !== undefined) data.description = dto.description.trim() || null;

    return this.prisma.distributorExpense.update({
      where: { id },
      data,
    });
  }

  async delete(id: string, distributorId: string) {
    const existing = await this.findOne(id, distributorId);

    // If already locked in historical reports or approved, soft-cancel rather than hard deleting to preserve auditability
    if (existing.status === 'APPROVED') {
      return this.prisma.distributorExpense.update({
        where: { id },
        data: { status: 'CANCELLED' },
      });
    }

    return this.prisma.distributorExpense.delete({
      where: { id },
    });
  }
}
