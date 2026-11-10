import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStatus, PaymentStatus, WalletTransactionType } from '@prisma/client';
import { generateDeliveryOtp } from '../order/utils/delivery-otp.util';

@Injectable()
export class SubscriptionScheduler {
  private readonly logger = new Logger(SubscriptionScheduler.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Runs daily at midnight to generate subscription orders for the day.
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async generateDailySubscriptions() {
    this.logger.log('Starting daily subscription generation...');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.

    // Get all active schedules
    const schedules = await this.prisma.deliverySchedule.findMany({
      where: { isActive: true },
      include: {
        rules: true,
        customer: {
          include: {
            addresses: true,
            user: true,
          },
        },
      },
    });

    let generatedCount = 0;

    for (const schedule of schedules) {
      if (!schedule.customer.addresses.length) continue;

      const defaultAddress =
        schedule.customer.addresses.find((a) => a.isDefault) ||
        schedule.customer.addresses[0];

      let todayQty = 0;

      for (const rule of schedule.rules) {
        if (rule.type === 'WEEKLY' && rule.dayOfWeek === dayOfWeek) {
          todayQty += rule.quantity;
        } else if (rule.type === 'INTERVAL') {
          const ruleStart = new Date(rule.startDate);
          ruleStart.setHours(0, 0, 0, 0);
          const diffTime = Math.abs(today.getTime() - ruleStart.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          const interval = rule.intervalDays || 1;
          if (diffDays % interval === 0) {
            todayQty += rule.quantity;
          }
        }
      }

      if (todayQty > 0) {
        // Prevent double generation using idempotency checks
        const existingOrder = await this.prisma.order.findFirst({
          where: {
            customerId: schedule.customerId,
            orderType: 'SUBSCRIPTION_ORDER',
            scheduledDate: {
              gte: today,
              lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
            },
          },
        });

        if (!existingOrder) {
          try {
            await this.prisma.$transaction(async (tx) => {
              // Get standard product for subscription
              const product = await tx.product.findFirst({
                where: { isJar: true },
              });

              if (!product) {
                this.logger.warn(
                  `No subscription product found for generating order for customer ${schedule.customerId}`,
                );
                return;
              }

              const unitPrice = Number(product.price || 0);
              const totalAmount = unitPrice * todayQty;

              // Check customer wallet and deduct atomically if sufficient balance exists
              let wallet = await tx.wallet.findUnique({
                where: { customerId: schedule.customerId },
              });

              if (!wallet) {
                wallet = await tx.wallet.create({
                  data: { customerId: schedule.customerId, balance: 0 },
                });
              }

              const hasSufficientBalance = (wallet.balance ?? 0) >= totalAmount;
              const paymentStatus = hasSufficientBalance
                ? PaymentStatus.SUCCESS
                : PaymentStatus.PENDING;
              const paymentMethod = hasSufficientBalance ? 'WALLET' : 'CASH';

              if (hasSufficientBalance && totalAmount > 0) {
                const balanceBefore = wallet.balance;
                const balanceAfter = balanceBefore - totalAmount;

                await tx.wallet.update({
                  where: { id: wallet.id },
                  data: {
                    balance: { decrement: totalAmount },
                  },
                });

                await tx.walletTransaction.create({
                  data: {
                    walletId: wallet.id,
                    type: WalletTransactionType.DEDUCTION,
                    amount: totalAmount,
                    balanceBefore,
                    balanceAfter,
                    referenceId: `SUB-${schedule.id.slice(0, 8)}`,
                    description: `Subscription delivery: ${todayQty} jar(s)`,
                  },
                });
              } else if (!hasSufficientBalance && totalAmount > 0) {
                this.logger.warn(
                  `Customer ${schedule.customerId} has insufficient wallet balance (₹${wallet.balance}) for subscription order ₹${totalAmount}. Order marked PENDING.`,
                );
              }

              const order = await tx.order.create({
                data: {
                  customerId: schedule.customerId,
                  orderType: 'SUBSCRIPTION_ORDER',
                  status: OrderStatus.NEW,
                  scheduledDate: today,
                  deliveryAddressId: defaultAddress.id,
                  subTotal: totalAmount,
                  totalAmount,
                  paymentStatus,
                  paymentMethod,
                  deliveryVerification: {
                    create: {
                      otp: generateDeliveryOtp(),
                    },
                  },
                  items: {
                    create: {
                      productId: product.id,
                      quantity: todayQty,
                      unitPrice,
                      total: totalAmount,
                    },
                  },
                },
              });

              // Create associated delivery logistical record tied to order
              await tx.delivery.create({
                data: {
                  customerId: schedule.customerId,
                  orderId: order.id,
                  addressId: defaultAddress.id,
                  scheduledFor: today,
                  requiredQuantity: todayQty,
                  status: OrderStatus.PENDING_ASSIGNMENT,
                },
              });
            });

            generatedCount++;
          } catch (error) {
            this.logger.error(
              `Failed to generate subscription for customer ${schedule.customerId}:`,
              error,
            );
          }
        }
      }
    }

    this.logger.log(
      `Completed daily subscription generation. Generated ${generatedCount} orders.`,
    );
  }
}
