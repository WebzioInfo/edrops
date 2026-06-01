import { Injectable } from '@nestjs/common';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportDto } from './dto/update-report.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportService {
  constructor(private prisma: PrismaService) {}

  create(createReportDto: CreateReportDto) {
    return this.prisma.report.create({ data: createReportDto as any });
  }

  findAll() {
    return this.prisma.report.findMany({ orderBy: { generatedAt: 'desc' }, take: 100 });
  }

  findOne(id: string | number) {
    return this.prisma.report.findUnique({ where: { id: String(id) } });
  }

  update(id: string | number, updateReportDto: UpdateReportDto) {
    return this.prisma.report.update({ where: { id: String(id) }, data: updateReportDto as any });
  }

  remove(id: string | number) {
    return this.prisma.report.delete({ where: { id: String(id) } });
  }
}
