import { Injectable } from '@nestjs/common';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StaffService {
  constructor(private prisma: PrismaService) {}

  create(createStaffDto: CreateStaffDto) {
    return this.prisma.staff.create({ data: createStaffDto as any });
  }

  findAll() {
    return this.prisma.staff.findMany({ include: { user: true, branch: true }, take: 100 });
  }

  async getDeliveryPartners() {
    return this.prisma.deliveryPartner.findMany({
      include: { user: true }
    });
  }

  findOne(id: string | number) {
    return this.prisma.staff.findUnique({ where: { id: String(id) }, include: { user: true, branch: true } });
  }

  update(id: string | number, updateStaffDto: UpdateStaffDto) {
    return this.prisma.staff.update({ where: { id: String(id) }, data: updateStaffDto as any });
  }

  remove(id: string | number) {
    return this.prisma.staff.delete({ where: { id: String(id) } });
  }
}
