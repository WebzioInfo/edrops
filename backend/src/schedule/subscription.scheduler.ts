import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStatus } from '@prisma/client';

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

              const order = await tx.order.create({
                data: {
                  customerId: schedule.customerId,
                  orderType: 'SUBSCRIPTION_ORDER',
                  status: OrderStatus.NEW,
                  scheduledDate: today,
                  deliveryAddressId: defaultAddress.id,
                  totalAmount: 0, // Prepaid, deduced from jarBalance
                  paymentStatus: 'SUCCESS', // Prepaid via jar balance
                  paymentMethod: 'PREPAID',
                  items: {
                    create: {
                      productId: product.id,
                      quantity: todayQty,
                      unitPrice: 0,
                      total: 0,
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
