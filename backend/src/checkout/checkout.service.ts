import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentService } from '../payment/payment.service';
import { ValidateCheckoutDto, InitiateCheckoutDto, ConfirmCheckoutDto } from './dto/checkout.dto';
import * as crypto from 'crypto';

@Injectable()
export class CheckoutService {
  private readonly logger = new Logger(CheckoutService.name);

  constructor(
    private prisma: PrismaService,
    private paymentService: PaymentService,
  ) {}

  getDeliverySlots() {
    return [
      { id: 'morning', label: '6AM - 9AM' },
      { id: 'midday', label: '9AM - 12PM' },
      { id: 'afternoon', label: '12PM - 3PM' },
      { id: 'evening', label: '3PM - 6PM' },
    ];
  }

  async validateCheckout(customerId: string, dto: ValidateCheckoutDto) {
    let items: any[] = [];
    
    if (dto.buyNowItems && dto.buyNowItems.length > 0) {
      const productIds = dto.buyNowItems.map(i => i.productId);
      const products = await this.prisma.product.findMany({ where: { id: { in: productIds } } });
      
      items = dto.buyNowItems.map(bItem => {
        const product = products.find(p => p.id === bItem.productId);
        if (!product || product.status !== 'ACTIVE') {
          throw new BadRequestException(`Product ${product?.name || bItem.productId} is no longer active`);
        }
        return {
          productId: product.id,
          quantity: bItem.quantity,
          product: product
        };
      });
    } else {
      const cart = await this.prisma.cart.findUnique({
        where: { customerId },
        include: { items: { include: { product: true } } },
      });

      if (!cart || cart.items.length === 0) {
        throw new BadRequestException('Cart is empty');
      }
      items = cart.items;
    }

    let subTotal = 0;
    let depositTotal = 0;

    for (const item of items) {
      if (item.product.status !== 'ACTIVE') {
        throw new BadRequestException(`Product ${item.product.name} is no longer active`);
      }
      subTotal += item.product.price * item.quantity;
      if (!dto.returnEmptyJars) {
        depositTotal += (item.product.depositAmount || 0) * item.quantity;
      }
    }

    const deliveryCharge = subTotal > 500 ? 0 : 50;
    const totalAmount = subTotal + depositTotal + deliveryCharge;

    return {
      subTotal,
      depositTotal,
      deliveryCharge,
      totalAmount,
      items,
    };
  }

