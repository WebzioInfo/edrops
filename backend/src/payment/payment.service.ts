import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentStatus, OrderStatus } from '@prisma/client';
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
      // Row-lock the Payment record to ensure strict concurrency control
      await tx.$executeRawUnsafe(
        `SELECT id FROM "Payment" WHERE id = $1 FOR UPDATE`,
        payment.id,
      );

      const freshPayment = await tx.payment.findUnique({
        where: { id: payment.id },
      });

      if (!freshPayment) throw new BadRequestException('Payment not found');

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

      // If already verified / completed, exit safely without duplicating side-effects
      if (freshPayment.status === PaymentStatus.SUCCESS) {
        return { ...freshPayment, alreadyProcessed: true };
      }

      const updatedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.SUCCESS },
      });

      if (payment.orderId) {
        await tx.$executeRawUnsafe(
          `SELECT id FROM "Order" WHERE id = $1 FOR UPDATE`,
          payment.orderId,
        );
        const order = await tx.order.findUnique({
          where: { id: payment.orderId },
        });
        if (order) {
          const isInitialStatus =
            order.status === OrderStatus.PENDING_PAYMENT ||
            order.status === OrderStatus.NEW ||
            (order.status as any) === 'PENDING' ||
            (order.status as any) === 'CREATED';
          await tx.order.update({
            where: { id: payment.orderId },
            data: {
              ...(isInitialStatus
                ? { status: OrderStatus.PENDING_ASSIGNMENT }
                : {}),
              paymentStatus: PaymentStatus.SUCCESS,
            },
          });
        }
      }

      await tx.paymentAuditLog.create({
        data: {
          paymentId: payment.id,
          action: 'CLIENT_SIGNATURE_VERIFIED',
          previousStatus: freshPayment.status,
          newStatus: PaymentStatus.SUCCESS,
          notes: `Verified Razorpay payment ${razorpay_payment_id}`,
        },
      });

      return updatedPayment;
    });
  }
}
