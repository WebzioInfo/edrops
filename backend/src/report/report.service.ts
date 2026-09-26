import { Injectable, Logger } from '@nestjs/common';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportDto } from './dto/update-report.dto';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole, OrderStatus, PaymentStatus } from '@prisma/client';

@Injectable()
export class ReportService {
  private readonly logger = new Logger(ReportService.name);

  constructor(private prisma: PrismaService) {}

  create(createReportDto: CreateReportDto) {
    return this.prisma.report.create({ data: createReportDto as any });
  }

  findAll() {
    return this.prisma.report.findMany({
      orderBy: { generatedAt: 'desc' },
      take: 100,
    });
  }

  findOne(id: string | number) {
    return this.prisma.report.findUnique({ where: { id: String(id) } });
  }

  update(id: string | number, updateReportDto: UpdateReportDto) {
    return this.prisma.report.update({
      where: { id: String(id) },
      data: updateReportDto as any,
    });
  }

  remove(id: string | number) {
    return this.prisma.report.delete({ where: { id: String(id) } });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // GOD-LEVEL ADMIN ERP ANALYTICS AGGREGATION
  // ─────────────────────────────────────────────────────────────────────────────

  async getAdminAnalytics(query?: {
    preset?: string;
    startDate?: string;
    endDate?: string;
    distributorId?: string;
    orderStatus?: string;
    paymentStatus?: string;
  }) {
    const now = new Date();

    // 1. Date Range Normalization
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    let rangeStart = new Date(todayStart);
    let rangeEnd = new Date(todayEnd);
    const preset = (query?.preset || 'LAST_30_DAYS').toUpperCase();

    if (query?.startDate && query?.endDate) {
      rangeStart = new Date(query.startDate);
      rangeEnd = new Date(query.endDate);
      if (isNaN(rangeStart.getTime())) rangeStart = new Date(todayStart);
      if (isNaN(rangeEnd.getTime())) rangeEnd = new Date(todayEnd);
      if (query.endDate.length <= 10) {
        rangeEnd.setHours(23, 59, 59, 999);
      }
    } else {
      switch (preset) {
        case 'TODAY': {
          rangeStart = new Date(todayStart);
          rangeEnd = new Date(todayEnd);
          break;
        }
        case 'YESTERDAY': {
          const y = new Date(now);
          y.setDate(y.getDate() - 1);
          rangeStart = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 0, 0, 0, 0);
          rangeEnd = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 23, 59, 59, 999);
          break;
        }
        case 'LAST_7_DAYS': {
          rangeStart = new Date(now);
          rangeStart.setDate(rangeStart.getDate() - 6);
          rangeStart.setHours(0, 0, 0, 0);
          rangeEnd = new Date(todayEnd);
          break;
        }
        case 'THIS_MONTH': {
          rangeStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
          rangeEnd = new Date(todayEnd);
          break;
        }
        case 'LAST_30_DAYS':
        default: {
          rangeStart = new Date(now);
          rangeStart.setDate(rangeStart.getDate() - 29);
          rangeStart.setHours(0, 0, 0, 0);
          rangeEnd = new Date(todayEnd);
          break;
        }
      }
    }

    // Historical comparison range (previous period of identical duration)
    const durationMs = Math.max(86400000, rangeEnd.getTime() - rangeStart.getTime());
    const prevRangeEnd = new Date(rangeStart.getTime() - 1);
    const prevRangeStart = new Date(prevRangeEnd.getTime() - durationMs);

    // Percentage change helper
    const getPercentageChange = (curr: number, prev: number) => {
      if (prev === 0) return curr > 0 ? 100 : 0;
      return Math.round(((curr - prev) / prev) * 100);
    };

    // Filter clauses
    const orderWhere: any = {
      createdAt: { gte: rangeStart, lte: rangeEnd },
    };
    if (query?.distributorId) orderWhere.distributorId = query.distributorId;
    if (query?.orderStatus) orderWhere.status = query.orderStatus as OrderStatus;
    if (query?.paymentStatus) orderWhere.paymentStatus = query.paymentStatus as PaymentStatus;

    const prevOrderWhere: any = {
      createdAt: { gte: prevRangeStart, lte: prevRangeEnd },
    };
    if (query?.distributorId) prevOrderWhere.distributorId = query.distributorId;

