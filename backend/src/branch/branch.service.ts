import { Injectable } from '@nestjs/common';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BranchService {
  constructor(private prisma: PrismaService) {}

  create(createBranchDto: CreateBranchDto) {
    return this.prisma.branch.create({ data: createBranchDto as any });
  }

  findAll() {
    return this.prisma.branch.findMany({ include: { staff: true }, take: 100 });
  }

  findOne(id: string | number) {
    return this.prisma.branch.findUnique({
      where: { id: String(id) },
      include: { staff: true },
    });
  }

  update(id: string | number, updateBranchDto: UpdateBranchDto) {
    return this.prisma.branch.update({
      where: { id: String(id) },
      data: updateBranchDto as any,
    });
  }

  remove(id: string | number) {
    return this.prisma.branch.delete({ where: { id: String(id) } });
  }
}
