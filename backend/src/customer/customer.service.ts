import { Injectable } from '@nestjs/common';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CustomerService {
  constructor(private prisma: PrismaService) {}

  create(createCustomerDto: CreateCustomerDto) {
    return this.prisma.customer.create({ data: createCustomerDto });
  }

  findAll() {
    return this.prisma.customer.findMany({
      include: {
        user: true,
        addresses: true,
        jarBalance: true,
        jarDeposit: true,
        jarOwnership: true,
        deliverySchedule: { include: { rules: true } },
      },
      orderBy: { user: { createdAt: 'desc' } },
      take: 100,
    });
  }

  findOne(id: string) {
    return this.prisma.customer.findUnique({
      where: { id },
      include: {
        user: true,
        addresses: true,
        jarBalance: true,
        jarDeposit: true,
        jarOwnership: true,
        deliverySchedule: { include: { rules: true } },
        deliveries: { orderBy: { scheduledFor: 'desc' }, take: 20 },
        transactions: { orderBy: { createdAt: 'desc' }, take: 20 },
        packagePurchases: {
          include: { package: true },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });
  }

  update(id: string, updateCustomerDto: UpdateCustomerDto) {
    return this.prisma.customer.update({
      where: { id },
      data: updateCustomerDto,
    });
  }

  remove(id: string) {
    return this.prisma.customer.delete({ where: { id } });
  }
}
