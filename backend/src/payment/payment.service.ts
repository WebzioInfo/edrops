import { BadRequestException, Injectable, InternalServerErrorException, Logger, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentStatus, WalletTransactionType } from '@prisma/client';
import Razorpay from 'razorpay';
import * as crypto from 'crypto';

@Injectable()
export class PaymentService {
  private razorpay: any;
  private readonly logger = new Logger(PaymentService.name);

  constructor(private prisma: PrismaService) {
    this.razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID as string,
      key_secret: process.env.RAZORPAY_SECRET as string,
    });
  }

  async createOrder(customerId: string, amount: number) {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Payment amount must be positive');
    }

    const payment = await this.prisma.payment.create({
      data: {
        customerId,
        amount,
        status: PaymentStatus.PENDING,
      },
    });

    try {
      const order = await this.razorpay.orders.create({
        amount: Math.round(amount * 100),
        currency: 'INR',
        receipt: payment.id,
      });

      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { providerId: order.id },
      });

      return { orderId: order.id, paymentId: payment.id, amount: order.amount };
    } catch (error) {
      this.logger.error('Failed to create Razorpay order', error);
      throw new InternalServerErrorException('Payment gateway error');
    }
  }

  async verifyWebhook(signature: string, payload: any) {
    if (!signature) {
      throw new UnauthorizedException('Missing Razorpay signature');
    }

    const secret = process.env.RAZORPAY_WEBHOOK_SECRET as string;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('hex');

    if (expectedSignature === signature) {
      if (payload.event === 'payment.captured' || payload.event === 'order.paid') {
        await this.processPaymentSuccess(payload.payload.payment.entity);
      }
      return { success: true };
    }
    
    throw new UnauthorizedException('Invalid webhook signature');
  }

  async verifyPayment(customerId: string, payload: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = payload;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      throw new BadRequestException('Missing signature details');
    }

    const secret = process.env.RAZORPAY_SECRET as string;
    if (!secret) {
      throw new InternalServerErrorException('Razorpay credentials not configured');
    }

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(razorpay_order_id + '|' + razorpay_payment_id)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      throw new BadRequestException('Invalid signature verification failed');
    }

    await this.processPaymentSuccess({
      order_id: razorpay_order_id,
      id: razorpay_payment_id
    });

    const payment = await this.prisma.payment.findFirst({
      where: { providerId: razorpay_order_id }
    });
    return payment;
  }

  private async processPaymentSuccess(paymentEntity: any) {
    const providerId = paymentEntity.order_id;
    
    const payment = await this.prisma.payment.findFirst({
      where: { providerId }
    });

    if (!payment || payment.status === PaymentStatus.SUCCESS) {
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.SUCCESS },
      });

      let wallet = await tx.wallet.findUnique({ where: { customerId: payment.customerId } });
      if (!wallet) {
        wallet = await tx.wallet.create({ data: { customerId: payment.customerId, balance: 0 } });
      }

      const balanceBefore = wallet.balance;
      const balanceAfter = balanceBefore + payment.amount;

      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: balanceAfter },
      });

      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: WalletTransactionType.TOP_UP,
          amount: payment.amount,
          balanceBefore,
          balanceAfter,
          referenceId: payment.id,
          description: 'Wallet top-up via Razorpay',
        },
      });

      await tx.paymentLog.create({
        data: {
          paymentId: payment.id,
          status: 'SUCCESS',
          payload: paymentEntity,
        }
      });
    });
  }
}
