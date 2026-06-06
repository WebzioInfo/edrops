import { Injectable } from '@nestjs/common';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PermissionService {
  constructor(private prisma: PrismaService) {}

  create(createPermissionDto: CreatePermissionDto) {
    return this.prisma.permission.create({ data: createPermissionDto as any });
  }

  findAll() {
    return this.prisma.permission.findMany({
      include: { role: true },
      take: 100,
    });
  }

  findOne(id: string | number) {
    return this.prisma.permission.findUnique({
      where: { id: String(id) },
      include: { role: true },
    });
  }

  update(id: string | number, updatePermissionDto: UpdatePermissionDto) {
    return this.prisma.permission.update({
      where: { id: String(id) },
      data: updatePermissionDto as any,
    });
  }

  remove(id: string | number) {
    return this.prisma.permission.delete({ where: { id: String(id) } });
  }
}
