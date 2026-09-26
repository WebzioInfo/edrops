import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { CreateDistributorDto } from './dto/create-distributor.dto';
import { UpdateDistributorDto } from './dto/update-distributor.dto';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

@Injectable()
export class StaffService {
  constructor(private prisma: PrismaService) {}

  create(createStaffDto: CreateStaffDto) {
    return this.prisma.staff.create({ data: createStaffDto as any });
  }

  findAll() {
    return this.prisma.staff.findMany({
      include: { user: true, branch: true },
      take: 100,
    });
  }

  // --- DISTRIBUTOR MANAGEMENT ---

  async getDistributors(query?: {
    search?: string;
    status?: string;
    route?: string;
  }) {
    const where: any = {
      role: UserRole.DISTRIBUTOR,
    };

    if (query?.status === 'ACTIVE') {
      where.isActive = true;
    } else if (query?.status === 'INACTIVE') {
      where.isActive = false;
    }

    if (query?.route && query.route !== 'ALL') {
      where.distributor = {
        routeOrArea: { contains: query.route, mode: 'insensitive' },
      };
    }

    if (query?.search && query.search.trim()) {
      const term = query.search.trim();
      where.OR = [
        { firstName: { contains: term, mode: 'insensitive' } },
        { lastName: { contains: term, mode: 'insensitive' } },
        { phone: { contains: term, mode: 'insensitive' } },
        { email: { contains: term, mode: 'insensitive' } },
        {
          distributor: {
            referralCode: { contains: term, mode: 'insensitive' },
          },
        },
        {
          distributor: {
            agencyName: { contains: term, mode: 'insensitive' },
          },
        },
        {
          distributor: {
            routeOrArea: { contains: term, mode: 'insensitive' },
          },
        },
      ];
    }

    const distributors = await this.prisma.user.findMany({
      where,
      include: {
        distributor: {
          include: {
            createdBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
        distributorPincodes: {
          where: { isActive: true },
        },
        _count: {
          select: {
            distributorOrders: true,
            distributorAssignments: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return distributors.map((user) => this.formatDistributor(user));
  }

  async getDistributorsSummary() {
    const all = await this.prisma.user.findMany({
      where: { role: UserRole.DISTRIBUTOR },
      include: {
        distributor: true,
      },
    });

    const total = all.length;
    const active = all.filter((u) => u.isActive).length;
    const inactive = total - active;
    const totalCompanyJars = all.reduce(
      (sum, u) => sum + (u.distributor?.companyOwnedJars || 0),
      0,
    );
    const totalDistributorJars = all.reduce(
      (sum, u) => sum + (u.distributor?.distributorOwnedJars || 0),
      0,
    );

    return {
      total,
      active,
      inactive,
      totalCompanyJars,
      totalDistributorJars,
    };
  }

  async getDeliveryPartners() {
    return this.getDistributors({ status: 'ACTIVE' });
  }

  async getDistributorById(id: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        role: UserRole.DISTRIBUTOR,
        OR: [{ id }, { distributor: { id } }],
      },
      include: {
        distributor: {
          include: {
            createdBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
        distributorPincodes: true,
        distributorAssignments: {
          include: {
            order: {
              select: {
                id: true,
                totalAmount: true,
                status: true,
                createdAt: true,
              },
            },
          },
          orderBy: { acceptedAt: 'desc' },
          take: 15,
        },
        _count: {
          select: {
            distributorOrders: true,
            distributorAssignments: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`Distributor with ID ${id} not found`);
    }

    return this.formatDistributor(user);
  }

  async createDistributor(dto: CreateDistributorDto, staffUserId?: string) {
    const cleanPhone = dto.phone.trim();
    const cleanEmail = dto.email?.trim() || null;
    const cleanRefCode = dto.referralCode.trim().toUpperCase();

    // 1. Validate referral code uniqueness (case-insensitive)
    const existingRef = await this.prisma.distributor.findFirst({
      where: {
        referralCode: { equals: cleanRefCode, mode: 'insensitive' },
      },
    });
    if (existingRef) {
      throw new ConflictException(
        `Referral code '${cleanRefCode}' is already assigned to another distributor`,
      );
    }

    // 2. Validate phone uniqueness
    const existingPhone = await this.prisma.user.findUnique({
      where: { phone: cleanPhone },
    });
    if (existingPhone) {
      throw new ConflictException(
        'Phone number is already registered to another user',
      );
    }

    // 3. Validate email uniqueness if provided
    if (cleanEmail) {
      const existingEmail = await this.prisma.user.findUnique({
        where: { email: cleanEmail },
      });
      if (existingEmail) {
        throw new ConflictException(
          'Email address is already registered to another user',
        );
      }
    }

    const rawPassword = dto.password || 'Edrops@2026';
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(rawPassword, salt);

    const newUser = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          phone: cleanPhone,
          email: cleanEmail,
          role: UserRole.DISTRIBUTOR,
          passwordHash,
          isActive: dto.isActive !== false,
        },
      });

      await tx.distributor.create({
        data: {
          userId: user.id,
          referralCode: cleanRefCode,
          agencyName: dto.agencyName?.trim() || null,
          address: dto.address?.trim() || null,
          routeOrArea: dto.routeOrArea?.trim() || null,
          vehicleType: dto.vehicleType?.trim() || null,
          vehiclePlate: dto.vehiclePlate?.trim() || null,
          jarOwnership: dto.jarOwnership?.trim() || 'COMPANY_OWNED',
          companyOwnedJars: dto.companyOwnedJars ?? 0,
          distributorOwnedJars: dto.distributorOwnedJars ?? 0,
          createdById: staffUserId || null,
        },
      });

      if (dto.servicePincodes && Array.isArray(dto.servicePincodes)) {
        const cleanPincodes = Array.from(
          new Set(
            dto.servicePincodes
              .map((p: string) => String(p).trim())
              .filter((p: string) => /^\d{6}$/.test(p)),
          ),
        );
        for (const pin of cleanPincodes) {
          await tx.distributorPincode.create({
            data: {
              distributorId: user.id,
              pincode: pin,
              isActive: true,
            },
          });
        }
      }

      return user;
    });

    return this.getDistributorById(newUser.id);
  }

  async updateDistributor(id: string, dto: UpdateDistributorDto) {
    const existingUser = await this.prisma.user.findFirst({
      where: {
        role: UserRole.DISTRIBUTOR,
        OR: [{ id }, { distributor: { id } }],
      },
      include: { distributor: true },
    });

    if (!existingUser) {
      throw new NotFoundException(`Distributor with ID ${id} not found`);
    }

    // Validate phone if changed
    if (dto.phone && dto.phone.trim() !== existingUser.phone) {
      const cleanPhone = dto.phone.trim();
      const phoneConflict = await this.prisma.user.findFirst({
        where: { phone: cleanPhone, id: { not: existingUser.id } },
      });
      if (phoneConflict) {
        throw new ConflictException(
          'Phone number is already registered to another user',
        );
      }
    }

    // Validate email if changed
    if (dto.email && dto.email.trim() !== existingUser.email) {
      const cleanEmail = dto.email.trim();
      const emailConflict = await this.prisma.user.findFirst({
        where: { email: cleanEmail, id: { not: existingUser.id } },
      });
      if (emailConflict) {
        throw new ConflictException(
          'Email address is already registered to another user',
        );
      }
    }

    // Validate referralCode if changed
    if (dto.referralCode) {
      const cleanRefCode = dto.referralCode.trim().toUpperCase();
      const refConflict = await this.prisma.distributor.findFirst({
        where: {
          referralCode: { equals: cleanRefCode, mode: 'insensitive' },
          userId: { not: existingUser.id },
        },
      });
      if (refConflict) {
        throw new ConflictException(
          `Referral code '${cleanRefCode}' is already assigned to another distributor`,
        );
      }
    }

    let passwordHash: string | undefined = undefined;
    if (dto.password && dto.password.trim()) {
      const salt = await bcrypt.genSalt(10);
      passwordHash = await bcrypt.hash(dto.password.trim(), salt);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: existingUser.id },
        data: {
          firstName: dto.firstName !== undefined ? dto.firstName.trim() : undefined,
          lastName: dto.lastName !== undefined ? dto.lastName.trim() : undefined,
          phone: dto.phone !== undefined ? dto.phone.trim() : undefined,
          email: dto.email !== undefined ? dto.email.trim() : undefined,
          isActive: dto.isActive !== undefined ? dto.isActive : undefined,
          passwordHash: passwordHash || undefined,
        },
      });

      const distData: any = {};
      if (dto.referralCode !== undefined) distData.referralCode = dto.referralCode.trim().toUpperCase();
      if (dto.agencyName !== undefined) distData.agencyName = dto.agencyName.trim();
      if (dto.address !== undefined) distData.address = dto.address.trim();
      if (dto.routeOrArea !== undefined) distData.routeOrArea = dto.routeOrArea.trim();
      if (dto.vehicleType !== undefined) distData.vehicleType = dto.vehicleType.trim();
      if (dto.vehiclePlate !== undefined) distData.vehiclePlate = dto.vehiclePlate.trim();
      if (dto.jarOwnership !== undefined) distData.jarOwnership = dto.jarOwnership.trim();
      if (dto.companyOwnedJars !== undefined) distData.companyOwnedJars = Number(dto.companyOwnedJars);
      if (dto.distributorOwnedJars !== undefined) distData.distributorOwnedJars = Number(dto.distributorOwnedJars);

      if (existingUser.distributor) {
        await tx.distributor.update({
          where: { id: existingUser.distributor.id },
          data: distData,
        });
      } else {
        await tx.distributor.create({
          data: {
            userId: existingUser.id,
            referralCode: distData.referralCode || `EDR-${existingUser.phone.slice(-4)}`,
            ...distData,
          },
        });
      }

      if (dto.servicePincodes !== undefined && Array.isArray(dto.servicePincodes)) {
        const cleanPincodes = Array.from(
          new Set(
            dto.servicePincodes
              .map((p: string) => String(p).trim())
              .filter((p: string) => /^\d{6}$/.test(p)),
          ),
        );
        await tx.distributorPincode.deleteMany({
          where: {
            distributorId: existingUser.id,
            pincode: { notIn: cleanPincodes },
          },
        });
        for (const pin of cleanPincodes) {
          await tx.distributorPincode.upsert({
            where: {
              distributorId_pincode: {
                distributorId: existingUser.id,
                pincode: pin,
              },
            },
            create: {
              distributorId: existingUser.id,
              pincode: pin,
              isActive: true,
            },
            update: {
              isActive: true,
            },
          });
        }
      }
    });

    return this.getDistributorById(existingUser.id);
  }

