import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { WalletService } from '../wallet/wallet.service';
import * as crypto from 'crypto';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly razorpayKeyId: string;
  private readonly razorpayKeySecret: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly wallet: WalletService,
  ) {
    this.razorpayKeyId = this.config.get<string>('RAZORPAY_KEY_ID') ?? '';
    this.razorpayKeySecret = this.config.get<string>('RAZORPAY_KEY_SECRET') ?? '';
  }

  // ─────────────────────────────────────────────
  // CREATE ORDER PAYMENT (for order checkout)
  // ─────────────────────────────────────────────

  async createRazorpayOrder(orderId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');

    const amount = Math.round(Number(order.payableAmount) * 100); // paise
    const receipt = `edrops_order_${orderId.slice(-8)}`;

    const rzpOrder = await this.callRazorpayAPI('/orders', {
      amount,
      currency: 'INR',
      receipt,
    });

    await this.prisma.payment.upsert({
      where: { orderId },
      create: {
        orderId,
        amount: order.payableAmount,
        method: 'RAZORPAY',
        razorpayOrderId: rzpOrder.id,
      },
      update: { razorpayOrderId: rzpOrder.id },
    });

    return {
      key: this.razorpayKeyId,
      amount,
      currency: 'INR',
      razorpayOrderId: rzpOrder.id,
      receipt,
      name: 'E-Drops',
      description: `Order #${orderId.slice(-8)}`,
    };
  }

  // ─────────────────────────────────────────────
  // CREATE WALLET RECHARGE (for wallet top-up)
  // ─────────────────────────────────────────────

  async createWalletRechargeOrder(userId: string, amount: number) {
    if (amount < 10) {
      throw new BadRequestException('Minimum recharge is ₹10');
    }

    const amountPaise = Math.round(amount * 100);
    const receipt = `edrops_wallet_${userId.slice(-8)}_${Date.now()}`;

    const rzpOrder = await this.callRazorpayAPI('/orders', {
      amount: amountPaise,
      currency: 'INR',
      receipt,
      notes: { userId, type: 'wallet_recharge' },
    });

    return {
      key: this.razorpayKeyId,
      amount: amountPaise,
      currency: 'INR',
      razorpayOrderId: rzpOrder.id,
      receipt,
      name: 'E-Drops Wallet',
      description: `Wallet Recharge ₹${amount}`,
    };
  }

  // ─────────────────────────────────────────────
  // VERIFY ORDER PAYMENT
  // ─────────────────────────────────────────────

  async verifyPayment(data: {
    orderId: string;
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  }) {
    this.verifySignature(data.razorpayOrderId, data.razorpayPaymentId, data.razorpaySignature);

    await this.prisma.payment.update({
      where: { orderId: data.orderId },
      data: {
        razorpayPaymentId: data.razorpayPaymentId,
        razorpaySignature: data.razorpaySignature,
        status: 'COMPLETED',
      },
    });

    return this.prisma.order.update({
      where: { id: data.orderId },
      data: { paymentStatus: 'COMPLETED', status: 'CONFIRMED' },
    });
  }

  // ─────────────────────────────────────────────
  // VERIFY & CREDIT WALLET RECHARGE
  // ─────────────────────────────────────────────

  async verifyWalletRecharge(data: {
    userId: string;
    amount: number;
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  }) {
    this.verifySignature(data.razorpayOrderId, data.razorpayPaymentId, data.razorpaySignature);

    // Credit wallet — this will also retry PENDING_PAYMENT subscriptions
    const result = await this.wallet.recharge(
      data.userId,
      data.amount,
      data.razorpayPaymentId,
    );

    this.logger.log(
      `[Payment] Wallet recharged ₹${data.amount} for user ${data.userId} via ${data.razorpayPaymentId}`,
    );

    return result;
  }

  // ─────────────────────────────────────────────
  // RAZORPAY WEBHOOK (for server-to-server events)
  // ─────────────────────────────────────────────

  async handleWebhook(rawBody: Buffer, signature: string) {
    // Verify webhook signature
    const expectedSignature = crypto
      .createHmac('sha256', this.config.get('RAZORPAY_WEBHOOK_SECRET', ''))
      .update(rawBody)
      .digest('hex');

    if (expectedSignature !== signature) {
      throw new BadRequestException('Invalid webhook signature');
    }

    const event = JSON.parse(rawBody.toString());
    this.logger.log(`[Webhook] Received event: ${event.event}`);

    switch (event.event) {
      case 'payment.captured': {
        const payment = event.payload.payment.entity;
        const notes = payment.notes ?? {};
        if (notes.type === 'wallet_recharge' && notes.userId) {
          await this.wallet.recharge(
            notes.userId,
            payment.amount / 100,
            payment.id,
          );
        }
        break;
      }
      case 'payment.failed':
        this.logger.warn(`[Webhook] Payment failed: ${event.payload.payment.entity.id}`);
        break;
    }

    return { received: true };
  }

  async getPaymentByOrder(orderId: string) {
    return this.prisma.payment.findUnique({ where: { orderId } });
  }

  // ─────────────────────────────────────────────
  // PRIVATE HELPERS
  // ─────────────────────────────────────────────

  private verifySignature(
    razorpayOrderId: string,
    razorpayPaymentId: string,
    signature: string,
  ) {
    const body = `${razorpayOrderId}|${razorpayPaymentId}`;
    const expected = crypto
      .createHmac('sha256', this.razorpayKeySecret)
      .update(body)
      .digest('hex');

    if (expected !== signature) {
      throw new BadRequestException('Payment signature verification failed');
    }
  }

  /** Real Razorpay API call with Basic Auth */
  private async callRazorpayAPI(path: string, body: any) {
    if (!this.razorpayKeyId || !this.razorpayKeySecret) {
      // Dev mode: return mock response
      this.logger.warn('[Razorpay] Keys not configured — returning mock order');
      return { id: `rzp_mock_${Date.now()}` };
    }

    const credentials = Buffer.from(
      `${this.razorpayKeyId}:${this.razorpayKeySecret}`,
    ).toString('base64');

    const res = await fetch(`https://api.razorpay.com/v1${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${credentials}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const error = await res.text();
      throw new BadRequestException(`Razorpay API error: ${error}`);
    }

    return res.json();
  }
}
