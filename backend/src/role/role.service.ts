import { Injectable } from '@nestjs/common';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RoleService {
  constructor(private prisma: PrismaService) {}

  create(createRoleDto: CreateRoleDto) {
    return this.prisma.role.create({ data: createRoleDto as any });
  }

  findAll() {
    return this.prisma.role.findMany({
      include: { permissions: true },
      take: 100,
    });
  }

  findOne(id: string | number) {
    return this.prisma.role.findUnique({
      where: { id: String(id) },
      include: { permissions: true },
    });
  }

  update(id: string | number, updateRoleDto: UpdateRoleDto) {
    return this.prisma.role.update({
      where: { id: String(id) },
      data: updateRoleDto as any,
    });
  }

  remove(id: string | number) {
    return this.prisma.role.delete({ where: { id: String(id) } });
  }
}