  async updateDistributorStatus(id: string, isActive: boolean) {
    const existing = await this.prisma.user.findFirst({
      where: {
        role: UserRole.DISTRIBUTOR,
        OR: [{ id }, { distributor: { id } }],
      },
    });

    if (!existing) {
      throw new NotFoundException(`Distributor with ID ${id} not found`);
    }

    const updated = await this.prisma.user.update({
      where: { id: existing.id },
      data: { isActive },
    });

    return {
      id: updated.id,
      isActive: updated.isActive,
      message: `Distributor ${updated.isActive ? 'activated' : 'deactivated'} successfully`,
    };
  }

  private formatDistributor(u: any) {
    const fullName = `${u.firstName || ''} ${u.lastName || ''}`.trim();
    return {
      id: u.id,
      userId: u.id,
      distributorProfileId: u.distributor?.id || null,
      firstName: u.firstName,
      lastName: u.lastName,
      fullName,
      phone: u.phone,
      email: u.email,
      role: u.role,
      isActive: u.isActive,
      referralCode: u.distributor?.referralCode || 'NOT_ASSIGNED',
      agencyName: u.distributor?.agencyName || null,
      address: u.distributor?.address || null,
      routeOrArea: u.distributor?.routeOrArea || null,
      vehicleType: u.distributor?.vehicleType || null,
      vehiclePlate: u.distributor?.vehiclePlate || null,
      jarOwnership: u.distributor?.jarOwnership || 'COMPANY_OWNED',
      companyOwnedJars: u.distributor?.companyOwnedJars ?? 0,
      distributorOwnedJars: u.distributor?.distributorOwnedJars ?? 0,
      totalJars:
        (u.distributor?.companyOwnedJars ?? 0) +
        (u.distributor?.distributorOwnedJars ?? 0),
      createdBy: u.distributor?.createdBy
        ? {
            id: u.distributor.createdBy.id,
            name: `${u.distributor.createdBy.firstName} ${u.distributor.createdBy.lastName}`.trim(),
            email: u.distributor.createdBy.email,
          }
        : null,
      servicePincodes: u.distributorPincodes || [],
      assignedOrdersCount: u._count?.distributorAssignments ?? 0,
      ordersCount: u._count?.distributorOrders ?? 0,
      recentAssignments: u.distributorAssignments || [],
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    };
  }

