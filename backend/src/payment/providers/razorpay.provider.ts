import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import {
  CreateOrderParams,
  PaymentOrderInfo,
  PaymentProvider,
  RefundParams,
  VerifySignatureParams,
  WebhookVerifyParams,
} from './payment-provider.interface';
import Razorpay from 'razorpay';
import * as crypto from 'crypto';

@Injectable()
export class RazorpayProvider implements PaymentProvider {
  private razorpay: any;
  private readonly logger = new Logger(RazorpayProvider.name);

  constructor() {
    this.razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_SECRET,
    });
  }

  getProviderName(): string {
    return 'RAZORPAY';
  }

  async createOrder(params: CreateOrderParams): Promise<PaymentOrderInfo> {
    try {
      const order = await this.razorpay.orders.create({
        amount: Math.round(params.amount * 100),
        currency: params.currency || 'INR',
        receipt: params.receiptId,
      });

      return {
        providerOrderId: order.id,
        amount: params.amount,
        currency: order.currency,
      };
    } catch (error) {
      this.logger.error('Failed to create Razorpay order', error);
      throw new InternalServerErrorException('Payment gateway error');
    }
  }

  verifyPaymentSignature(params: VerifySignatureParams): boolean {
    const secret = process.env.RAZORPAY_SECRET as string;
    if (!secret) return false;

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(params.providerOrderId + '|' + params.providerPaymentId)
      .digest('hex');

    return expectedSignature === params.signature;
  }

  verifyWebhookSignature(params: WebhookVerifyParams): boolean {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET as string;
    if (!secret) return false;

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(params.payload)
      .digest('hex');

    return expectedSignature === params.signature;
  }

  async processRefund(
    params: RefundParams,
  ): Promise<{ refundId: string; status: string }> {
    try {
      const refund = await this.razorpay.payments.refund(
        params.providerPaymentId,
        {
          amount: Math.round(params.amount * 100),
          receipt: params.receiptId,
        },
      );

      return {
        refundId: refund.id,
        status: refund.status,
      };
    } catch (error) {
      this.logger.error('Failed to process Razorpay refund', error);
      throw new InternalServerErrorException('Refund failed at gateway');
    }
  }
}
