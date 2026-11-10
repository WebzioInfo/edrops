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
    paymentId?: string | null,
    tx?: any,
  ) {
    const execute = async (prismaTx: any) => {
      if (paymentId) {
        const existing = await prismaTx.packagePurchase.findUnique({
          where: { paymentId },
        });
        if (existing) {
          throw new BadRequestException(
            'This payment has already been processed.',
          );
        }
      }

      // Resolve active or default Brand for multi-brand JarBalance
      let brand = await prismaTx.brand.findFirst({
        where: { isActive: true },
      });
      if (!brand) {
        brand = await prismaTx.brand.findFirst();
      }
      if (!brand) {
        brand = await prismaTx.brand.create({
          data: {
            name: 'Biodrops',
            description: 'Default Water Brand',
          },
        });
      }
      const brandId = brand.id;

      // Lock the customer's JarBalance row to prevent concurrent updates
      await prismaTx.$executeRawUnsafe(
        `SELECT id FROM "JarBalance" WHERE "customerId" = $1 AND "brandId" = $2 FOR UPDATE`,
        customerId,
        brandId,
      );

      const order = await prismaTx.packagePurchase.create({
        data: {
          customerId,
          packageId,
          amount,
          paymentStatus: PaymentStatus.SUCCESS,
          paymentId: paymentId || null,
        },
      });

      let jarBalance = await prismaTx.jarBalance.findUnique({
        where: { customerId_brandId: { customerId, brandId } },
      });
      if (!jarBalance) {
        jarBalance = await prismaTx.jarBalance.create({
          data: { customerId, brandId, availableJars: 0, totalPurchased: 0 },
        });
      }

      // Ensure jar ownership record exists
      let jarOwnership = await prismaTx.jarOwnership.findUnique({
        where: { customerId_brandId: { customerId, brandId } },
      });
      if (!jarOwnership) {
        await prismaTx.jarOwnership.create({
          data: { customerId, brandId, companyJarsHeld: 0, ownedJars: 0 },
        });
      }

      // Ensure jar deposit record exists
      let jarDeposit = await prismaTx.jarDeposit.findUnique({
        where: { customerId_brandId: { customerId, brandId } },
      });
      if (!jarDeposit) {
        await prismaTx.jarDeposit.create({
          data: {
            customerId,
            brandId,
            maxActiveJars: 0,
            depositPaid: 0.0,
            depositDue: 0.0,
          },
        });
      }

      const balanceBefore = jarBalance.availableJars;
      const balanceAfter = balanceBefore + jarsAdded;

      await prismaTx.jarBalance.update({
        where: { customerId_brandId: { customerId, brandId } },
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
