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
  DepositTransactionType,
} from '@prisma/client';
import { SettingsService } from '../settings/settings.service';
import { PaymentService } from '../payment/payment.service';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class WalletService {
  constructor(
    private prisma: PrismaService,
    private settingsService: SettingsService,
    private paymentService: PaymentService,
    private notificationService: NotificationService,
  ) { }

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
    const [wallets, deposits, depositRefunds] = await Promise.all([
      this.prisma.wallet.aggregate({ _sum: { balance: true } }),
      this.prisma.jarDeposit.aggregate({ _sum: { depositPaid: true } }),
      this.prisma.depositTransaction.aggregate({
        _sum: { amount: true },
        where: { type: DepositTransactionType.DEPOSIT_REFUNDED },
      }),
    ]);

    return {
      totalRechargeBalances: wallets._sum.balance ?? 0,
      totalDepositsHeld: deposits._sum.depositPaid ?? 0,
      depositsRefunded: depositRefunds._sum.amount ?? 0,
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
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Amount must be positive');
    }
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

      // Concurrency lock on Wallet row
      if (typeof prismaTx.$executeRawUnsafe === 'function') {
        await prismaTx.$executeRawUnsafe(
          `SELECT id FROM "Wallet" WHERE id = $1 FOR UPDATE`,
          wallet.id,
        );
      }
      wallet = await prismaTx.wallet.findUnique({
        where: { id: wallet.id },
      });

      // Idempotency check: if transaction with this referenceId already exists, do not double credit
      if (referenceId) {
        const existingTx = await prismaTx.walletTransaction.findFirst({
          where: { walletId: wallet.id, referenceId, type },
        });
        if (existingTx) {
          return {
            wallet,
            transaction: existingTx,
            alreadyProcessed: true,
          };
        }
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

      return { wallet: { ...wallet, balance: balanceAfter }, transaction, alreadyProcessed: false };
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
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Amount must be positive');
    }
    const customer = await this.prisma.customer.findUnique({
      where: { userId },
    });
    if (!customer) throw new NotFoundException('Customer profile not found');

    const execute = async (prismaTx: any) => {
      let wallet = await prismaTx.wallet.findUnique({
        where: { customerId: customer.id },
      });
      if (!wallet) {
        throw new NotFoundException('Wallet not found');
      }

      // Concurrency row-lock on Wallet
      if (typeof prismaTx.$executeRawUnsafe === 'function') {
        await prismaTx.$executeRawUnsafe(
          `SELECT id FROM "Wallet" WHERE id = $1 FOR UPDATE`,
          wallet.id,
        );
      }
      wallet = await prismaTx.wallet.findUnique({
        where: { id: wallet.id },
      });
      if (!wallet) throw new NotFoundException('Wallet not found');

      // Strict idempotency: prevent deducting twice for the same reference
      if (referenceId) {
        const existingTx = await prismaTx.walletTransaction.findFirst({
          where: { walletId: wallet.id, referenceId, type },
        });
        if (existingTx) {
          return { wallet, transaction: existingTx, alreadyProcessed: true };
        }
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

      return { wallet: { ...wallet, balance: balanceAfter }, transaction, alreadyProcessed: false };
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

    const depositAmount = await this.settingsService.getDepositAmountPerJar();

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

    // Credit wallet with the payment amount, using payment.id as referenceId for strict idempotency
    const result = await this.addFunds(
      userId,
      verifiedPayment.amount,
      WalletTransactionType.TOP_UP,
      `Direct Wallet Recharge (₹${verifiedPayment.amount})`,
      verifiedPayment.id,
    );

    if (!result.alreadyProcessed) {
      try {
        this.notificationService.notifyPaymentEvent({
          paymentId: razorpayPaymentId,
          customerId: customer.id,
          userId,
          amount: verifiedPayment.amount,
          status: 'SUCCESS',
        });
        this.notificationService.notifyWalletRecharge({
          customerId: customer.id,
          amount: verifiedPayment.amount,
          newBalance: result.wallet.balance,
        });
      } catch (e) {
        console.warn('[WalletService] notification error:', e);
      }
    }

    return result;
  }

  async payOrderFromWallet(userId: string, orderId: string, amount?: number) {
    const customer = await this.prisma.customer.findUnique({
      where: { userId },
      include: { wallet: true },
    });
    if (!customer) throw new NotFoundException('Customer profile not found');

    return this.prisma.$transaction(async (tx) => {
      // Row lock the order
      if (typeof tx.$executeRawUnsafe === 'function') {
        await tx.$executeRawUnsafe(
          `SELECT id FROM "Order" WHERE id = $1 FOR UPDATE`,
          orderId,
        );
      }

      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { payments: true },
      });
      if (!order) throw new NotFoundException('Order not found');
      if (order.customerId !== customer.id) {
        throw new BadRequestException('Order does not belong to this customer');
      }

      const totalPaid = (order.payments || [])
        .filter(
          (p) =>
            p.status === PaymentStatus.PAID ||
            p.status === PaymentStatus.SUCCESS,
        )
        .reduce((sum, p) => sum + p.amount, 0);

      const remainingDue = Math.max(
        0,
        Number((order.totalAmount - totalPaid).toFixed(2)),
      );
      if (remainingDue <= 0.01) {
        throw new BadRequestException('This order is already fully paid.');
      }

      const payAmount = amount ? Math.min(amount, remainingDue) : remainingDue;
      if (payAmount <= 0) {
        throw new BadRequestException('Payment amount must be greater than zero.');
      }

      // Ensure wallet exists and row lock it
      let wallet = customer.wallet;
      if (!wallet) {
        wallet = await tx.wallet.create({
          data: { customerId: customer.id, balance: 0.0 },
        });
      }

      if (typeof tx.$executeRawUnsafe === 'function') {
        await tx.$executeRawUnsafe(
          `SELECT id FROM "Wallet" WHERE id = $1 FOR UPDATE`,
          wallet.id,
        );
      }
      const lockedWallet = await tx.wallet.findUnique({
        where: { id: wallet.id },
      });
      if (!lockedWallet || lockedWallet.balance < payAmount) {
        throw new BadRequestException(
          `Insufficient wallet balance (₹${(lockedWallet?.balance || 0).toFixed(2)}). Need ₹${payAmount.toFixed(2)}.`,
        );
      }

      const balanceBefore = lockedWallet.balance;
      const balanceAfter = balanceBefore - payAmount;

      await tx.wallet.update({
        where: { id: lockedWallet.id },
        data: { balance: balanceAfter },
      });

      await tx.walletTransaction.create({
        data: {
          walletId: lockedWallet.id,
          type: WalletTransactionType.DEDUCTION,
          amount: payAmount,
          balanceBefore,
          balanceAfter,
          referenceId: `ORD-${order.id}`,
          description: `Payment for Order #${order.id.slice(0, 8)}`,
        },
      });

      const payment = await tx.payment.create({
        data: {
          orderId: order.id,
          customerId: customer.id,
          amount: payAmount,
          currency: 'INR',
          status: PaymentStatus.PAID,
          provider: 'WALLET',
          receiptId: `WAL-${order.id}-${Date.now()}`,
          description: `Wallet Payment for Order #${order.id.slice(0, 8)}`,
        },
      });

      const newTotalPaid = totalPaid + payAmount;
      const newStatus =
        newTotalPaid >= order.totalAmount - 0.01
          ? PaymentStatus.SUCCESS
          : PaymentStatus.PARTIALLY_PAID;

      await tx.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: newStatus,
          paymentMethod:
            order.paymentMethod === 'COD' ? 'WALLET' : order.paymentMethod,
        },
      });

      await tx.paymentAuditLog.create({
        data: {
          paymentId: payment.id,
          action: 'WALLET_PAYMENT_COLLECTED',
          previousStatus: order.paymentStatus,
          newStatus,
          notes: `Paid ₹${payAmount} from wallet. Total paid: ₹${newTotalPaid}/${order.totalAmount}`,
        },
      });

      return {
        success: true,
        orderId: order.id,
        amountPaid: payAmount,
        remainingDue: Math.max(
          0,
          Number((order.totalAmount - newTotalPaid).toFixed(2)),
        ),
        paymentStatus: newStatus,
        walletBalance: balanceAfter,
      };
    });
  }

  async getAllBillingHistory(userId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { userId },
      include: {
        wallet: {
          include: {
            transactions: { orderBy: { createdAt: 'desc' }, take: 50 },
          },
        },
        packagePurchases: {
          include: { package: true },
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
        orders: {
          include: { items: true },
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
        depositTransactions: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
        jarDeposits: true,
      },
    });

    if (!customer) throw new NotFoundException('Customer profile not found');

    const items: Array<{
      id: string;
      category: 'SUBSCRIPTION' | 'WALLET' | 'ORDER' | 'DEPOSIT';
      title: string;
      description: string;
      amount: number;
      jars?: number;
      status: string;
      direction: 'CREDIT' | 'DEBIT';
      createdAt: Date | string;
      referenceId?: string;
    }> = [];

    // 1. Subscriptions & Packages
    for (const p of customer.packagePurchases || []) {
      items.push({
        id: p.id,
        category: 'SUBSCRIPTION',
        title: p.package?.name || 'Prepaid Water Plan',
        description: `${p.package?.jarCount || 0} Jars Package Plan`,
        amount: p.amount,
        jars: p.package?.jarCount || 0,
        status: p.paymentStatus,
        direction: 'CREDIT',
        createdAt: p.createdAt,
        referenceId: p.paymentId || p.id,
      });
    }

    // 2. Orders (Single orders / items)
    for (const o of customer.orders || []) {
      items.push({
        id: o.id,
        category: 'ORDER',
        title: `Order #${o.id.substring(0, 8).toUpperCase()}`,
        description: o.orderType === 'SUBSCRIPTION_ORDER' ? 'Scheduled Water Drop' : 'One-time Water / Accessories',
        amount: o.totalAmount || o.subTotal,
        status: o.paymentStatus || o.status,
        direction: 'DEBIT',
        createdAt: o.createdAt,
        referenceId: o.id,
      });
    }

    // 3. Wallet Transactions
    for (const w of customer.wallet?.transactions || []) {
      items.push({
        id: w.id,
        category: 'WALLET',
        title: w.type === 'TOP_UP' ? 'Wallet Top-Up' : w.type === 'REFUND' ? 'Wallet Refund' : 'Wallet Payment',
        description: w.description || (w.type === 'TOP_UP' ? 'Money added via UPI/Card' : 'Paid from wallet balance'),
        amount: w.amount,
        status: 'SUCCESS',
        direction: w.type === 'TOP_UP' || w.type === 'REFUND' ? 'CREDIT' : 'DEBIT',
        createdAt: w.createdAt,
        referenceId: w.referenceId || w.id,
      });
    }

    // 4. Deposit Transactions
    for (const d of customer.depositTransactions || []) {
      items.push({
        id: d.id,
        category: 'DEPOSIT',
        title: d.type === 'DEPOSIT_PAID' ? 'Jar Security Deposit' : 'Deposit Refunded',
        description: d.description || `${d.jarsAffected || 0} Company Can(s) Deposit`,
        amount: d.amount,
        jars: d.jarsAffected,
        status: 'SUCCESS',
        direction: d.type === 'DEPOSIT_PAID' ? 'DEBIT' : 'CREDIT',
        createdAt: d.createdAt,
        referenceId: d.referenceId || d.id,
      });
    }

    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const activeDeposit = customer.jarDeposits?.[0] || {
      maxActiveJars: 0,
      depositPaid: 0,
      depositDue: 0,
    };

    return {
      walletBalance: customer.wallet?.balance || 0,
      depositPaid: activeDeposit.depositPaid,
      depositDue: activeDeposit.depositDue,
      maxActiveJars: activeDeposit.maxActiveJars,
      transactions: items,
    };
  }

  async payDepositFromWallet(userId: string, amountToPay?: number) {
    const customer = await this.prisma.customer.findUnique({
      where: { userId },
      include: {
        wallet: true,
        jarDeposits: true,
        jarOwnerships: true,
      },
    });

    if (!customer) throw new NotFoundException('Customer profile not found');

    const jarDeposit = customer.jarDeposits?.[0];
    if (!jarDeposit || jarDeposit.depositDue <= 0) {
      throw new BadRequestException('No outstanding jar deposit due.');
    }

    const payAmount = amountToPay && amountToPay > 0
      ? Math.min(amountToPay, jarDeposit.depositDue)
      : jarDeposit.depositDue;

    let wallet = customer.wallet;
    if (!wallet) {
      wallet = await this.prisma.wallet.create({
        data: { customerId: customer.id, balance: 0.0 },
      });
    }

    if (wallet.balance < payAmount) {
      throw new BadRequestException(
        `Insufficient wallet balance. You have ₹${wallet.balance}, but ₹${payAmount} is required. Please top up your wallet or pay online.`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const balanceBefore = wallet.balance;
      const balanceAfter = balanceBefore - payAmount;

      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: balanceAfter },
      });

      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: WalletTransactionType.DEDUCTION,
          amount: payAmount,
          balanceBefore,
          balanceAfter,
          description: `Jar Security Deposit Payment (${jarDeposit.maxActiveJars} cans)`,
        },
      });

      const newDepositPaid = jarDeposit.depositPaid + payAmount;
      const newDepositDue = Math.max(0, jarDeposit.depositDue - payAmount);

      await tx.jarDeposit.update({
        where: { id: jarDeposit.id },
        data: {
          depositPaid: newDepositPaid,
          depositDue: newDepositDue,
        },
      });

      await tx.depositTransaction.create({
        data: {
          customerId: customer.id,
          type: DepositTransactionType.DEPOSIT_PAID,
          amount: payAmount,
          jarsAffected: jarDeposit.maxActiveJars,
          balanceBefore: jarDeposit.depositDue,
          balanceAfter: newDepositDue,
          description: `Paid ₹${payAmount} jar security deposit from wallet balance`,
        },
      });

      await tx.transaction.create({
        data: {
          customerId: customer.id,
          type: TransactionType.DEPOSIT_PAYMENT,
          amountMoney: payAmount,
          balanceBefore: 0,
          balanceAfter: 0,
          description: `Jar security deposit paid via wallet (₹${payAmount})`,
        },
      });

      return {
        success: true,
        amountPaid: payAmount,
        depositPaid: newDepositPaid,
        depositDue: newDepositDue,
        walletBalance: balanceAfter,
      };
    });
  }

  async initiateDepositOnline(userId: string, amountToPay?: number) {
    const customer = await this.prisma.customer.findUnique({
      where: { userId },
      include: { jarDeposits: true },
    });
    if (!customer) throw new NotFoundException('Customer profile not found');

    const jarDeposit = customer.jarDeposits?.[0];
    if (!jarDeposit || jarDeposit.depositDue <= 0) {
      throw new BadRequestException('No outstanding jar deposit due.');
    }

    const payAmount = amountToPay && amountToPay > 0
      ? Math.min(amountToPay, jarDeposit.depositDue)
      : jarDeposit.depositDue;

    const intent = await this.paymentService.createPaymentIntent({
      customerId: customer.id,
      amount: payAmount,
      description: `Jar Security Deposit Payment (₹${payAmount})`,
    });

    return {
      paymentId: intent.paymentId,
      razorpayOrderId: intent.orderId,
      amount: intent.amount,
      currency: 'INR',
    };
  }

  async confirmDepositOnline(
    userId: string,
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string,
  ) {
    const customer = await this.prisma.customer.findUnique({
      where: { userId },
      include: { jarDeposits: true },
    });
    if (!customer) throw new NotFoundException('Customer profile not found');

    const verifiedPayment = await this.paymentService.verifyPayment(
      {
        razorpay_order_id: razorpayOrderId,
        razorpay_payment_id: razorpayPaymentId,
        razorpay_signature: razorpaySignature,
      },
      customer.id,
    );

    const jarDeposit = customer.jarDeposits?.[0];
    if (!jarDeposit) throw new NotFoundException('Jar deposit record not found');

    const payAmount = verifiedPayment.amount;

    return this.prisma.$transaction(async (tx) => {
      if (typeof tx.$executeRawUnsafe === 'function') {
        await tx.$executeRawUnsafe(
          `SELECT id FROM "JarDeposit" WHERE id = $1 FOR UPDATE`,
          jarDeposit.id,
        );
      }

      const existingDepositTx = await tx.depositTransaction.findFirst({
        where: { customerId: customer.id, referenceId: razorpayPaymentId },
      });
      const lockedDeposit = await tx.jarDeposit.findUnique({
        where: { id: jarDeposit.id },
      });
      if (!lockedDeposit) throw new NotFoundException('Jar deposit record not found');

      if (
        ('alreadyProcessed' in verifiedPayment && verifiedPayment.alreadyProcessed) ||
        existingDepositTx
      ) {
        return {
          success: true,
          alreadyProcessed: true,
          amountPaid: payAmount,
          depositPaid: lockedDeposit.depositPaid,
          depositDue: lockedDeposit.depositDue,
        };
      }

      const newDepositPaid = lockedDeposit.depositPaid + payAmount;
      const newDepositDue = Math.max(0, lockedDeposit.depositDue - payAmount);

      await tx.jarDeposit.update({
        where: { id: lockedDeposit.id },
        data: {
          depositPaid: newDepositPaid,
          depositDue: newDepositDue,
        },
      });

      await tx.depositTransaction.create({
        data: {
          customerId: customer.id,
          type: DepositTransactionType.DEPOSIT_PAID,
          amount: payAmount,
          jarsAffected: lockedDeposit.maxActiveJars,
          balanceBefore: lockedDeposit.depositDue,
          balanceAfter: newDepositDue,
          referenceId: razorpayPaymentId,
          description: `Paid ₹${payAmount} jar deposit online via Razorpay`,
        },
      });

      return {
        success: true,
        amountPaid: payAmount,
        depositPaid: newDepositPaid,
        depositDue: newDepositDue,
      };
    });
  }
}
