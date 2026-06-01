import { Injectable } from '@nestjs/common';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  create(createAdminDto: CreateAdminDto) {
    return this.prisma.admin.create({ data: createAdminDto as any });
  }

  findAll() {
    return this.prisma.admin.findMany({ include: { user: true }, take: 100 });
  }

  findOne(id: string | number) {
    return this.prisma.admin.findUnique({ where: { id: String(id) }, include: { user: true } });
  }

  update(id: string | number, updateAdminDto: UpdateAdminDto) {
    return this.prisma.admin.update({ where: { id: String(id) }, data: updateAdminDto as any });
  }

  remove(id: string | number) {
    return this.prisma.admin.delete({ where: { id: String(id) } });
  }
}
