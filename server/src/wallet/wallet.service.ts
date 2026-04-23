import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionType } from '@prisma/client';
import { Prisma } from '@prisma/client';

@Injectable()
export class WalletService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly moduleRef: ModuleRef,
  ) {}

  private async resolveSubscriptionsService() {
    try {
      const { SubscriptionsService } = await import('../subscriptions/subscriptions.service.js');
      return this.moduleRef.get(SubscriptionsService, { strict: false });
    } catch {
      return null;
    }
  }

  async getOrCreate(userId: string) {
    return this.prisma.wallet.upsert({
      where: { userId },
      create: { userId, balance: 0 },
      update: {},
      include: {
        transactions: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });
  }

  async getWallet(userId: string) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { userId },
      include: {
        transactions: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
    if (!wallet) {
      return this.getOrCreate(userId);
    }
    return wallet;
  }

  async getBalance(userId: string) {
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    return { balance: wallet?.balance ?? 0 };
  }

  async getTransactions(userId: string, page = 1, limit = 20) {
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) return { data: [], total: 0, page, limit };

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where: { walletId: wallet.id },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.transaction.count({ where: { walletId: wallet.id } }),
    ]);
    return { data, total, page, limit };
  }

  // ─────────────────────────────────────────────
  // CREDIT
  // ─────────────────────────────────────────────

  async credit(
    userId: string,
    amount: number,
    description: string,
    referenceId?: string,
  ) {
    if (amount <= 0) throw new BadRequestException('Credit amount must be positive');

    const wallet = await this.getOrCreate(userId);
    const [updatedWallet, tx] = await this.prisma.$transaction([
      this.prisma.wallet.update({
        where: { id: wallet.id },
        data: { balance: { increment: amount } },
      }),
      this.prisma.transaction.create({
        data: {
          walletId: wallet.id,
          userId,
          type: 'CREDIT',
          amount,
          closingBalance: Number(wallet.balance) + amount,
          description,
          referenceId,
        },
      }),
    ]);

    // After credit: retry any PENDING_PAYMENT subscriptions
    const subscriptionsService = await this.resolveSubscriptionsService();
    if (subscriptionsService?.retryPendingForUser) {
      const retried = await subscriptionsService.retryPendingForUser(userId);
      if (retried.length > 0) {
        console.log(`[Wallet] Reactivated ${retried.length} pending subscriptions for user ${userId}`);
      }
    }

    return { wallet: updatedWallet, transaction: tx };
  }

  // ─────────────────────────────────────────────
  // DEBIT
  // ─────────────────────────────────────────────

  async debit(
    userId: string,
    amount: number,
    description: string,
    referenceId?: string,
  ) {
    if (amount <= 0) throw new BadRequestException('Debit amount must be positive');

    const wallet = await this.getOrCreate(userId);
    if (Number(wallet.balance) < amount) {
      throw new BadRequestException(
        `Insufficient wallet balance. Available: ₹${wallet.balance}, Required: ₹${amount}`,
      );
    }

    const [updatedWallet, tx] = await this.prisma.$transaction([
      this.prisma.wallet.update({
        where: { id: wallet.id },
        data: { balance: { decrement: amount } },
      }),
      this.prisma.transaction.create({
        data: {
          walletId: wallet.id,
          userId,
          type: 'DEBIT',
          amount,
          closingBalance: Number(wallet.balance) - amount,
          description,
          referenceType: 'ORDER',
          referenceId,
        },
      }),
    ]);
    return { wallet: updatedWallet, transaction: tx };
  }

  // Transaction-safe debit for atomic cross-module operations
  async debitTx(
    txClient: any,
    userId: string,
    amount: number,
    description: string,
    referenceType: any,
    referenceId?: string,
  ) {
    if (amount <= 0) throw new BadRequestException('Debit amount must be positive');

    const wallet = await txClient.wallet.upsert({
      where: { userId },
      create: { userId, balance: 0 },
      update: {},
    });

    if (Number(wallet.balance) < amount) {
      throw new BadRequestException(
        `Insufficient wallet balance. Available: ₹${wallet.balance}, Required: ₹${amount}`,
      );
    }

    const updatedWallet = await txClient.wallet.update({
      where: { id: wallet.id },
      data: { balance: { decrement: amount } },
    });

    const tx = await txClient.transaction.create({
      data: {
        walletId: wallet.id,
        userId,
        type: 'DEBIT',
        amount,
        closingBalance: Number(wallet.balance) - amount,
        description,
        referenceType,
        referenceId,
      },
    });

    return { wallet: updatedWallet, transaction: tx };
  }

  // ─────────────────────────────────────────────
  // RECHARGE (via Razorpay / manual admin top-up)
  // ─────────────────────────────────────────────

  async recharge(
    userId: string,
    amount: number,
    razorpayPaymentId?: string,
    adminNote?: string,
  ) {
    if (amount < 10) {
      throw new BadRequestException('Minimum recharge amount is ₹10');
    }
    const description = razorpayPaymentId
      ? `Wallet recharge via Razorpay (${razorpayPaymentId})`
      : `Admin top-up${adminNote ? ': ' + adminNote : ''}`;

    return this.credit(userId, amount, description, razorpayPaymentId);
  }

  // ─────────────────────────────────────────────
  // JAR DAMAGE PENALTY
  // ─────────────────────────────────────────────

  async adjustForJarLoss(
    userId: string,
    quantity: number,
    penaltyPerJar: number,
    orderId?: string,
  ) {
    const totalPenalty = quantity * penaltyPerJar;
    return this.debit(
      userId,
      totalPenalty,
      `Jar Loss/Damage Penalty: ${quantity} jar(s) × ₹${penaltyPerJar}`,
      orderId,
    );
  }
}
