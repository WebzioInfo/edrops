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
import { EventsGateway } from '../events/events.gateway';
import { StaffNotificationService } from '../notification/staff-notification.service';
import { PromoService } from '../promo/promo.service';

@Injectable()
export class CheckoutService {
  private readonly logger = new Logger(CheckoutService.name);

  constructor(
    private prisma: PrismaService,
    private paymentService: PaymentService,
    private eventsGateway: EventsGateway,
    private staffNotificationService: StaffNotificationService,
    private promoService: PromoService,
  ) {}

  private async notifyNewOrder(orderId: string, customerId: string, totalAmount: number) {
    const customer = await this.prisma.user.findFirst({ where: { customer: { id: customerId } } });
    const customerName = customer ? `${customer.firstName} ${customer.lastName}` : 'Customer';
    
    const notification = await this.staffNotificationService.createNotification({
      orderId,
      type: 'NEW_ORDER',
      title: 'New Order Received',
      message: `${customerName} placed Order #${orderId.substring(0, 8)}`,
    });

    this.eventsGateway.emitNewOrder({
      id: orderId,
      amount: totalAmount,
      customerId,
      customerName,
      time: new Date(),
    }, notification);
  }

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
    
    let discountTotal = 0;
    if (dto.promoCode) {
      const promoResult = await this.promoService.validateCode(
        dto.promoCode,
        customerId,
        subTotal,
        'ONETIME_ORDER',
        deliveryCharge,
        false,
      );
      discountTotal = promoResult.calculatedDiscount;
    }

    const totalAmount = Math.max(0, subTotal + depositTotal + deliveryCharge - discountTotal);

