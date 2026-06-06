import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DeliveryStatus, TransactionType } from '@prisma/client';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class DeliveryEngine {
  constructor(
    private prisma: PrismaService,
    private settingsService: SettingsService,
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
              status: DeliveryStatus.PENDING,
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
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    
    // Calculate the start of the current week (Monday)
    const day = today.getUTCDay();
    const diff = today.getUTCDate() - day + (day === 0 ? -6 : 1);
    const startOfWeek = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), diff));

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

    // We must safely clear all FUTURE and CURRENT pending/assigned deliveries to regenerate them cleanly
    await this.prisma.delivery.deleteMany({
      where: {
        customerId,
        scheduledFor: { gte: startOfWeek },
        status: { in: [DeliveryStatus.PENDING, DeliveryStatus.ASSIGNED] }
      }
    });

    if (!schedule || !schedule.isActive || schedule.rules.length === 0) {
      return { success: true, generatedCount: 0 };
    }

    const defaultAddress = schedule.customer.addresses.find((a) => a.isDefault) || schedule.customer.addresses[0];
    if (!defaultAddress) return { success: true, generatedCount: 0 };

    let generatedCount = 0;
    const daysToGenerate = weeksOut * 7;
    
    // We generate from START OF WEEK to N weeks out.
    for (let i = 0; i < daysToGenerate; i++) {
      const targetDate = new Date(startOfWeek.getTime());
      targetDate.setUTCDate(startOfWeek.getUTCDate() + i);
      const dayOfWeek = targetDate.getUTCDay();
      
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
          where: { customerId, scheduledFor: targetDate }
        });

        if (!existing) {
          await this.prisma.delivery.create({
            data: {
              customerId,
              addressId: defaultAddress.id,
              scheduledFor: targetDate,
              requiredQuantity: dailyQty,
              status: DeliveryStatus.PENDING,
            }
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
        data: { status: DeliveryStatus.ASSIGNED },
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
        data: { status: DeliveryStatus.DELIVERED },
      });
    });
  }

  // 4. Staff confirms delivery, reducing balance and updating deposit/ownership atomically
  async confirmDelivery(
    deliveryId: string,
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
      if (delivery.status === DeliveryStatus.DELIVERED) {
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

      // 1. Fetch balance, deposit, and ownership records (initialize if missing)
      let jarBalance = await tx.jarBalance.findUnique({
        where: { customerId },
      });
      if (!jarBalance) {
        jarBalance = await tx.jarBalance.create({
          data: { customerId, availableJars: 0, totalPurchased: 0 },
        });
      }

      let jarOwnership = await tx.jarOwnership.findUnique({
        where: { customerId },
      });
      if (!jarOwnership) {
        jarOwnership = await tx.jarOwnership.create({
          data: { customerId, companyJarsHeld: 0, ownedJars: 0 },
        });
      }

      let jarDeposit = await tx.jarDeposit.findUnique({
        where: { customerId },
      });
      if (!jarDeposit) {
        jarDeposit = await tx.jarDeposit.create({
          data: {
            customerId,
            maxActiveJars: 0,
            depositPaid: 0.0,
            depositDue: 0.0,
          },
        });
      }

      // Check balance limit (negative balance protection)
      if (jarBalance.availableJars < confirmedDeliveredQty) {
        throw new BadRequestException(
          'Insufficient customer jar balance to complete this quantity.',
        );
      }

      // 2. Perform math calculations
      const balanceBefore = jarBalance.availableJars;
      const balanceAfter = balanceBefore - confirmedDeliveredQty;

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
        where: { customerId },
        data: { availableJars: balanceAfter },
      });

      await tx.jarOwnership.update({
        where: { customerId },
        data: { companyJarsHeld: newCompanyJarsHeld },
      });

      await tx.jarDeposit.update({
        where: { customerId },
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
      if (balanceAfter <= lowBalanceThreshold) {
        const custRecord = await tx.customer.findUnique({
          where: { id: customerId },
        });
        if (custRecord) {
          await tx.notification.create({
            data: {
              userId: custRecord.userId,
              type: 'LOW_BALANCE',
              title: 'Low prepaid jar balance!',
              message: `You only have ${balanceAfter} jars remaining in your prepaid balance. Please purchase a new package to prevent delivery interruptions.`,
            },
          });
        }
      }

      // Also create a notification for completed delivery
      const custRecord = await tx.customer.findUnique({
        where: { id: customerId },
      });
      if (custRecord) {
        await tx.notification.create({
          data: {
            userId: custRecord.userId,
            type: 'DELIVERY_UPDATE',
            title: 'Delivery Completed Successfully',
            message: `Your scheduled delivery of ${confirmedDeliveredQty} water jars has been completed. Empty jars collected: ${confirmedEmptyCollected}. Remaining prepaid balance: ${balanceAfter} jars.`,
          },
        });
      }

      return tx.delivery.update({
        where: { id: deliveryId },
        data: { status: DeliveryStatus.DELIVERED },
      });
    });
  }

  // 5. Fail delivery
  async failDelivery(deliveryId: string, reason: string) {
    return this.prisma.delivery.update({
      where: { id: deliveryId },
      data: {
        status: DeliveryStatus.FAILED,
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
