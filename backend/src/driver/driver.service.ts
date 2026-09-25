import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDriverDto } from './dto/create-driver.dto';
import { UpdateDriverDto } from './dto/update-driver.dto';
import { DriverQueryDto } from './dto/driver-query.dto';

@Injectable()
export class DriverService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Normalize vehicle number (uppercase, trimmed, collapsed spaces)
   */
  private normalizeVehicleNumber(val: string): string {
    return val ? val.trim().toUpperCase().replace(/\s+/g, ' ') : '';
  }

  // ==========================================
  // DISTRIBUTOR-SCOPED OPERATIONS
  // ==========================================

  /**
   * List drivers strictly scoped to the authenticated distributor
   */
  async findAllForDistributor(distributorId: string, query: DriverQueryDto) {
    const where: any = { distributorId };

    if (query.status === 'ACTIVE') {
      where.isActive = true;
    } else if (query.status === 'INACTIVE') {
      where.isActive = false;
    }

    if (query.route && query.route.trim()) {
      where.routeOrArea = { contains: query.route.trim(), mode: 'insensitive' };
    }

    if (query.search && query.search.trim()) {
      const term = query.search.trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { phone: { contains: term, mode: 'insensitive' } },
        { alternatePhone: { contains: term, mode: 'insensitive' } },
        { vehicleNumber: { contains: term, mode: 'insensitive' } },
        { vehicleType: { contains: term, mode: 'insensitive' } },
        { routeOrArea: { contains: term, mode: 'insensitive' } },
        { pincode: { contains: term, mode: 'insensitive' } },
      ];
    }

    const [drivers, total, activeCount, inactiveCount] = await Promise.all([
      this.prisma.driver.findMany({
        where,
        orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
        include: {
          _count: {
            select: { orders: true },
          },
        },
      }),
      this.prisma.driver.count({ where: { distributorId } }),
      this.prisma.driver.count({ where: { distributorId, isActive: true } }),
      this.prisma.driver.count({ where: { distributorId, isActive: false } }),
    ]);

    return {
      drivers,
      stats: {
        total,
        active: activeCount,
        inactive: inactiveCount,
      },
    };
  }

  /**
   * Get single driver strictly scoped to authenticated distributor with recent orders/deliveries
   */
  async findOneForDistributor(id: string, distributorId: string) {
    const driver = await this.prisma.driver.findFirst({
      where: { id, distributorId },
      include: {
        _count: {
          select: { orders: true },
        },
        orders: {
          where: { distributorId },
          take: 25,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            status: true,
            totalAmount: true,
            scheduledDate: true,
            createdAt: true,
            paymentStatus: true,
            customer: {
              select: {
                id: true,
                user: {
                  select: {
                    firstName: true,
                    lastName: true,
                    phone: true,
                  },
                },
              },
            },
            address: {
              select: {
                street: true,
                city: true,
                zipCode: true,
                area: true,
              },
            },
          },
        },
      },
    });

    if (!driver) {
      throw new NotFoundException('Driver not found or does not belong to your account');
    }

    return driver;
  }

  /**
   * Create driver for authenticated distributor
   */
  async createForDistributor(distributorId: string, dto: CreateDriverDto) {
    const cleanPhone = dto.phone.trim();
    const cleanVehicleNumber = this.normalizeVehicleNumber(dto.vehicleNumber);

    // Prevent duplicate phone or vehicle number for the same distributor
    const existing = await this.prisma.driver.findFirst({
      where: {
        distributorId,
        isActive: true,
        OR: [{ phone: cleanPhone }, { vehicleNumber: cleanVehicleNumber }],
      },
    });

    if (existing) {
      if (existing.phone === cleanPhone) {
        throw new ConflictException(`An active driver with phone ${cleanPhone} already exists`);
      }
      if (existing.vehicleNumber === cleanVehicleNumber) {
        throw new ConflictException(`An active driver with vehicle number ${cleanVehicleNumber} already exists`);
      }
    }

    const driver = await this.prisma.driver.create({
      data: {
        distributorId,
        name: dto.name.trim(),
        phone: cleanPhone,
        alternatePhone: dto.alternatePhone?.trim() || null,
        routeOrArea: dto.routeOrArea?.trim() || null,
        pincode: dto.pincode ? dto.pincode.trim() : '682001',
        vehicleType: dto.vehicleType.trim(),
        vehicleNumber: cleanVehicleNumber,
        notes: dto.notes?.trim() || null,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      },
    });

    return driver;
  }

  /**
   * Update driver for authenticated distributor
   */
  async updateForDistributor(id: string, distributorId: string, dto: UpdateDriverDto) {
    // Verify ownership
    const existing = await this.prisma.driver.findFirst({
      where: { id, distributorId },
    });

    if (!existing) {
      throw new NotFoundException('Driver not found or does not belong to your account');
    }

    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.phone !== undefined) {
      const cleanPhone = dto.phone.trim();
      // Check duplicate phone
      const duplicatePhone = await this.prisma.driver.findFirst({
        where: {
          distributorId,
          phone: cleanPhone,
          id: { not: id },
          isActive: true,
        },
      });
      if (duplicatePhone) {
        throw new ConflictException(`Another driver with phone ${cleanPhone} already exists`);
      }
      data.phone = cleanPhone;
    }
    if (dto.alternatePhone !== undefined) data.alternatePhone = dto.alternatePhone?.trim() || null;
    if (dto.routeOrArea !== undefined) data.routeOrArea = dto.routeOrArea?.trim() || null;
    if (dto.pincode !== undefined) data.pincode = dto.pincode.trim();
    if (dto.vehicleType !== undefined) data.vehicleType = dto.vehicleType.trim();
    if (dto.vehicleNumber !== undefined) {
      const cleanVehicle = this.normalizeVehicleNumber(dto.vehicleNumber);
      const duplicateVehicle = await this.prisma.driver.findFirst({
        where: {
          distributorId,
          vehicleNumber: cleanVehicle,
          id: { not: id },
          isActive: true,
        },
      });
      if (duplicateVehicle) {
        throw new ConflictException(`Another driver with vehicle number ${cleanVehicle} already exists`);
      }
      data.vehicleNumber = cleanVehicle;
    }
    if (dto.notes !== undefined) data.notes = dto.notes?.trim() || null;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    return this.prisma.driver.update({
      where: { id },
      data,
    });
  }

  /**
   * Toggle driver active status
   */
  async toggleStatusForDistributor(id: string, distributorId: string, isActive: boolean) {
    const existing = await this.prisma.driver.findFirst({
      where: { id, distributorId },
    });

    if (!existing) {
      throw new NotFoundException('Driver not found or does not belong to your account');
    }

    return this.prisma.driver.update({
      where: { id },
      data: { isActive },
    });
  }

  /**
   * Delete / Deactivate driver for distributor.
   * If driver has assigned orders, soft-deactivate to preserve historical records.
   */
  async deleteForDistributor(id: string, distributorId: string) {
    const existing = await this.prisma.driver.findFirst({
      where: { id, distributorId },
    });

    if (!existing) {
      throw new NotFoundException('Driver not found or does not belong to your account');
    }

    const orderCount = await this.prisma.order.count({
      where: { driverId: id },
    });

    if (orderCount > 0) {
      // Historical orders exist -> soft delete by deactivating
      const updated = await this.prisma.driver.update({
        where: { id },
        data: { isActive: false },
      });
      return {
        message: 'Driver has historical orders and was deactivated to preserve history.',
        deactivated: true,
        driver: updated,
      };
    }

    // No historical orders -> safe hard delete
    await this.prisma.driver.delete({
      where: { id },
    });

    return {
      message: 'Driver deleted successfully.',
      deactivated: false,
    };
  }

  // ==========================================
  // STAFF-SCOPED OPERATIONS
  // ==========================================

  /**
   * List drivers across distributors with optional distributor filter
   */
  async findAllForStaff(query: DriverQueryDto) {
    const where: any = {};

    if (query.distributorId && query.distributorId !== 'ALL') {
      where.distributorId = query.distributorId;
    }

    if (query.status === 'ACTIVE') {
      where.isActive = true;
    } else if (query.status === 'INACTIVE') {
      where.isActive = false;
    }

    if (query.route && query.route.trim()) {
      where.routeOrArea = { contains: query.route.trim(), mode: 'insensitive' };
    }

    if (query.search && query.search.trim()) {
      const term = query.search.trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { phone: { contains: term, mode: 'insensitive' } },
        { vehicleNumber: { contains: term, mode: 'insensitive' } },
        { vehicleType: { contains: term, mode: 'insensitive' } },
        { routeOrArea: { contains: term, mode: 'insensitive' } },
        { pincode: { contains: term, mode: 'insensitive' } },
        {
          distributor: {
            OR: [
              { firstName: { contains: term, mode: 'insensitive' } },
              { lastName: { contains: term, mode: 'insensitive' } },
              {
                distributor: {
                  agencyName: { contains: term, mode: 'insensitive' },
                },
              },
            ],
          },
        },
      ];
    }

    const [drivers, total, activeCount, inactiveCount] = await Promise.all([
      this.prisma.driver.findMany({
        where,
        orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
        include: {
          distributor: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
              email: true,
              distributor: {
                select: {
                  agencyName: true,
                  referralCode: true,
                  routeOrArea: true,
                },
              },
            },
          },
          _count: {
            select: { orders: true },
          },
        },
      }),
      this.prisma.driver.count({ where: query.distributorId ? { distributorId: query.distributorId } : undefined }),
      this.prisma.driver.count({ where: { ...(query.distributorId ? { distributorId: query.distributorId } : {}), isActive: true } }),
      this.prisma.driver.count({ where: { ...(query.distributorId ? { distributorId: query.distributorId } : {}), isActive: false } }),
    ]);

    return {
      drivers,
      stats: {
        total,
        active: activeCount,
        inactive: inactiveCount,
      },
    };
  }

  /**
   * Get single driver for staff
   */
  async findOneForStaff(id: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { id },
      include: {
        distributor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
            distributor: {
              select: {
                agencyName: true,
                referralCode: true,
                routeOrArea: true,
              },
            },
          },
        },
        _count: {
          select: { orders: true },
        },
        orders: {
          take: 30,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            status: true,
            totalAmount: true,
            scheduledDate: true,
            createdAt: true,
            paymentStatus: true,
            customer: {
              select: {
                id: true,
                user: {
                  select: {
                    firstName: true,
                    lastName: true,
                    phone: true,
                  },
                },
              },
            },
            address: {
              select: {
                street: true,
                city: true,
                zipCode: true,
                area: true,
              },
            },
          },
        },
      },
    });

    if (!driver) {
      throw new NotFoundException('Driver not found');
    }

    return driver;
  }

  /**
   * Create driver on behalf of a distributor (Staff / Admin)
   */
  async createForStaff(dto: CreateDriverDto) {
    if (!dto.distributorId) {
      throw new BadRequestException('distributorId is required when creating driver from Staff Portal');
    }

    // Verify distributor exists
    const distributor = await this.prisma.user.findFirst({
      where: { id: dto.distributorId, role: 'DISTRIBUTOR' },
    });
    if (!distributor) {
      throw new BadRequestException('Selected distributor not found');
    }

    return this.createForDistributor(dto.distributorId, dto);
  }

  /**
   * Update driver (Staff / Admin)
   */
  async updateForStaff(id: string, dto: UpdateDriverDto) {
    const existing = await this.prisma.driver.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Driver not found');
    }
    return this.updateForDistributor(id, existing.distributorId, dto);
  }

  /**
   * Toggle status for Staff
   */
  async toggleStatusForStaff(id: string, isActive: boolean) {
    const existing = await this.prisma.driver.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Driver not found');
    }
    return this.toggleStatusForDistributor(id, existing.distributorId, isActive);
  }

  /**
   * Delete or deactivate for Staff
   */
  async deleteForStaff(id: string) {
    const existing = await this.prisma.driver.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Driver not found');
    }
    return this.deleteForDistributor(id, existing.distributorId);
  }
}
