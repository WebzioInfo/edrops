import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStatus, PaymentStatus } from '@prisma/client';

export interface ProfitTransactionItem {
  productId?: string;
  productName: string;
  quantity: number;
  customerUnitPrice: number;
  customerRevenue: number;
  partnerUnitCost: number;
  edropsCost: number;
  profit: number;
}

export interface ProfitTransaction {
  id: string;
  orderId?: string;
  orderNumber: string;
  deliveryId?: string;
  date: string;
  customerName: string;
  customerPhone: string;
  address: string;
  items: ProfitTransactionItem[];
  totalJars: number;
  paidAmount: number;
  edropsCost: number;
  profit: number;
  paymentStatus: string;
  deliveryStatus: string;
  isEligible: boolean;
  notes?: string;
}

export interface ProfitSummary {
  totalProfit: number;
  paidRevenue: number;
  edropsCost: number;
  profitMargin: number;
  completedDeliveries: number;
  totalJars: number;
  currentJarRate: number;
  pendingPaymentCount: number;
  pendingProfit: number;
  totalDeliveredCount: number;
}

@Injectable()
export class PartnerProfitsService {
  constructor(private prisma: PrismaService) {}

  async getPartnerProfits(
    userId: string,
    query: {
      period?: string;
      startDate?: string;
      endDate?: string;
      paymentStatus?: string;
    },
  ) {
    // 1. Resolve DeliveryPartner record
    const partner = await this.prisma.deliveryPartner.findFirst({
      where: {
        OR: [{ userId }, { id: userId }],
      },
      include: { user: true },
    });

    if (!partner) {
      throw new NotFoundException('Delivery partner account not found');
    }

    const currentJarRate = Number(partner.jarUnitPrice || 0);

    // 2. Date Filtering Resolution
    const now = new Date();
    let dateFilterStart: Date | null = null;
    let dateFilterEnd: Date | null = null;

    if (query.period === 'TODAY') {
      dateFilterStart = new Date(now);
      dateFilterStart.setHours(0, 0, 0, 0);
      dateFilterEnd = new Date(now);
      dateFilterEnd.setHours(23, 59, 59, 999);
    } else if (query.period === 'THIS_WEEK') {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday
      dateFilterStart = new Date(now.setDate(diff));
      dateFilterStart.setHours(0, 0, 0, 0);
      dateFilterEnd = new Date();
      dateFilterEnd.setHours(23, 59, 59, 999);
    } else if (query.period === 'THIS_MONTH') {
      dateFilterStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      dateFilterEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    } else if (query.startDate) {
      dateFilterStart = new Date(query.startDate);
      dateFilterStart.setHours(0, 0, 0, 0);
      if (query.endDate) {
        dateFilterEnd = new Date(query.endDate);
        dateFilterEnd.setHours(23, 59, 59, 999);
      }
    }

    // 3. Query all assigned Deliveries and direct orders for this partner
    const deliveries = await this.prisma.delivery.findMany({
      where: {
        assignment: { deliveryPartnerId: partner.id },
        ...(dateFilterStart
          ? {
              scheduledFor: {
                gte: dateFilterStart,
                ...(dateFilterEnd ? { lte: dateFilterEnd } : {}),
              },
            }
          : {}),
      },
      include: {
        customer: { include: { user: true } },
        address: true,
        assignment: true,
        report: true,
        order: {
          include: {
            items: { include: { product: true } },
            payments: true,
            customer: { include: { user: true } },
            address: true,
          },
        },
      },
      orderBy: { scheduledFor: 'desc' },
    });

    // Also fetch standalone orders created by/associated with this partner that may not have a Delivery row
    const deliveryOrderIds = deliveries.map((d) => d.orderId).filter(Boolean) as string[];
    const directOrders = await this.prisma.order.findMany({
      where: {
        id: { notIn: deliveryOrderIds },
        OR: [
          { history: { some: { changedByUserId: partner.userId } } },
          { adminNotes: { contains: partner.user.firstName, mode: 'insensitive' } },
        ],
        ...(dateFilterStart
          ? {
              createdAt: {
                gte: dateFilterStart,
                ...(dateFilterEnd ? { lte: dateFilterEnd } : {}),
              },
            }
          : {}),
      },
      include: {
        items: { include: { product: true } },
        payments: true,
        customer: { include: { user: true } },
        address: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const transactions: ProfitTransaction[] = [];
    let totalPaidRevenue = 0;
    let totalEdropsCost = 0;
    let totalProfit = 0;
    let completedDeliveriesCount = 0;
    let totalJarsDelivered = 0;
    let pendingPaymentCount = 0;
    let pendingProfit = 0;
    let totalDeliveredCount = 0;

    // Helper to evaluate an order or delivery transaction
    for (const d of deliveries) {
      const order = d.order;
      const report = d.report;
      const rateSnapshot = d.assignment?.rateSnapshot ? Number(d.assignment.rateSnapshot) : currentJarRate;

      const customerName = d.customer?.user
        ? `${d.customer.user.firstName} ${d.customer.user.lastName}`.trim()
        : d.customer?.companyName || 'Valued Customer';
      const customerPhone = d.customer?.user?.phone || '—';
      const addressStr = [d.address?.street, d.address?.city].filter(Boolean).join(', ') || 'Delivery Address';

      const isDelivered =
        d.status === OrderStatus.DELIVERED ||
        d.status === OrderStatus.COMPLETED ||
        order?.status === OrderStatus.DELIVERED ||
        order?.status === OrderStatus.COMPLETED ||
        !!report;

      const isCancelled = d.status === OrderStatus.CANCELLED || d.status === OrderStatus.FAILED || order?.status === OrderStatus.CANCELLED;

      // Determine Payment status
      let paymentStatusStr = (order?.paymentStatus as string) || 'PENDING';
      if (paymentStatusStr === 'SUCCESS') paymentStatusStr = 'PAID';

      if (order?.payments && order.payments.length > 0) {
        const successful = order.payments.some((p) => p.status === PaymentStatus.SUCCESS || (p.status as any) === 'PAID');
        const refunded = order.payments.some((p) => p.status === PaymentStatus.REFUNDED);
        if (refunded) paymentStatusStr = 'REFUNDED';
        else if (successful) paymentStatusStr = 'PAID';
      }

      // If it's a subscription drop without an order, delivery completion serves as recognized paid drop
      if (!order && isDelivered) {
        paymentStatusStr = 'PAID';
      }

      const isPaid = paymentStatusStr === 'PAID' || paymentStatusStr === 'SUCCESS';
      const isEligible = isPaid && isDelivered && !isCancelled;

      const itemsList: ProfitTransactionItem[] = [];
      let transactionRevenue = 0;
      let transactionCost = 0;
      let transactionJars = 0;

      if (order && order.items && order.items.length > 0) {
        for (const it of order.items) {
          const qty = it.quantity || 1;
          transactionJars += qty;
          const custUnitPrice = Number(it.unitPrice || 0);
          const custLineRev = Number((qty * custUnitPrice).toFixed(2));
          transactionRevenue += custLineRev;

          // Cost priority: Item Snapshot -> Delivery Assignment Snapshot -> Current Jar Unit Rate
          const itemCostRate = it.partnerCost !== null && it.partnerCost !== undefined
            ? Number(it.partnerCost)
            : rateSnapshot;
          
          const edropsLineCost = Number((qty * itemCostRate).toFixed(2));
          transactionCost += edropsLineCost;

          const itemProfit = Number((custLineRev - edropsLineCost).toFixed(2));

          itemsList.push({
            productId: it.productId,
            productName: it.product?.name || '20L Water Jar',
            quantity: qty,
            customerUnitPrice: custUnitPrice,
            customerRevenue: custLineRev,
            partnerUnitCost: itemCostRate,
            edropsCost: edropsLineCost,
            profit: isEligible ? itemProfit : 0,
          });
        }
      } else {
        // Delivery drop quantity
        const qty = report?.partnerDeliveredQty ?? report?.confirmedDeliveredQty ?? d.requiredQuantity ?? 1;
        transactionJars += qty;
        const defaultCustomerPrice = 70.0;
        transactionRevenue = Number((qty * defaultCustomerPrice).toFixed(2));
        transactionCost = Number((qty * rateSnapshot).toFixed(2));

        itemsList.push({
          productName: '20L Water Jar',
          quantity: qty,
          customerUnitPrice: defaultCustomerPrice,
          customerRevenue: transactionRevenue,
          partnerUnitCost: rateSnapshot,
          edropsCost: transactionCost,
          profit: isEligible ? Number((transactionRevenue - transactionCost).toFixed(2)) : 0,
        });
      }

      const potentialProfit = Number((transactionRevenue - transactionCost).toFixed(2));
      const realizedProfit = isEligible ? potentialProfit : 0;

      if (isDelivered && !isCancelled) {
        totalDeliveredCount += 1;
        if (isEligible) {
          totalPaidRevenue += transactionRevenue;
          totalEdropsCost += transactionCost;
          totalProfit += realizedProfit;
          completedDeliveriesCount += 1;
          totalJarsDelivered += transactionJars;
        } else {
          pendingPaymentCount += 1;
          pendingProfit += potentialProfit;
        }
      }

      const orderNumber = order ? `#ORD-${order.id.slice(0, 6).toUpperCase()}` : `#DEL-${d.id.slice(0, 6).toUpperCase()}`;

      transactions.push({
        id: d.id,
        orderId: order?.id,
        orderNumber,
        deliveryId: d.id,
        date: d.scheduledFor.toISOString(),
        customerName,
        customerPhone,
        address: addressStr,
        items: itemsList,
        totalJars: transactionJars,
        paidAmount: isPaid ? transactionRevenue : 0,
        edropsCost: transactionCost,
        profit: realizedProfit,
        paymentStatus: paymentStatusStr,
        deliveryStatus: d.status,
        isEligible,
        notes: report?.partnerNotes || report?.staffNotes || order?.adminNotes || undefined,
      });
    }

    // Direct standalone orders
    for (const ord of directOrders) {
      const customerName = ord.customer?.user
        ? `${ord.customer.user.firstName} ${ord.customer.user.lastName}`.trim()
        : ord.customer?.companyName || 'Valued Customer';
      const customerPhone = ord.customer?.user?.phone || '—';
      const addressStr = [ord.address?.street, ord.address?.city].filter(Boolean).join(', ') || 'Delivery Address';

      const isDelivered = ord.status === OrderStatus.DELIVERED || ord.status === OrderStatus.COMPLETED;
      const isCancelled = ord.status === OrderStatus.CANCELLED;

      let paymentStatusStr = (ord.paymentStatus as string) || 'PENDING';
      if (paymentStatusStr === 'SUCCESS') paymentStatusStr = 'PAID';

      if (ord.payments && ord.payments.length > 0) {
        const successful = ord.payments.some((p) => p.status === PaymentStatus.SUCCESS || (p.status as any) === 'PAID');
        const refunded = ord.payments.some((p) => p.status === PaymentStatus.REFUNDED);
        if (refunded) paymentStatusStr = 'REFUNDED';
        else if (successful) paymentStatusStr = 'PAID';
      }

      const isPaid = paymentStatusStr === 'PAID' || paymentStatusStr === 'SUCCESS';
      const isEligible = isPaid && isDelivered && !isCancelled;

      const itemsList: ProfitTransactionItem[] = [];
      let transactionRevenue = 0;
      let transactionCost = 0;
      let transactionJars = 0;

      for (const it of ord.items) {
        const qty = it.quantity || 1;
        transactionJars += qty;
        const custUnitPrice = Number(it.unitPrice || 0);
        const custLineRev = Number((qty * custUnitPrice).toFixed(2));
        transactionRevenue += custLineRev;

        const itemCostRate = it.partnerCost !== null && it.partnerCost !== undefined
          ? Number(it.partnerCost)
          : currentJarRate;
        
        const edropsLineCost = Number((qty * itemCostRate).toFixed(2));
        transactionCost += edropsLineCost;

        const itemProfit = Number((custLineRev - edropsLineCost).toFixed(2));

        itemsList.push({
          productId: it.productId,
          productName: it.product?.name || '20L Water Jar',
          quantity: qty,
          customerUnitPrice: custUnitPrice,
          customerRevenue: custLineRev,
          partnerUnitCost: itemCostRate,
          edropsCost: edropsLineCost,
          profit: isEligible ? itemProfit : 0,
        });
      }

      const potentialProfit = Number((transactionRevenue - transactionCost).toFixed(2));
      const realizedProfit = isEligible ? potentialProfit : 0;

      if (isDelivered && !isCancelled) {
        totalDeliveredCount += 1;
        if (isEligible) {
          totalPaidRevenue += transactionRevenue;
          totalEdropsCost += transactionCost;
          totalProfit += realizedProfit;
          completedDeliveriesCount += 1;
          totalJarsDelivered += transactionJars;
        } else {
          pendingPaymentCount += 1;
          pendingProfit += potentialProfit;
        }
      }

      transactions.push({
        id: ord.id,
        orderId: ord.id,
        orderNumber: `#ORD-${ord.id.slice(0, 6).toUpperCase()}`,
        date: ord.createdAt.toISOString(),
        customerName,
        customerPhone,
        address: addressStr,
        items: itemsList,
        totalJars: transactionJars,
        paidAmount: isPaid ? transactionRevenue : 0,
        edropsCost: transactionCost,
        profit: realizedProfit,
        paymentStatus: paymentStatusStr,
        deliveryStatus: ord.status,
        isEligible,
        notes: ord.adminNotes || undefined,
      });
    }

    // Sort transactions newest first
    transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Calculate profit margin safely
    const finalPaidRev = Number(totalPaidRevenue.toFixed(2));
    const finalEdropsCost = Number(totalEdropsCost.toFixed(2));
    const finalProfit = Number((finalPaidRev - finalEdropsCost).toFixed(2));
    const profitMargin = finalPaidRev > 0 ? Number(((finalProfit / finalPaidRev) * 100).toFixed(2)) : 0;

    const summary: ProfitSummary = {
      totalProfit: finalProfit,
      paidRevenue: finalPaidRev,
      edropsCost: finalEdropsCost,
      profitMargin,
      completedDeliveries: completedDeliveriesCount,
      totalJars: totalJarsDelivered,
      currentJarRate,
      pendingPaymentCount,
      pendingProfit: Number(pendingProfit.toFixed(2)),
      totalDeliveredCount,
    };

    return {
      summary,
      transactions,
    };
  }
}
