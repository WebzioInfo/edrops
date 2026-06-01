import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionType } from '@prisma/client';

@Injectable()
export class BalanceEngine {
  constructor(private prisma: PrismaService) {}

  async deductJars(customerId: string, amount: number, referenceId?: string, description?: string) {
    return this.prisma.$transaction(async (tx) => {
      const jarBalance = await tx.jarBalance.findUnique({ where: { customerId } });
      if (!jarBalance) throw new BadRequestException('Customer jar balance record not found');
      if (jarBalance.availableJars < amount) {
        throw new BadRequestException('Insufficient jars balance');
      }

      const balanceBefore = jarBalance.availableJars;
      const balanceAfter = balanceBefore - amount;

      await tx.jarBalance.update({
        where: { customerId },
        data: { availableJars: balanceAfter }
      });

      const transaction = await tx.transaction.create({
        data: {
          customerId,
          type: TransactionType.CONSUMPTION,
          amountJars: -amount,
          balanceBefore,
          balanceAfter,
          referenceId,
          description
        }
      });

      return transaction;
    });
  }

  async addJars(customerId: string, amount: number, referenceId?: string, description?: string) {
    return this.prisma.$transaction(async (tx) => {
      let jarBalance = await tx.jarBalance.findUnique({ where: { customerId } });
      if (!jarBalance) {
        jarBalance = await tx.jarBalance.create({
          data: { customerId, availableJars: 0, totalPurchased: 0 }
        });
      }

      const balanceBefore = jarBalance.availableJars;
      const balanceAfter = balanceBefore + amount;

      await tx.jarBalance.update({
        where: { customerId },
        data: { 
          availableJars: balanceAfter,
          totalPurchased: { increment: amount }
        }
      });

      const transaction = await tx.transaction.create({
        data: {
          customerId,
          type: TransactionType.RECHARGE,
          amountJars: amount,
          balanceBefore,
          balanceAfter,
          referenceId,
          description
        }
      });

      return transaction;
    });
  }
}
