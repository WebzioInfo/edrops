import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import {
  OrderStatus,
  PaymentStatus,
  WalletTransactionType,
  TransactionType,
} from '@prisma/client';
import { generateDeliveryOtp } from '../order/utils/delivery-otp.util';
import {
  getISTMidnight,
  getISTDayRange,
  formatISTDateString,
  isSameISTDay,
} from '../common/timezone.util';

@Injectable()
export class SubscriptionScheduler {
  private readonly logger = new Logger(SubscriptionScheduler.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Runs daily at midnight IST to generate subscription orders for the day.
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async generateDailySubscriptions() {
    this.logger.log('Starting daily subscription generation (IST)...');

    // 1. Calculate strict IST date boundaries
    const today = getISTMidnight();
    const { start: todayStart, end: todayEnd } = getISTDayRange(today);
    const dayOfWeek = today.getUTCDay(); // 0 = Sunday, 1 = Monday, etc.

    // 2. Fetch all active schedules with rules and specific date overrides
    const schedules = await this.prisma.deliverySchedule.findMany({
      where: { isActive: true },
      include: {
        rules: true,
        overrides: true,
        customer: {
          include: {
            addresses: true,
            user: true,
          },
        },
      },
    });

    let generatedCount = 0;
    let prepaidCount = 0;
    let walletCount = 0;
    let splitCount = 0;
    let codCount = 0;

    for (const schedule of schedules) {
      if (!schedule.customer?.addresses?.length) continue;

      const defaultAddress =
        schedule.customer.addresses.find((a) => a.isDefault) ||
        schedule.customer.addresses[0];

      let todayQty = 0;

      // Check for specific date override first (Phase 8: Date Overrides)
      const override = schedule.overrides?.find((o) =>
        isSameISTDay(o.targetDate, today),
      );

      if (override) {
        todayQty = Math.max(0, override.quantity);
      } else {
        // Evaluate weekly and interval rules
        for (const rule of schedule.rules) {
          if (rule.type === 'WEEKLY' && rule.dayOfWeek === dayOfWeek) {
            todayQty += rule.quantity;
          } else if (rule.type === 'INTERVAL') {
            const ruleStart = getISTMidnight(rule.startDate);
            if (today.getTime() >= ruleStart.getTime()) {
              const diffTime = today.getTime() - ruleStart.getTime();
              const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
              const interval = rule.intervalDays || 1;
              if (diffDays % interval === 0) {
                todayQty += rule.quantity;
              }
            }
          }
        }
      }

      if (todayQty > 0) {
        try {
          await this.prisma.$transaction(async (tx) => {
            // Concurrency control: Lock customer account during scheduler processing
            await tx.$executeRawUnsafe(
              'SELECT pg_advisory_xact_lock(hashtext($1))',
              schedule.customerId,
            );

            // Prevent double generation using robust IST date range check
            const existingOrder = await tx.order.findFirst({
              where: {
                customerId: schedule.customerId,
                orderType: 'SUBSCRIPTION_ORDER',
                scheduledDate: {
                  gte: todayStart,
                  lt: todayEnd,
                },
              },
            });

            if (existingOrder) {
              return;
            }

            // Get standard product for subscription
            const product = await tx.product.findFirst({
              where: { isJar: true },
            });

            if (!product) {
              this.logger.warn(
                `No subscription product found for customer ${schedule.customerId}`,
              );
              return;
            }

            const unitPrice = Number(product.price || 0);
            const totalAmount = unitPrice * todayQty;

            // ─────────────────────────────────────────────────────────────────
            // UNIFIED MULTI-TIER FUNDING ENGINE (Phase 1 & Phase 3)
            // ─────────────────────────────────────────────────────────────────
            
            // Tier 1: Check and apply available Prepaid Jars (JarBalance)
            let jarBalance = await tx.jarBalance.findFirst({
              where: {
                customerId: schedule.customerId,
                availableJars: { gt: 0 },
              },
              orderBy: { availableJars: 'desc' },
            });

            const prepaidJarsAvailable = Math.max(0, jarBalance?.availableJars || 0);
            const prepaidJarsToApply = Math.min(todayQty, prepaidJarsAvailable);
            const remainingJars = todayQty - prepaidJarsToApply;

            // Tier 2: Check and apply Wallet Cash for remainder
            const remainingPayableAmount = remainingJars * unitPrice;
            let walletAmountToDeduct = 0;
            let walletJarsCovered = 0;

            let wallet = await tx.wallet.findUnique({
              where: { customerId: schedule.customerId },
            });

            if (!wallet) {
              wallet = await tx.wallet.create({
                data: { customerId: schedule.customerId, balance: 0 },
              });
            }

            const currentWalletBalance = Number(wallet.balance ?? 0);

            if (remainingPayableAmount > 0 && currentWalletBalance > 0) {
              walletJarsCovered = Math.min(
                remainingJars,
                Math.floor(currentWalletBalance / unitPrice),
              );
              walletAmountToDeduct = walletJarsCovered * unitPrice;
            }

            const unfundedJars = remainingJars - walletJarsCovered;
            const unfundedAmount = unfundedJars * unitPrice;

            // Execute Atomic Balance Deductions
            if (prepaidJarsToApply > 0 && jarBalance) {
              const balanceBefore = jarBalance.availableJars;
              const balanceAfter = balanceBefore - prepaidJarsToApply;

              await tx.jarBalance.update({
                where: { id: jarBalance.id },
                data: { availableJars: balanceAfter },
              });

              await tx.transaction.create({
                data: {
                  customerId: schedule.customerId,
                  type: TransactionType.CONSUMPTION,
                  amountJars: -prepaidJarsToApply,
                  balanceBefore,
                  balanceAfter,
                  referenceId: `SUB-${schedule.id.slice(0, 8)}`,
                  description: `Subscription package consumption: ${prepaidJarsToApply} jar(s)`,
                },
              });
            }

            if (walletAmountToDeduct > 0 && wallet) {
              const balanceBefore = Number(wallet.balance);
              const balanceAfter = balanceBefore - walletAmountToDeduct;

              await tx.wallet.update({
                where: { id: wallet.id },
                data: { balance: { decrement: walletAmountToDeduct } },
              });

              await tx.walletTransaction.create({
                data: {
                  walletId: wallet.id,
                  type: WalletTransactionType.DEDUCTION,
                  amount: walletAmountToDeduct,
                  balanceBefore,
                  balanceAfter,
                  referenceId: `SUB-${schedule.id.slice(0, 8)}`,
                  description: `Subscription delivery wallet deduction: ${walletJarsCovered} jar(s)`,
                },
              });
            }

            // Determine Payment Method and Classification
            let paymentStatus: PaymentStatus = PaymentStatus.SUCCESS;
            let paymentMethod = 'PREPAID_PACKAGE';
            let hybridSecondaryMethod: string | null = null;

            if (unfundedAmount === 0) {
              if (prepaidJarsToApply === todayQty) {
                paymentMethod = 'PREPAID_PACKAGE';
                prepaidCount++;
              } else if (walletAmountToDeduct === totalAmount) {
                paymentMethod = 'WALLET';
                walletCount++;
              } else {
                paymentMethod = 'PREPAID_PACKAGE';
                hybridSecondaryMethod = 'WALLET';
                splitCount++;
              }
            } else {
              paymentStatus = PaymentStatus.PENDING;
              paymentMethod =
                prepaidJarsToApply > 0
                  ? 'PREPAID_PACKAGE'
                  : walletAmountToDeduct > 0
                  ? 'WALLET'
                  : 'CASH';
              hybridSecondaryMethod = 'CASH';
              codCount++;
            }

            // Financial breakdown metadata for auditable reconciliation and safe reversal
            const fundingMeta = {
              prepaidJars: prepaidJarsToApply,
              walletDeducted: walletAmountToDeduct,
              codDue: unfundedAmount,
              unitPrice,
              totalJars: todayQty,
              totalAmount,
            };

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
                hybridSecondaryMethod,
                adminNotes: JSON.stringify(fundingMeta),
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

            // ─────────────────────────────────────────────────────────────────
            // SINGLE AUTHORITATIVE DELIVERY IDENTITY (Phase 4: Reuse existing)
            // ─────────────────────────────────────────────────────────────────
            const existingDelivery = await tx.delivery.findFirst({
              where: {
                customerId: schedule.customerId,
                scheduledFor: today,
                status: {
                  in: [
                    OrderStatus.PENDING_ASSIGNMENT,
                    OrderStatus.ASSIGNED,
                  ],
                },
              },
            });

            if (existingDelivery) {
              // Reuse prospective delivery created by schedule sync, linking the generated order
              await tx.delivery.update({
                where: { id: existingDelivery.id },
                data: {
                  orderId: order.id,
                  requiredQuantity: todayQty,
                  addressId: defaultAddress.id,
                },
              });
            } else {
              // Create delivery record if not already present
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
            }

            generatedCount++;
          });
        } catch (error) {
          this.logger.error(
            `Failed to generate subscription for customer ${schedule.customerId}:`,
            error,
          );
        }
      }
    }

    this.logger.log(
      `Completed daily subscription generation: ${generatedCount} generated ` +
        `(${prepaidCount} prepaid, ${walletCount} wallet, ${splitCount} split, ${codCount} cash/pending)`,
    );
  }
}
