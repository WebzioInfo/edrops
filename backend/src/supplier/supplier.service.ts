import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { RecordSupplierPaymentDto } from './dto/record-supplier-payment.dto';
import { AdjustSupplierBalanceDto } from './dto/adjust-supplier-balance.dto';

@Injectable()
export class SupplierService {
  constructor(private readonly prisma: PrismaService) {}

  async create(distributorId: string, dto: CreateSupplierDto) {
    const openingBalance = dto.openingBalance ? Math.abs(dto.openingBalance) : 0;
    const openingBalanceType = (dto.openingBalanceType || 'PAYABLE').toUpperCase();

    const supplier = await this.prisma.supplier.create({
      data: {
        distributorId,
        name: dto.name.trim(),
        contactPerson: dto.contactPerson?.trim() || null,
        phone: dto.phone?.trim() || null,
        email: dto.email?.trim() || null,
        companyName: dto.companyName?.trim() || null,
        gstin: dto.gstin?.trim() || null,
        pan: dto.pan?.trim() || null,
        supplierType: dto.supplierType?.trim() || null,
        addressLine1: dto.addressLine1?.trim() || null,
        addressLine2: dto.addressLine2?.trim() || null,
        city: dto.city?.trim() || null,
        state: dto.state?.trim() || null,
        pinCode: dto.pinCode?.trim() || null,
        country: dto.country?.trim() || 'India',
        openingBalance,
        openingBalanceType,
        notes: dto.notes?.trim() || null,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      },
    });

    // Record initial ledger entry if opening balance is provided
    if (openingBalance > 0) {
      const isPayable = openingBalanceType === 'PAYABLE';
      await this.prisma.supplierTransaction.create({
        data: {
          supplierId: supplier.id,
          distributorId,
          type: 'OPENING_BALANCE',
          reference: 'INITIAL',
          description: isPayable
            ? 'Opening Balance (We owe supplier)'
            : 'Opening Balance (Supplier owes us)',
          debit: isPayable ? openingBalance : 0,
          credit: isPayable ? 0 : openingBalance,
          balance: isPayable ? openingBalance : -openingBalance,
        },
      });
    }

    return supplier;
  }

  async findAll(
    distributorId: string,
    query: { search?: string; status?: string },
  ) {
    const where: any = { distributorId };

    if (query.status === 'ACTIVE') {
      where.isActive = true;
    } else if (query.status === 'INACTIVE') {
      where.isActive = false;
    }

    if (query.search && query.search.trim()) {
      const term = query.search.trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { companyName: { contains: term, mode: 'insensitive' } },
        { contactPerson: { contains: term, mode: 'insensitive' } },
        { phone: { contains: term, mode: 'insensitive' } },
        { email: { contains: term, mode: 'insensitive' } },
        { gstin: { contains: term, mode: 'insensitive' } },
      ];
    }

