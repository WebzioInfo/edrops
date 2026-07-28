import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentStatus, TransactionType } from '@prisma/client';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class RechargeEngine {
  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
  ) {}

  async processRecharge(
    customerId: string,
    packageId: string,
    amount: number,
    jarsAdded: number,
    paymentId: string,
    tx?: any,
  ) {
    const execute = async (prismaTx: any) => {
      const existing = await prismaTx.packagePurchase.findUnique({
        where: { paymentId },
      });
      if (existing) {
        throw new BadRequestException(
          'This payment has already been processed.',
        );
      }

      // Lock the customer's JarBalance row to prevent concurrent updates
      await prismaTx.$executeRawUnsafe(
        `SELECT id FROM "JarBalance" WHERE "customerId" = $1 FOR UPDATE`,
        customerId,
      );

      const order = await prismaTx.packagePurchase.create({
        data: {
          customerId,
          packageId,
          amount,
          paymentStatus: PaymentStatus.SUCCESS,
          paymentId,
        },
      });

      let jarBalance = await prismaTx.jarBalance.findUnique({
        where: { customerId },
      });
      if (!jarBalance) {
        jarBalance = await prismaTx.jarBalance.create({
          data: { customerId, availableJars: 0, totalPurchased: 0 },
        });
      }

      const balanceBefore = jarBalance.availableJars;
      const balanceAfter = balanceBefore + jarsAdded;

      await prismaTx.jarBalance.update({
        where: { customerId },
        data: {
          availableJars: balanceAfter,
          totalPurchased: { increment: jarsAdded },
        },
      });

      await prismaTx.transaction.create({
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

      // Successful purchase notification (run asynchronously)
      setImmediate(() => {
        this.notificationService.notifyPackagePurchased({
          customerId,
          jarsAdded,
          balanceAfter,
        });
      });

      return order;
    };

    return tx ? execute(tx) : this.prisma.$transaction(execute);
  }
}
