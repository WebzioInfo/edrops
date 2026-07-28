import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminCustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async searchCustomers(query: string) {
    return this.prisma.customer.findMany({
      where: {
        OR: [
          { user: { phone: { contains: query, mode: 'insensitive' } } },
          { user: { firstName: { contains: query, mode: 'insensitive' } } },
          { user: { lastName: { contains: query, mode: 'insensitive' } } },
          { user: { email: { contains: query, mode: 'insensitive' } } },
          { id: { contains: query } },
          { referralCode: { contains: query, mode: 'insensitive' } },
        ],
      },
      include: {
        user: {
          select: { firstName: true, lastName: true, phone: true, email: true },
        },
      },
      take: 20,
    });
  }

  async getCustomerProfile(customerId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
            isActive: true,
            createdAt: true,
          },
        },
        wallet: true,
        jarBalances: { include: { brand: true } },
        jarDeposits: { include: { brand: true } },
        addresses: true,
        orders: { take: 10, orderBy: { createdAt: 'desc' } },
        deliverySchedule: { include: { rules: true } },
        supportTickets: { take: 5, orderBy: { createdAt: 'desc' } },
      },
    });

    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  async createWalkInCustomer(
    phone: string,
    firstName: string = 'Walk-In',
    lastName: string = 'Customer',
  ) {
    // Check if a user with this phone already exists
    let user = await this.prisma.user.findUnique({ where: { phone } });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          phone,
          firstName,
          lastName,
          passwordHash: 'WALKIN_NO_LOGIN',
          role: 'CUSTOMER',
        },
      });
    }

    let customer = await this.prisma.customer.findUnique({
      where: { userId: user.id },
    });

    if (!customer) {
      customer = await this.prisma.customer.create({
        data: {
          userId: user.id,
          isWalkIn: true,
        },
      });

      // Create an empty wallet
      await this.prisma.wallet.create({ data: { customerId: customer.id } });
    }

    return customer;
  }
}
