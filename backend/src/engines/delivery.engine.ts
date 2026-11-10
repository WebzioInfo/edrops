import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStatus, TransactionType } from '@prisma/client';
import { SettingsService } from '../settings/settings.service';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class DeliveryEngine {
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
    const now = new Date();
    // Force strict UTC midnight to avoid local timezone drift
    const today = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );

    // Calculate Indian Standard Time (IST = UTC+5:30) to evaluate operational daily cutoff
    const nowIST = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
    const currentHourIST = nowIST.getUTCHours();
    const isPastTodayCutoff = currentHourIST >= 14; // Past 2:00 PM IST (daily dispatch cutoff)

    // Check if customer already has a delivery today that is active or completed
    const existingTodayDelivery = await this.prisma.delivery.findFirst({
      where: { customerId, scheduledFor: today },
    });
    const isTodayUnderwayOrDone =
      existingTodayDelivery &&
      [
        'OUT_FOR_DELIVERY',
        'IN_TRANSIT',
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
    const schedule = await this.prisma.deliverySchedule.findUnique({
      where: { customerId },
      include: {
        rules: true,
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
    await this.prisma.delivery.deleteMany({
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
      // If cutoff has passed OR today's delivery is already underway/done/exists:
      // Do NOT create or overwrite today's delivery!
      // The new quantity will naturally apply starting from next week's occurrence!
      if (targetDate.getTime() === today.getTime()) {
        if (isPastTodayCutoff || isTodayUnderwayOrDone || existingTodayDelivery) {
          continue;
        }
      }

      let dailyQty = 0;

      for (const rule of schedule.rules) {
        if (rule.type === 'WEEKLY' && rule.dayOfWeek === dayOfWeek) {
          dailyQty += rule.quantity;
        } else if (rule.type === 'INTERVAL') {
          const ruleStart = new Date(rule.startDate);
          ruleStart.setUTCHours(0, 0, 0, 0);
          const diffTime = Math.abs(targetDate.getTime() - ruleStart.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          const interval = rule.intervalDays || 1;
          if (diffDays % interval === 0) {
            dailyQty += rule.quantity;
          }
        }
      }

      if (dailyQty > 0) {
        // Safe upsert or create due to the unique constraint
        const existing = await this.prisma.delivery.findFirst({
          where: { customerId, scheduledFor: targetDate },
        });

        if (!existing) {
          await this.prisma.delivery.create({
            data: {
              customerId,
              addressId: defaultAddress.id,
              scheduledFor: targetDate,
              requiredQuantity: dailyQty,
              status: OrderStatus.PENDING_ASSIGNMENT,
            },
          });
          generatedCount++;
        }
      }
    }

    return { success: true, generatedCount };
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
      const delivery = await tx.delivery.findUnique({
        where: { id: deliveryId },
        include: { report: true },
      });

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

      let jarBalance = await tx.jarBalance.findUnique({
        where: { customerId_brandId: { customerId, brandId } },
      });
      if (!jarBalance) {
        jarBalance = await tx.jarBalance.create({
          data: { customerId, brandId, availableJars: 0, totalPurchased: 0 },
        });
      }

      let jarOwnership = await tx.jarOwnership.findUnique({
        where: { customerId_brandId: { customerId, brandId } },
      });
      if (!jarOwnership) {
        jarOwnership = await tx.jarOwnership.create({
          data: { customerId, brandId, companyJarsHeld: 0, ownedJars: 0 },
        });
      }

      let jarDeposit = await tx.jarDeposit.findUnique({
        where: { customerId_brandId: { customerId, brandId } },
      });
      if (!jarDeposit) {
        jarDeposit = await tx.jarDeposit.create({
          data: {
            customerId,
            brandId,
            maxActiveJars: 0,
            depositPaid: 0.0,
            depositDue: 0.0,
          },
        });
      }

      // 2. Perform math calculations
      const balanceBefore = jarBalance.availableJars;
      // Deduct from prepaid jar balance if available
      const balanceAfter = Math.max(0, balanceBefore - confirmedDeliveredQty);

      // Only enforce strict package balance limit if customer is an active package subscriber
      if (jarBalance.totalPurchased > 0 && jarBalance.availableJars < confirmedDeliveredQty) {
        throw new BadRequestException(
          'Insufficient customer jar balance to complete this quantity. Please recharge your package.',
        );
      }

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

      // Fetch deposit amount from settings
      const depositAmountPerJar = await this.settingsService.getSettingNumber(
        'DEPOSIT_AMOUNT_PER_JAR',
        200.0,
      );
      const newDepositDue = Math.max(
        0.0,
        newMaxActiveJars * depositAmountPerJar - jarDeposit.depositPaid,
      );

      // 3. Write updates
      await tx.jarBalance.update({
        where: { customerId_brandId: { customerId, brandId } },
        data: { availableJars: balanceAfter },
      });

      await tx.jarOwnership.update({
        where: { customerId_brandId: { customerId, brandId } },
        data: { companyJarsHeld: newCompanyJarsHeld },
      });

      await tx.jarDeposit.update({
        where: { customerId_brandId: { customerId, brandId } },
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
            referenceId: deliveryId,
            description: `Delivery completed. Customer: ${customerId}`,
          },
        });
      }

      // Log transaction
      const txn = await tx.transaction.create({
        data: {
          customerId,
          type: TransactionType.CONSUMPTION,
          amountJars: -confirmedDeliveredQty,
          balanceBefore,
          balanceAfter,
          referenceId: delivery.id,
          description: `Confirmed delivery of ${confirmedDeliveredQty} jars (Empty jars collected: ${confirmedEmptyCollected})`,
        },
      });

      // Update delivery report confirmation details
      await tx.deliveryReport.update({
        where: { deliveryId },
        data: {
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
        this.notificationService.notifyDeliveryCompleted({
          customerId,
          deliveredQty: confirmedDeliveredQty,
          emptyCollected: confirmedEmptyCollected,
          balanceAfter,
        });
      });

      return tx.delivery.update({
        where: { id: deliveryId },
        data: { status: OrderStatus.DELIVERED },
      });
    });
  }

  // 5. Fail delivery
  async failDelivery(deliveryId: string, reason: string) {
    return this.prisma.delivery.update({
      where: { id: deliveryId },
      data: {
        status: OrderStatus.FAILED,
        report: {
          upsert: {
            create: {
              partnerDeliveredQty: 0,
              partnerEmptyCollected: 0,
              partnerNotes: `Failed: ${reason}`,
            },
            update: {
              partnerNotes: `Failed: ${reason}`,
            },
          },
        },
      },
    });
  }
}
