import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DistributorIdentityResolver } from './distributor-identity.resolver';
import {
  TopUpDistributorWalletDto,
  PayPurchaseFromWalletDto,
  RequestDistributorWithdrawalDto,
  QueryDistributorWalletTransactionsDto,
} from './dto/distributor-wallet.dto';
import { DistributorWalletTxType } from '@prisma/client';

@Injectable()
export class DistributorWalletService {
  private readonly logger = new Logger(DistributorWalletService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly identityResolver: DistributorIdentityResolver,
  ) {}

  /**
   * Helper to ensure wallet exists for distributor
   */
  private async getOrCreateWallet(distributorId: string) {
    let wallet = await this.prisma.distributorWallet.findUnique({
      where: { distributorId },
    });

    if (!wallet) {
      wallet = await this.prisma.distributorWallet.create({
        data: {
          distributorId,
          balance: 0.0,
        },
      });
    }

    return wallet;
  }

  /**
   * Fetch distributor wallet overview, balance, and key financial stats
   */
  async getWalletOverview(
    caller: { id?: string; sub?: string; role?: string },
    explicitDistributorId?: string,
  ) {
    const identity = await this.identityResolver.resolve(
      caller,
      explicitDistributorId,
    );
    const wallet = await this.getOrCreateWallet(identity.distributorId);

    // Aggregate statistics across transaction types
    const [txSummary, pendingPurchases] = await Promise.all([
      this.prisma.distributorWalletTransaction.groupBy({
        by: ['type'],
        where: { walletId: wallet.id },
        _sum: { amount: true },
        _count: { id: true },
      }),
      // Look up unpaid or partially paid wholesale purchases
      this.prisma.purchase.aggregate({
        where: {
          distributorId: identity.userId,
          paymentStatus: { in: ['DUE', 'PARTIAL'] },
        },
        _sum: { total: true, amountPaid: true },
        _count: { id: true },
      }),
    ]);

    let totalTopUp = 0;
    let totalPurchasePaid = 0;
    let totalCommission = 0;
    let totalWithdrawal = 0;
    let totalCodSettlement = 0;

    for (const item of txSummary) {
      const sum = item._sum.amount || 0;
      switch (item.type) {
        case DistributorWalletTxType.TOP_UP:
        case DistributorWalletTxType.ADJUSTMENT:
          totalTopUp += sum;
          break;
        case DistributorWalletTxType.PURCHASE_PAYMENT:
          totalPurchasePaid += sum;
          break;
        case DistributorWalletTxType.COMMISSION_CREDIT:
          totalCommission += sum;
          break;
        case DistributorWalletTxType.WITHDRAWAL:
          totalWithdrawal += sum;
          break;
        case DistributorWalletTxType.COD_SETTLEMENT:
          totalCodSettlement += sum;
          break;
      }
    }

    const totalPurchasesAmount = pendingPurchases._sum.total || 0;
    const purchasesPaidSoFar = pendingPurchases._sum.amountPaid || 0;
    const pendingPurchasesPayable = Math.max(0, totalPurchasesAmount - purchasesPaidSoFar);

    return {
      distributor: {
        id: identity.distributorId,
        agencyName: identity.agencyName,
        routeOrArea: identity.routeOrArea,
      },
      wallet: {
        id: wallet.id,
        balance: Number(wallet.balance.toFixed(2)),
        currency: wallet.currency,
        updatedAt: wallet.updatedAt,
      },
      stats: {
        totalTopUp: Number(totalTopUp.toFixed(2)),
        totalPurchasePaid: Number(totalPurchasePaid.toFixed(2)),
        totalCommission: Number(totalCommission.toFixed(2)),
        totalWithdrawal: Number(totalWithdrawal.toFixed(2)),
        totalCodSettlement: Number(totalCodSettlement.toFixed(2)),
        pendingPurchasesDue: Number(pendingPurchasesPayable.toFixed(2)),
        pendingPurchasesCount: pendingPurchases._count.id || 0,
      },
    };
  }