  async initiateCheckout(customerId: string, dto: InitiateCheckoutDto) {
    const validation = await this.validateCheckout(customerId, { returnEmptyJars: dto.returnEmptyJars, buyNowItems: dto.buyNowItems });
    const { subTotal, depositTotal, deliveryCharge, totalAmount, items } = validation;

    const order = await this.prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          customerId,
          status: 'PENDING',
          orderType: 'ONETIME_ORDER',
          subTotal,
          depositTotal,
          deliveryCharge,
          totalAmount,
          deliveryAddressId: dto.addressId,
          timeSlot: dto.timeSlot,
          paymentMethod: dto.paymentMethod,
          items: {
            create: items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.product.price,
              deposit: dto.returnEmptyJars ? 0 : (item.product.depositAmount || 0),
              total: (item.product.price + (dto.returnEmptyJars ? 0 : (item.product.depositAmount || 0))) * item.quantity,
            })),
          },
        },
      });

      if (!dto.buyNowItems || dto.buyNowItems.length === 0) {
        await tx.cartItem.deleteMany({ where: { cart: { customerId } } });
      }
      return newOrder;
    });

    if (dto.paymentMethod === 'COD') {
      if (totalAmount > 2000) throw new BadRequestException('COD not allowed for orders above ₹2000');
      
      await this.prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: order.id },
          data: { status: 'CONFIRMED' }
        });
        const requiredQuantity = items.reduce((acc, i) => acc + i.quantity, 0);
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);

        const existingDelivery = await tx.delivery.findFirst({
          where: { customerId, scheduledFor: today }
        });

        if (existingDelivery) {
          await tx.delivery.update({
            where: { id: existingDelivery.id },
            data: { requiredQuantity: existingDelivery.requiredQuantity + requiredQuantity }
          });
        } else {
          await tx.delivery.create({
            data: {
              customerId,
              addressId: dto.addressId,
              scheduledFor: today,
              requiredQuantity,
              status: 'PENDING'
            }
          });
        }
      });
      return { orderId: order.id, status: 'SUCCESS' };
    }

    if (dto.paymentMethod === 'WALLET') {
      const wallet = await this.prisma.wallet.findUnique({ where: { customerId } });
      if (!wallet || wallet.balance < totalAmount) {
        throw new BadRequestException('Insufficient wallet balance');
      }

      await this.prisma.$transaction(async (tx) => {
        await tx.wallet.update({
          where: { id: wallet.id },
          data: { balance: wallet.balance - totalAmount },
        });
        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: 'DEDUCTION',
            amount: totalAmount,
            balanceBefore: wallet.balance,
            balanceAfter: wallet.balance - totalAmount,
            description: `Order Payment #${order.id}`,
          }
        });
        await tx.order.update({
          where: { id: order.id },
          data: { status: 'CONFIRMED', paymentStatus: 'SUCCESS' }
        });
        
        const requiredQuantity = items.reduce((acc, i) => acc + i.quantity, 0);
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);

        const existingDelivery = await tx.delivery.findFirst({
          where: { customerId, scheduledFor: today }
        });

        if (existingDelivery) {
          await tx.delivery.update({
            where: { id: existingDelivery.id },
            data: { requiredQuantity: existingDelivery.requiredQuantity + requiredQuantity }
          });
        } else {
          await tx.delivery.create({
            data: {
              customerId,
              addressId: dto.addressId,
              scheduledFor: today,
              requiredQuantity,
              status: 'PENDING'
            }
          });
        }
      });
      return { orderId: order.id, status: 'SUCCESS' };
    }

    if (dto.paymentMethod === 'RAZORPAY') {
      const paymentIntent = await this.paymentService.createPaymentIntent({
        customerId,
        amount: totalAmount,
        orderId: order.id,
        description: `Order #${order.id.substring(0, 8)}`,
      });
      return {
        orderId: order.id,
        razorpayOrderId: paymentIntent.orderId,
        amount: paymentIntent.amount,
        currency: 'INR',
      };
    }

    if (dto.paymentMethod === 'HYBRID') {
      const wallet = await this.prisma.wallet.findUnique({ where: { customerId } });
      const walletBalance = wallet ? wallet.balance : 0;
      if (walletBalance === 0) throw new BadRequestException('Wallet is empty, cannot use HYBRID');

      const remainingAmount = totalAmount - walletBalance;
      
      if (remainingAmount <= 0) {
        // Wallet covers everything
        return this.initiateCheckout(customerId, { ...dto, paymentMethod: 'WALLET' });
      }

      // Lock wallet funds
      await this.prisma.$transaction(async (tx) => {
        await tx.wallet.update({
          where: { id: wallet!.id },
          data: { balance: 0 },
        });
        await tx.walletTransaction.create({
          data: {
            walletId: wallet!.id,
            type: 'DEDUCTION',
            amount: walletBalance,
            balanceBefore: walletBalance,
            balanceAfter: 0,
            description: `Hybrid Order Partial Payment #${order.id}`,
          }
        });
      });

      const paymentIntent = await this.paymentService.createPaymentIntent({
        customerId,
        amount: remainingAmount,
        orderId: order.id,
        description: `Order #${order.id.substring(0, 8)} (Hybrid)`,
      });

      return {
        orderId: order.id,
        razorpayOrderId: paymentIntent.orderId,
        amount: paymentIntent.amount,
        currency: 'INR',
      };
    }

    throw new BadRequestException('Invalid payment method');
  }

  async confirmCheckout(customerId: string, dto: ConfirmCheckoutDto) {
    if (dto.paymentMethod === 'RAZORPAY' || dto.paymentMethod === 'HYBRID') {
      const secret = process.env.RAZORPAY_SECRET || 'mock';
      const body = dto.razorpayOrderId + '|' + dto.razorpayPaymentId;
      const expectedSignature = crypto.createHmac('sha256', secret).update(body.toString()).digest('hex');

      if (expectedSignature !== dto.razorpaySignature && expectedSignature !== 'mock') {
        throw new BadRequestException('Invalid payment signature');
      }

      const order = await this.prisma.order.update({
        where: { id: dto.orderId },
        data: { status: 'CONFIRMED', paymentStatus: 'SUCCESS' },
        include: { items: true }
      });

      const requiredQuantity = order.items.reduce((acc, i) => acc + i.quantity, 0);
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      const existingDelivery = await this.prisma.delivery.findFirst({
        where: { customerId, scheduledFor: today }
      });

      if (existingDelivery) {
        await this.prisma.delivery.update({
          where: { id: existingDelivery.id },
          data: { requiredQuantity: existingDelivery.requiredQuantity + requiredQuantity }
        });
      } else {
        await this.prisma.delivery.create({
          data: {
            customerId,
            addressId: order.deliveryAddressId,
            scheduledFor: today,
            requiredQuantity,
            status: 'PENDING'
          }
        });
      }

      return { success: true, orderId: dto.orderId };
    }

    throw new BadRequestException('Payment confirmation not applicable for this method');
  }
}
