import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  WalletTransactionType,
  TransactionType,
  PaymentStatus,
} from '@prisma/client';
import { SettingsService } from '../settings/settings.service';
import { PaymentService } from '../payment/payment.service';

@Injectable()
export class WalletService {
  constructor(
    private prisma: PrismaService,
    private settingsService: SettingsService,
    private paymentService: PaymentService,
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
    tx?: any,
  ) {
    const customer = await this.prisma.customer.findUnique({
      where: { userId },
    });
    if (!customer) throw new NotFoundException('Customer profile not found');

    const execute = async (prismaTx: any) => {
      let wallet = await prismaTx.wallet.findUnique({
        where: { customerId: customer.id },
      });
      if (!wallet) {
        wallet = await prismaTx.wallet.create({
          data: { customerId: customer.id },
        });
      }

      const balanceBefore = wallet.balance;
      const balanceAfter = balanceBefore + amount;

      await prismaTx.wallet.update({
        where: { id: wallet.id },
        data: { balance: balanceAfter },
      });

      const transaction = await prismaTx.walletTransaction.create({
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
    };

    return tx ? execute(tx) : this.prisma.$transaction(execute);
  }

  async deductFunds(
    userId: string,
    amount: number,
    type: WalletTransactionType,
    description?: string,
    referenceId?: string,
    tx?: any,
  ) {
    const customer = await this.prisma.customer.findUnique({
      where: { userId },
    });
    if (!customer) throw new NotFoundException('Customer profile not found');

    const execute = async (prismaTx: any) => {
      const wallet = await prismaTx.wallet.findUnique({
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

      await prismaTx.wallet.update({
        where: { id: wallet.id },
        data: { balance: balanceAfter },
      });

      const transaction = await prismaTx.walletTransaction.create({
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
    };

    return tx ? execute(tx) : this.prisma.$transaction(execute);
  }

  async ownJar(userId: string, brandId: string, tx?: any) {
    const customer = await this.prisma.customer.findUnique({
      where: { userId },
      include: {
        wallet: true,
        jarDeposits: { where: { brandId } },
        jarOwnerships: { where: { brandId } },
        jarBalances: { where: { brandId } },
      },
    });

    if (!customer) throw new NotFoundException('Customer profile not found');

    let wallet = customer.wallet;
    if (!wallet) {
      wallet = await this.prisma.wallet.create({
        data: { customerId: customer.id, balance: 0.0 },
      });
    }

    let jarDeposit = customer.jarDeposits[0];
    if (!jarDeposit) {
      jarDeposit = await this.prisma.jarDeposit.create({
        data: {
          customerId: customer.id,
          brandId,
          maxActiveJars: 0,
          depositPaid: 0.0,
          depositDue: 0.0,
        },
      });
    }

    let jarOwnership = customer.jarOwnerships[0];
    if (!jarOwnership) {
      jarOwnership = await this.prisma.jarOwnership.create({
        data: {
          customerId: customer.id,
          brandId,
          companyJarsHeld: 0,
          ownedJars: 0,
        },
      });
    }

    const depositAmount = await this.settingsService.getSettingNumber(
      'DEPOSIT_AMOUNT_PER_JAR',
      200.0,
    );

    if (jarDeposit.depositDue < depositAmount) {
      throw new BadRequestException(
        'No outstanding deposit due to pay for this brand',
      );
    }

    if (wallet.balance < depositAmount) {
      throw new BadRequestException(
        `Insufficient wallet balance (₹${depositAmount} required)`,
      );
    }

    const execute = async (prismaTx: any) => {
      const balanceBefore = wallet.balance;
      const balanceAfter = balanceBefore - depositAmount;
      await prismaTx.wallet.update({
        where: { id: wallet.id },
        data: { balance: balanceAfter },
      });

      await prismaTx.walletTransaction.create({
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

      await prismaTx.jarOwnership.update({
        where: { customerId_brandId: { customerId: customer.id, brandId } },
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

      await prismaTx.jarDeposit.update({
        where: { customerId_brandId: { customerId: customer.id, brandId } },
        data: {
          depositPaid: newDepositPaid,
          depositDue: newDepositDue,
        },
      });

      const currentAvailableJars = customer.jarBalances[0]?.availableJars ?? 0;

      await prismaTx.transaction.create({
        data: {
          customerId: customer.id,
          type: TransactionType.DEPOSIT_PAYMENT,
          amountMoney: depositAmount,
          balanceBefore: currentAvailableJars,
          balanceAfter: currentAvailableJars,
          description: `Converted deposit due into owned jar (₹${depositAmount})`,
        },
      });

      return { success: true };
    };

    return tx ? execute(tx) : this.prisma.$transaction(execute);
  }

  async initiateRecharge(userId: string, amount: number) {
    if (amount <= 0) {
      throw new BadRequestException('Recharge amount must be greater than 0');
    }

    const customer = await this.prisma.customer.findUnique({
      where: { userId },
    });
    if (!customer) throw new NotFoundException('Customer profile not found');

    const intent = await this.paymentService.createPaymentIntent({
      customerId: customer.id,
      amount: amount,
      description: `Wallet Recharge (₹${amount})`,
    });

    return {
      paymentId: intent.paymentId,
      razorpayOrderId: intent.orderId,
      amount: intent.amount,
      currency: 'INR',
    };
  }

  async confirmRecharge(
    userId: string,
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string,
  ) {
    const customer = await this.prisma.customer.findUnique({
      where: { userId },
    });
    if (!customer) throw new NotFoundException('Customer profile not found');

    // Verify the signature
    const verifiedPayment = await this.paymentService.verifyPayment(
      {
        razorpay_order_id: razorpayOrderId,
        razorpay_payment_id: razorpayPaymentId,
        razorpay_signature: razorpaySignature,
      },
      customer.id,
    );

    // Credit wallet with the payment amount
    return this.addFunds(
      userId,
      verifiedPayment.amount,
      WalletTransactionType.TOP_UP,
      `Direct Wallet Recharge (₹${verifiedPayment.amount})`,
    );
  }
}
