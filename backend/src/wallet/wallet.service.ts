import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WalletTransactionType, TransactionType, PaymentStatus } from '@prisma/client';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class WalletService {
  constructor(
    private prisma: PrismaService,
    private settingsService: SettingsService,
  ) {}

  async getWallet(userId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { userId },
    });
    if (!customer) throw new NotFoundException('Customer profile not found');

    let wallet = await this.prisma.wallet.findUnique({
      where: { customerId: customer.id },
    });

    if (!wallet) {
      wallet = await this.prisma.wallet.create({
        data: {
          customerId: customer.id,
          balance: 0.0,
        },
      });
    }
    return wallet;
  }

  async getAdminLedger() {
    const [wallets, deposits] = await Promise.all([
      this.prisma.wallet.aggregate({ _sum: { balance: true } }),
      this.prisma.jarDeposit.aggregate({ _sum: { depositPaid: true } }),
    ]);

    const refunded = await this.prisma.transaction.aggregate({
      _sum: { amountMoney: true },
      where: { type: TransactionType.REFUND },
    });

    return {
      totalRechargeBalances: wallets._sum.balance ?? 0,
      totalDepositsHeld: deposits._sum.depositPaid ?? 0,
      depositsRefunded: refunded._sum.amountMoney ?? 0,
      pendingSettlements: 0,
    };
  }

  async getTransactions(userId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { userId },
      include: { wallet: true },
    });
    if (!customer) throw new NotFoundException('Customer profile not found');
    if (!customer.wallet) return [];

    return this.prisma.walletTransaction.findMany({
      where: { walletId: customer.wallet.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async addFunds(
    userId: string,
    amount: number,
    type: WalletTransactionType,
    description?: string,
    referenceId?: string,
  ) {
    const customer = await this.prisma.customer.findUnique({
      where: { userId },
    });
    if (!customer) throw new NotFoundException('Customer profile not found');

    return this.prisma.$transaction(async (tx) => {
      let wallet = await tx.wallet.findUnique({
        where: { customerId: customer.id },
      });
      if (!wallet) {
        wallet = await tx.wallet.create({ data: { customerId: customer.id } });
      }

      const balanceBefore = wallet.balance;
      const balanceAfter = balanceBefore + amount;

      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: balanceAfter },
      });

      const transaction = await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type,
          amount,
          balanceBefore,
          balanceAfter,
          referenceId,
          description,
        },
      });

      return { wallet: { ...wallet, balance: balanceAfter }, transaction };
    });
  }

  async deductFunds(
    userId: string,
    amount: number,
    type: WalletTransactionType,
    description?: string,
    referenceId?: string,
  ) {
    const customer = await this.prisma.customer.findUnique({
      where: { userId },
    });
    if (!customer) throw new NotFoundException('Customer profile not found');

    return this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({
        where: { customerId: customer.id },
      });
      if (!wallet) {
        throw new NotFoundException('Wallet not found');
      }

      if (wallet.balance < amount) {
        throw new BadRequestException('Insufficient wallet balance');
      }

      const balanceBefore = wallet.balance;
      const balanceAfter = balanceBefore - amount;

      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: balanceAfter },
      });

      const transaction = await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type,
          amount,
          balanceBefore,
          balanceAfter,
          referenceId,
          description,
        },
      });

      return { wallet: { ...wallet, balance: balanceAfter }, transaction };
    });
  }

  async ownJar(userId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { userId },
      include: {
        wallet: true,
        jarDeposit: true,
        jarOwnership: true,
        jarBalance: true,
      },
    });

    if (!customer) throw new NotFoundException('Customer profile not found');

    let wallet = customer.wallet;
    if (!wallet) {
      wallet = await this.prisma.wallet.create({
        data: { customerId: customer.id, balance: 0.0 },
      });
    }

    let jarDeposit = customer.jarDeposit;
    if (!jarDeposit) {
      jarDeposit = await this.prisma.jarDeposit.create({
        data: {
          customerId: customer.id,
          maxActiveJars: 0,
          depositPaid: 0.0,
          depositDue: 0.0,
        },
      });
    }

    let jarOwnership = customer.jarOwnership;
    if (!jarOwnership) {
      jarOwnership = await this.prisma.jarOwnership.create({
        data: { customerId: customer.id, companyJarsHeld: 0, ownedJars: 0 },
      });
    }

    const depositAmount = await this.settingsService.getSettingNumber(
      'DEPOSIT_AMOUNT_PER_JAR',
      200.0,
    );

    if (jarDeposit.depositDue < depositAmount) {
      throw new BadRequestException('No outstanding deposit due to pay');
    }

    if (wallet.balance < depositAmount) {
      throw new BadRequestException(
        `Insufficient wallet balance (₹${depositAmount} required)`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const balanceBefore = wallet.balance;
      const balanceAfter = balanceBefore - depositAmount;
      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: balanceAfter },
      });

      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: WalletTransactionType.DEDUCTION,
          amount: depositAmount,
          balanceBefore,
          balanceAfter,
          description: `Payment for Jar Ownership conversion`,
        },
      });

      const newCompanyJarsHeld = Math.max(0, jarOwnership.companyJarsHeld - 1);
      const newOwnedJars = jarOwnership.ownedJars + 1;

      await tx.jarOwnership.update({
        where: { customerId: customer.id },
        data: {
          companyJarsHeld: newCompanyJarsHeld,
          ownedJars: newOwnedJars,
        },
      });

      const newDepositPaid = jarDeposit.depositPaid + depositAmount;
      const newDepositDue = Math.max(
        0.0,
        jarDeposit.depositDue - depositAmount,
      );

      await tx.jarDeposit.update({
        where: { customerId: customer.id },
        data: {
          depositPaid: newDepositPaid,
          depositDue: newDepositDue,
        },
      });

      await tx.transaction.create({
        data: {
          customerId: customer.id,
          type: TransactionType.DEPOSIT_PAYMENT,
          amountMoney: depositAmount,
          balanceBefore: customer.jarBalance?.availableJars ?? 0,
          balanceAfter: customer.jarBalance?.availableJars ?? 0,
          description: `Converted deposit due into owned jar (₹${depositAmount})`,
        },
      });

      return { success: true };
    });
  }

  async rechargeWallet(userId: string, amount: number) {
    if (amount <= 0) {
      throw new BadRequestException('Recharge amount must be greater than 0');
    }
    
    // Check auto-creation and credit wallet
    return this.addFunds(
      userId,
      amount,
      WalletTransactionType.TOP_UP,
      `Direct Wallet Recharge (₹${amount})`
    );
  }
}
