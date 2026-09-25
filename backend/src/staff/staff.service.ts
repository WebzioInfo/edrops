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
}
