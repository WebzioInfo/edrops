import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentStatus } from '@prisma/client';
import { RazorpayProvider } from './providers/razorpay.provider';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private prisma: PrismaService,
    private razorpayProvider: RazorpayProvider,
  ) {}

  async createPaymentIntent(params: {
    customerId: string;
    amount: number;
    orderId?: string;
    rechargeId?: string;
    description?: string;
  }) {
    if (!Number.isFinite(params.amount) || params.amount <= 0) {
      throw new BadRequestException('Payment amount must be positive');
    }

    const payment = await this.prisma.payment.create({
      data: {
        customerId: params.customerId,
        amount: params.amount,
        orderId: params.orderId,
        description: params.description,
        status: PaymentStatus.CREATED,
        provider: this.razorpayProvider.getProviderName(),
      },
    });

    try {
      const orderInfo = await this.razorpayProvider.createOrder({
        amount: params.amount,
        receiptId: payment.id,
      });

      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          providerId: orderInfo.providerOrderId,
          status: PaymentStatus.PENDING,
        },
      });

      return {
        orderId: orderInfo.providerOrderId,
        paymentId: payment.id,
        amount: orderInfo.amount,
      };
    } catch (error) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.FAILED },
      });
      throw error;
    }
  }

  async verifyPayment(
    payload: {
      razorpay_order_id: string;
      razorpay_payment_id: string;
      razorpay_signature: string;
    },
    customerId?: string,
  ) {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      payload;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      throw new BadRequestException('Missing signature details');
    }

    const isValid = this.razorpayProvider.verifyPaymentSignature({
      providerOrderId: razorpay_order_id,
      providerPaymentId: razorpay_payment_id,
      signature: razorpay_signature,
    });

    if (!isValid) {
      throw new BadRequestException('Invalid signature verification failed');
    }

    const payment = await this.prisma.payment.findFirst({
      where: { providerId: razorpay_order_id },
    });

    if (!payment) throw new BadRequestException('Payment not found');
    if (customerId && payment.customerId !== customerId) {
      throw new UnauthorizedException(
        'Payment does not belong to this customer',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const existingAttempt = await tx.paymentAttempt.findFirst({
        where: {
          paymentId: payment.id,
          providerId: razorpay_payment_id,
        },
      });

      if (!existingAttempt) {
        await tx.paymentAttempt.create({
          data: {
            paymentId: payment.id,
            providerId: razorpay_payment_id,
            status: 'SUCCESS',
          },
        });
      }

      const updatedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.SUCCESS },
      });

      if (payment.orderId) {
        await tx.order.update({
          where: { id: payment.orderId },
          data: { status: 'CONFIRMED', paymentStatus: PaymentStatus.SUCCESS },
        });
      }

      await tx.paymentAuditLog.create({
        data: {
          paymentId: payment.id,
          action: 'CLIENT_SIGNATURE_VERIFIED',
          previousStatus: payment.status,
          newStatus: PaymentStatus.SUCCESS,
          notes: `Verified Razorpay payment ${razorpay_payment_id}`,
        },
      });

      return updatedPayment;
    });
  }
}
