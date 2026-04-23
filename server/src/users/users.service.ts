import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(role?: Role) {
    return this.prisma.user.findMany({
      where: { deletedAt: null, ...(role && { role }) },
      select: {
        id: true, name: true, phone: true, email: true, role: true,
        isActive: true, createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true, name: true, phone: true, email: true, role: true,
        isActive: true, createdAt: true, addresses: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async findByPhone(phone: string) {
    return this.prisma.user.findUnique({ where: { phone } });
  }

  async create(data: {
    name: string;
    phone: string;
    email?: string;
    password: string;
    role?: Role;
  }) {
    return this.prisma.user.create({ data: { ...data, role: data.role ?? 'CUSTOMER' } });
  }

  async update(id: string, data: Partial<{ name: string; email: string; isActive: boolean }>) {
    return this.prisma.user.update({ where: { id }, data });
  }

  async softDelete(id: string) {
    return this.prisma.user.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async addAddress(
    userId: string,
    data: {
      label?: string; line1: string; line2?: string;
      city: string; district: string; pincode: string;
      landmark?: string; latitude?: number; longitude?: number; isDefault?: boolean;
    },
  ) {
    if (data.isDefault) {
      await this.prisma.address.updateMany({
        where: { userId }, data: { isDefault: false },
      });
    }
    return this.prisma.address.create({ data: { ...data, userId } });
  }

  async getAddresses(userId: string) {
    return this.prisma.address.findMany({ where: { userId, deletedAt: null } });
  }
}