    // ─────────────────────────────────────────────────────────────────────────
    // BATCH 1: GLOBAL COUNTS & CATALOG DATA
    // ─────────────────────────────────────────────────────────────────────────
    const [
      totalDistributorsCount,
      activeDistributorsCount,
      totalDriversCount,
      activeDriversCount,
      totalCustomersCount,
      activeCustomersCount,
      totalProductsCount,
      activeCategoriesCount,
      activeBrandsCount,
      packagesList,
    ] = await Promise.all([
      this.prisma.user.count({ where: { role: UserRole.DISTRIBUTOR } }),
      this.prisma.user.count({ where: { role: UserRole.DISTRIBUTOR, isActive: true } }),
      this.prisma.driver.count(),
      this.prisma.driver.count({ where: { isActive: true } }),
      this.prisma.customer.count(),
      this.prisma.customer.count({ where: { user: { isActive: true } } }),
      this.prisma.product.count({ where: { status: 'ACTIVE' } }),
      this.prisma.category.count(),
      this.prisma.brand.count(),
      this.prisma.package.findMany({
        where: { isActive: true },
        orderBy: { displayOrder: 'asc' },
      }),
    ]);

    // ─────────────────────────────────────────────────────────────────────────
    // BATCH 2: ORDERS & MEMBERSHIPS SALES METRICS
    // ─────────────────────────────────────────────────────────────────────────
    const [
      ordersPeriodCount,
      ordersPrevCount,
      ordersTodayCount,
      ordersPeriodSalesAgg,
      ordersPrevSalesAgg,
      ordersTodaySalesAgg,
      packagesPeriodCount,
      packagesPrevCount,
      packagesPeriodSalesAgg,
      packagesPrevSalesAgg,
    ] = await Promise.all([
      this.prisma.order.count({ where: orderWhere }),
      this.prisma.order.count({ where: prevOrderWhere }),
      this.prisma.order.count({
        where: { createdAt: { gte: todayStart, lte: todayEnd } },
      }),
      this.prisma.order.aggregate({
        _sum: { totalAmount: true },
        where: { ...orderWhere, status: { not: 'CANCELLED' } },
      }),
      this.prisma.order.aggregate({
        _sum: { totalAmount: true },
        where: { ...prevOrderWhere, status: { not: 'CANCELLED' } },
      }),
      this.prisma.order.aggregate({
        _sum: { totalAmount: true },
        where: {
          createdAt: { gte: todayStart, lte: todayEnd },
          status: { not: 'CANCELLED' },
        },
      }),
      this.prisma.packagePurchase.count({
        where: {
          createdAt: { gte: rangeStart, lte: rangeEnd },
          paymentStatus: { in: ['SUCCESS', 'PAID'] },
        },
      }),
      this.prisma.packagePurchase.count({
        where: {
          createdAt: { gte: prevRangeStart, lte: prevRangeEnd },
          paymentStatus: { in: ['SUCCESS', 'PAID'] },
        },
      }),
      this.prisma.packagePurchase.aggregate({
        _sum: { amount: true },
        where: {
          createdAt: { gte: rangeStart, lte: rangeEnd },
          paymentStatus: { in: ['SUCCESS', 'PAID'] },
        },
      }),
      this.prisma.packagePurchase.aggregate({
        _sum: { amount: true },
        where: {
          createdAt: { gte: prevRangeStart, lte: prevRangeEnd },
          paymentStatus: { in: ['SUCCESS', 'PAID'] },
        },
      }),
    ]);

