import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { SubscriptionFrequency, SubscriptionStatus } from '@prisma/client';
import { addDays, parseISO, formatISO, startOfDay } from 'date-fns';

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
  ) {}

  // ─────────────────────────────────────────────
  // CREATE
  // ─────────────────────────────────────────────

  async create(
    userId: string,
    data: {
      frequency: SubscriptionFrequency;
      startDate: Date;
      addressId: string;
      items: { productId: string; quantity: number }[];
      customDays?: number[];
      skipDates?: Date[];
    },
  ) {
    // Validate address belongs to user
    const address = await this.prisma.address.findFirst({
      where: { id: data.addressId, userId, deletedAt: null },
    });
    if (!address) throw new NotFoundException('Address not found');

    // Fetch products for pricing
    const productIds = data.items.map((i) => i.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, isActive: true, deletedAt: null },
    });
    if (products.length !== productIds.length) {
      throw new BadRequestException('One or more products are invalid or inactive');
    }

    let totalAmount = 0;
    const subItems = data.items.map((item) => {
      const product = products.find((p) => p.id === item.productId)!;
      const unitPrice = Number(product.price);
      totalAmount += unitPrice * item.quantity;
      return {
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: product.price,
      };
    });

    const startDate = new Date(data.startDate);
    const nextDeliveryDate = this.calcNextDelivery(startDate, data.frequency, data.customDays || [], data.skipDates || [], true);

    return this.prisma.subscription.create({
      data: {
        userId,
        frequency: data.frequency,
        startDate,
        nextDeliveryDate,
        totalAmount,
        items: { create: subItems },
        schedule: {
          create: {
            customDays: data.customDays || [],
            skipDates: data.skipDates || [],
          }
        }
      },
      include: { items: { include: { product: true } }, schedule: true },
    });
  }

  // ─────────────────────────────────────────────
  // QUERIES
  // ─────────────────────────────────────────────

  async findByUser(userId: string) {
    return this.prisma.subscription.findMany({
      where: { userId, deletedAt: null },
      include: { items: { include: { product: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAll(status?: SubscriptionStatus, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.subscription.findMany({
        where: { deletedAt: null, ...(status && { status }) },
        include: {
          user: { select: { id: true, name: true, phone: true } },
          items: { include: { product: { select: { id: true, name: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.subscription.count({
        where: { deletedAt: null, ...(status && { status }) },
      }),
    ]);
    return { data, total, page, limit };
  }

  async findById(id: string) {
    const sub = await this.prisma.subscription.findFirst({
      where: { id, deletedAt: null },
      include: {
        user: { select: { id: true, name: true, phone: true } },
        items: { include: { product: true } },
        schedule: true,
      },
    });
    if (!sub) throw new NotFoundException('Subscription not found');
    return sub;
  }

  // ─────────────────────────────────────────────
  // LIFECYCLE: PAUSE
  // ─────────────────────────────────────────────

  async pause(id: string, userId: string) {
    const sub = await this.findAndAuthorize(id, userId);
    if (sub.status === 'PAUSED') {
      throw new BadRequestException('Subscription is already paused');
    }
    if (!['ACTIVE', 'PENDING_PAYMENT'].includes(sub.status)) {
      throw new BadRequestException(`Cannot pause subscription in ${sub.status} status`);
    }
    return this.prisma.subscription.update({
      where: { id },
      data: { status: 'PAUSED', pausedAt: new Date() },
    });
  }

  // ─────────────────────────────────────────────
  // LIFECYCLE: RESUME
  // ─────────────────────────────────────────────

  async resume(id: string, userId: string) {
    const sub = await this.findAndAuthorize(id, userId);
    if (sub.status !== 'PAUSED') {
      throw new BadRequestException('Subscription is not paused');
    }

    // Recalculate next delivery from today
    const nextDeliveryDate = this.calcNextDelivery(new Date(), sub.frequency, sub.schedule?.customDays || [], sub.schedule?.skipDates || [], true);

    return this.prisma.subscription.update({
      where: { id },
      data: {
        status: 'ACTIVE',
        resumedAt: new Date(),
        nextDeliveryDate,
      },
    });
  }

  // ─────────────────────────────────────────────
  // LIFECYCLE: SKIP NEXT DELIVERY
  // ─────────────────────────────────────────────

  async skipNext(id: string, userId: string) {
    const sub = await this.findAndAuthorize(id, userId);
    if (sub.status !== 'ACTIVE') {
      throw new BadRequestException('Can only skip on an active subscription');
    }
    if (!sub.nextDeliveryDate) {
      throw new BadRequestException('No upcoming delivery to skip');
    }

    const skippedDate = startOfDay(sub.nextDeliveryDate);
    const alreadySkipped = sub.schedule?.skipDates.some(d => startOfDay(new Date(d)).getTime() === skippedDate.getTime());
    
    if (alreadySkipped) {
      throw new BadRequestException('Next delivery is already skipped');
    }

    // Update schedule skipDates
    await this.prisma.subscriptionSchedule.update({
      where: { subscriptionId: id },
      data: { skipDates: { push: skippedDate } }
    });

    // Advance to the delivery after the skipped one
    const newNext = this.calcNextDelivery(
      sub.nextDeliveryDate, 
      sub.frequency, 
      sub.schedule?.customDays || [], 
      [...(sub.schedule?.skipDates || []), skippedDate]
    );

    return this.prisma.subscription.update({
      where: { id },
      data: {
        nextDeliveryDate: newNext,
      },
    });
  }

  // ─────────────────────────────────────────────
  // LIFECYCLE: EXTEND
  // ─────────────────────────────────────────────

  async extend(id: string, userId: string, days: number) {
    if (days <= 0 || days > 365) {
      throw new BadRequestException('Days must be between 1 and 365');
    }
    const sub = await this.findAndAuthorize(id, userId);
    if (['CANCELLED', 'EXPIRED'].includes(sub.status)) {
      throw new BadRequestException(`Cannot extend a ${sub.status} subscription`);
    }

    const baseDate = sub.endDate ?? new Date();
    const newEndDate = addDays(new Date(baseDate), days);

    return this.prisma.subscription.update({
      where: { id },
      data: { endDate: newEndDate, status: 'ACTIVE' },
    });
  }

  // ─────────────────────────────────────────────
  // LIFECYCLE: CANCEL
  // ─────────────────────────────────────────────

  async cancel(id: string, userId: string) {
    const sub = await this.findAndAuthorize(id, userId);
    if (['CANCELLED', 'EXPIRED'].includes(sub.status)) {
      throw new BadRequestException('Subscription is already cancelled or expired');
    }
    return this.prisma.subscription.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
  }

  // ─────────────────────────────────────────────
  // ADMIN: MANUAL STATUS OVERRIDE
  // ─────────────────────────────────────────────

  async updateStatus(id: string, status: SubscriptionStatus) {
    const sub = await this.prisma.subscription.findFirst({ where: { id, deletedAt: null } });
    if (!sub) throw new NotFoundException('Subscription not found');
    return this.prisma.subscription.update({ where: { id }, data: { status } });
  }

  // ─────────────────────────────────────────────
  // ENGINE HELPERS
  // ─────────────────────────────────────────────

  async advanceDeliveryDate(id: string) {
    const sub = await this.prisma.subscription.findUnique({ where: { id }, include: { schedule: true } });
    if (!sub || !sub.nextDeliveryDate) return;
    const next = this.calcNextDelivery(sub.nextDeliveryDate, sub.frequency, sub.schedule?.customDays || [], sub.schedule?.skipDates || []);
    return this.prisma.subscription.update({
      where: { id },
      data: { nextDeliveryDate: next },
    });
  }

  async markAsPendingPayment(id: string) {
    return this.prisma.subscription.update({
      where: { id },
      data: { status: 'PENDING_PAYMENT' },
    });
  }

  /**
   * Called when a user tops up their wallet.
   * Finds all PENDING_PAYMENT subscriptions for this user and reactivates them.
   */
  async retryPendingForUser(userId: string): Promise<string[]> {
    const pending = await this.prisma.subscription.findMany({
      where: { userId, status: 'PENDING_PAYMENT', deletedAt: null },
    });

    const retriedIds: string[] = [];
    for (const sub of pending) {
      // Check if wallet now has sufficient balance
      const sufficient = await this.hasSufficientBalance(userId, Number(sub.totalAmount));
      if (sufficient) {
        const fullSub = await this.prisma.subscription.findUnique({ where: { id: sub.id }, include: { schedule: true } });
        // Recalculate next delivery from today
        const nextDeliveryDate = this.calcNextDelivery(new Date(), sub.frequency, fullSub?.schedule?.customDays || [], fullSub?.schedule?.skipDates || [], true);
        await this.prisma.subscription.update({
          where: { id: sub.id },
          data: { status: 'ACTIVE', nextDeliveryDate },
        });
        retriedIds.push(sub.id);
      }
    }
    return retriedIds;
  }

  async hasSufficientBalance(userId: string, amount: number): Promise<boolean> {
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    return !!wallet && Number(wallet.balance) >= amount;
  }

  // ─────────────────────────────────────────────
  // PRIVATE HELPERS
  // ─────────────────────────────────────────────

  private async findAndAuthorize(id: string, userId: string) {
    const sub = await this.prisma.subscription.findFirst({
      where: { id, deletedAt: null },
      include: { items: true, schedule: true },
    });
    if (!sub) throw new NotFoundException('Subscription not found');
    if (sub.userId !== userId) throw new ForbiddenException('Access denied');
    return sub;
  }

  /**
   * @param from      The base date for calculation
   * @param frequency Subscription frequency
   * @param fromToday If true, uses today as base (for resume/initial creation)
   */
  calcNextDelivery(
    from: Date,
    frequency: SubscriptionFrequency,
    customDays: number[] = [],
    skipDates: Date[] = [],
    fromToday = false,
  ): Date {
    const base = startOfDay(fromToday ? new Date() : new Date(from));
    let nextDate = base;

    if (frequency === 'CUSTOM') {
      // Find the next day that matches customDays (0=Sun, 1=Mon, ...)
      if (!customDays || customDays.length === 0) customDays = [0, 1, 2, 3, 4, 5, 6]; 
      
      let attempts = 0;
      do {
        nextDate = addDays(nextDate, 1);
        attempts++;
      } while (!customDays.includes(nextDate.getDay()) && attempts < 14);
    } else {
      const daysMap: Record<string, number> = {
        DAILY: 1,
        ALTERNATE_DAYS: 2,
        WEEKLY: 7,
        MONTHLY: 30,
      };
      nextDate = addDays(base, daysMap[frequency] || 1);
    }
    
    // Check if nextDate is in skipDates. If yes, compute next recursively.
    const isSkipped = skipDates.some(d => startOfDay(new Date(d)).getTime() === nextDate.getTime());
    if (isSkipped) {
       return this.calcNextDelivery(nextDate, frequency, customDays, skipDates, false);
    }

    return nextDate;
  }
}