  // --- STAFF ENTITY CRUD ---

  findOne(id: string | number) {
    return this.prisma.staff.findUnique({
      where: { id: String(id) },
      include: { user: true, branch: true },
    });
  }

  update(id: string | number, updateStaffDto: UpdateStaffDto) {
    return this.prisma.staff.update({
      where: { id: String(id) },
      data: updateStaffDto as any,
    });
  }

  remove(id: string | number) {
    return this.prisma.staff.delete({ where: { id: String(id) } });
  }

  // --- STAFF REPORTS AGGREGATION ---

  async getStaffReports(query?: {
    startDate?: string;
    endDate?: string;
    preset?: string;
  }) {
    const now = new Date();

    // Today's range (local/UTC day bounds)
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    // Calculate requested range
    let rangeStart = new Date(todayStart);
    let rangeEnd = new Date(todayEnd);
    const preset = (query?.preset || 'TODAY').toUpperCase();

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
        case 'LAST_30_DAYS': {
          rangeStart = new Date(now);
          rangeStart.setDate(rangeStart.getDate() - 29);
          rangeStart.setHours(0, 0, 0, 0);
          rangeEnd = new Date(todayEnd);
          break;
        }
        case 'THIS_MONTH': {
          rangeStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
          rangeEnd = new Date(todayEnd);
          break;
        }
        case 'TODAY':
        default: {
          rangeStart = new Date(todayStart);
          rangeEnd = new Date(todayEnd);
          break;
        }
      }
    }

    // 1. Overall counts (Distributors, Drivers, Total Customers, Pending Orders)
    const [
      activeDistributorsCount,
      totalDistributorsCount,
      activeDriversCount,
      totalDriversCount,
      totalCustomersCount,
      pendingOrdersCount,
      packagesList,
    ] = await Promise.all([
      this.prisma.user.count({ where: { role: UserRole.DISTRIBUTOR, isActive: true } }),
      this.prisma.user.count({ where: { role: UserRole.DISTRIBUTOR } }),
      this.prisma.driver.count({ where: { isActive: true } }),
      this.prisma.driver.count(),
      this.prisma.customer.count(),
      this.prisma.order.count({
        where: {
          status: { in: ['NEW', 'PENDING_PAYMENT', 'PENDING_ASSIGNMENT', 'ASSIGNED', 'PROCESSING', 'READY'] },
        },
      }),
      this.prisma.package.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          jarCount: true,
          price: true,
          packageBadge: true,
          packageColor: true,
        },
        orderBy: { displayOrder: 'asc' },
      }),
    ]);

    // 2. Today's metrics (for TODAY top summary)
    const [
      ordersTodayCount,
      ordersTodaySalesAgg,
      customersTodayCount,
      deliveriesTodayCount,
      packagesTodayCount,
      packagesTodaySalesAgg,
    ] = await Promise.all([
      this.prisma.order.count({
        where: { createdAt: { gte: todayStart, lte: todayEnd } },
      }),
      this.prisma.order.aggregate({
        _sum: { totalAmount: true },
        where: {
          createdAt: { gte: todayStart, lte: todayEnd },
          status: { not: 'CANCELLED' },
        },
      }),
      this.prisma.customer.count({
        where: {
          user: { createdAt: { gte: todayStart, lte: todayEnd } },
        },
      }),
      this.prisma.order.count({
        where: {
          status: { in: ['DELIVERED', 'COMPLETED'] },
          OR: [
            { deliveredAt: { gte: todayStart, lte: todayEnd } },
            { updatedAt: { gte: todayStart, lte: todayEnd } },
          ],
        },
      }),
      this.prisma.packagePurchase.count({
        where: {
          createdAt: { gte: todayStart, lte: todayEnd },
          paymentStatus: 'SUCCESS',
        },
      }),
      this.prisma.packagePurchase.aggregate({
        _sum: { amount: true },
        where: {
          createdAt: { gte: todayStart, lte: todayEnd },
          paymentStatus: 'SUCCESS',
        },
      }),
    ]);

    // 3. Period metrics (for the selected date range)
    const [
      ordersPeriodCount,
      ordersPeriodSalesAgg,
      customersPeriodCount,
      deliveriesPeriodCount,
      packagesPeriodCount,
      packagesPeriodSalesAgg,
      cancelledOrdersPeriodCount,
      ordersByStatusGroup,
      purchasesByPackageGroup,
    ] = await Promise.all([
      this.prisma.order.count({
        where: { createdAt: { gte: rangeStart, lte: rangeEnd } },
      }),
      this.prisma.order.aggregate({
        _sum: { totalAmount: true },
        where: {
          createdAt: { gte: rangeStart, lte: rangeEnd },
          status: { not: 'CANCELLED' },
        },
      }),
      this.prisma.customer.count({
        where: {
          user: { createdAt: { gte: rangeStart, lte: rangeEnd } },
        },
      }),
      this.prisma.order.count({
        where: {
          status: { in: ['DELIVERED', 'COMPLETED'] },
          OR: [
            { deliveredAt: { gte: rangeStart, lte: rangeEnd } },
            { updatedAt: { gte: rangeStart, lte: rangeEnd } },
          ],
        },
      }),
      this.prisma.packagePurchase.count({
        where: {
          createdAt: { gte: rangeStart, lte: rangeEnd },
          paymentStatus: 'SUCCESS',
        },
      }),
      this.prisma.packagePurchase.aggregate({
        _sum: { amount: true },
        where: {
          createdAt: { gte: rangeStart, lte: rangeEnd },
          paymentStatus: 'SUCCESS',
        },
      }),
      this.prisma.order.count({
        where: {
          createdAt: { gte: rangeStart, lte: rangeEnd },
          status: 'CANCELLED',
        },
      }),
      this.prisma.order.groupBy({
        by: ['status'],
        where: { createdAt: { gte: rangeStart, lte: rangeEnd } },
        _count: { id: true },
      }),
      this.prisma.packagePurchase.groupBy({
        by: ['packageId'],
        where: {
          createdAt: { gte: rangeStart, lte: rangeEnd },
          paymentStatus: 'SUCCESS',
        },
        _count: { id: true },
        _sum: { amount: true },
      }),
    ]);

    // 4. Operations Overview Status Breakdown
    const statusCounts: Record<string, number> = {};
    ordersByStatusGroup.forEach((g) => {
      statusCounts[g.status] = g._count.id;
    });

    const receivedCount = (statusCounts['NEW'] || 0) + (statusCounts['ORDER_PLACED'] || 0);
    const processingCount =
      (statusCounts['PROCESSING'] || 0) +
      (statusCounts['READY'] || 0) +
      (statusCounts['ACCEPTED_BY_PARTNER'] || 0) +
      (statusCounts['ASSIGNED'] || 0) +
      (statusCounts['PENDING_ASSIGNMENT'] || 0);
    const outForDeliveryCount = statusCounts['OUT_FOR_DELIVERY'] || 0;
    const deliveredCount = (statusCounts['DELIVERED'] || 0) + (statusCounts['COMPLETED'] || 0);
    const cancelledCount = statusCounts['CANCELLED'] || 0;

    // Delivery pipeline status
    const [
      ordersWaitingAssignment,
      ordersAssignedTotal,
      ordersOutForDeliveryTotal,
    ] = await Promise.all([
      this.prisma.order.count({
        where: {
          status: { in: ['NEW', 'PENDING_ASSIGNMENT'] },
          distributorId: null,
        },
      }),
      this.prisma.order.count({
        where: {
          distributorId: { not: null },
          status: { in: ['ASSIGNED', 'ACCEPTED_BY_PARTNER', 'PROCESSING', 'READY'] },
        },
      }),
      this.prisma.order.count({
        where: { status: 'OUT_FOR_DELIVERY' },
      }),
    ]);

    // 5. Membership Performance
    const purchaseMap = new Map<string, { count: number; revenue: number }>();
    purchasesByPackageGroup.forEach((p) => {
      purchaseMap.set(p.packageId, {
        count: p._count.id,
        revenue: p._sum.amount ?? 0,
      });
    });

    const membershipPerformance = packagesList.map((pkg) => {
      const stats = purchaseMap.get(pkg.id) || { count: 0, revenue: 0 };
      return {
        id: pkg.id,
        name: pkg.name,
        jarCount: pkg.jarCount,
        price: pkg.price,
        soldCount: stats.count,
        revenue: stats.revenue,
        packageBadge: pkg.packageBadge,
        packageColor: pkg.packageColor,
      };
    }).sort((a, b) => b.soldCount - a.soldCount);

    // 6. Sales Time-Series (for chart)
    const periodOrders = await this.prisma.order.findMany({
      where: {
        createdAt: { gte: rangeStart, lte: rangeEnd },
        status: { not: 'CANCELLED' },
      },
      select: {
        id: true,
        totalAmount: true,
        createdAt: true,
      },
    });

    const periodPurchases = await this.prisma.packagePurchase.findMany({
      where: {
        createdAt: { gte: rangeStart, lte: rangeEnd },
        paymentStatus: 'SUCCESS',
      },
      select: {
        id: true,
        amount: true,
        createdAt: true,
      },
    });

    // Generate daily buckets
    const daysDiff = Math.max(1, Math.ceil((rangeEnd.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24)));
    const timeSeriesMap = new Map<string, { date: string; label: string; orderSales: number; membershipSales: number; totalSales: number; orderCount: number }>();

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
      });
    }

    periodOrders.forEach((o) => {
      const dateKey = o.createdAt.toISOString().split('T')[0];
      const bucket = timeSeriesMap.get(dateKey);
      if (bucket) {
        bucket.orderSales += o.totalAmount;
        bucket.totalSales += o.totalAmount;
        bucket.orderCount += 1;
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

    // 7. Customer Overview
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const activeCustomerIds = await this.prisma.order.groupBy({
      by: ['customerId'],
      where: { createdAt: { gte: thirtyDaysAgo } },
    });
    const activeCustomersCount = activeCustomerIds.length;
    const inactiveCustomersCount = Math.max(0, totalCustomersCount - activeCustomersCount);

    const periodNewCustomers = await this.prisma.customer.findMany({
      where: { user: { createdAt: { gte: rangeStart, lte: rangeEnd } } },
      select: { user: { select: { createdAt: true } } },
    });

    const customerTrendMap = new Map<string, number>();
    salesTimeSeries.forEach((s) => customerTrendMap.set(s.date, 0));
    periodNewCustomers.forEach((c) => {
      const dateKey = c.user.createdAt.toISOString().split('T')[0];
      customerTrendMap.set(dateKey, (customerTrendMap.get(dateKey) || 0) + 1);
    });

    const customerGrowthTrend = salesTimeSeries.map((s) => ({
      date: s.date,
      label: s.label,
      count: customerTrendMap.get(s.date) || 0,
    }));

    // 8. Needs Attention (Real Actionable Issues)
    const [
      unassignedOrders,
      pendingPaymentOrders,
      delayedOrders,
      inactiveDistributors,
      incompleteCustomers,
    ] = await Promise.all([
      this.prisma.order.findMany({
        where: {
          status: { in: ['NEW', 'PENDING_ASSIGNMENT'] },
          distributorId: null,
        },
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          totalAmount: true,
          createdAt: true,
          customer: { select: { user: { select: { firstName: true, lastName: true } } } },
        },
      }),
      this.prisma.order.findMany({
        where: {
          paymentStatus: { in: ['PENDING', 'FAILED'] },
          status: { not: 'CANCELLED' },
        },
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          totalAmount: true,
          paymentStatus: true,
          createdAt: true,
          customer: { select: { user: { select: { firstName: true, lastName: true } } } },
        },
      }),
      this.prisma.order.findMany({
        where: {
          scheduledDate: { lt: todayStart },
          status: { notIn: ['DELIVERED', 'COMPLETED', 'CANCELLED'] },
        },
        take: 5,
        orderBy: { scheduledDate: 'asc' },
        select: {
          id: true,
          scheduledDate: true,
          status: true,
          customer: { select: { user: { select: { firstName: true, lastName: true } } } },
        },
      }),
      this.prisma.user.findMany({
        where: {
          role: UserRole.DISTRIBUTOR,
          isActive: false,
        },
        take: 5,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          distributor: { select: { agencyName: true } },
        },
      }),
      this.prisma.customer.findMany({
        where: {
          addresses: { none: {} },
        },
        take: 5,
        select: {
          id: true,
          user: { select: { firstName: true, lastName: true, phone: true } },
        },
      }),
    ]);

    const attentionItems: Array<{
      id: string;
      type: string;
      title: string;
      description: string;
      count: number;
      severity: 'high' | 'medium' | 'low';
      link: string;
      actionLabel: string;
      sampleItems: string[];
    }> = [];

    if (unassignedOrders.length > 0) {
      attentionItems.push({
        id: 'unassigned_orders',
        type: 'UNASSIGNED_ORDERS',
        title: `${unassignedOrders.length} ${unassignedOrders.length === 1 ? 'order is' : 'orders are'} waiting for assignment`,
        description: 'New orders require a distributor to be assigned before delivery processing.',
        count: unassignedOrders.length,
        severity: 'high',
        link: '/staff/orders',
        actionLabel: 'Assign Orders',
        sampleItems: unassignedOrders.map(
          (o) => `Order #${o.id.slice(0, 8).toUpperCase()} (₹${o.totalAmount}) - ${o.customer?.user?.firstName || 'Customer'}`
        ),
      });
    }

    if (pendingPaymentOrders.length > 0) {
      attentionItems.push({
        id: 'pending_payments',
        type: 'PENDING_PAYMENTS',
        title: `${pendingPaymentOrders.length} ${pendingPaymentOrders.length === 1 ? 'payment needs' : 'payments need'} verification`,
        description: 'Orders are awaiting payment confirmation or resolution.',
        count: pendingPaymentOrders.length,
        severity: 'medium',
        link: '/staff/orders',
        actionLabel: 'Verify Payments',
        sampleItems: pendingPaymentOrders.map(
          (o) => `Order #${o.id.slice(0, 8).toUpperCase()} - ₹${o.totalAmount} (${o.paymentStatus})`
        ),
      });
    }

    if (delayedOrders.length > 0) {
      attentionItems.push({
        id: 'delayed_deliveries',
        type: 'DELAYED_DELIVERIES',
        title: `${delayedOrders.length} ${delayedOrders.length === 1 ? 'delivery is' : 'deliveries are'} overdue`,
        description: 'Orders have passed their scheduled delivery date without being completed.',
        count: delayedOrders.length,
        severity: 'high',
        link: '/staff/orders',
        actionLabel: 'Check Deliveries',
        sampleItems: delayedOrders.map(
          (o) => `Order #${o.id.slice(0, 8).toUpperCase()} scheduled for ${new Date(o.scheduledDate!).toLocaleDateString('en-IN')}`
        ),
      });
    }

    if (inactiveDistributors.length > 0) {
      attentionItems.push({
        id: 'inactive_distributors',
        type: 'INACTIVE_DISTRIBUTORS',
        title: `${inactiveDistributors.length} ${inactiveDistributors.length === 1 ? 'distributor is' : 'distributors are'} inactive`,
        description: 'Inactive partner accounts may affect local order routing.',
        count: inactiveDistributors.length,
        severity: 'low',
        link: '/staff/distributors',
        actionLabel: 'Manage Distributors',
        sampleItems: inactiveDistributors.map(
          (d) => `${d.distributor?.agencyName || `${d.firstName} ${d.lastName}`} (${d.phone})`
        ),
      });
    }

    if (incompleteCustomers.length > 0) {
      attentionItems.push({
        id: 'incomplete_customers',
        type: 'INCOMPLETE_CUSTOMERS',
        title: `${incompleteCustomers.length} ${incompleteCustomers.length === 1 ? 'customer has' : 'customers have'} incomplete details`,
        description: 'Customers registered without a delivery address on file.',
        count: incompleteCustomers.length,
        severity: 'low',
        link: '/staff/customers',
        actionLabel: 'View Customers',
        sampleItems: incompleteCustomers.map(
          (c) => `${c.user?.firstName || ''} ${c.user?.lastName || ''} (${c.user?.phone || 'No phone'})`.trim()
        ),
      });
    }

    // 9. Recent Staff Activity Feed
    const [recentStatusHistory, recentAuditLogs, recentCustomers, recentDrivers] = await Promise.all([
      this.prisma.orderStatusHistory.findMany({
        take: 12,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { firstName: true, lastName: true, role: true } },
          order: { select: { id: true, totalAmount: true } },
        },
      }),
      this.prisma.auditLog.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { firstName: true, lastName: true, role: true } },
        },
      }),
      this.prisma.customer.findMany({
        take: 6,
        orderBy: { user: { createdAt: 'desc' } },
        include: {
          user: { select: { firstName: true, lastName: true, phone: true, createdAt: true } },
        },
      }),
      this.prisma.driver.findMany({
        take: 6,
        orderBy: { createdAt: 'desc' },
        select: { id: true, name: true, phone: true, createdAt: true },
      }),
    ]);

    const activityList: Array<{
      id: string;
      timestamp: string;
      type: 'ORDER' | 'CUSTOMER' | 'DRIVER' | 'SYSTEM' | 'SECURITY';
      title: string;
      description?: string;
      actor: string;
      role: string;
    }> = [];

    recentStatusHistory.forEach((h) => {
      activityList.push({
        id: `osh_${h.id}`,
        timestamp: h.createdAt.toISOString(),
        type: 'ORDER',
        title: `Order #${h.order?.id?.slice(0, 8).toUpperCase() || 'ORDER'} marked ${h.newStatus.replace(/_/g, ' ')}`,
        description: h.reason || `Status updated from ${h.previousStatus.replace(/_/g, ' ')}`,
        actor: h.user ? `${h.user.firstName} ${h.user.lastName}`.trim() : 'System',
        role: h.user?.role || 'SYSTEM',
      });
    });

    recentAuditLogs.forEach((a) => {
      if (a.action === 'CREATE_CUSTOMER') {
        activityList.push({
          id: `audit_${a.id}`,
          timestamp: a.createdAt.toISOString(),
          type: 'CUSTOMER',
          title: `New customer profile created`,
          description: `Action logged: ${a.action}`,
          actor: a.user ? `${a.user.firstName} ${a.user.lastName}`.trim() : 'Staff',
          role: a.user?.role || 'STAFF',
        });
      } else if (a.action.includes('PASSWORD')) {
        activityList.push({
          id: `audit_${a.id}`,
          timestamp: a.createdAt.toISOString(),
          type: 'SECURITY',
          title: a.action.replace(/_/g, ' '),
          description: `User account security event`,
          actor: a.user ? `${a.user.firstName} ${a.user.lastName}`.trim() : 'User',
          role: a.user?.role || 'USER',
        });
      }
    });

    recentCustomers.forEach((c) => {
      activityList.push({
        id: `cust_${c.id}`,
        timestamp: c.user.createdAt.toISOString(),
        type: 'CUSTOMER',
        title: `Customer "${c.user.firstName} ${c.user.lastName}".trim() added`,
        description: `Phone: ${c.user.phone}`,
        actor: 'Staff / Online',
        role: 'STAFF',
      });
    });

    recentDrivers.forEach((d) => {
      activityList.push({
        id: `drv_${d.id}`,
        timestamp: d.createdAt.toISOString(),
        type: 'DRIVER',
        title: `New driver "${d.name}" onboarded`,
        description: `Phone: ${d.phone}`,
        actor: 'Staff',
        role: 'STAFF',
      });
    });

    activityList.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const uniqueActivities = activityList.slice(0, 15);

    return {
      dateRange: {
        preset,
        startDate: rangeStart.toISOString(),
        endDate: rangeEnd.toISOString(),
      },
      today: {
        ordersCount: ordersTodayCount,
        salesAmount: (ordersTodaySalesAgg._sum.totalAmount ?? 0) + (packagesTodaySalesAgg._sum.amount ?? 0),
        orderSales: ordersTodaySalesAgg._sum.totalAmount ?? 0,
        membershipSales: packagesTodaySalesAgg._sum.amount ?? 0,
        newCustomersCount: customersTodayCount,
        deliveriesCount: deliveriesTodayCount,
        membershipsSoldCount: packagesTodayCount,
        activeDistributorsCount,
        activeDriversCount,
        pendingOrdersCount,
      },
      period: {
        ordersCount: ordersPeriodCount,
        salesAmount: (ordersPeriodSalesAgg._sum.totalAmount ?? 0) + (packagesPeriodSalesAgg._sum.amount ?? 0),
        orderSales: ordersPeriodSalesAgg._sum.totalAmount ?? 0,
        membershipSales: packagesPeriodSalesAgg._sum.amount ?? 0,
        newCustomersCount: customersPeriodCount,
        deliveriesCount: deliveriesPeriodCount,
        membershipsSoldCount: packagesPeriodCount,
        cancelledOrdersCount: cancelledOrdersPeriodCount,
        averageOrderValue: ordersPeriodCount > 0
          ? Math.round(((ordersPeriodSalesAgg._sum.totalAmount ?? 0) / ordersPeriodCount) * 100) / 100
          : 0,
      },
      operations: {
        ordersReceived: receivedCount,
        ordersProcessing: processingCount,
        ordersOutForDelivery: outForDeliveryCount,
        ordersDelivered: deliveredCount,
        ordersCancelled: cancelledCount,
        totalHandled: ordersPeriodCount,
        deliveryPipeline: {
          waitingAssignment: ordersWaitingAssignment,
          assigned: ordersAssignedTotal,
          outForDelivery: ordersOutForDeliveryTotal,
          delivered: deliveriesPeriodCount,
          cancelled: cancelledCount,
        },
      },
      fleet: {
        activeDistributors: activeDistributorsCount,
        totalDistributors: totalDistributorsCount,
        activeDrivers: activeDriversCount,
        totalDrivers: totalDriversCount,
      },
      customers: {
        totalCustomers: totalCustomersCount,
        newCustomersInRange: customersPeriodCount,
        activeCustomers: activeCustomersCount,
        inactiveCustomers: inactiveCustomersCount,
        growthTrend: customerGrowthTrend,
      },
      salesTimeSeries,
      membershipPerformance,
      attentionItems,
      recentActivity: uniqueActivities,
    };
  }
}