    return {
      subTotal,
      depositTotal,
      deliveryCharge,
      discountTotal,
      totalAmount,
      items,
      promoCode: dto.promoCode || null,
    };
  }

  async initiateCheckout(customerId: string, dto: InitiateCheckoutDto) {
    const validation = await this.validateCheckout(customerId, {
      returnEmptyJars: dto.returnEmptyJars,
      buyNowItems: dto.buyNowItems,
      promoCode: dto.promoCode,
    });
    const { subTotal, depositTotal, deliveryCharge, discountTotal, totalAmount, items } = validation;

    const orderId = crypto.randomUUID();
    let razorpayOrderId: string | undefined;

    if (dto.paymentMethod === 'COD' && totalAmount > 2000) {
      throw new BadRequestException('COD not allowed for orders above ₹2000');
    }

    let hybridRemainingAmount = 0;
    let walletBalance = 0;

    if (dto.paymentMethod === 'HYBRID') {
      const wallet = await this.prisma.wallet.findUnique({ where: { customerId } });
      walletBalance = wallet ? wallet.balance : 0;
      if (walletBalance === 0) throw new BadRequestException('Wallet is empty, cannot use HYBRID');
      hybridRemainingAmount = totalAmount - walletBalance;
      
      if (hybridRemainingAmount <= 0) {
        dto.paymentMethod = 'WALLET'; // Wallet covers everything
      } else {
        const paymentIntent = await this.paymentService.createPaymentIntent({
          customerId,
          amount: hybridRemainingAmount,
          orderId,
          description: `Order #${orderId.substring(0, 8)} (Hybrid)`,
        });
        razorpayOrderId = paymentIntent.orderId;
      }
    }

    if (dto.paymentMethod === 'RAZORPAY') {
      const paymentIntent = await this.paymentService.createPaymentIntent({
        customerId,
        amount: totalAmount,
        orderId,
        description: `Order #${orderId.substring(0, 8)}`,
      });
      razorpayOrderId = paymentIntent.orderId;
    }

    const order = await this.prisma.$transaction(async (tx) => {
      // 1. Redeem promo code inside the transaction context
      if (dto.promoCode) {
        await this.promoService.redeemCode(
          dto.promoCode,
          customerId,
          subTotal,
          'ONETIME_ORDER',
          deliveryCharge,
          false,
          tx,
        );
      }

      // 2. Check wallet balance strictly inside transaction to prevent race conditions
      if (dto.paymentMethod === 'WALLET' || dto.paymentMethod === 'HYBRID') {
        const wallet = await tx.wallet.findUnique({ where: { customerId } });
        const currentBalance = wallet ? wallet.balance : 0;
        const requiredDeduction = dto.paymentMethod === 'WALLET' ? totalAmount : walletBalance;
        
        if (currentBalance < requiredDeduction) {
          throw new BadRequestException('Insufficient wallet balance');
        }

        await tx.wallet.update({
          where: { id: wallet!.id },
          data: { balance: currentBalance - requiredDeduction },
        });

        await tx.walletTransaction.create({
          data: {
            walletId: wallet!.id,
            type: 'DEDUCTION',
            amount: requiredDeduction,
            balanceBefore: currentBalance,
            balanceAfter: currentBalance - requiredDeduction,
            description: dto.paymentMethod === 'HYBRID' ? `Hybrid Order Partial Payment #${orderId}` : `Order Payment #${orderId}`,
          }
        });
      }

      // 3. Create the order
      const newOrder = await tx.order.create({
        data: {
          id: orderId,
          customerId,
          status: (dto.paymentMethod === 'COD' || dto.paymentMethod === 'WALLET') ? 'CONFIRMED' : 'PENDING',
          orderType: 'ONETIME_ORDER',
          subTotal,
          depositTotal,
          deliveryCharge,
          discountTotal,
          totalAmount,
          promoCode: dto.promoCode ? dto.promoCode.toUpperCase() : null,
          deliveryAddressId: dto.addressId,
          timeSlot: dto.timeSlot,
          paymentMethod: dto.paymentMethod,
          paymentStatus: (dto.paymentMethod === 'COD' || dto.paymentMethod === 'WALLET') ? 'SUCCESS' : 'PENDING',
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

      // 4. Clear cart if not Buy Now
      if (!dto.buyNowItems || dto.buyNowItems.length === 0) {
        await tx.cartItem.deleteMany({ where: { cart: { customerId } } });
      }

      // 4. Schedule delivery if payment is instantly confirmed
      if (dto.paymentMethod === 'COD' || dto.paymentMethod === 'WALLET') {
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
      }

      return newOrder;
    });

    // Fire events AFTER successful commit
    if (dto.paymentMethod === 'COD' || dto.paymentMethod === 'WALLET') {
      await this.notifyNewOrder(order.id, customerId, totalAmount);
      return { orderId: order.id, status: 'SUCCESS' };
    }

    return {
      orderId: order.id,
      razorpayOrderId,
      amount: dto.paymentMethod === 'HYBRID' ? hybridRemainingAmount : totalAmount,
      currency: 'INR',
    };
  }

  async confirmCheckout(customerId: string, dto: ConfirmCheckoutDto) {
    if (dto.paymentMethod === 'RAZORPAY' || dto.paymentMethod === 'HYBRID') {
      const secret = process.env.RAZORPAY_SECRET || 'mock';
      const body = dto.razorpayOrderId + '|' + dto.razorpayPaymentId;
      const expectedSignature = crypto.createHmac('sha256', secret).update(body.toString()).digest('hex');

      const isMock = process.env.RAZORPAY_KEY_ID?.startsWith('rzp_test_mock');
      const isMockValid = isMock && dto.razorpaySignature === 'mock_signature_valid';

      if (expectedSignature !== dto.razorpaySignature && !isMockValid) {
        throw new BadRequestException('Invalid payment signature');
      }

      // Wrap updates in transaction to prevent partial delivery tracking
      const order = await this.prisma.$transaction(async (tx) => {
        const updatedOrder = await tx.order.update({
          where: { id: dto.orderId },
          data: { status: 'CONFIRMED', paymentStatus: 'SUCCESS' },
          include: { items: true }
        });

        const requiredQuantity = updatedOrder.items.reduce((acc, i) => acc + i.quantity, 0);
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
              addressId: updatedOrder.deliveryAddressId,
              scheduledFor: today,
              requiredQuantity,
              status: 'PENDING'
            }
          });
        }
        return updatedOrder;
      });

      // Notify post-transaction
      await this.notifyNewOrder(order.id, customerId, order.totalAmount);

      return { success: true, orderId: dto.orderId };
    }

    throw new BadRequestException('Payment confirmation not applicable for this method');
  }
}