    // ─────────────────────────────────────────────────────────────────────────
    // BATCH 3: DETAILED ORDERS & PURCHASES (DIRECT QUERIES)
    // ─────────────────────────────────────────────────────────────────────────
    const periodOrders: any[] = await this.prisma.order.findMany({
      where: orderWhere,
      orderBy: { createdAt: 'desc' },
      take: 300,
      include: {
        customer: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                phone: true,
                email: true,
              },
            },
          },
        },
        distributor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
        driver: {
          select: {
            id: true,
            name: true,
            phone: true,
            vehicleNumber: true,
            vehicleType: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                categoryId: true,
                category: { select: { name: true } },
                brand: { select: { name: true } },
              },
            },
          },
        },
        payments: {
          select: {
            id: true,
            amount: true,
            status: true,
            provider: true,
            createdAt: true,
          },
        },
      },
    });

    const periodPurchases: any[] = await this.prisma.packagePurchase.findMany({
      where: {
        createdAt: { gte: rangeStart, lte: rangeEnd },
        paymentStatus: { in: ['SUCCESS', 'PAID'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        package: true,
        customer: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                phone: true,
              },
            },
          },
        },
      },
    });

    // ─────────────────────────────────────────────────────────────────────────
    // BATCH 4: STATUS GROUPINGS & ENTITY LISTS
    // ─────────────────────────────────────────────────────────────────────────
    const [
      pendingOrdersCount,
      ordersByStatusGroup,
      prevOrdersByStatusGroup,
      distributorUsers,
      driversList,
      topCustomersList,
      allProductsList,
      recentStatusHistory,
      recentAuditLogs,
    ] = await Promise.all([
      this.prisma.order.count({
        where: {
          status: {
            in: [
              'NEW',
              'ORDER_PLACED',
              'PENDING_PAYMENT',
              'PENDING_ASSIGNMENT',
              'ASSIGNED',
              'ACCEPTED_BY_PARTNER',
              'PROCESSING',
              'READY',
            ],
          },
        },
      }),
      this.prisma.order.groupBy({
        by: ['status'],
        where: orderWhere,
        _count: { id: true },
      }),
      this.prisma.order.groupBy({
        by: ['status'],
        where: prevOrderWhere,
        _count: { id: true },
      }),
      this.prisma.user.findMany({
        where: { role: UserRole.DISTRIBUTOR },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          isActive: true,
          createdAt: true,
          distributor: {
            select: {
              agencyName: true,
              routeOrArea: true,
            },
          },
        },
        orderBy: { firstName: 'asc' },
      }),
      this.prisma.driver.findMany({
        select: {
          id: true,
          name: true,
          phone: true,
          vehicleNumber: true,
          vehicleType: true,
          routeOrArea: true,
          isActive: true,
          distributorId: true,
          distributor: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
            },
          },
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.customer.findMany({
        take: 150,
        orderBy: { orders: { _count: 'desc' } },
        select: {
          id: true,
          jarsAtCustomer: true,
          user: {
            select: {
              firstName: true,
              lastName: true,
              phone: true,
              isActive: true,
              createdAt: true,
            },
          },
          jarDeposits: {
            select: {
              depositPaid: true,
              depositDue: true,
            },
          },
          packagePurchases: {
            where: { paymentStatus: { in: ['SUCCESS', 'PAID'] } },
            take: 1,
            orderBy: { createdAt: 'desc' },
            select: {
              package: { select: { name: true } },
            },
          },
        },
      }),
      this.prisma.product.findMany({
        select: {
          id: true,
          name: true,
          price: true,
          status: true,
          category: { select: { id: true, name: true } },
          brand: { select: { id: true, name: true } },
          stock: {
            select: {
              quantity: true,
              reservedQty: true,
            },
          },
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.orderStatusHistory.findMany({
        where: { createdAt: { gte: rangeStart, lte: rangeEnd } },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          orderId: true,
          previousStatus: true,
          newStatus: true,
          reason: true,
          createdAt: true,
          user: {
            select: {
              firstName: true,
              lastName: true,
              role: true,
            },
          },
          order: {
            select: {
              id: true,
              totalAmount: true,
            },
          },
        },
      }),
      this.prisma.auditLog.findMany({
        where: { createdAt: { gte: rangeStart, lte: rangeEnd } },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          action: true,
          entityType: true,
          entityId: true,
          createdAt: true,
          user: {
            select: {
              firstName: true,
              lastName: true,
              role: true,
            },
          },
        },
      }),
    ]);

    // ─────────────────────────────────────────────────────────────────────────
    // STATUS COUNTS MAPPER
    // ─────────────────────────────────────────────────────────────────────────

    const statusCounts: Record<string, number> = {};
    ordersByStatusGroup.forEach((g) => {
      statusCounts[g.status] = g._count.id;
    });

    const prevStatusCounts: Record<string, number> = {};
    prevOrdersByStatusGroup.forEach((g) => {
      prevStatusCounts[g.status] = g._count.id;
    });

    const deliveredOrdersCount = (statusCounts['DELIVERED'] || 0) + (statusCounts['COMPLETED'] || 0);
    const prevDeliveredOrdersCount = (prevStatusCounts['DELIVERED'] || 0) + (prevStatusCounts['COMPLETED'] || 0);

    const cancelledOrdersCount = statusCounts['CANCELLED'] || 0;
    const newPlacedCount = (statusCounts['NEW'] || 0) + (statusCounts['ORDER_PLACED'] || 0);
    const confirmedCount = statusCounts['CONFIRMED'] || 0;
    const assignedCount = (statusCounts['ASSIGNED'] || 0) + (statusCounts['ACCEPTED_BY_PARTNER'] || 0);
    const outForDeliveryCount = statusCounts['OUT_FOR_DELIVERY'] || 0;

    // Financial aggregates
    const orderSalesAmount = ordersPeriodSalesAgg._sum.totalAmount || 0;
    const prevOrderSalesAmount = ordersPrevSalesAgg._sum.totalAmount || 0;
    const membershipSalesAmount = packagesPeriodSalesAgg._sum.amount || 0;
    const prevMembershipSalesAmount = packagesPrevSalesAgg._sum.amount || 0;

    const totalSalesAmount = orderSalesAmount + membershipSalesAmount;
    const prevTotalSalesAmount = prevOrderSalesAmount + prevMembershipSalesAmount;

    // Payments calculations
    let amountCollected = 0;
    let cashCollectedAmount = 0;
    let onlinePaymentsAmount = 0;
    let outstandingAmount = 0;

    const paymentMethodStats: Record<string, { count: number; amount: number }> = {};

    periodOrders.forEach((o) => {
      let orderPaid = 0;
      if (o.payments && o.payments.length > 0) {
        o.payments.forEach((p) => {
          if (p.status === 'SUCCESS' || p.status === 'PAID') {
            orderPaid += p.amount;
            const method = (p.provider || o.paymentMethod || 'OTHER').toUpperCase();
            if (!paymentMethodStats[method]) {
              paymentMethodStats[method] = { count: 0, amount: 0 };
            }
            paymentMethodStats[method].count += 1;
            paymentMethodStats[method].amount += p.amount;

            if (method.includes('CASH')) cashCollectedAmount += p.amount;
            else onlinePaymentsAmount += p.amount;
          }
        });
      } else if (o.paymentStatus === 'PAID') {
        orderPaid = o.totalAmount;
        const method = (o.paymentMethod || 'CASH').toUpperCase();
        if (!paymentMethodStats[method]) {
          paymentMethodStats[method] = { count: 0, amount: 0 };
        }
        paymentMethodStats[method].count += 1;
        paymentMethodStats[method].amount += o.totalAmount;

        if (method.includes('CASH')) cashCollectedAmount += o.totalAmount;
        else onlinePaymentsAmount += o.totalAmount;
      }

      amountCollected += orderPaid;
      if (o.status !== 'CANCELLED') {
        const due = Math.max(0, o.totalAmount - orderPaid);
        outstandingAmount += due;
      }
    });

    // Add package purchases to collection & payment methods
    amountCollected += membershipSalesAmount;
    onlinePaymentsAmount += membershipSalesAmount;
    if (!paymentMethodStats['ONLINE']) {
      paymentMethodStats['ONLINE'] = { count: 0, amount: 0 };
    }
    paymentMethodStats['ONLINE'].count += packagesPeriodCount;
    paymentMethodStats['ONLINE'].amount += membershipSalesAmount;

    // Average Order Value & Delivery Completion Rate
    const nonCancelledOrdersCount = Math.max(1, ordersPeriodCount - cancelledOrdersCount);
    const averageOrderValue = Math.round(orderSalesAmount / nonCancelledOrdersCount);
    const deliveryCompletionRate = ordersPeriodCount > 0
      ? Math.round((deliveredOrdersCount / ordersPeriodCount) * 100)
      : 0;

    // ─────────────────────────────────────────────────────────────────────────
    // DAILY TIME SERIES GENERATOR
    // ─────────────────────────────────────────────────────────────────────────

    const daysDiff = Math.max(1, Math.min(60, Math.ceil((rangeEnd.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24))));
    const timeSeriesMap = new Map<string, { date: string; label: string; orderSales: number; membershipSales: number; totalSales: number; orderCount: number; deliveredCount: number }>();

    for (let i = 0; i < daysDiff; i++) {
      const d = new Date(rangeStart.getTime() + i * 24 * 60 * 60 * 1000);
      const dateKey = d.toISOString().split('T')[0];
      const label = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
      timeSeriesMap.set(dateKey, {
        date: dateKey,
        label,
        orderSales: 0,
        membershipSales: 0,
        totalSales: 0,
        orderCount: 0,
        deliveredCount: 0,
      });
    }

    periodOrders.forEach((o) => {
      const dateKey = o.createdAt.toISOString().split('T')[0];
      const bucket = timeSeriesMap.get(dateKey);
      if (bucket) {
        if (o.status !== 'CANCELLED') {
          bucket.orderSales += o.totalAmount;
          bucket.totalSales += o.totalAmount;
        }
        bucket.orderCount += 1;
        if (o.status === 'DELIVERED') {
          bucket.deliveredCount += 1;
        }
      }
    });

    periodPurchases.forEach((p) => {
      const dateKey = p.createdAt.toISOString().split('T')[0];
      const bucket = timeSeriesMap.get(dateKey);
      if (bucket) {
        bucket.membershipSales += p.amount;
        bucket.totalSales += p.amount;
      }
    });

    const salesTimeSeries = Array.from(timeSeriesMap.values());

    // ─────────────────────────────────────────────────────────────────────────
    // MULTI-DIMENSIONAL AGGREGATIONS
    // ─────────────────────────────────────────────────────────────────────────

    // A. Orders / Deliveries by Distributor
    const distributorStatsMap = new Map<string, {
      id: string;
      name: string;
      phone: string;
      agencyName?: string;
      assignedCount: number;
      deliveredCount: number;
      pendingCount: number;
      cancelledCount: number;
      sales: number;
      collected: number;
      outstanding: number;
    }>();

    distributorUsers.forEach((d) => {
      distributorStatsMap.set(d.id, {
        id: d.id,
        name: `${d.firstName || ''} ${d.lastName || ''}`.trim() || 'Distributor',
        phone: d.phone || '',
        agencyName: d.distributor?.agencyName || d.distributor?.routeOrArea || '',
        assignedCount: 0,
        deliveredCount: 0,
        pendingCount: 0,
        cancelledCount: 0,
        sales: 0,
        collected: 0,
        outstanding: 0,
      });
    });

    // B. Deliveries by Driver
    const driverStatsMap = new Map<string, {
      id: string;
      name: string;
      phone: string;
      vehicleNumber: string;
      vehicleType: string;
      distributorName: string;
      assignedCount: number;
      deliveredCount: number;
      pendingCount: number;
      isActive: boolean;
    }>();

    driversList.forEach((dr) => {
      driverStatsMap.set(dr.id, {
        id: dr.id,
        name: dr.name,
        phone: dr.phone,
        vehicleNumber: dr.vehicleNumber,
        vehicleType: dr.vehicleType,
        distributorName: dr.distributor ? `${dr.distributor.firstName} ${dr.distributor.lastName}`.trim() : 'Unassigned',
        assignedCount: 0,
        deliveredCount: 0,
        pendingCount: 0,
        isActive: dr.isActive,
      });
    });

    // C. Product sales & performance
    const productStatsMap = new Map<string, {
      id: string;
      name: string;
      category: string;
      brand: string;
      price: number;
      unitsSold: number;
      revenue: number;
      ordersCount: number;
      stock: number;
    }>();

    allProductsList.forEach((prod) => {
      const currentStock = prod.stock?.reduce((acc, s) => acc + (s.quantity - s.reservedQty), 0) || 0;
      productStatsMap.set(prod.id, {
        id: prod.id,
        name: prod.name,
        category: prod.category?.name || 'Standard',
        brand: prod.brand?.name || 'Edrops',
        price: prod.price,
        unitsSold: 0,
        revenue: 0,
        ordersCount: 0,
        stock: Math.max(0, currentStock),
      });
    });

    // D. Customer orders aggregation
    const customerOrdersAgg = new Map<string, {
      id: string;
      name: string;
      phone: string;
      ordersCount: number;
      totalSpend: number;
    }>();

    // Populate order dimensions
    periodOrders.forEach((o) => {
      // Distributor stats
      if (o.distributorId && distributorStatsMap.has(o.distributorId)) {
        const ds = distributorStatsMap.get(o.distributorId)!;
        ds.assignedCount += 1;
        if (o.status === 'DELIVERED') ds.deliveredCount += 1;
        else if (o.status === 'CANCELLED') ds.cancelledCount += 1;
        else ds.pendingCount += 1;

        if (o.status !== 'CANCELLED') {
          ds.sales += o.totalAmount;
          const paid = o.paymentStatus === 'PAID' ? o.totalAmount : 0;
          ds.collected += paid;
          ds.outstanding += Math.max(0, o.totalAmount - paid);
        }
      }

      // Driver stats
      if (o.driverId && driverStatsMap.has(o.driverId)) {
        const drs = driverStatsMap.get(o.driverId)!;
        drs.assignedCount += 1;
        if (o.status === 'DELIVERED') drs.deliveredCount += 1;
        else drs.pendingCount += 1;
      }

      // Product stats
      if (o.status !== 'CANCELLED' && o.items) {
        o.items.forEach((item) => {
          if (productStatsMap.has(item.productId)) {
            const ps = productStatsMap.get(item.productId)!;
            ps.unitsSold += item.quantity;
            ps.revenue += item.quantity * item.unitPrice;
            ps.ordersCount += 1;
          }
        });
      }

      // Customer stats
      if (o.customerId) {
        const custName = o.customer?.user ? `${o.customer.user.firstName} ${o.customer.user.lastName}`.trim() : 'Customer';
        const custPhone = o.customer?.user?.phone || '';
        if (!customerOrdersAgg.has(o.customerId)) {
          customerOrdersAgg.set(o.customerId, {
            id: o.customerId,
            name: custName,
            phone: custPhone,
            ordersCount: 0,
            totalSpend: 0,
          });
        }
        const ca = customerOrdersAgg.get(o.customerId)!;
        ca.ordersCount += 1;
        if (o.status !== 'CANCELLED') ca.totalSpend += o.totalAmount;
      }
    });

    // ─────────────────────────────────────────────────────────────────────────
    // MEMBERSHIP PERFORMANCE
    // ─────────────────────────────────────────────────────────────────────────

    const packageStatsMap = new Map<string, {
      id: string;
      name: string;
      jarCount: number;
      price: number;
      badge?: string;
      color?: string;
      soldCount: number;
      revenue: number;
      customerCount: Set<string>;
    }>();

    packagesList.forEach((pkg) => {
      packageStatsMap.set(pkg.id, {
        id: pkg.id,
        name: pkg.name,
        jarCount: pkg.jarCount,
        price: pkg.price,
        badge: pkg.packageBadge || undefined,
        color: pkg.packageColor || undefined,
        soldCount: 0,
        revenue: 0,
        customerCount: new Set<string>(),
      });
    });

    periodPurchases.forEach((p) => {
      if (packageStatsMap.has(p.packageId)) {
        const ps = packageStatsMap.get(p.packageId)!;
        ps.soldCount += 1;
        ps.revenue += p.amount;
        if (p.customerId) ps.customerCount.add(p.customerId);
      }
    });

    const membershipsList = Array.from(packageStatsMap.values()).map((ps) => ({
      id: ps.id,
      name: ps.name,
      jarCount: ps.jarCount,
      price: ps.price,
      badge: ps.badge,
      color: ps.color,
      soldCount: ps.soldCount,
      revenue: ps.revenue,
      customersCount: ps.customerCount.size,
      status: 'Active',
    })).sort((a, b) => b.soldCount - a.soldCount);

    const membershipsJarsVolume = membershipsList.reduce((acc, m) => acc + (m.soldCount * m.jarCount), 0);

    // ─────────────────────────────────────────────────────────────────────────
    // SORTED LISTS & DETAILED TABLES
    // ─────────────────────────────────────────────────────────────────────────

    // Distributors Performance List
    const distributorPerformanceList = Array.from(distributorStatsMap.values()).map((ds) => {
      const completionRate = ds.assignedCount > 0 ? Math.round((ds.deliveredCount / ds.assignedCount) * 100) : 0;
      return {
        ...ds,
        deliveryPerformance: completionRate,
      };
    }).sort((a, b) => b.assignedCount - a.assignedCount);

    // Drivers Performance List
    const driverPerformanceList = Array.from(driverStatsMap.values()).map((drs) => {
      const completionRate = drs.assignedCount > 0 ? Math.round((drs.deliveredCount / drs.assignedCount) * 100) : 0;
      return {
        ...drs,
        completionRate,
      };
    }).sort((a, b) => b.assignedCount - a.assignedCount);

    // Products Performance List
    const productPerformanceList = Array.from(productStatsMap.values()).sort((a, b) => b.revenue - a.revenue);
    const totalUnitsSold = productPerformanceList.reduce((acc, p) => acc + p.unitsSold, 0);
    const totalProductRevenue = productPerformanceList.reduce((acc, p) => acc + p.revenue, 0);

    // Detailed Customers List
    const customerPerformanceList = topCustomersList.map((c) => {
      const agg = customerOrdersAgg.get(c.id);
      const depositPaid = c.jarDeposits?.reduce((acc, d) => acc + d.depositPaid, 0) || 0;
      const depositDue = c.jarDeposits?.reduce((acc, d) => acc + d.depositDue, 0) || 0;
      const activePlan = c.packagePurchases?.[0]?.package?.name || 'None';

      return {
        id: c.id,
        name: c.user ? `${c.user.firstName} ${c.user.lastName}`.trim() : 'Customer',
        phone: c.user?.phone || '',
        ordersCount: agg?.ordersCount || 0,
        totalPurchases: agg?.totalSpend || 0,
        depositPaid,
        depositDue,
        jarsAtCustomer: c.jarsAtCustomer || 0,
        membershipStatus: activePlan,
        createdAt: c.user?.createdAt || new Date(),
      };
    }).sort((a, b) => b.ordersCount - a.ordersCount);

    const customersWithOrdersCount = customerOrdersAgg.size;
    const customersWithDueCount = customerPerformanceList.filter((c) => c.depositDue > 0).length;

    // Detailed Recent Orders Table
    const recentOrdersTable = periodOrders.slice(0, 100).map((o) => {
      const itemsSummary = o.items?.map((it) => `${it.quantity}x ${it.product?.name || 'Item'}`).join(', ') || 'No Items';
      const custName = o.customer?.user ? `${o.customer.user.firstName} ${o.customer.user.lastName}`.trim() : 'Customer';
      const distName = o.distributor ? `${o.distributor.firstName} ${o.distributor.lastName}`.trim() : 'Unassigned';
      const drvName = o.driver?.name || 'Unassigned';

      return {
        id: o.id,
        date: o.createdAt,
        customerName: custName,
        customerPhone: o.customer?.user?.phone || '',
        distributorName: distName,
        driverName: drvName,
        itemsSummary,
        amount: o.totalAmount,
        paymentStatus: o.paymentStatus,
        orderStatus: o.status,
        deliveredDate: o.deliveredAt,
      };
    });

    // Detailed Payments Table
    const paymentTransactionsTable = periodOrders
      .filter((o) => o.status !== 'CANCELLED')
      .slice(0, 100)
      .map((o) => {
        const custName = o.customer?.user ? `${o.customer.user.firstName} ${o.customer.user.lastName}`.trim() : 'Customer';
        const isPaid = o.paymentStatus === 'PAID';
        const paidAmount = isPaid ? o.totalAmount : (o.payments?.[0]?.amount || 0);
        const dueAmount = Math.max(0, o.totalAmount - paidAmount);

        return {
          id: o.id,
          orderId: o.id.slice(0, 8).toUpperCase(),
          customerName: custName,
          amount: o.totalAmount,
          paid: paidAmount,
          due: dueAmount,
          paymentMethod: o.paymentMethod || 'CASH',
          paymentStatus: o.paymentStatus,
          date: o.createdAt,
        };
      });

    // Detailed Audit & Activity log (Merge status history and audit logs)
    const combinedAudit = [
      ...recentStatusHistory.map((h) => ({
        id: h.id,
        timestamp: h.createdAt,
        user: h.user ? `${h.user.firstName} ${h.user.lastName} (${h.user.role})` : 'System / Auto',
        action: 'Order Status Changed',
        entity: `Order #${h.orderId.slice(0, 8).toUpperCase()}`,
        previousState: h.previousStatus,
        newState: h.newStatus,
        details: h.reason || `Status updated to ${h.newStatus}`,
      })),
      ...recentAuditLogs.map((a) => ({
        id: a.id,
        timestamp: a.createdAt,
        user: a.user ? `${a.user.firstName} ${a.user.lastName} (${a.user.role})` : 'Admin User',
        action: a.action || 'System Action',
        entity: `${a.entityType} #${a.entityId?.slice(0, 8) || ''}`,
        previousState: '—',
        newState: a.action,
        details: `${a.entityType} modified`,
      })),
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 50);

    // ─────────────────────────────────────────────────────────────────────────
    // FINAL ERP RESPONSE PAYLOAD
    // ─────────────────────────────────────────────────────────────────────────

    return {
      dateRange: {
        preset,
        startDate: rangeStart.toISOString(),
        endDate: rangeEnd.toISOString(),
      },
      overview: {
        kpis: {
          totalOrders: {
            value: ordersPeriodCount,
            prevValue: ordersPrevCount,
            change: getPercentageChange(ordersPeriodCount, ordersPrevCount),
            label: 'Total orders placed in selected period',
          },
          ordersToday: {
            value: ordersTodayCount,
            label: "Orders placed today so far",
          },
          pendingOrders: {
            value: pendingOrdersCount,
            label: 'Orders currently awaiting fulfillment/delivery',
          },
          deliveredOrders: {
            value: deliveredOrdersCount,
            prevValue: prevDeliveredOrdersCount,
            change: getPercentageChange(deliveredOrdersCount, prevDeliveredOrdersCount),
            label: 'Successfully delivered orders',
          },
          cancelledOrders: {
            value: cancelledOrdersCount,
            label: 'Cancelled / rejected orders in range',
          },
          totalSales: {
            value: totalSalesAmount,
            prevValue: prevTotalSalesAmount,
            change: getPercentageChange(totalSalesAmount, prevTotalSalesAmount),
            label: 'Gross orders & membership volume',
          },
          amountCollected: {
            value: amountCollected,
            label: 'Cash & online payments received',
          },
          outstandingAmount: {
            value: outstandingAmount,
            label: 'Unpaid order amounts & pending collections',
          },
          activeCustomers: {
            value: activeCustomersCount,
            total: totalCustomersCount,
            label: 'Registered active customer accounts',
          },
          activeDistributors: {
            value: activeDistributorsCount,
            total: totalDistributorsCount,
            label: 'Active distributor distribution agencies',
          },
          activeDrivers: {
            value: activeDriversCount,
            total: totalDriversCount,
            label: 'Fleet delivery drivers currently on duty',
          },
          membershipsSold: {
            value: packagesPeriodCount,
            prevValue: packagesPrevCount,
            change: getPercentageChange(packagesPeriodCount, packagesPrevCount),
            label: 'Prepaid membership packages purchased',
          },
        },
        salesTimeSeries,
      },
      orders: {
        kpis: {
          total: ordersPeriodCount,
          newPlaced: newPlacedCount,
          confirmed: confirmedCount,
          assigned: assignedCount,
          outForDelivery: outForDeliveryCount,
          delivered: deliveredOrdersCount,
          cancelled: cancelledOrdersCount,
          pending: pendingOrdersCount,
          averageOrderValue,
          deliveryCompletionRate,
        },
        byStatus: Object.entries(statusCounts).map(([status, count]) => ({ status, count })),
        byDistributor: distributorPerformanceList.slice(0, 10).map((d) => ({ name: d.name, count: d.assignedCount })),
        byDriver: driverPerformanceList.slice(0, 10).map((dr) => ({ name: dr.name, count: dr.assignedCount })),
        recentOrders: recentOrdersTable,
      },
      sales: {
        kpis: {
          grossSales: totalSalesAmount,
          orderSales: orderSalesAmount,
          membershipSales: membershipSalesAmount,
          paidAmount: amountCollected,
          pendingAmount: outstandingAmount,
          cashCollected: cashCollectedAmount,
          onlinePayments: onlinePaymentsAmount,
          refunds: 0,
        },
        paymentMethods: Object.entries(paymentMethodStats).map(([method, data]) => ({
          method,
          count: data.count,
          amount: data.amount,
        })),
        salesByProduct: productPerformanceList.slice(0, 8),
        salesByDistributor: distributorPerformanceList.slice(0, 8),
        transactions: paymentTransactionsTable,
      },
      customers: {
        kpis: {
          total: totalCustomersCount,
          active: activeCustomersCount,
          newInRange: topCustomersList.filter((c) => c.user?.createdAt && new Date(c.user.createdAt) >= rangeStart).length,
          withOrders: customersWithOrdersCount,
          withOutstanding: customersWithDueCount,
          membershipCustomers: packagesPeriodCount,
        },
        customerList: customerPerformanceList,
      },
      distributors: {
        kpis: {
          total: totalDistributorsCount,
          active: activeDistributorsCount,
          assignedOrders: ordersPeriodCount,
          deliveredOrders: deliveredOrdersCount,
          pendingOrders: pendingOrdersCount,
          cancelledOrders: cancelledOrdersCount,
          revenueHandled: orderSalesAmount,
        },
        performanceList: distributorPerformanceList,
      },
      drivers: {
        kpis: {
          total: totalDriversCount,
          active: activeDriversCount,
          assignedDeliveries: driverPerformanceList.reduce((acc, dr) => acc + dr.assignedCount, 0),
          outForDelivery: outForDeliveryCount,
          delivered: deliveredOrdersCount,
          failedCancelled: cancelledOrdersCount,
          deliveryCompletionRate,
        },
        performanceList: driverPerformanceList,
      },
      products: {
        kpis: {
          totalProducts: totalProductsCount,
          activeCategories: activeCategoriesCount,
          activeBrands: activeBrandsCount,
          totalUnitsSold,
          totalRevenue: totalProductRevenue,
        },
        performanceList: productPerformanceList,
      },
      memberships: {
        kpis: {
          totalPlans: packagesList.length,
          plansSold: packagesPeriodCount,
          jarsVolumeSold: membershipsJarsVolume,
          revenue: membershipSalesAmount,
          activeMemberships: membershipsList.reduce((acc, m) => acc + m.customersCount, 0),
        },
        performanceList: membershipsList,
      },
      audit: {
        activityList: combinedAudit,
      },
    };
  }
}
