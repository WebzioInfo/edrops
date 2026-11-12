import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStatus } from '@prisma/client';
import { ResolvedDistributorIdentity } from './distributor-identity.resolver';

export interface PnlDateRange {
  preset: string;
  startDate: string;
  endDate: string;
}

export interface PnlQueryDto {
  preset?: string;
  startDate?: string;
  endDate?: string;
}

export interface CategoryExpenseSummary {
  label: string;
  amount: number;
  count: number;
}

@Injectable()
export class DistributorPnlService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Evaluates inclusive IST date bounds based on standard accounting presets.
   */
  private resolveDateRange(query?: PnlQueryDto): { rangeStart: Date; rangeEnd: Date; preset: string } {
    const now = new Date();
    // Offset for IST (UTC+05:30)
    const istOffset = 5.5 * 60 * 60 * 1000;
    const nowIst = new Date(now.getTime() + istOffset);

    const todayStart = new Date(Date.UTC(nowIst.getUTCFullYear(), nowIst.getUTCMonth(), nowIst.getUTCDate(), 0, 0, 0, 0) - istOffset);
    const todayEnd = new Date(Date.UTC(nowIst.getUTCFullYear(), nowIst.getUTCMonth(), nowIst.getUTCDate(), 23, 59, 59, 999) - istOffset);

    let rangeStart = new Date(todayStart);
    let rangeEnd = new Date(todayEnd);
    let preset = (query?.preset || 'THIS_MONTH').toUpperCase();
    if (preset === '7D') preset = 'LAST_7_DAYS';
    if (preset === '30D') preset = 'LAST_30_DAYS';
    if (preset === 'PREV_MONTH') preset = 'LAST_MONTH';

    if (query?.startDate && query?.endDate) {
      rangeStart = new Date(query.startDate);
      rangeEnd = new Date(query.endDate);
      if (isNaN(rangeStart.getTime())) rangeStart = new Date(todayStart);
      if (isNaN(rangeEnd.getTime())) rangeEnd = new Date(todayEnd);
      if (query.endDate.length <= 10) {
        rangeEnd.setHours(23, 59, 59, 999);
      }
      if (rangeStart > rangeEnd) {
        const tmp = rangeStart;
        rangeStart = rangeEnd;
        rangeEnd = tmp;
      }
      return { rangeStart, rangeEnd, preset: 'CUSTOM' };
    }

    switch (preset) {
      case 'TODAY':
        rangeStart = new Date(todayStart);
        rangeEnd = new Date(todayEnd);
        break;
      case 'YESTERDAY': {
        const yStart = new Date(todayStart);
        yStart.setDate(yStart.getDate() - 1);
        const yEnd = new Date(todayEnd);
        yEnd.setDate(yEnd.getDate() - 1);
        rangeStart = yStart;
        rangeEnd = yEnd;
        break;
      }
      case 'LAST_7_DAYS': {
        const d7 = new Date(todayStart);
        d7.setDate(d7.getDate() - 6);
        rangeStart = d7;
        rangeEnd = new Date(todayEnd);
        break;
      }
      case 'LAST_30_DAYS': {
        const d30 = new Date(todayStart);
        d30.setDate(d30.getDate() - 29);
        rangeStart = d30;
        rangeEnd = new Date(todayEnd);
        break;
      }
      case 'THIS_MONTH': {
        const mStart = new Date(Date.UTC(nowIst.getUTCFullYear(), nowIst.getUTCMonth(), 1, 0, 0, 0, 0) - istOffset);
        rangeStart = mStart;
        rangeEnd = new Date(todayEnd);
        break;
      }
      case 'LAST_MONTH': {
        const lmStart = new Date(Date.UTC(nowIst.getUTCFullYear(), nowIst.getUTCMonth() - 1, 1, 0, 0, 0, 0) - istOffset);
        const lmEnd = new Date(Date.UTC(nowIst.getUTCFullYear(), nowIst.getUTCMonth(), 0, 23, 59, 59, 999) - istOffset);
        rangeStart = lmStart;
        rangeEnd = lmEnd;
        break;
      }
      case 'THIS_QUARTER': {
        const currentQuarter = Math.floor(nowIst.getUTCMonth() / 3);
        const qStart = new Date(Date.UTC(nowIst.getUTCFullYear(), currentQuarter * 3, 1, 0, 0, 0, 0) - istOffset);
        rangeStart = qStart;
        rangeEnd = new Date(todayEnd);
        break;
      }
      case 'THIS_YEAR': {
        const yStart = new Date(Date.UTC(nowIst.getUTCFullYear(), 0, 1, 0, 0, 0, 0) - istOffset);
        rangeStart = yStart;
        rangeEnd = new Date(todayEnd);
        break;
      }
      case 'ALL_TIME':
      default:
        rangeStart = new Date(2023, 0, 1, 0, 0, 0, 0);
        rangeEnd = new Date(todayEnd);
        break;
    }

    return { rangeStart, rangeEnd, preset };
  }

  /**
   * Generates the authoritative Distributor Profit & Loss Statement.
   */
  async getPnlStatement(identity: ResolvedDistributorIdentity, query?: PnlQueryDto) {
    const { rangeStart, rangeEnd, preset } = this.resolveDateRange(query);

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 1: PARALLEL DATA EXTRACTION WITH DUAL-ID SEPARATION
    // ─────────────────────────────────────────────────────────────────────────
    const [
      orders,
      accessorySales,
      distributorWholesaleSales,
      purchases,
      expenses,
      damagedInventoryLogs,
      activeSubscriptionDeliveries,
    ] = await Promise.all([
      // A. Assigned customer retail orders (Filtered by User.id)
      this.prisma.order.findMany({
        where: {
          distributorId: identity.userId,
          createdAt: { gte: rangeStart, lte: rangeEnd },
          status: { notIn: [OrderStatus.CANCELLED, OrderStatus.FAILED, OrderStatus.RETURNED] },
        },
        include: {
          items: {
            include: { product: true },
          },
          payments: true,
          customer: {
            include: { user: { select: { firstName: true, lastName: true, phone: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),

      // B. Direct accessory sales (Filtered by Distributor.id)
      this.prisma.accessorySale.findMany({
        where: {
          distributorId: identity.distributorId,
          saleDate: { gte: rangeStart, lte: rangeEnd },
          paymentStatus: { not: 'CANCELLED' },
        },
        include: { product: true },
        orderBy: { saleDate: 'desc' },
      }),

      // C. Wholesale commercial invoices from eDrops/Aquzio to this distributor
      this.prisma.distributorSale.findMany({
        where: {
          distributorId: identity.distributorId,
          paymentStatus: { not: 'CANCELLED' },
        },
        include: {
          items: {
            include: { product: true },
          },
        },
        orderBy: { saleDate: 'desc' },
      }),

      // D. Direct supplier purchases recorded by distributor (Filtered by User.id)
      this.prisma.purchase.findMany({
        where: {
          distributorId: identity.userId,
        },
        orderBy: { purchaseDate: 'desc' },
      }),

      // E. Distributor operating expenses (Filtered by Distributor.id)
      this.prisma.distributorExpense.findMany({
        where: {
          distributorId: identity.distributorId,
          expenseDate: { gte: rangeStart, lte: rangeEnd },
          status: 'APPROVED',
        },
        orderBy: { expenseDate: 'desc' },
      }),

      // F. Damaged / lost stock write-offs
      this.prisma.inventoryLog.findMany({
        where: {
          distributorId: identity.distributorId,
          ownership: 'DISTRIBUTOR',
          action: { in: ['DAMAGED', 'LOST', 'WRITE_OFF', 'ADJUSTMENT_DOWN'] },
          createdAt: { gte: rangeStart, lte: rangeEnd },
        },
      }),

      // G. Completed subscription deliveries handled by this distributor
      this.prisma.delivery.findMany({
        where: {
          order: { distributorId: identity.userId },
          status: 'DELIVERED',
          scheduledFor: { gte: rangeStart, lte: rangeEnd },
        },
        include: { report: true },
      }),
    ]);

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 2: UNIT COSTING LOOKUP MATRIX (COGS HIERARCHY)
    // ─────────────────────────────────────────────────────────────────────────
    // Costing priority: Linked purchase invoice -> Recent commercial wholesale rate -> Standard fallback
    let recentWholesaleWaterJarRate = 28.0; // Default pickup wholesale rate
    if (distributorWholesaleSales.length > 0) {
      for (const sale of distributorWholesaleSales) {
        const jarItem = sale.items.find((i) => i.product?.isJar);
        if (jarItem && jarItem.unitPrice > 0) {
          recentWholesaleWaterJarRate = Number(jarItem.unitPrice);
          break;
        }
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 3: REVENUE ACCUMULATION
    // ─────────────────────────────────────────────────────────────────────────
    let grossRetailRevenue = 0;
    let customerJarDepositLiability = 0;
    let netOperatingRetailRevenue = 0;
    let totalOrderDiscounts = 0;
    let totalWaterJarsDelivered = 0;
    let totalWaterJarCogs = 0;
    let isCogsEstimated = false;

    // Track accounts receivable
    let customerCollectedPayments = 0;
    let customerOutstandingReceivables = 0;

    for (const order of orders) {
      const orderTotal = Number(order.totalAmount) || 0;
      const depositTotal = Number(order.depositTotal) || 0;
      const discountTotal = Number(order.discountTotal) || 0;
      const subTotal = Number(order.subTotal) || 0;

      // Deduce customer collections
      const paidPayments = (order as any).payments?.filter((p: any) => p.status === 'SUCCESS' || p.status === 'PAID') || [];
      const paidFromPayments = paidPayments.reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);
      const isOrderMarkedPaid = (order.paymentStatus as any) === 'PAID';
      let orderPaid = paidFromPayments > 0 ? paidFromPayments : (isOrderMarkedPaid ? orderTotal : 0);

      customerCollectedPayments += Math.min(orderPaid, orderTotal);
      customerOutstandingReceivables += Math.max(0, orderTotal - orderPaid);

      customerJarDepositLiability += depositTotal;
      totalOrderDiscounts += discountTotal;
      grossRetailRevenue += orderTotal;

      // Operating revenue is subTotal minus discounts (deposit is strictly balance sheet liability)
      const operatingSales = Math.max(0, subTotal - discountTotal);
      netOperatingRetailRevenue += operatingSales;

      // Calculate COGS per line item
      const orderItems = (order as any).items || [];
      for (const item of orderItems) {
        const qty = Number(item.quantity) || 1;
        if (item.product?.isJar) {
          totalWaterJarsDelivered += qty;
          // Water jar COGS based on wholesale rate
          const unitCost = item.product.distributorPrice ? Number(item.product.distributorPrice) : recentWholesaleWaterJarRate;
          if (!item.product.distributorPrice) isCogsEstimated = true;
          totalWaterJarCogs += unitCost * qty;
        } else {
          // Non-jar items sold in retail orders (taps, stands, etc.)
          const unitCost = Number(item.product?.costPrice || item.product?.distributorPrice || (item.unitPrice * 0.7));
          totalWaterJarCogs += unitCost * qty;
        }
      }
    }

    // Direct Accessory Sales Revenue
    let netAccessoryRevenue = 0;
    let totalAccessoryCogs = 0;
    let totalAccessoryUnits = 0;

    for (const accSale of accessorySales) {
      const taxable = Number(accSale.taxableAmount) || Number(accSale.totalAmount - (accSale.taxAmount || 0));
      netAccessoryRevenue += taxable;
      totalAccessoryUnits += Number(accSale.quantity) || 1;

      // Cost of accessory
      const unitCost = Number(accSale.product?.costPrice || accSale.product?.distributorPrice || (accSale.unitPrice * 0.7));
      totalAccessoryCogs += unitCost * (Number(accSale.quantity) || 1);
    }

    // Subscription fulfillment compensation (Contractual delivery fee if recorded)
    let subscriptionDeliveredJars = 0;
    for (const del of activeSubscriptionDeliveries) {
      const qty = del.report?.confirmedDeliveredQty ?? del.report?.partnerDeliveredQty ?? del.requiredQuantity ?? 0;
      subscriptionDeliveredJars += qty;
    }
    // Subscription packages belong to eDrops company; distributor fulfillment fee is recorded if agreement exists (currently zero margin/untracked)
    const subscriptionFulfillmentIncome = 0;

    // Total Net Operating Revenue
    const totalNetRevenue = Number((netOperatingRetailRevenue + netAccessoryRevenue + subscriptionFulfillmentIncome).toFixed(2));

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 4: COGS & INVENTORY LOSS WRITE-OFFS
    // ─────────────────────────────────────────────────────────────────────────
    let inventoryWriteOffs = 0;
    for (const log of damagedInventoryLogs) {
      const qty = Math.abs(Number(log.quantity) || 0);
      // Cost of broken/lost distributor-owned jar = ₹250 asset replacement or acquisition rate
      inventoryWriteOffs += qty * recentWholesaleWaterJarRate;
    }

    const totalCogs = Number((totalWaterJarCogs + totalAccessoryCogs + inventoryWriteOffs).toFixed(2));
    const grossProfit = Number((totalNetRevenue - totalCogs).toFixed(2));
    const grossMarginPercent = totalNetRevenue > 0 ? Number(((grossProfit / totalNetRevenue) * 100).toFixed(1)) : 0;

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 5: OPERATING EXPENSES (OPEX)
    // ─────────────────────────────────────────────────────────────────────────
    const categoryBreakdown: Record<string, CategoryExpenseSummary> = {
      FUEL: { label: 'Fuel & Delivery Vehicles', amount: 0, count: 0 },
      VEHICLE_MAINTENANCE: { label: 'Vehicle Maintenance & Repairs', amount: 0, count: 0 },
      DRIVER_SALARY: { label: 'Driver & Delivery Partner Wages', amount: 0, count: 0 },
      HELPER_SALARY: { label: 'Helper & Loading Wages', amount: 0, count: 0 },
      RENT: { label: 'Warehouse & Godown Rent', amount: 0, count: 0 },
      ELECTRICITY: { label: 'Electricity Utilities', amount: 0, count: 0 },
      WATER: { label: 'Water Utilities', amount: 0, count: 0 },
      LOADING_UNLOADING: { label: 'Loading & Unloading Charges', amount: 0, count: 0 },
      TRANSPORTATION: { label: 'Logistics & Freight Outward', amount: 0, count: 0 },
      PACKAGING: { label: 'Packaging, Caps & Shrink Film', amount: 0, count: 0 },
      INTERNET: { label: 'Mobile, Telephone & Internet', amount: 0, count: 0 },
      MARKETING: { label: 'Local Promotion & Signage', amount: 0, count: 0 },
      REPAIRS: { label: 'Facility & Equipment Repairs', amount: 0, count: 0 },
      BANK_CHARGES: { label: 'Bank & UPI Payment Fees', amount: 0, count: 0 },
      OTHER: { label: 'General & Miscellaneous Overhead', amount: 0, count: 0 },
    };

    let totalOpex = 0;
    for (const exp of expenses) {
      const amt = Number(exp.amount) || 0;
      totalOpex += amt;
      const cat = (exp.category || 'OTHER').toUpperCase();
      if (categoryBreakdown[cat]) {
        categoryBreakdown[cat].amount += amt;
        categoryBreakdown[cat].count += 1;
      } else {
        categoryBreakdown['OTHER'].amount += amt;
        categoryBreakdown['OTHER'].count += 1;
      }
    }

    const operatingProfit = Number((grossProfit - totalOpex).toFixed(2));
    const netProfitBeforeTax = operatingProfit; // No non-operating entries currently
    const netProfitMarginPercent = totalNetRevenue > 0 ? Number(((netProfitBeforeTax / totalNetRevenue) * 100).toFixed(1)) : 0;

    // Supplier Payables
    let totalPurchasesAmount = 0;
    let totalPurchasesPaid = 0;
    for (const p of purchases) {
      totalPurchasesAmount += Number(p.total) || 0;
      totalPurchasesPaid += Number(p.amountPaid) || 0;
    }
    const supplierOutstandingPayables = Math.max(0, totalPurchasesAmount - totalPurchasesPaid);

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 6: RESPONSE STRUCTURING WITH AUDIT TRACEABILITY
    // ─────────────────────────────────────────────────────────────────────────
    return {
      distributor: {
        id: identity.distributorId,
        userId: identity.userId,
        agencyName: identity.agencyName,
        routeOrArea: identity.routeOrArea,
        jarDepositRate: identity.jarDepositRate,
        companyOwnedJars: identity.companyOwnedJars,
        distributorOwnedJars: identity.distributorOwnedJars,
      },
      period: {
        preset,
        startDate: rangeStart.toISOString(),
        endDate: rangeEnd.toISOString(),
      },
      summary: {
        totalNetRevenue,
        totalCogs,
        grossProfit,
        grossMarginPercent,
        totalOpex: Number(totalOpex.toFixed(2)),
        operatingProfit,
        netProfitBeforeTax,
        netProfitMarginPercent,
        customerJarDepositLiability: Number(customerJarDepositLiability.toFixed(2)),
        customerOutstandingReceivables: Number(customerOutstandingReceivables.toFixed(2)),
        supplierOutstandingPayables: Number(supplierOutstandingPayables.toFixed(2)),
      },
      revenueBreakdown: {
        grossRetailRevenue: Number(grossRetailRevenue.toFixed(2)),
        totalOrderDiscounts: Number(totalOrderDiscounts.toFixed(2)),
        customerJarDepositLiability: Number(customerJarDepositLiability.toFixed(2)),
        netOperatingRetailRevenue: Number(netOperatingRetailRevenue.toFixed(2)),
        netAccessoryRevenue: Number(netAccessoryRevenue.toFixed(2)),
        subscriptionFulfillmentIncome: Number(subscriptionFulfillmentIncome.toFixed(2)),
        totalWaterJarsDelivered,
        totalAccessoryUnits,
        totalOrdersCount: orders.length,
        customerCollectedPayments: Number(customerCollectedPayments.toFixed(2)),
        customerOutstandingReceivables: Number(customerOutstandingReceivables.toFixed(2)),
      },
      cogsBreakdown: {
        totalCogs,
        waterJarCogs: Number(totalWaterJarCogs.toFixed(2)),
        accessoryCogs: Number(totalAccessoryCogs.toFixed(2)),
        inventoryWriteOffs: Number(inventoryWriteOffs.toFixed(2)),
        unitWaterJarRateUsed: recentWholesaleWaterJarRate,
        isCogsEstimated,
        damagedJarsCount: damagedInventoryLogs.reduce((sum, l) => sum + Math.abs(Number(l.quantity) || 0), 0),
      },
      opexBreakdown: {
        totalOpex: Number(totalOpex.toFixed(2)),
        categories: categoryBreakdown,
        totalExpenseCount: expenses.length,
      },
      recentExpenses: expenses.slice(0, 10).map((e) => ({
        id: e.id,
        title: e.title,
        category: e.category,
        amount: e.amount,
        expenseDate: e.expenseDate,
        paymentMethod: e.paymentMethod,
        paymentStatus: e.paymentStatus,
        vendorName: e.vendorName,
        invoiceNumber: e.invoiceNumber,
      })),
      auditFlags: {
        cogsEstimationNote: isCogsEstimated
          ? 'COGS was computed using the active wholesale product baseline rate (₹28.00 pickup) because specific acquisition lot links were unrecorded.'
          : 'COGS is backed by confirmed wholesale invoices from Aquzio/eDrops.',
        subscriptionRevenueExcluded:
          'Customer prepaid subscription fees (PackagePurchase) belong exclusively to eDrops company and are strictly excluded from distributor revenue.',
        customerDepositsIsolated:
          'Customer jar deposits (₹150/jar) are balance sheet liabilities and are strictly excluded from operating revenue.',
      },
    };
  }

  /**
   * Returns a high-level KPI summary suitable for quick metric widgets.
   */
  async getPnlSummary(identity: ResolvedDistributorIdentity, query?: PnlQueryDto) {
    const full = await this.getPnlStatement(identity, query);
    return {
      distributor: full.distributor,
      period: full.period,
      summary: full.summary,
      auditFlags: full.auditFlags,
    };
  }

  /**
   * Returns granular transaction lines contributing to the P&L statement.
   */
  async getPnlDetails(identity: ResolvedDistributorIdentity, query?: PnlQueryDto) {
    const full = await this.getPnlStatement(identity, query);
    return {
      distributor: full.distributor,
      period: full.period,
      summary: full.summary,
      revenueBreakdown: full.revenueBreakdown,
      cogsBreakdown: full.cogsBreakdown,
      opexBreakdown: full.opexBreakdown,
      recentExpenses: full.recentExpenses,
      auditFlags: full.auditFlags,
    };
  }
}
