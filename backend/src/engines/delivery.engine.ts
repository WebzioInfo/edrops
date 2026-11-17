import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  OrderStatus,
  TransactionType,
  PaymentStatus,
  WalletTransactionType,
} from '@prisma/client';
import { SettingsService } from '../settings/settings.service';
import { NotificationService } from '../notification/notification.service';
import {
  getISTMidnight,
  isSameISTDay,
} from '../common/timezone.util';

@Injectable()
export class DeliveryEngine {
  private readonly logger = new Logger(DeliveryEngine.name);

  constructor(
    private prisma: PrismaService,
    private settingsService: SettingsService,
    private notificationService: NotificationService,
  ) {}

  // 1. Generate Today's Deliveries based on schedules
  async generateTodayDeliveries(date: Date = new Date()) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const dayOfWeek = startOfDay.getDay(); // 0=Sunday, 1=Monday...

    // Fetch all active schedules with their rules
    const schedules = await this.prisma.deliverySchedule.findMany({
      where: { isActive: true },
      include: {
        rules: true,
        customer: {
          include: {
            addresses: true,
          },
        },
      },
    });

    let generatedCount = 0;

    for (const schedule of schedules) {
      const customer = schedule.customer;
      const defaultAddress =
        customer.addresses.find((a) => a.isDefault) || customer.addresses[0];
      if (!defaultAddress) continue;

      // Check if a delivery already exists for today to prevent double-generation
      const existing = await this.prisma.delivery.findFirst({
        where: {
          customerId: customer.id,
          scheduledFor: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
      });
      if (existing) continue;

      let todayQty = 0;

      for (const rule of schedule.rules) {
        if (rule.type === 'WEEKLY' && rule.dayOfWeek === dayOfWeek) {
          todayQty += rule.quantity;
        } else if (rule.type === 'INTERVAL') {
          // Check if today matches the interval from the start date
          const ruleStart = new Date(rule.startDate);
          ruleStart.setHours(0, 0, 0, 0);
          const diffTime = Math.abs(startOfDay.getTime() - ruleStart.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          const interval = rule.intervalDays || 1;
          if (diffDays % interval === 0) {
            todayQty += rule.quantity;
          }
        }
      }

      if (todayQty > 0) {
        try {
          await this.prisma.delivery.create({
            data: {
              customerId: customer.id,
              addressId: defaultAddress.id,
              scheduledFor: startOfDay,
              requiredQuantity: todayQty,
              status: OrderStatus.PENDING_ASSIGNMENT,
            },
          });
          generatedCount++;
        } catch (err: any) {
          // Catch unique constraint violation and skip gracefully to support safe reruns
          if (err.code === 'P2002') {
            continue;
          }
          throw err;
        }
      }
    }

    return { success: true, generatedCount };
  }

  // Generate Future Deliveries based on schedule (Replaces generateTodayDeliveries for predictive generation)
  async syncCustomerSchedule(customerId: string, weeksOut: number = 8) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Concurrency control: acquire transaction-level advisory lock per customer to prevent race-condition duplicates
      await tx.$executeRawUnsafe(
        'SELECT pg_advisory_xact_lock(hashtext($1))',
        customerId,
      );

      const now = new Date();
      // Calculate Indian Standard Time (IST = UTC+5:30)
      const nowIST = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
      // Strict UTC midnight corresponding to IST today
      const today = new Date(
        Date.UTC(nowIST.getUTCFullYear(), nowIST.getUTCMonth(), nowIST.getUTCDate()),
      );

      const currentHourIST = nowIST.getUTCHours();
      const isPastTodayCutoff = currentHourIST >= 14; // Past 2:00 PM IST (daily dispatch cutoff)

      // Check if customer already has a delivery today that is active or completed
      const existingTodayDelivery = await tx.delivery.findFirst({
        where: { customerId, scheduledFor: today },
      });
      const isTodayUnderwayOrDone =
        existingTodayDelivery &&
        [
          'OUT_FOR_DELIVERY',
          'DELIVERED',
          'COMPLETED',
          'CANCELLED',
          'FAILED',
        ].includes(existingTodayDelivery.status);

      // Calculate the start of the current week (Monday)
      const day = today.getUTCDay();
      const diff = today.getUTCDate() - day + (day === 0 ? -6 : 1);
      const startOfWeek = new Date(
        Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), diff),
      );

      // Fetch the customer's active schedule and rules
      const schedule = await tx.deliverySchedule.findUnique({
        where: { customerId },
        include: {
          rules: true,
          overrides: true,
          customer: {
            include: { addresses: true },
          },
        },
      });

      // If today is past cutoff or today's delivery is already underway/completed,
      // protect today's delivery and only clear future pending deliveries from tomorrow onwards.
      const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
      const deleteFromDate =
        isPastTodayCutoff || isTodayUnderwayOrDone ? tomorrow : today;

      // Safely clear pending/assigned deliveries from deleteFromDate onwards
      await tx.delivery.deleteMany({
        where: {
          customerId,
          scheduledFor: { gte: deleteFromDate },
          status: { in: [OrderStatus.PENDING_ASSIGNMENT, OrderStatus.ASSIGNED] },
        },
      });

      if (!schedule || !schedule.isActive || schedule.rules.length === 0) {
        return { success: true, generatedCount: 0 };
      }

      const defaultAddress =
        schedule.customer.addresses.find((a) => a.isDefault) ||
        schedule.customer.addresses[0];
      if (!defaultAddress) return { success: true, generatedCount: 0 };

      let generatedCount = 0;
      const daysToGenerate = weeksOut * 7;

      // We generate from START OF WEEK to N weeks out.
      for (let i = 0; i < daysToGenerate; i++) {
        const targetDate = new Date(startOfWeek.getTime());
        targetDate.setUTCDate(startOfWeek.getUTCDate() + i);
        const dayOfWeek = targetDate.getUTCDay();

        // 1. Skip past days (before today)
        if (targetDate.getTime() < today.getTime()) {
          continue;
        }

        // 2. If targetDate is today:
        if (targetDate.getTime() === today.getTime()) {
          if (isPastTodayCutoff || isTodayUnderwayOrDone || existingTodayDelivery) {
            continue;
          }
        }

        let dailyQty = 0;

        // Check for specific date override first
        const dateOverride = (schedule as any).overrides?.find((o: any) =>
          isSameISTDay(new Date(o.targetDate), targetDate),
        );

        if (dateOverride) {
          dailyQty = dateOverride.quantity;
        } else {
          for (const rule of schedule.rules) {
            if (rule.type === 'WEEKLY' && rule.dayOfWeek === dayOfWeek) {
              dailyQty += rule.quantity;
            } else if (rule.type === 'INTERVAL') {
              const ruleStart = new Date(rule.startDate);
              ruleStart.setUTCHours(0, 0, 0, 0);
              if (targetDate.getTime() >= ruleStart.getTime()) {
                const diffTime = targetDate.getTime() - ruleStart.getTime();
                const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
                const interval = rule.intervalDays || 1;
                if (diffDays % interval === 0) {
                  dailyQty += rule.quantity;
                }
              }
            }
          }
        }

        if (dailyQty > 0) {
          const existing = await tx.delivery.findFirst({
            where: { customerId, scheduledFor: targetDate },
          });

          if (!existing) {
            await tx.delivery.create({
              data: {
                customerId,
                addressId: defaultAddress.id,
                scheduledFor: targetDate,
                requiredQuantity: dailyQty,
                status: OrderStatus.PENDING_ASSIGNMENT,
              },
            });
            generatedCount++;
          } else if (
            existing.status === OrderStatus.PENDING_ASSIGNMENT &&
            existing.requiredQuantity !== dailyQty
          ) {
            // In-place smart update for pending deliveries when customer adjusts schedule
            await tx.delivery.update({
              where: { id: existing.id },
              data: { requiredQuantity: dailyQty },
            });
          }
        }
      }

      return { success: true, generatedCount };
    });
  }

  // 2. Staff manual assignment
  async assignDelivery(deliveryId: string, deliveryPartnerId: string) {
    return this.prisma.$transaction(async (tx) => {
      const delivery = await tx.delivery.findUnique({
        where: { id: deliveryId },
      });
      if (!delivery) throw new BadRequestException('Delivery not found');

      // Create or update assignment
      await tx.deliveryAssignment.upsert({
        where: { deliveryId },
        update: { deliveryPartnerId },
        create: { deliveryId, deliveryPartnerId },
      });

      return tx.delivery.update({
        where: { id: deliveryId },
        data: { status: OrderStatus.ASSIGNED },
      });
    });
  }

  // 3. Delivery partner submits report
  async submitDeliveryReport(
    deliveryId: string,
    partnerDeliveredQty: number,
    partnerEmptyCollected: number,
    partnerNotes?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const delivery = await tx.delivery.findUnique({
        where: { id: deliveryId },
      });
      if (!delivery) throw new BadRequestException('Delivery not found');

      await tx.deliveryReport.upsert({
        where: { deliveryId },
        update: {
          partnerDeliveredQty,
          partnerEmptyCollected,
          partnerNotes,
          partnerSubmittedAt: new Date(),
        },
        create: {
          deliveryId,
          partnerDeliveredQty,
          partnerEmptyCollected,
          partnerNotes,
        },
      });

      return tx.delivery.update({
        where: { id: deliveryId },
        data: { status: OrderStatus.DELIVERED },
      });
    });
  }

  // 4. Staff confirms delivery, reducing balance and updating deposit/ownership atomically
  async confirmDelivery(
    deliveryId: string,
    brandId: string,
    confirmedDeliveredQty: number,
    confirmedEmptyCollected: number,
    confirmedDamagedQty: number,
    staffNotes?: string,
    staffId?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      let delivery = await tx.delivery.findUnique({
        where: { id: deliveryId },
        include: { report: true },
      });

      if (!delivery) {
        delivery = await tx.delivery.findFirst({
          where: { orderId: deliveryId },
          include: { report: true },
        });
      }

      if (!delivery) throw new BadRequestException('Delivery not found');

      // Prevent double confirmations
      if (delivery.status === OrderStatus.DELIVERED) {
        throw new BadRequestException(
          'Delivery has already been confirmed and completed.',
        );
      }

      const customerId = delivery.customerId;

      // Row-locking to prevent concurrent conflicts and race conditions
      await tx.$executeRawUnsafe(
        `SELECT id FROM "JarBalance" WHERE "customerId" = $1 FOR UPDATE`,
        customerId,
      );
      await tx.$executeRawUnsafe(
        `SELECT id FROM "JarOwnership" WHERE "customerId" = $1 FOR UPDATE`,
        customerId,
      );
      await tx.$executeRawUnsafe(
        `SELECT id FROM "JarDeposit" WHERE "customerId" = $1 FOR UPDATE`,
        customerId,
      );

      // Lock warehouse inventory row
      const firstInventory = await tx.inventory.findFirst();
      if (firstInventory) {
        await tx.$executeRawUnsafe(
          `SELECT id FROM "Inventory" WHERE id = $1 FOR UPDATE`,
          firstInventory.id,
        );
      }

      // Ensure brand exists for balance & deposit tracking
      let effectiveBrandId = brandId;
      if (!effectiveBrandId) {
        let defaultBrand = await tx.brand.findFirst();
        if (!defaultBrand) {
          defaultBrand = await tx.brand.create({
            data: { name: 'eDrops Standard' },
          });
        }
        effectiveBrandId = defaultBrand.id;
      }

      let jarBalance = await tx.jarBalance.findUnique({
        where: { customerId_brandId: { customerId, brandId: effectiveBrandId } },
      });
      if (!jarBalance) {
        jarBalance = await tx.jarBalance.create({
          data: { customerId, brandId: effectiveBrandId, availableJars: 0, totalPurchased: 0 },
        });
      }

      let jarOwnership = await tx.jarOwnership.findUnique({
        where: { customerId_brandId: { customerId, brandId: effectiveBrandId } },
      });
      if (!jarOwnership) {
        jarOwnership = await tx.jarOwnership.create({
          data: { customerId, brandId: effectiveBrandId, companyJarsHeld: 0, ownedJars: 0 },
        });
      }

      let jarDeposit = await tx.jarDeposit.findUnique({
        where: { customerId_brandId: { customerId, brandId: effectiveBrandId } },
      });
      if (!jarDeposit) {
        jarDeposit = await tx.jarDeposit.create({
          data: {
            customerId,
            brandId: effectiveBrandId,
            maxActiveJars: 0,
            depositPaid: 0.0,
            depositDue: 0.0,
          },
        });
      }

      // 2. Perform math calculations
      let alreadyDeductedPrepaidJars = 0;
      if (delivery.orderId) {
        const parentOrder = await tx.order.findUnique({
          where: { id: delivery.orderId },
          select: { adminNotes: true, paymentMethod: true },
        });
        if (parentOrder?.adminNotes) {
          try {
            const parsed = JSON.parse(parentOrder.adminNotes);
            if (parsed.prepaidJars) {
              alreadyDeductedPrepaidJars = Number(parsed.prepaidJars);
            }
          } catch {}
        }
      }

      // Quantity remaining to deduct from jar balance
      const jarsToDeduct = Math.max(0, confirmedDeliveredQty - alreadyDeductedPrepaidJars);
      const balanceBefore = jarBalance.availableJars;
      const balanceAfter = Math.max(0, balanceBefore - jarsToDeduct);

      // Jars in possession updates:
      // companyJarsHeld = companyJarsHeld + delivered - emptyCollected
      const newCompanyJarsHeld = Math.max(
        0,
        jarOwnership.companyJarsHeld +
          confirmedDeliveredQty -
          confirmedEmptyCollected,
      );

      // maxActiveJars is the peak active jars in customer possession
      const newMaxActiveJars = Math.max(
        jarDeposit.maxActiveJars,
        newCompanyJarsHeld,
      );

      // Fetch deposit amount from settings (defaults to ₹300)
      const depositAmountPerJar = await this.settingsService.getDepositAmountPerJar();
      const newDepositDue = Math.max(
        0.0,
        newMaxActiveJars * depositAmountPerJar - jarDeposit.depositPaid,
      );

      // 3. Write updates
      if (jarsToDeduct > 0) {
        await tx.jarBalance.update({
          where: { customerId_brandId: { customerId, brandId: effectiveBrandId } },
          data: { availableJars: balanceAfter },
        });

        await tx.transaction.create({
          data: {
            customerId,
            type: TransactionType.CONSUMPTION,
            amountJars: -jarsToDeduct,
            balanceBefore,
            balanceAfter,
            referenceId: delivery.id,
            description: `Confirmed delivery of ${confirmedDeliveredQty} jars (${alreadyDeductedPrepaidJars} previously funded, ${jarsToDeduct} deducted now)`,
          },
        });
      }

      await tx.jarOwnership.update({
        where: { customerId_brandId: { customerId, brandId: effectiveBrandId } },
        data: { companyJarsHeld: newCompanyJarsHeld },
      });

      await tx.jarDeposit.update({
        where: { customerId_brandId: { customerId, brandId: effectiveBrandId } },
        data: {
          maxActiveJars: newMaxActiveJars,
          depositDue: newDepositDue,
        },
      });

      // Update warehouse inventory atomically (prevent negative stock)
      if (firstInventory) {
        if (firstInventory.filledJars < confirmedDeliveredQty) {
          throw new BadRequestException(
            `Insufficient warehouse inventory (Filled Jars available: ${firstInventory.filledJars}).`,
          );
        }
        await tx.inventory.update({
          where: { id: firstInventory.id },
          data: {
            filledJars: firstInventory.filledJars - confirmedDeliveredQty,
            emptyJars: firstInventory.emptyJars + confirmedEmptyCollected,
            damagedJars: firstInventory.damagedJars + confirmedDamagedQty,
          },
        });

        await tx.inventoryLog.create({
          data: {
            action: 'DELIVERY',
            filledQty: -confirmedDeliveredQty,
            emptyQty: confirmedEmptyCollected,
            damagedQty: confirmedDamagedQty,
            referenceId: delivery.id,
            description: `Delivery completed. Customer: ${customerId}`,
          },
        });
      }

      // Update or create delivery report confirmation details
      await tx.deliveryReport.upsert({
        where: { deliveryId: delivery.id },
        create: {
          deliveryId: delivery.id,
          partnerDeliveredQty: confirmedDeliveredQty,
          partnerEmptyCollected: confirmedEmptyCollected,
          confirmedDeliveredQty,
          confirmedEmptyCollected,
          confirmedDamagedQty,
          staffNotes,
          confirmedAt: new Date(),
          confirmedById: staffId,
        },
        update: {
          confirmedDeliveredQty,
          confirmedEmptyCollected,
          confirmedDamagedQty,
          staffNotes,
          confirmedAt: new Date(),
          confirmedById: staffId,
        },
      });

      // Warn customer if available balance is low (threshold from settings)
      const lowBalanceThreshold = await this.settingsService.getSettingNumber(
        'LOW_BALANCE_THRESHOLD',
        5,
      );

      // Fire notifications outside transaction context
      setImmediate(() => {
        if (balanceAfter <= lowBalanceThreshold) {
          this.notificationService.notifyLowBalance({
            customerId,
            balance: balanceAfter,
          });
        }
        if (newCompanyJarsHeld >= 4) {
          this.notificationService.notifyEmptyJarsThreshold({
            customerId,
            jarsAtCustomer: newCompanyJarsHeld,
          });
        }
        this.notificationService.notifyDeliveryCompleted({
          customerId,
          deliveredQty: confirmedDeliveredQty,
          emptyCollected: confirmedEmptyCollected,
          balanceAfter,
        });
      });

      if (delivery.orderId) {
        const parentOrder = await tx.order.findUnique({
          where: { id: delivery.orderId },
          include: { payments: true },
        });

        if (parentOrder) {
          const isCOD =
            parentOrder.paymentMethod === 'COD' ||
            parentOrder.paymentMethod === 'CASH' ||
            parentOrder.paymentMethod === 'CASH_ON_DELIVERY';

          const updateOrderData: any = {
            status: OrderStatus.DELIVERED,
            deliveredAt: new Date(),
          };

          if (
            isCOD &&
            parentOrder.paymentStatus !== PaymentStatus.SUCCESS &&
            parentOrder.paymentStatus !== PaymentStatus.PAID
          ) {
            updateOrderData.paymentStatus = PaymentStatus.SUCCESS;

            const hasPayment = parentOrder.payments.some(
              (p) =>
                p.status === PaymentStatus.SUCCESS ||
                p.status === PaymentStatus.PAID,
            );
            if (!hasPayment) {
              await tx.payment.create({
                data: {
                  orderId: parentOrder.id,
                  customerId: delivery.customerId,
                  amount: parentOrder.totalAmount,
                  currency: 'INR',
                  status: PaymentStatus.PAID,
                  provider: 'CASH',
                  receiptId: `COD-${delivery.id}`,
                  description: `Cash on Delivery collected by delivery partner`,
                },
              });
            }
          }

          await tx.order.update({
            where: { id: delivery.orderId },
            data: updateOrderData,
          });
        }
      }

      return tx.delivery.update({
        where: { id: delivery.id },
        data: {
          status: OrderStatus.DELIVERED,
          completedAt: new Date(),
        },
      });
    });
  }

  // 5. Fail delivery with symmetric financial reservation reversal
  async failDelivery(deliveryId: string, reason: string) {
    return this.prisma.$transaction(async (tx) => {
      const delivery = await tx.delivery.findUnique({
        where: { id: deliveryId },
        include: { order: true },
      });
      if (!delivery) throw new BadRequestException('Delivery not found');

      // Idempotency check: already failed or cancelled
      if (
        delivery.status === OrderStatus.FAILED ||
        delivery.status === OrderStatus.CANCELLED
      ) {
        return delivery;
      }

      const customerId = delivery.customerId;

      // Check if order had reserved wallet cash or prepaid jars
      if (delivery.order && delivery.order.adminNotes) {
        try {
          const meta = JSON.parse(delivery.order.adminNotes);

          // 1. Symmetrically restore reserved wallet cash
          if (meta.walletDeducted && meta.walletDeducted > 0) {
            const wallet = await tx.wallet.findUnique({ where: { customerId } });
            if (wallet) {
              const newBalance = Number(wallet.balance) + Number(meta.walletDeducted);
              await tx.wallet.update({
                where: { customerId },
                data: { balance: newBalance },
              });
              await tx.walletTransaction.create({
                data: {
                  walletId: wallet.id,
                  type: WalletTransactionType.REFUND,
                  amount: meta.walletDeducted,
                  balanceBefore: wallet.balance,
                  balanceAfter: newBalance,
                  description: `Refund for failed delivery ${delivery.id}: ${reason}`,
                  referenceId: delivery.id,
                },
              });
            }
          }

          // 2. Symmetrically restore reserved prepaid jars
          if (meta.prepaidJars && meta.prepaidJars > 0) {
            const jarBalance = await tx.jarBalance.findFirst({
              where: { customerId },
            });
            if (jarBalance) {
              const newAvail = jarBalance.availableJars + meta.prepaidJars;
              await tx.jarBalance.update({
                where: { id: jarBalance.id },
                data: { availableJars: newAvail },
              });
              await tx.transaction.create({
                data: {
                  customerId,
                  type: TransactionType.REFUND,
                  amountJars: meta.prepaidJars,
                  balanceBefore: jarBalance.availableJars,
                  balanceAfter: newAvail,
                  referenceId: delivery.id,
                  description: `Restored ${meta.prepaidJars} jars from failed delivery: ${reason}`,
                },
              });
            }
          }
        } catch (e) {
          this.logger.warn(
            `Failed to parse adminNotes on order ${delivery.orderId}: ${e}`,
          );
        }

        if (delivery.orderId) {
          await tx.order.update({
            where: { id: delivery.orderId },
            data: { status: OrderStatus.FAILED },
          });
        }
      }

      await tx.deliveryReport.upsert({
        where: { deliveryId: delivery.id },
        create: {
          deliveryId: delivery.id,
          partnerDeliveredQty: 0,
          partnerEmptyCollected: 0,
          partnerNotes: `Failed: ${reason}`,
        },
        update: {
          partnerNotes: `Failed: ${reason}`,
        },
      });

      const updatedDelivery = await tx.delivery.update({
        where: { id: delivery.id },
        data: { status: OrderStatus.FAILED },
      });

      setImmediate(() => {
        this.notificationService.notifyDeliveryFailed({
          customerId,
          deliveryId: delivery.id,
          reason,
        });
      });

      return updatedDelivery;
    });
  }
}
