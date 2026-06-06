import { Injectable } from '@nestjs/common';
import { CreateAuditDto } from './dto/create-audit.dto';
import { UpdateAuditDto } from './dto/update-audit.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  create(createAuditDto: CreateAuditDto) {
    return this.prisma.auditLog.create({ data: createAuditDto as any });
  }

  async log(
    userId: string | null,
    action: string,
    entityType: string,
    entityId: string,
    oldValues?: any,
    newValues?: any,
  ) {
    return this.prisma.auditLog.create({
      data: {
        userId,
        action,
        entityType,
        entityId,
        oldValues: oldValues
          ? JSON.parse(JSON.stringify(oldValues))
          : undefined,
        newValues: newValues
          ? JSON.parse(JSON.stringify(newValues))
          : undefined,
      },
    });
  }

  findAll() {
    return this.prisma.auditLog.findMany({
      include: { user: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  findOne(id: string | number) {
    return this.prisma.auditLog.findUnique({
      where: { id: String(id) },
      include: { user: true },
    });
  }

  update(id: string | number, updateAuditDto: UpdateAuditDto) {
    return this.prisma.auditLog.update({
      where: { id: String(id) },
      data: updateAuditDto as any,
    });
  }

  remove(id: string | number) {
    return this.prisma.auditLog.delete({ where: { id: String(id) } });
  }
}
