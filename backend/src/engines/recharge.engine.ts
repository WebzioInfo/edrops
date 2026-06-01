import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentStatus, TransactionType } from '@prisma/client';

@Injectable()
export class RechargeEngine {
  constructor(private prisma: PrismaService) {}

  async processRecharge(
    customerId: string,
    packageId: string,
    amount: number,
    jarsAdded: number,
    paymentId: string
  ) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.packagePurchase.findUnique({
        where: { paymentId },
      });
      if (existing) {
        throw new BadRequestException('This payment has already been processed.');
      }

      // Lock the customer's JarBalance row to prevent concurrent updates
      await tx.$executeRawUnsafe(
        `SELECT id FROM "JarBalance" WHERE "customerId" = $1 FOR UPDATE`,
        customerId
      );

      const order = await tx.packagePurchase.create({
        data: {
          customerId,
          packageId,
          amount,
          paymentStatus: PaymentStatus.SUCCESS,
          paymentId,
        }
      });

      let jarBalance = await tx.jarBalance.findUnique({ where: { customerId } });
      if (!jarBalance) {
        jarBalance = await tx.jarBalance.create({
          data: { customerId, availableJars: 0, totalPurchased: 0 }
        });
      }

      const balanceBefore = jarBalance.availableJars;
      const balanceAfter = balanceBefore + jarsAdded;

      await tx.jarBalance.update({
        where: { customerId },
        data: {
          availableJars: balanceAfter,
          totalPurchased: { increment: jarsAdded },
        },
      });

      await tx.transaction.create({
        data: {
          customerId,
          type: TransactionType.RECHARGE,
          amountJars: jarsAdded,
          balanceBefore,
          balanceAfter,
          referenceId: order.id,
          description: `Jars recharged via package purchase (${jarsAdded} jars)`,
        },
      });

      // Successful purchase notification
      const customer = await tx.customer.findUnique({ where: { id: customerId } });
      if (customer) {
        await tx.notification.create({
          data: {
            userId: customer.userId,
            type: 'RECHARGE_SUCCESS',
            title: 'Prepaid Jars Recharged!',
            message: `Successfully purchased package. Added ${jarsAdded} jars to your balance. Your new prepaid jar balance is ${balanceAfter} jars.`
          }
        });
      }

      return order;
    });
  }
}
