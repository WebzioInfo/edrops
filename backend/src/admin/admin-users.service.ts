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
      where.role = {
        in: [
          UserRole.ADMIN,
          UserRole.STAFF,
          UserRole.DELIVERY_PARTNER,
          UserRole.MANAGER,
          UserRole.DISTRIBUTOR,
        ],
      };
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
        { distributor: { referralCode: { contains: term, mode: 'insensitive' } } },
        { distributor: { agencyName: { contains: term, mode: 'insensitive' } } },
        { customer: { referralCode: { contains: term, mode: 'insensitive' } } },
        { distributorPincodes: { some: { pincode: { contains: term } } } },
      ];
    }

    const users = await this.prisma.user.findMany({
      where,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        alternatePhone: true,
        email: true,
        avatarUrl: true,
        role: true,
        permissions: true,
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
                    address: {
                      select: {
                        zipCode: true,
                        city: true,
                        area: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
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
          select: {
            id: true,
            pincode: true,
            location: true,
            district: true,
            state: true,
            isActive: true,
          },
        },
        drivers: {
          select: {
            id: true,
            name: true,
            phone: true,
            pincode: true,
            vehicleType: true,
            vehicleNumber: true,
            routeOrArea: true,
            isActive: true,
          },
        },
        customer: {
          select: {
            referralCode: true,
            customerType: true,
            companyName: true,
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

    // Lookup matching driver records for delivery partners
    const dpPhones = users
      .filter((u) => u.role === UserRole.DELIVERY_PARTNER && u.phone)
      .map((u) => u.phone);
    const dpCleanPhones = dpPhones.map((p) => p.replace(/^\+91/, '').trim());
    const dpPlates = users
      .filter((u) => u.role === UserRole.DELIVERY_PARTNER && u.deliveryPartner?.vehiclePlate)
      .map((u) => u.deliveryPartner!.vehiclePlate!)
      .filter(Boolean);

    const matchingDrivers =
      dpPhones.length > 0 || dpPlates.length > 0
        ? await this.prisma.driver.findMany({
            where: {
              OR: [
                { phone: { in: [...dpPhones, ...dpCleanPhones] } },
                ...(dpPlates.length > 0 ? [{ vehicleNumber: { in: dpPlates } }] : []),
              ],
            },
          })
        : [];

    return users.map((u) => this.formatUser(u, matchingDrivers));
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
          { distributor: { id } },
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
                    address: {
                      select: {
                        zipCode: true,
                        city: true,
                        area: true,
                      },
                    },
                  },
                },
              },
              orderBy: { assignedAt: 'desc' },
              take: 20,
            },
          },
        },
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
          select: {
            id: true,
            pincode: true,
            location: true,
            district: true,
            state: true,
            isActive: true,
          },
        },
        drivers: {
          select: {
            id: true,
            name: true,
            phone: true,
            pincode: true,
            vehicleType: true,
            vehicleNumber: true,
            routeOrArea: true,
            isActive: true,
          },
        },
        customer: {
          select: {
            referralCode: true,
            customerType: true,
            companyName: true,
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
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    let matchingDrivers: any[] = [];
    if (user.role === UserRole.DELIVERY_PARTNER) {
      const cleanPhone = user.phone ? user.phone.replace(/^\+91/, '').trim() : '';
      matchingDrivers = await this.prisma.driver.findMany({
        where: {
          OR: [
            { phone: user.phone },
            ...(cleanPhone ? [{ phone: cleanPhone }] : []),
            ...(user.deliveryPartner?.vehiclePlate
              ? [{ vehicleNumber: user.deliveryPartner.vehiclePlate }]
              : []),
          ],
        },
      });
    }

    return this.formatUser(user, matchingDrivers);
  }

  async create(data: {
    firstName: string;
    lastName: string;
    phone: string;
    alternatePhone?: string;
    email?: string;
    role: UserRole;
    password?: string;
    vehicleType?: string;
    vehiclePlate?: string;
    jarUnitPrice?: number | string;
    isActive?: boolean;
    permissions?: string[];
    referralCode?: string;
    agencyName?: string;
    routeOrArea?: string;
    pincode?: string;
    servicePincodes?: string[];
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

    const priceNum =
      data.jarUnitPrice !== undefined && data.jarUnitPrice !== ''
        ? Number(data.jarUnitPrice)
        : 0;

    if (isNaN(priceNum) || priceNum < 0) {
      throw new BadRequestException('Jar unit price must be a valid non-negative number');
    }

    const user = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          firstName: data.firstName.trim(),
          lastName: data.lastName.trim(),
          phone: data.phone.trim(),
          alternatePhone: data.alternatePhone?.trim() || null,
          email: data.email?.trim() || null,
          role: data.role || UserRole.STAFF,
          permissions: Array.isArray(data.permissions) ? data.permissions : [],
          passwordHash,
          isActive: data.isActive !== false,
        },
      });

      // Role specific records
      if (newUser.role === UserRole.DELIVERY_PARTNER) {
        await tx.deliveryPartner.create({
          data: {
            userId: newUser.id,
            vehicleType: data.vehicleType?.trim() || 'Motorcycle',
            vehiclePlate: data.vehiclePlate?.trim() || null,
            jarUnitPrice: new Prisma.Decimal(priceNum),
          },
        });
      } else if (newUser.role === UserRole.DISTRIBUTOR) {
        const cleanRef = data.referralCode?.trim()
          ? data.referralCode.trim().toUpperCase()
          : `EDR-${(newUser.phone || '').replace(/\D/g, '').slice(-4) || 'DIST'}`;

        await tx.distributor.create({
          data: {
            userId: newUser.id,
            referralCode: cleanRef,
            agencyName: data.agencyName?.trim() || null,
            routeOrArea: data.routeOrArea?.trim() || null,
            vehicleType: data.vehicleType?.trim() || null,
            vehiclePlate: data.vehiclePlate?.trim() || null,
          },
        });

        const rawPins = data.servicePincodes || (data.pincode ? data.pincode.split(',') : []);
        const cleanPins = Array.from(
          new Set(
            rawPins
              .map((p: string) => String(p).trim())
              .filter((p: string) => /^\d{6}$/.test(p)),
          ),
        );
        for (const pin of cleanPins) {
          await tx.distributorPincode.create({
            data: {
              distributorId: newUser.id,
              pincode: pin,
              isActive: true,
            },
          });
        }
      } else if (newUser.role === UserRole.STAFF || newUser.role === UserRole.MANAGER) {
        await tx.staff.create({
          data: {
            userId: newUser.id,
            vehicleType: data.vehicleType?.trim() || null,
            vehiclePlate: data.vehiclePlate?.trim() || null,
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
      alternatePhone?: string;
      email?: string;
      role?: UserRole;
      isActive?: boolean;
      password?: string;
      vehicleType?: string;
      vehiclePlate?: string;
      jarUnitPrice?: number | string;
      permissions?: string[];
      referralCode?: string;
      agencyName?: string;
      routeOrArea?: string;
      pincode?: string;
      servicePincodes?: string[];
    },
  ) {
    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [
          { id },
          { deliveryPartner: { id } },
          { distributor: { id } },
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
    if (data.firstName !== undefined) updateData.firstName = data.firstName.trim();
    if (data.lastName !== undefined) updateData.lastName = data.lastName.trim();
    if (data.phone !== undefined) updateData.phone = data.phone.trim();
    if (data.alternatePhone !== undefined) updateData.alternatePhone = data.alternatePhone?.trim() || null;
    if (data.email !== undefined) updateData.email = data.email?.trim() || null;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.role !== undefined) updateData.role = data.role;
    if (data.permissions !== undefined) {
      updateData.permissions = Array.isArray(data.permissions) ? data.permissions : [];
    }

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
        if (data.vehicleType !== undefined) dpUpdate.vehicleType = data.vehicleType?.trim() || null;
        if (data.vehiclePlate !== undefined) dpUpdate.vehiclePlate = data.vehiclePlate?.trim() || null;
        if (data.jarUnitPrice !== undefined && data.jarUnitPrice !== '') {
          const p = Number(data.jarUnitPrice);
          if (isNaN(p) || p < 0) {
            throw new BadRequestException('Jar unit price must be a valid non-negative number');
          }
          dpUpdate.jarUnitPrice = new Prisma.Decimal(p);
        }

        if (!dp) {
          await tx.deliveryPartner.create({
            data: {
              userId,
              vehicleType: data.vehicleType?.trim() || 'Motorcycle',
              vehiclePlate: data.vehiclePlate?.trim() || null,
              jarUnitPrice: dpUpdate.jarUnitPrice || new Prisma.Decimal(0),
            },
          });
        } else if (Object.keys(dpUpdate).length > 0) {
          await tx.deliveryPartner.update({
            where: { userId },
            data: dpUpdate,
          });
        }
      } else if (targetRole === UserRole.DISTRIBUTOR) {
        const dist = await tx.distributor.findUnique({ where: { userId } });
        const cleanRef = data.referralCode?.trim()
          ? data.referralCode.trim().toUpperCase()
          : `EDR-${(updatedUser.phone || '').replace(/\D/g, '').slice(-4) || 'DIST'}`;

        const distData: any = {};
        if (data.agencyName !== undefined) distData.agencyName = data.agencyName?.trim() || null;
        if (data.routeOrArea !== undefined) distData.routeOrArea = data.routeOrArea?.trim() || null;
        if (data.vehicleType !== undefined) distData.vehicleType = data.vehicleType?.trim() || null;
        if (data.vehiclePlate !== undefined) distData.vehiclePlate = data.vehiclePlate?.trim() || null;
        if (data.referralCode !== undefined && data.referralCode?.trim()) {
          distData.referralCode = data.referralCode.trim().toUpperCase();
        }

        if (!dist) {
          await tx.distributor.create({
            data: {
              userId,
              referralCode: cleanRef,
              agencyName: distData.agencyName || null,
              routeOrArea: distData.routeOrArea || null,
              vehicleType: distData.vehicleType || null,
              vehiclePlate: distData.vehiclePlate || null,
            },
          });
        } else if (Object.keys(distData).length > 0) {
          await tx.distributor.update({
            where: { userId },
            data: distData,
          });
        }

        // Handle service pincodes if provided
        if (data.servicePincodes !== undefined || data.pincode !== undefined) {
          const rawPins = data.servicePincodes || (data.pincode ? data.pincode.split(',') : []);
          const cleanPins = Array.from(
            new Set(
              rawPins
                .map((p: string) => String(p).trim())
                .filter((p: string) => /^\d{6}$/.test(p)),
            ),
          );
          if (cleanPins.length > 0) {
            await tx.distributorPincode.deleteMany({
              where: {
                distributorId: userId,
                pincode: { notIn: cleanPins },
              },
            });
            for (const pin of cleanPins) {
              await tx.distributorPincode.upsert({
                where: {
                  distributorId_pincode: {
                    distributorId: userId,
                    pincode: pin,
                  },
                },
                create: {
                  distributorId: userId,
                  pincode: pin,
                  isActive: true,
                },
                update: {
                  isActive: true,
                },
              });
            }
          }
        }
      } else if (targetRole === UserRole.STAFF || targetRole === UserRole.MANAGER) {
        const staff = await tx.staff.findUnique({ where: { userId } });
        if (!staff) {
          await tx.staff.create({
            data: {
              userId,
              vehicleType: data.vehicleType?.trim() || null,
              vehiclePlate: data.vehiclePlate?.trim() || null,
            },
          });
        } else if (data.vehicleType !== undefined || data.vehiclePlate !== undefined) {
          await tx.staff.update({
            where: { userId },
            data: {
              vehicleType: data.vehicleType?.trim() || null,
              vehiclePlate: data.vehiclePlate?.trim() || null,
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

  private formatUser(user: any, matchingDrivers: any[] = []) {
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
    const jarUnitPrice =
      rawJarPrice !== undefined && rawJarPrice !== null ? Number(rawJarPrice) : 0;

    // Driver matching for Delivery Partner
    const userPhoneClean = user.phone ? user.phone.replace(/^\+91/, '').trim() : '';
    const matchedDriver =
      user.role === UserRole.DELIVERY_PARTNER && matchingDrivers.length > 0
        ? matchingDrivers.find(
            (d: any) =>
              (user.phone && d.phone === user.phone) ||
              (userPhoneClean && d.phone === userPhoneClean) ||
              (user.deliveryPartner?.vehiclePlate &&
                d.vehicleNumber &&
                d.vehicleNumber.toLowerCase() === user.deliveryPartner.vehiclePlate.toLowerCase()),
          )
        : null;

    // Referral code (Distributor or Customer)
    const rawReferralCode = user.distributor?.referralCode || user.customer?.referralCode || null;
    const referralCode =
      rawReferralCode && String(rawReferralCode).trim() !== ''
        ? String(rawReferralCode).trim()
        : null;

    // Pincodes logic
    const distributorPincodesList = (user.distributorPincodes || []).map((p: any) => p.pincode);
    const deliveryPartnerFallbackPin =
      assignments.find((a: any) => a.delivery?.address?.zipCode)?.delivery?.address?.zipCode ||
      null;
    const driverPincode = matchedDriver?.pincode || deliveryPartnerFallbackPin || null;

    let pincode: string | null = null;
    if (user.role === UserRole.DISTRIBUTOR) {
      pincode = distributorPincodesList.length > 0 ? distributorPincodesList.join(', ') : null;
    } else if (user.role === UserRole.DELIVERY_PARTNER) {
      pincode = driverPincode || null;
    } else if (user.role === UserRole.CUSTOMER) {
      pincode = user.customer?.addresses?.[0]?.zipCode || null;
    }

    // Vehicle details
    const vehicleType =
      user.deliveryPartner?.vehicleType ||
      user.distributor?.vehicleType ||
      user.staff?.vehicleType ||
      matchedDriver?.vehicleType ||
      null;
    const vehiclePlate =
      user.deliveryPartner?.vehiclePlate ||
      user.distributor?.vehiclePlate ||
      user.staff?.vehiclePlate ||
      matchedDriver?.vehicleNumber ||
      null;

    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: `${user.firstName} ${user.lastName}`.trim(),
      phone: user.phone,
      alternatePhone: user.alternatePhone || null,
      email: user.email,
      avatarUrl: user.avatarUrl || null,
      role: user.role,
      permissions: user.permissions || [],
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      referralCode,
      pincode,
      servicePincodes: distributorPincodesList,
      vehicleType,
      vehiclePlate,
      agencyName: user.distributor?.agencyName || null,
      routeOrArea: user.distributor?.routeOrArea || matchedDriver?.routeOrArea || null,
      deliveryPartner: user.deliveryPartner
        ? {
            id: user.deliveryPartner.id,
            vehicleType:
              user.deliveryPartner.vehicleType || matchedDriver?.vehicleType || 'Standard Vehicle',
            vehiclePlate: user.deliveryPartner.vehiclePlate || matchedDriver?.vehicleNumber || null,
            pincode: driverPincode,
            routeOrArea: matchedDriver?.routeOrArea || null,
            jarUnitPrice,
            totalDeliveries,
            completedDeliveries,
            todayDeliveries,
            availability: user.isActive ? 'Online' : 'Offline',
            recentAssignments: user.deliveryPartner.assignments || [],
            matchedDriver: matchedDriver
              ? {
                  id: matchedDriver.id,
                  name: matchedDriver.name,
                  phone: matchedDriver.phone,
                  pincode: matchedDriver.pincode,
                  vehicleNumber: matchedDriver.vehicleNumber,
                  vehicleType: matchedDriver.vehicleType,
                  routeOrArea: matchedDriver.routeOrArea,
                }
              : null,
          }
        : null,
      distributor: user.distributor
        ? {
            id: user.distributor.id,
            referralCode: user.distributor.referralCode,
            agencyName: user.distributor.agencyName || null,
            address: user.distributor.address || null,
            routeOrArea: user.distributor.routeOrArea || null,
            vehicleType: user.distributor.vehicleType || null,
            vehiclePlate: user.distributor.vehiclePlate || null,
            jarOwnership: user.distributor.jarOwnership || 'COMPANY_OWNED',
            companyOwnedJars: user.distributor.companyOwnedJars ?? 0,
            distributorOwnedJars: user.distributor.distributorOwnedJars ?? 0,
            totalJars:
              (user.distributor.companyOwnedJars ?? 0) +
              (user.distributor.distributorOwnedJars ?? 0),
            servicePincodes: (user.distributorPincodes || []).map((p: any) => ({
              id: p.id,
              pincode: p.pincode,
              location: p.location || null,
              district: p.district || null,
              state: p.state || null,
            })),
            pincodesList: distributorPincodesList,
            driversCount: user.drivers?.length ?? 0,
            drivers: user.drivers || [],
            createdBy: user.distributor.createdBy
              ? {
                  id: user.distributor.createdBy.id,
                  name: `${user.distributor.createdBy.firstName} ${user.distributor.createdBy.lastName}`.trim(),
                  email: user.distributor.createdBy.email,
                }
              : null,
          }
        : null,
      staff: user.staff
        ? {
            id: user.staff.id,
            branchId: user.staff.branchId || null,
            branch: user.staff.branch
              ? {
                  id: user.staff.branch.id,
                  name: user.staff.branch.name,
                  location: user.staff.branch.location,
                  contactInfo: user.staff.branch.contactInfo || null,
                }
              : null,
            vehicleType: user.staff.vehicleType || null,
            vehiclePlate: user.staff.vehiclePlate || null,
          }
        : null,
      admin: user.admin,
      customer: user.customer
        ? {
            referralCode: user.customer.referralCode || null,
            customerType: user.customer.customerType || null,
            companyName: user.customer.companyName || null,
          }
        : null,
    };
  }
}