  /**
   * Paginated transaction history with type/search filtering
   */
  async getTransactions(
    caller: { id?: string; sub?: string; role?: string },
    query: QueryDistributorWalletTransactionsDto,
    explicitDistributorId?: string,
  ) {
    const identity = await this.identityResolver.resolve(
      caller,
      explicitDistributorId,
    );
    const wallet = await this.getOrCreateWallet(identity.distributorId);

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const whereClause: any = {
      walletId: wallet.id,
    };

    if (query.type && query.type !== 'ALL') {
      whereClause.type = query.type as DistributorWalletTxType;
    }

    if (query.search?.trim()) {
      const q = query.search.trim();
      whereClause.OR = [
        { description: { contains: q, mode: 'insensitive' } },
        { referenceId: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [total, items] = await Promise.all([
      this.prisma.distributorWalletTransaction.count({ where: whereClause }),
      this.prisma.distributorWalletTransaction.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      items: items.map((tx) => ({
        id: tx.id,
        type: tx.type,
        amount: Number(tx.amount.toFixed(2)),
        balanceBefore: Number(tx.balanceBefore.toFixed(2)),
        balanceAfter: Number(tx.balanceAfter.toFixed(2)),
        referenceId: tx.referenceId,
        description: tx.description,
        createdAt: tx.createdAt,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Top-up wallet balance (Recharge / Bank Deposit)
   */
  async topUp(
    caller: { id?: string; sub?: string; role?: string },
    dto: TopUpDistributorWalletDto,
    explicitDistributorId?: string,
  ) {
    const identity = await this.identityResolver.resolve(
      caller,
      explicitDistributorId,
    );
    const amount = Number(dto.amount);
    if (isNaN(amount) || amount <= 0) {
      throw new BadRequestException('Top-up amount must be greater than zero.');
    }

    const wallet = await this.getOrCreateWallet(identity.distributorId);

    const result = await this.prisma.$transaction(async (tx) => {
      const freshWallet = await tx.distributorWallet.findUnique({
        where: { id: wallet.id },
      });
      if (!freshWallet) throw new NotFoundException('Wallet not found');

      const balanceBefore = freshWallet.balance;
      const balanceAfter = balanceBefore + amount;

      const updatedWallet = await tx.distributorWallet.update({
        where: { id: freshWallet.id },
        data: { balance: balanceAfter },
      });

      const transaction = await tx.distributorWalletTransaction.create({
        data: {
          walletId: freshWallet.id,
          type: DistributorWalletTxType.TOP_UP,
          amount,
          balanceBefore,
          balanceAfter,
          referenceId: dto.referenceId || `TOPUP-${Date.now()}`,
          description:
            dto.notes?.trim() ||
            `Distributor Wallet Recharge via ${dto.paymentMethod || 'Direct Transfer'}`,
          createdById: caller.id || caller.sub,
        },
      });

      return { wallet: updatedWallet, transaction };
    });

    this.logger.log(
      `[DistributorWallet] Top-up of ₹${amount} successful for ${identity.agencyName}. New balance: ₹${result.wallet.balance}`,
    );

    return {
      success: true,
      message: `Successfully added ₹${amount.toFixed(2)} to wallet.`,
      wallet: {
        id: result.wallet.id,
        balance: Number(result.wallet.balance.toFixed(2)),
      },
      transaction: result.transaction,
    };
  }

  /**
   * Pay for wholesale jar purchase using available wallet balance
   */
  async payPurchase(
    caller: { id?: string; sub?: string; role?: string },
    dto: PayPurchaseFromWalletDto,
    explicitDistributorId?: string,
  ) {
    const identity = await this.identityResolver.resolve(
      caller,
      explicitDistributorId,
    );
    const wallet = await this.getOrCreateWallet(identity.distributorId);

    const purchase = await this.prisma.purchase.findFirst({
      where: {
        id: dto.purchaseId,
        distributorId: identity.userId,
      },
    });

    if (!purchase) {
      throw new NotFoundException('Wholesale purchase record not found.');
    }

    const currentTotal = purchase.total;
    const currentPaid = purchase.amountPaid || 0;
    const remainingDue = Math.max(0, currentTotal - currentPaid);

    if (remainingDue <= 0 || purchase.paymentStatus === 'PAID') {
      throw new BadRequestException('This purchase order is already fully paid.');
    }

    const payAmount = dto.amount ? Math.min(dto.amount, remainingDue) : remainingDue;

    if (payAmount <= 0) {
      throw new BadRequestException('Payment amount must be greater than zero.');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const freshWallet = await tx.distributorWallet.findUnique({
        where: { id: wallet.id },
      });

      if (!freshWallet || freshWallet.balance < payAmount) {
        throw new BadRequestException(
          `Insufficient wallet balance (₹${(freshWallet?.balance || 0).toFixed(2)}). Need ₹${payAmount.toFixed(2)}. Please recharge your wallet first.`,
        );
      }

      const balanceBefore = freshWallet.balance;
      const balanceAfter = balanceBefore - payAmount;

      // 1. Deduct wallet
      const updatedWallet = await tx.distributorWallet.update({
        where: { id: freshWallet.id },
        data: { balance: balanceAfter },
      });

      // 2. Create transaction record
      const transaction = await tx.distributorWalletTransaction.create({
        data: {
          walletId: freshWallet.id,
          type: DistributorWalletTxType.PURCHASE_PAYMENT,
          amount: payAmount,
          balanceBefore,
          balanceAfter,
          referenceId: purchase.purchaseNumber || purchase.id,
          description: `Payment for Wholesale Purchase #${purchase.purchaseNumber || purchase.id} (${purchase.supplierName})`,
          createdById: caller.id || caller.sub,
        },
      });

      // 3. Update purchase payment status & amountPaid
      const newAmountPaid = currentPaid + payAmount;
      const newStatus = newAmountPaid >= currentTotal - 0.01 ? 'PAID' : 'PARTIAL';

      const existingPayments = Array.isArray(purchase.payments)
        ? (purchase.payments as any[])
        : [];

      existingPayments.push({
        amount: payAmount,
        method: 'WALLET',
        date: new Date().toISOString(),
        reference: transaction.id,
      });

      const updatedPurchase = await tx.purchase.update({
        where: { id: purchase.id },
        data: {
          amountPaid: newAmountPaid,
          paymentStatus: newStatus,
          payments: existingPayments,
        },
      });

      return { wallet: updatedWallet, transaction, purchase: updatedPurchase };
    });

    return {
      success: true,
      message: `Paid ₹${payAmount.toFixed(2)} toward Purchase #${purchase.purchaseNumber || purchase.id}.`,
      wallet: {
        id: result.wallet.id,
        balance: Number(result.wallet.balance.toFixed(2)),
      },
      transaction: result.transaction,
      purchase: {
        id: result.purchase.id,
        paymentStatus: result.purchase.paymentStatus,
        amountPaid: result.purchase.amountPaid,
      },
    };
  }

  /**
   * Request withdrawal / payout to bank account
   */
  async requestWithdrawal(
    caller: { id?: string; sub?: string; role?: string },
    dto: RequestDistributorWithdrawalDto,
    explicitDistributorId?: string,
  ) {
    const identity = await this.identityResolver.resolve(
      caller,
      explicitDistributorId,
    );
    const amount = Number(dto.amount);
    if (isNaN(amount) || amount <= 0) {
      throw new BadRequestException('Withdrawal amount must be greater than zero.');
    }

    const wallet = await this.getOrCreateWallet(identity.distributorId);

    const result = await this.prisma.$transaction(async (tx) => {
      const freshWallet = await tx.distributorWallet.findUnique({
        where: { id: wallet.id },
      });

      if (!freshWallet || freshWallet.balance < amount) {
        throw new BadRequestException(
          `Insufficient wallet balance (₹${(freshWallet?.balance || 0).toFixed(2)}). You cannot withdraw more than your available balance.`,
        );
      }

      const balanceBefore = freshWallet.balance;
      const balanceAfter = balanceBefore - amount;

      const updatedWallet = await tx.distributorWallet.update({
        where: { id: freshWallet.id },
        data: { balance: balanceAfter },
      });

      const txRecord = await tx.distributorWalletTransaction.create({
        data: {
          walletId: freshWallet.id,
          type: DistributorWalletTxType.WITHDRAWAL,
          amount,
          balanceBefore,
          balanceAfter,
          referenceId: `WD-${Date.now()}`,
          description: `Payout request to ${dto.bankName} (A/C: ${dto.accountNumber.slice(-4).padStart(dto.accountNumber.length, '*')}, IFSC: ${dto.ifscCode})${dto.notes ? ` - ${dto.notes}` : ''}`,
          createdById: caller.id || caller.sub,
        },
      });

      return { wallet: updatedWallet, transaction: txRecord };
    });

    return {
      success: true,
      message: `Withdrawal request of ₹${amount.toFixed(2)} submitted successfully.`,
      wallet: {
        id: result.wallet.id,
        balance: Number(result.wallet.balance.toFixed(2)),
      },
      transaction: result.transaction,
    };
  }
}
