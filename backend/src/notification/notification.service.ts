import { Injectable } from '@nestjs/common';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationService {
  constructor(private prisma: PrismaService) {}

  create(createNotificationDto: CreateNotificationDto) {
    return this.prisma.notification.create({ data: createNotificationDto as any });
  }

  findAll() {
    return this.prisma.notification.findMany({ include: { user: true }, orderBy: { createdAt: 'desc' }, take: 100 });
  }

  findOne(id: string | number) {
    return this.prisma.notification.findUnique({ where: { id: String(id) }, include: { user: true } });
  }

  update(id: string | number, updateNotificationDto: UpdateNotificationDto) {
    return this.prisma.notification.update({ where: { id: String(id) }, data: updateNotificationDto as any });
  }

  remove(id: string | number) {
    return this.prisma.notification.delete({ where: { id: String(id) } });
  }
}
