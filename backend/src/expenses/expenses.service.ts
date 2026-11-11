import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';

@Injectable()
export class ExpensesService {
  constructor(private prisma: PrismaService) {}

  async createExpense(dto: CreateExpenseDto, userId?: string) {
    const expenseDate = dto.expenseDate ? new Date(dto.expenseDate) : new Date();

    return this.prisma.expense.create({
      data: {
        category: dto.category.toUpperCase().trim(),
        title: dto.title.trim(),
        amount: Number(dto.amount),
        expenseDate,
        paymentMethod: (dto.paymentMethod || 'CASH').toUpperCase().trim(),
        paymentStatus: (dto.paymentStatus || 'PAID').toUpperCase().trim(),
        status: 'APPROVED',
        vendorName: dto.vendorName?.trim() || null,
        invoiceNumber: dto.invoiceNumber?.trim() || null,
        notes: dto.notes?.trim() || null,
        createdByUserId: userId || null,
        approvedByUserId: userId || null,
      },
    });
  }

  async getExpenses(query?: {
    category?: string;
    startDate?: string;
    endDate?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }) {
    const where: any = {};

    if (query?.category && query.category !== 'ALL') {
      where.category = query.category.toUpperCase();
    }

    if (query?.status && query.status !== 'ALL') {
      where.status = query.status.toUpperCase();
    }

    if (query?.startDate || query?.endDate) {
      where.expenseDate = {};
      if (query.startDate) {
        where.expenseDate.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        const end = new Date(query.endDate);
        if (query.endDate.length <= 10) end.setHours(23, 59, 59, 999);
        where.expenseDate.lte = end;
      }
    }

    const [items, total] = await Promise.all([
      this.prisma.expense.findMany({
        where,
        orderBy: { expenseDate: 'desc' },
        take: query?.limit ? Number(query.limit) : 50,
        skip: query?.offset ? Number(query.offset) : 0,
      }),
      this.prisma.expense.count({ where }),
    ]);

    return { items, total };
  }

  async getExpenseSummary(startDate?: Date, endDate?: Date) {
    const where: any = {
      status: 'APPROVED',
    };

    if (startDate || endDate) {
      where.expenseDate = {};
      if (startDate) where.expenseDate.gte = startDate;
      if (endDate) where.expenseDate.lte = endDate;
    }

    const expenses = await this.prisma.expense.findMany({
      where,
      select: {
        category: true,
        amount: true,
      },
    });

    const categoryTotals: Record<string, number> = {
      FUEL: 0,
      RENT: 0,
      SALARIES: 0,
      MAINTENANCE: 0,
      UTILITIES: 0,
      MARKETING: 0,
      PACKAGING: 0,
      OTHER: 0,
    };

    let totalOpex = 0;

    for (const exp of expenses) {
      const cat = exp.category.toUpperCase();
      const amt = Number(exp.amount) || 0;
      totalOpex += amt;
      if (categoryTotals[cat] !== undefined) {
        categoryTotals[cat] += amt;
      } else {
        categoryTotals['OTHER'] += amt;
      }
    }

    return {
      totalOpex,
      categoryTotals,
      count: expenses.length,
    };
  }

  async updateExpense(id: string, dto: UpdateExpenseDto, userId?: string) {
    const existing = await this.prisma.expense.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Expense #${id} not found`);

    return this.prisma.expense.update({
      where: { id },
      data: {
        ...(dto.category ? { category: dto.category.toUpperCase().trim() } : {}),
        ...(dto.title ? { title: dto.title.trim() } : {}),
        ...(dto.amount ? { amount: Number(dto.amount) } : {}),
        ...(dto.expenseDate ? { expenseDate: new Date(dto.expenseDate) } : {}),
        ...(dto.paymentMethod ? { paymentMethod: dto.paymentMethod.toUpperCase().trim() } : {}),
        ...(dto.paymentStatus ? { paymentStatus: dto.paymentStatus.toUpperCase().trim() } : {}),
        ...(dto.status ? { status: dto.status.toUpperCase().trim() } : {}),
        ...(dto.vendorName !== undefined ? { vendorName: dto.vendorName?.trim() || null } : {}),
        ...(dto.invoiceNumber !== undefined ? { invoiceNumber: dto.invoiceNumber?.trim() || null } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes?.trim() || null } : {}),
        ...(dto.status === 'APPROVED' && !existing.approvedByUserId ? { approvedByUserId: userId || null } : {}),
      },
    });
  }

  async deleteExpense(id: string) {
    const existing = await this.prisma.expense.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Expense #${id} not found`);

    return this.prisma.expense.delete({ where: { id } });
  }
}