    const suppliers = await this.prisma.supplier.findMany({
      where,
      include: {
        purchases: {
          select: {
            id: true,
            total: true,
            amountPaid: true,
            paymentStatus: true,
          },
        },
        transactions: {
          where: { type: { in: ['BALANCE_ADJUSTMENT', 'ADJUSTMENT'] } },
          orderBy: [
            { createdAt: 'desc' },
            { id: 'desc' },
          ],
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate aggregated stats and balances for each supplier
    const enriched = suppliers.map((supplier) => {
      const totalPurchased = supplier.purchases.reduce(
        (sum, p) => sum + (Number(p.total) || 0),
        0,
      );
      const totalPaid = supplier.purchases.reduce(
        (sum, p) => sum + (Number(p.amountPaid) || 0),
        0,
      );

      const opening = Number(supplier.openingBalance) || 0;
      const openingPayable =
        supplier.openingBalanceType === 'RECEIVABLE' ? -opening : opening;

      // Pending from purchases = sum of max(0, p.total - (p.amountPaid || 0))
      const totalPendingPurchases = supplier.purchases.reduce((sum, p) => {
        const paid = Number(p.amountPaid || 0);
        return sum + Math.max(0, (Number(p.total) || 0) - paid);
      }, 0);

      // Latest adjustment if any
      const latestAdjustment = supplier.transactions[0];

      const balance =
        latestAdjustment !== undefined
          ? latestAdjustment.balance
          : Math.round((openingPayable + totalPendingPurchases) * 100) / 100;

      return {
        id: supplier.id,
        name: supplier.name,
        contactPerson: supplier.contactPerson,
        phone: supplier.phone,
        email: supplier.email,
        companyName: supplier.companyName,
        gstin: supplier.gstin,
        pan: supplier.pan,
        supplierType: supplier.supplierType,
        addressLine1: supplier.addressLine1,
        addressLine2: supplier.addressLine2,
        city: supplier.city,
        state: supplier.state,
        pinCode: supplier.pinCode,
        country: supplier.country,
        openingBalance: supplier.openingBalance,
        openingBalanceType: supplier.openingBalanceType,
        notes: supplier.notes,
        isActive: supplier.isActive,
        createdAt: supplier.createdAt,
        updatedAt: supplier.updatedAt,
        purchaseCount: supplier.purchases.length,
        totalPurchased: Math.round(totalPurchased * 100) / 100,
        totalPaid: Math.round(totalPaid * 100) / 100,
        balance,
      };
    });

    if (query.status === 'HAS_OUTSTANDING') {
      return enriched.filter((s) => s.balance > 0);
    } else if (query.status === 'FULLY_PAID') {
      return enriched.filter((s) => s.balance <= 0);
    }

    return enriched;
  }

  async findOne(id: string, distributorId: string) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id, distributorId },
      include: {
        purchases: {
          orderBy: [
            { purchaseDate: 'desc' },
            { createdAt: 'desc' },
          ],
        },
        transactions: {
          orderBy: [
            { createdAt: 'desc' },
            { id: 'desc' },
          ],
        },
      },
    });

    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }

    const opening = Number(supplier.openingBalance) || 0;
    const openingPayable =
      supplier.openingBalanceType === 'RECEIVABLE' ? -opening : opening;

    // 1. Build distinct business ledger transactions:
    // A purchase is represented as EXACTLY ONE ledger transaction.
    // Payment events linked to a purchase update that purchase's paid/pending/balance values.
    const businessLedgerRows: any[] = [];

    // Optional: Opening Balance transaction if supplier has an opening balance
    if (opening > 0) {
      const openingTx = supplier.transactions.find(
        (t) => t.type === 'OPENING_BALANCE',
      );
      businessLedgerRows.push({
        id: openingTx?.id || `opening_${supplier.id}`,
        type: 'OPENING_BALANCE',
        reference: openingTx?.reference || 'INITIAL',
        description:
          openingTx?.description ||
          (supplier.openingBalanceType === 'RECEIVABLE'
            ? 'Opening Balance (Supplier owes us)'
            : 'Opening Balance (We owe supplier)'),
        date: openingTx?.date || supplier.createdAt,
        createdAt: openingTx?.createdAt || supplier.createdAt,
        total: opening,
        paid: 0,
        pending: opening,
        status: 'PENDING',
      });
    }

    // Purchases: exactly ONE ledger transaction per purchase
    for (const p of supplier.purchases) {
      const total = Number(p.total) || 0;

      // Calculate paid from payments array or amountPaid
      let paidFromPayments = 0;
      if (Array.isArray(p.payments) && p.payments.length > 0) {
        paidFromPayments = (p.payments as any[]).reduce(
          (sum, pay) => sum + (Number(pay.amount) || 0),
          0,
        );
      }
      const paid = Math.min(
        total,
        Math.max(
          paidFromPayments,
          Number(p.amountPaid || 0),
          p.paymentStatus === 'PAID' ? total : 0,
        ),
      );
      const pending = Math.max(0, Number((total - paid).toFixed(2)));
      const status =
        pending <= 0 ? 'PAID' : paid <= 0 ? 'PENDING' : 'PARTIAL';

      businessLedgerRows.push({
        id: p.id,
        purchaseId: p.id,
        type: 'PURCHASE',
        reference: p.purchaseNumber,
        description: p.notes
          ? `Purchase ${p.purchaseNumber} - ${p.notes}`
          : `Purchase ${p.purchaseNumber}`,
        date: p.purchaseDate,
        createdAt: p.createdAt,
        total,
        paid: Math.round(paid * 100) / 100,
        pending,
        status,
        items: p.items,
        subtotal: p.subtotal,
        tax: p.tax,
        payments: p.payments,
      });
    }

    // Balance adjustments: auditable manual adjustments
    const adjustments = supplier.transactions.filter(
      (t) => t.type === 'BALANCE_ADJUSTMENT' || t.type === 'ADJUSTMENT',
    );
    for (const adj of adjustments) {
      const delta = (adj.debit || 0) - (adj.credit || 0);
      businessLedgerRows.push({
        id: adj.id,
        type: 'BALANCE_ADJUSTMENT',
        reference: adj.reference || 'ADJUSTMENT',
        description: adj.description || 'Manual balance adjustment',
        date: adj.date,
        createdAt: adj.createdAt,
        total: adj.debit > 0 ? adj.debit : 0,
        paid: adj.credit > 0 ? adj.credit : 0,
        pending: 0,
        status: 'COMPLETED',
        adjustmentDelta: delta,
        targetBalance: adj.balance,
      });
    }

    // Standalone transactions that are not linked to any purchase and not adjustments/opening
    const standaloneTxs = supplier.transactions.filter(
      (t) =>
        t.type !== 'OPENING_BALANCE' &&
        t.type !== 'BALANCE_ADJUSTMENT' &&
        t.type !== 'ADJUSTMENT' &&
        !t.purchaseId,
    );
    for (const st of standaloneTxs) {
      businessLedgerRows.push({
        id: st.id,
        type: st.type,
        reference: st.reference || '—',
        description: st.description || '—',
        date: st.date,
        createdAt: st.createdAt,
        total: st.debit || 0,
        paid: st.credit || 0,
        pending: Math.max(0, (st.debit || 0) - (st.credit || 0)),
        status: 'COMPLETED',
      });
    }

    // 2. Sequential Running Balance Calculation:
    // Sort all business ledger rows chronologically (oldest first)
    businessLedgerRows.sort((a, b) => {
      const tA = new Date(a.createdAt).getTime();
      const tB = new Date(b.createdAt).getTime();
      if (tA !== tB) return tA - tB;
      return (a.id || '').localeCompare(b.id || '');
    });

    let running = openingPayable;
    for (const row of businessLedgerRows) {
      if (row.type === 'OPENING_BALANCE') {
        row.runningBalance = Math.round(openingPayable * 100) / 100;
        running = row.runningBalance;
      } else if (row.type === 'PURCHASE') {
        // Outstanding amount owed for this purchase is row.pending
        running = Math.round((running + row.pending) * 100) / 100;
        row.runningBalance = running;
      } else if (row.type === 'BALANCE_ADJUSTMENT') {
        if (row.targetBalance !== undefined) {
          running = row.targetBalance;
        } else {
          running = Math.round((running + row.adjustmentDelta) * 100) / 100;
        }
        row.runningBalance = running;
      } else {
        // Any standalone payment reduces running balance; debit increases
        running =
          Math.round((running + (row.total || 0) - (row.paid || 0)) * 100) / 100;
        row.runningBalance = running;
      }
    }

    const calculatedOutstanding =
      businessLedgerRows.length > 0 ? running : openingPayable;

    // 3. Presentation Sort:
    // Output strictly in newest-first order (createdAt DESC, id DESC)
    businessLedgerRows.sort((a, b) => {
      const tA = new Date(a.createdAt).getTime();
      const tB = new Date(b.createdAt).getTime();
      if (tA !== tB) return tB - tA;
      return (b.id || '').localeCompare(a.id || '');
    });

    const totalPurchased = supplier.purchases.reduce(
      (sum, p) => sum + (Number(p.total) || 0),
      0,
    );
    const totalPaid = supplier.purchases.reduce(
      (sum, p) => sum + (Number(p.amountPaid) || 0),
      0,
    );

    return {
      ...supplier,
      transactions: businessLedgerRows,
      totalPurchased: Math.round(totalPurchased * 100) / 100,
      totalPaid: Math.round(totalPaid * 100) / 100,
      outstandingBalance: calculatedOutstanding,
    };
  }

  async update(id: string, distributorId: string, dto: UpdateSupplierDto) {
    const existing = await this.prisma.supplier.findFirst({
      where: { id, distributorId },
    });

    if (!existing) {
      throw new NotFoundException('Supplier not found');
    }

    return this.prisma.supplier.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.contactPerson !== undefined && {
          contactPerson: dto.contactPerson?.trim() || null,
        }),
        ...(dto.phone !== undefined && { phone: dto.phone?.trim() || null }),
        ...(dto.email !== undefined && { email: dto.email?.trim() || null }),
        ...(dto.companyName !== undefined && {
          companyName: dto.companyName?.trim() || null,
        }),
        ...(dto.gstin !== undefined && { gstin: dto.gstin?.trim() || null }),
        ...(dto.pan !== undefined && { pan: dto.pan?.trim() || null }),
        ...(dto.supplierType !== undefined && {
          supplierType: dto.supplierType?.trim() || null,
        }),
        ...(dto.addressLine1 !== undefined && {
          addressLine1: dto.addressLine1?.trim() || null,
        }),
        ...(dto.addressLine2 !== undefined && {
          addressLine2: dto.addressLine2?.trim() || null,
        }),
        ...(dto.city !== undefined && { city: dto.city?.trim() || null }),
        ...(dto.state !== undefined && { state: dto.state?.trim() || null }),
        ...(dto.pinCode !== undefined && {
          pinCode: dto.pinCode?.trim() || null,
        }),
        ...(dto.country !== undefined && {
          country: dto.country?.trim() || 'India',
        }),
        ...(dto.notes !== undefined && { notes: dto.notes?.trim() || null }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async delete(id: string, distributorId: string) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id, distributorId },
      include: {
        purchases: { select: { id: true } },
        transactions: { select: { id: true } },
      },
    });

    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }

    // Safe deletion rule: If there are existing purchases or financial transactions, soft delete/archive
    if (supplier.purchases.length > 0 || supplier.transactions.length > 0) {
      await this.prisma.supplier.update({
        where: { id },
        data: { isActive: false },
      });
      return {
        success: true,
        message: 'Supplier has associated records and was archived safely',
      };
    }

    // Otherwise completely remove unused supplier
    await this.prisma.supplier.delete({
      where: { id },
    });

    return {
      success: true,
      message: 'Supplier deleted successfully',
    };
  }

  async recordPayment(
    id: string,
    distributorId: string,
    dto: RecordSupplierPaymentDto,
  ) {
    const supplier = await this.findOne(id, distributorId);

    if (dto.amount <= 0) {
      throw new BadRequestException('Payment amount must be greater than 0');
    }

    if (supplier.outstandingBalance <= 0) {
      throw new BadRequestException(
        'Supplier has no outstanding payable balance',
      );
    }

    if (dto.amount > supplier.outstandingBalance + 0.01) {
      throw new BadRequestException(
        `Payment amount (₹${dto.amount}) cannot exceed current outstanding balance of ₹${supplier.outstandingBalance}`,
      );
    }

    const paymentAmount = Math.round(dto.amount * 100) / 100;
    const paymentDate = dto.paymentDate
      ? new Date(dto.paymentDate)
      : new Date();
    const ref =
      dto.reference?.trim() || `PAY-${Date.now().toString().slice(-6)}`;

    // Allocate payment across pending purchases for this supplier (FIFO)
    const unpaidPurchases = await this.prisma.purchase.findMany({
      where: {
        distributorId,
        supplierId: id,
        paymentStatus: { in: ['PENDING', 'PARTIAL'] },
      },
      orderBy: { purchaseDate: 'asc' },
    });

    let remainingToAllocate = paymentAmount;

    for (const p of unpaidPurchases) {
      if (remainingToAllocate <= 0) break;

      const currentPaid = p.amountPaid || 0;
      const pending = Math.max(0, Number((p.total - currentPaid).toFixed(2)));

      if (pending > 0) {
        const allocate = Math.min(remainingToAllocate, pending);
        const newPaid = Number((currentPaid + allocate).toFixed(2));
        const newPending = Math.max(0, Number((p.total - newPaid).toFixed(2)));
        const newStatus = newPending <= 0 ? 'PAID' : 'PARTIAL';

        const existingPayments = Array.isArray(p.payments)
          ? (p.payments as any[])
          : [];

        const paymentEntry = {
          id: `pay_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          amount: allocate,
          date: paymentDate.toISOString(),
          notes: dto.notes?.trim() || `Supplier payment ref: ${ref}`,
        };

        await this.prisma.purchase.update({
          where: { id: p.id },
          data: {
            amountPaid: newPaid,
            paymentStatus: newStatus,
            payments: [...existingPayments, paymentEntry],
          },
        });

        remainingToAllocate = Number((remainingToAllocate - allocate).toFixed(2));
      }
    }

    // Determine current running balance from actual supplier outstanding balance
    const previousBalance = supplier.outstandingBalance;
    const newRunningBalance =
      Math.round((previousBalance - paymentAmount) * 100) / 100;

    const now = new Date();
    // Record payment in supplier ledger
    const transaction = await this.prisma.supplierTransaction.create({
      data: {
        supplierId: id,
        distributorId,
        date: paymentDate,
        createdAt: now,
        type: 'PAYMENT',
        reference: ref,
        description:
          dto.notes?.trim() ||
          (dto.paymentMethod
            ? `Payment via ${dto.paymentMethod}`
            : 'Payment recorded'),
        debit: 0,
        credit: paymentAmount,
        balance: newRunningBalance,
      },
    });

    return {
      success: true,
      transaction,
      newOutstandingBalance: newRunningBalance,
    };
  }

  async adjustBalance(
    id: string,
    distributorId: string,
    dto: AdjustSupplierBalanceDto,
    auditUser?: { userId?: string; userName?: string },
  ) {
    const supplier = await this.findOne(id, distributorId);

    const currentBalance = supplier.outstandingBalance;
    const targetBalance = Math.round(dto.newBalance * 100) / 100;
    const delta = Math.round((targetBalance - currentBalance) * 100) / 100;

    if (delta === 0) {
      throw new BadRequestException(
        'New balance cannot be identical to the current balance',
      );
    }

    const now = new Date();
    const ref = dto.reference?.trim() || `ADJ-${Date.now().toString().slice(-6)}`;
    const reasonText = dto.reason?.trim() || 'Manual balance adjustment';
    const userSignature = auditUser?.userName ? ` by ${auditUser.userName}` : '';
    const description = `Balance Adjustment: ₹${currentBalance.toLocaleString('en-IN')} → ₹${targetBalance.toLocaleString('en-IN')} (${delta > 0 ? '+' : ''}₹${delta.toLocaleString('en-IN')})${userSignature}. Reason: ${reasonText}`;

    const transaction = await this.prisma.supplierTransaction.create({
      data: {
        supplierId: id,
        distributorId,
        date: now,
        createdAt: now,
        type: 'BALANCE_ADJUSTMENT',
        reference: ref,
        description,
        debit: delta > 0 ? delta : 0,
        credit: delta < 0 ? Math.abs(delta) : 0,
        balance: targetBalance,
      },
    });

    return {
      success: true,
      transaction,
      previousBalance: currentBalance,
      newOutstandingBalance: targetBalance,
      adjustmentAmount: delta,
    };
  }
}
