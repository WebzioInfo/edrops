import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type ScheduleRuleInput = {
  type: 'WEEKLY' | 'INTERVAL' | 'CUSTOM';
  dayOfWeek?: number;
  quantity?: number;
  intervalDays?: number;
  customNotes?: string;
};

export type ScheduleUpdateInput = {
  isActive?: boolean;
  rules: ScheduleRuleInput[];
};

@Injectable()
export class ScheduleService {
  constructor(private prisma: PrismaService) {}

  async getSchedule(userId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { userId },
    });
    if (!customer) throw new NotFoundException('Customer profile not found');

    let schedule = await this.prisma.deliverySchedule.findUnique({
      where: { customerId: customer.id },
      include: { rules: true },
    });

    if (!schedule) {
      schedule = await this.prisma.deliverySchedule.create({
        data: { customerId: customer.id, isActive: true },
        include: { rules: true },
      });
    }

    return schedule;
  }

  async updateSchedule(userId: string, data: ScheduleUpdateInput) {
    const customer = await this.prisma.customer.findUnique({
      where: { userId },
    });
    if (!customer) throw new NotFoundException('Customer profile not found');

    return this.updateScheduleByCustomerId(customer.id, data);
  }

  async updateScheduleByCustomerId(
    customerId: string,
    data: ScheduleUpdateInput,
  ) {
    this.validateRules(data.rules ?? []);

    return this.prisma.$transaction(async (tx) => {
      let schedule = await tx.deliverySchedule.findUnique({
        where: { customerId },
      });

      if (!schedule) {
        schedule = await tx.deliverySchedule.create({
          data: { customerId, isActive: data.isActive ?? true },
        });
      } else if (data.isActive !== undefined) {
        schedule = await tx.deliverySchedule.update({
          where: { id: schedule.id },
          data: { isActive: data.isActive },
        });
      }

      await tx.deliveryScheduleRule.deleteMany({
        where: { deliveryScheduleId: schedule.id },
      });

      if (data.rules?.length) {
        await tx.deliveryScheduleRule.createMany({
          data: data.rules.map((rule) => ({
            deliveryScheduleId: schedule.id,
            type: rule.type,
            dayOfWeek: rule.type === 'WEEKLY' ? rule.dayOfWeek : null,
            quantity: rule.quantity ?? 1,
            intervalDays: rule.type === 'INTERVAL' ? rule.intervalDays : null,
            customNotes: rule.type === 'CUSTOM' ? rule.customNotes : null,
            startDate: new Date(),
          })),
        });
      }

      return tx.deliverySchedule.findUnique({
        where: { id: schedule.id },
        include: { rules: true },
      });
    });
  }

  private validateRules(rules: ScheduleRuleInput[]) {
    for (const rule of rules) {
      const validTypes = ['WEEKLY', 'INTERVAL', 'CUSTOM'];
      if (!validTypes.includes(rule.type)) {
        throw new BadRequestException(
          'Schedule rule type must be WEEKLY, INTERVAL, or CUSTOM',
        );
      }

      if (rule.type !== 'CUSTOM') {
        if (!rule.quantity || rule.quantity < 1 || rule.quantity > 10) {
          throw new BadRequestException(
            'Schedule quantity must be between 1 and 10 jars',
          );
        }
      }

      if (rule.type === 'WEEKLY') {
        if (
          rule.dayOfWeek === undefined ||
          rule.dayOfWeek < 0 ||
          rule.dayOfWeek > 6
        ) {
          throw new BadRequestException(
            'Weekly schedule rules require a dayOfWeek from 0 to 6',
          );
        }
      }

      if (rule.type === 'INTERVAL') {
        if (
          !rule.intervalDays ||
          rule.intervalDays < 1 ||
          rule.intervalDays > 30
        ) {
          throw new BadRequestException(
            'Interval schedule rules require intervalDays from 1 to 30',
          );
        }
      }

      if (rule.type === 'CUSTOM') {
        if (!rule.customNotes || rule.customNotes.trim() === '') {
          throw new BadRequestException(
            'Custom schedule rules require instructions in customNotes',
          );
        }
      }
    }
  }
}
