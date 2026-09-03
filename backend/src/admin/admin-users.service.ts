import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AdminUsersService {
  constructor(private prisma: PrismaService) {}

  async findAllUsers(query: {
    role?: string;
    status?: string;
    search?: string;
  }) {
    const where: any = {};

    // Role filtering
    if (query.role && query.role !== 'ALL') {
      where.role = query.role as UserRole;
    } else {
      // By default for application users & staff, exclude customers unless explicitly requested
      where.role = { in: [UserRole.ADMIN, UserRole.STAFF, UserRole.DELIVERY_PARTNER, UserRole.MANAGER] };
    }

    // Status filtering
    if (query.status === 'ACTIVE') {
      where.isActive = true;
    } else if (query.status === 'INACTIVE') {
      where.isActive = false;
    }

    // Search term
    if (query.search) {
      const term = query.search.trim();
      where.OR = [
        { firstName: { contains: term, mode: 'insensitive' } },
        { lastName: { contains: term, mode: 'insensitive' } },
        { phone: { contains: term, mode: 'insensitive' } },
        { email: { contains: term, mode: 'insensitive' } },
        { id: { contains: term, mode: 'insensitive' } },
      ];
    }

    const users = await this.prisma.user.findMany({
      where,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        deliveryPartner: {
          include: {
            assignments: {
              include: {
                delivery: {
                  select: {
                    id: true,
                    status: true,
                    scheduledFor: true,
                  },
                },
              },
            },
          },
        },
        staff: {
          include: {
            branch: true,
          },
        },
        admin: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return users.map((u) => this.formatUser(u));
  }

  async findDeliveryPartners(query: {
    status?: string;
    availability?: string;
    search?: string;
  }) {
    const users = await this.findAllUsers({
      role: UserRole.DELIVERY_PARTNER,
      status: query.status,
      search: query.search,
    });

    return users;
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { id },
          { deliveryPartner: { id } },
        ],
      },
      include: {
        deliveryPartner: {
          include: {
            assignments: {
              include: {
                delivery: {
                  select: {
                    id: true,
                    status: true,
                    scheduledFor: true,
                  },
                },
              },
              orderBy: { assignedAt: 'desc' },
              take: 20,
            },
          },
        },
        staff: {
          include: {
            branch: true,
          },
        },
        admin: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User or Delivery Partner with ID ${id} not found`);
    }

    return this.formatUser(user);
  }

  async create(data: {
    firstName: string;
    lastName: string;
    phone: string;
    email?: string;
    role: UserRole;
    password?: string;
    vehicleType?: string;
    vehiclePlate?: string;
    jarUnitPrice?: number | string;
    isActive?: boolean;
  }) {
    // Validate phone unique
    const existingPhone = await this.prisma.user.findUnique({
      where: { phone: data.phone },
    });
    if (existingPhone) {
      throw new ConflictException('Phone number is already registered to another user');
    }

    // Validate email unique if provided
    if (data.email) {
      const existingEmail = await this.prisma.user.findUnique({
        where: { email: data.email },
      });
      if (existingEmail) {
        throw new ConflictException('Email address is already registered to another user');
      }
    }

    const rawPassword = data.password || 'Edrops@2026';
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(rawPassword, salt);

    const priceNum = data.jarUnitPrice !== undefined && data.jarUnitPrice !== ''
      ? Number(data.jarUnitPrice)
      : 0;

    if (isNaN(priceNum) || priceNum < 0) {
      throw new BadRequestException('Jar unit price must be a valid non-negative number');
    }

    const user = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone,
          email: data.email || null,
          role: data.role || UserRole.STAFF,
          passwordHash,
          isActive: data.isActive !== false,
        },
      });

      // Role specific records
      if (newUser.role === UserRole.DELIVERY_PARTNER) {
        await tx.deliveryPartner.create({
          data: {
            userId: newUser.id,
            vehicleType: data.vehicleType || 'Motorcycle',
            vehiclePlate: data.vehiclePlate || null,
            jarUnitPrice: new Prisma.Decimal(priceNum),
          },
        });
      } else if (newUser.role === UserRole.STAFF || newUser.role === UserRole.MANAGER) {
        await tx.staff.create({
          data: {
            userId: newUser.id,
            vehicleType: data.vehicleType || null,
            vehiclePlate: data.vehiclePlate || null,
          },
        });
      } else if (newUser.role === UserRole.ADMIN) {
        await tx.admin.create({
          data: {
            userId: newUser.id,
            level: 1,
          },
        });
      }

      return newUser;
    });

    return this.findOne(user.id);
  }

  async update(
    id: string,
    data: {
      firstName?: string;
      lastName?: string;
      phone?: string;
      email?: string;
      role?: UserRole;
      isActive?: boolean;
      password?: string;
      vehicleType?: string;
      vehiclePlate?: string;
      jarUnitPrice?: number | string;
    },
  ) {
    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [
          { id },
          { deliveryPartner: { id } },
        ],
      },
    });

    if (!existing) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    const userId = existing.id;

    // Unique checks
    if (data.phone && data.phone !== existing.phone) {
      const phoneTaken = await this.prisma.user.findFirst({
        where: { phone: data.phone, NOT: { id: userId } },
      });
      if (phoneTaken) {
        throw new ConflictException('Phone number is already in use by another user');
      }
    }

    if (data.email && data.email !== existing.email) {
      const emailTaken = await this.prisma.user.findFirst({
        where: { email: data.email, NOT: { id: userId } },
      });
      if (emailTaken) {
        throw new ConflictException('Email address is already in use by another user');
      }
    }

    const updateData: any = {};
    if (data.firstName !== undefined) updateData.firstName = data.firstName;
    if (data.lastName !== undefined) updateData.lastName = data.lastName;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.email !== undefined) updateData.email = data.email || null;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.role !== undefined) updateData.role = data.role;

    if (data.password) {
      const salt = await bcrypt.genSalt(10);
      updateData.passwordHash = await bcrypt.hash(data.password, salt);
    }

    await this.prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: updateData,
      });

      // Handle Role change lifecycle
      const targetRole = data.role || existing.role;

      if (targetRole === UserRole.DELIVERY_PARTNER) {
        const dp = await tx.deliveryPartner.findUnique({ where: { userId } });
        const dpUpdate: any = {};
        if (data.vehicleType !== undefined) dpUpdate.vehicleType = data.vehicleType;
        if (data.vehiclePlate !== undefined) dpUpdate.vehiclePlate = data.vehiclePlate;
        if (data.jarUnitPrice !== undefined && data.jarUnitPrice !== '') {
          const p = Number(data.jarUnitPrice);
          if (isNaN(p) || p < 0) throw new BadRequestException('Jar unit price must be a valid non-negative number');
          dpUpdate.jarUnitPrice = new Prisma.Decimal(p);
        }

        if (!dp) {
          await tx.deliveryPartner.create({
            data: {
              userId,
              vehicleType: data.vehicleType || 'Motorcycle',
              vehiclePlate: data.vehiclePlate || null,
              jarUnitPrice: dpUpdate.jarUnitPrice || new Prisma.Decimal(0),
            },
          });
        } else if (Object.keys(dpUpdate).length > 0) {
          await tx.deliveryPartner.update({
            where: { userId },
            data: dpUpdate,
          });
        }
      } else if (targetRole === UserRole.STAFF || targetRole === UserRole.MANAGER) {
        const staff = await tx.staff.findUnique({ where: { userId } });
        if (!staff) {
          await tx.staff.create({
            data: {
              userId,
              vehicleType: data.vehicleType || null,
              vehiclePlate: data.vehiclePlate || null,
            },
          });
        }
      } else if (targetRole === UserRole.ADMIN) {
        const admin = await tx.admin.findUnique({ where: { userId } });
        if (!admin) {
          await tx.admin.create({
            data: {
              userId,
              level: 1,
            },
          });
        }
      }

      return updatedUser;
    });

    return this.findOne(userId);
  }

  async updateJarUnitPrice(id: string, jarUnitPrice: number | string) {
    if (jarUnitPrice === undefined || jarUnitPrice === null || jarUnitPrice === '') {
      throw new BadRequestException('Jar unit price is required');
    }

    const priceNum = Number(jarUnitPrice);
    if (isNaN(priceNum) || priceNum < 0) {
      throw new BadRequestException('Jar unit price must be a valid non-negative number');
    }

    if (priceNum > 10000) {
      throw new BadRequestException('Jar unit price cannot exceed ₹10,000.00');
    }

    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [
          { id },
          { deliveryPartner: { id } },
        ],
      },
      include: { deliveryPartner: true },
    });

    if (!existing) {
      throw new NotFoundException(`Delivery Partner or User with ID ${id} not found`);
    }

    const userId = existing.id;

    if (!existing.deliveryPartner) {
      await this.prisma.deliveryPartner.create({
        data: {
          userId,
          vehicleType: 'Motorcycle',
          jarUnitPrice: new Prisma.Decimal(priceNum),
        },
      });
    } else {
      await this.prisma.deliveryPartner.update({
        where: { userId },
        data: {
          jarUnitPrice: new Prisma.Decimal(priceNum),
        },
      });
    }

    return this.findOne(userId);
  }

  async remove(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // Soft delete / deactivate
    await this.prisma.user.update({
      where: { id },
      data: { isActive: false },
    });

    return { success: true, message: 'User deactivated successfully' };
  }

  private formatUser(user: any) {
    const assignments = user.deliveryPartner?.assignments || [];
    const totalDeliveries = assignments.length;
    const completedDeliveries = assignments.filter(
      (a: any) => a.delivery?.status === 'COMPLETED' || a.delivery?.status === 'DELIVERED',
    ).length;

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const todayDeliveries = assignments.filter((a: any) => {
      const d = a.assignedAt ? new Date(a.assignedAt) : new Date(user.createdAt);
      return d >= startOfToday;
    }).length;

    const rawJarPrice = user.deliveryPartner?.jarUnitPrice;
    const jarUnitPrice = rawJarPrice !== undefined && rawJarPrice !== null
      ? Number(rawJarPrice)
      : 0;

    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: `${user.firstName} ${user.lastName}`.trim(),
      phone: user.phone,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      deliveryPartner: user.deliveryPartner
        ? {
            id: user.deliveryPartner.id,
            vehicleType: user.deliveryPartner.vehicleType || 'Standard Vehicle',
            vehiclePlate: user.deliveryPartner.vehiclePlate || '—',
            jarUnitPrice,
            totalDeliveries,
            completedDeliveries,
            todayDeliveries,
            availability: user.isActive ? 'Online' : 'Offline',
            recentAssignments: user.deliveryPartner.assignments || [],
          }
        : null,
      staff: user.staff,
      admin: user.admin,
    };
  }
}
