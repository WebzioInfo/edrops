import { Injectable } from '@nestjs/common';
import { CreateSettingDto } from './dto/create-setting.dto';
import { UpdateSettingDto } from './dto/update-setting.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  async getSetting(key: string, defaultValue: string): Promise<string> {
    const setting = await this.prisma.settings.findUnique({ where: { key } });
    return setting ? setting.value : defaultValue;
  }

  async getSettingNumber(key: string, defaultValue: number): Promise<number> {
    const val = await this.getSetting(key, String(defaultValue));
    const num = parseFloat(val);
    return isNaN(num) ? defaultValue : num;
  }

  async updateBulk(settings: Record<string, string>) {
    return this.prisma.$transaction(async (tx) => {
      const results: any[] = [];
      for (const [key, value] of Object.entries(settings)) {
        const res = await tx.settings.upsert({
          where: { key },
          update: { value },
          create: { key, value },
        });
        results.push(res);
      }
      return results;
    });
  }

  create(createSettingDto: CreateSettingDto) {
    return this.prisma.settings.create({ data: createSettingDto as any });
  }

  findAll() {
    return this.prisma.settings.findMany({
      orderBy: { key: 'asc' },
      take: 100,
    });
  }

  findOne(id: string | number) {
    return this.prisma.settings.findUnique({ where: { id: String(id) } });
  }

  update(id: string | number, updateSettingDto: UpdateSettingDto) {
    return this.prisma.settings.update({
      where: { id: String(id) },
      data: updateSettingDto as any,
    });
  }

  remove(id: string | number) {
    return this.prisma.settings.delete({ where: { id: String(id) } });
  }
}
