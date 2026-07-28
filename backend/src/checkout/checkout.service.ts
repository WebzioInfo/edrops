import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { OrderStatus, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentService } from '../payment/payment.service';
import { ValidateCheckoutDto, InitiateCheckoutDto, ConfirmCheckoutDto } from './dto/checkout.dto';
import * as crypto from 'crypto';
import { NotificationService } from '../notification/notification.service';
import { PromoService } from '../promo/promo.service';
@Injectable()
export class CheckoutService {
  private readonly logger = new Logger(CheckoutService.name);

  constructor(
    private prisma: PrismaService,
    private paymentService: PaymentService,
    private notificationService: NotificationService,
    private promoService: PromoService,
  ) {}

  private async notifyNewOrder(orderId: string, customerId: string, totalAmount: number, paymentMethod: string) {
    const customer = await this.prisma.user.findFirst({ where: { customer: { id: customerId } } });
    const customerName = customer ? `${customer.firstName} ${customer.lastName}` : 'Customer';
    const customerPhone = customer ? customer.phone : undefined;
    
    this.notificationService.notifyOrderCreated({
      orderId,
      customerId,
      customerName,
      customerPhone,
      totalAmount,
      paymentMethod
    });
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
          product: product,
          deposit: 0 // Will be calculated below
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
      items = cart.items.map(item => ({ ...item, deposit: 0 }));
    }

    let subTotal = 0;
    
    // Group purchased jars by brand
    const purchasedJarsByBrand: Record<string, { quantity: number; depositAmount: number }> = {};
    
    for (const item of items) {
      if (item.product.status !== 'ACTIVE') {
        throw new BadRequestException(`Product ${item.product.name} is no longer active`);
      }
      subTotal += item.product.price * item.quantity;
      
      if (item.product.isJar && item.product.brandId) {
        if (!purchasedJarsByBrand[item.product.brandId]) {
          purchasedJarsByBrand[item.product.brandId] = { quantity: 0, depositAmount: item.product.depositAmount || 0 };
        }
        purchasedJarsByBrand[item.product.brandId].quantity += item.quantity;
      }
    }

    // Validate returned jars
    if (dto.returnedJars && dto.returnedJars.length > 0) {
      for (const returned of dto.returnedJars) {
        const ownership = await this.prisma.jarOwnership.findUnique({
          where: { customerId_brandId: { customerId, brandId: returned.brandId } }
        });
        
        const ownedCount = ownership ? (ownership.ownedJars + ownership.companyJarsHeld) : 0;
        if (returned.quantity > ownedCount) {
          throw new BadRequestException(`Cannot return ${returned.quantity} jars. You only have ${ownedCount} jars of this brand.`);
        }
      }
    }

    let depositTotal = 0;
    const additionalDepositByBrand: Record<string, number> = {};

    // Calculate required deposit per brand based on net new jars
    for (const [brandId, purchased] of Object.entries(purchasedJarsByBrand)) {
      const returnedObj = dto.returnedJars?.find(r => r.brandId === brandId);
      const returnedQty = returnedObj ? returnedObj.quantity : 0;
      
      const netNewJars = purchased.quantity - returnedQty;
      
      if (netNewJars > 0) {
        const depositRecord = await this.prisma.jarDeposit.findUnique({
          where: { customerId_brandId: { customerId, brandId } }
        });
        
        const currentActiveJars = depositRecord?.maxActiveJars || 0;
        const depositPaid = depositRecord?.depositPaid || 0;
        
        const newTotalActiveJars = currentActiveJars + netNewJars;
        const targetDeposit = newTotalActiveJars * purchased.depositAmount;
        
        const additionalDepositRequired = Math.max(0, targetDeposit - depositPaid);
        additionalDepositByBrand[brandId] = additionalDepositRequired;
        depositTotal += additionalDepositRequired;
      }
    }

    // Allocate deposit to items (for OrderItem records)
    for (const item of items) {
      if (item.product.isJar && item.product.brandId && additionalDepositByBrand[item.product.brandId] > 0) {
        // Simple allocation: allocate total additional deposit of the brand evenly across purchased quantity
        const brandTotalDeposit = additionalDepositByBrand[item.product.brandId];
        const brandTotalQty = purchasedJarsByBrand[item.product.brandId].quantity;
        item.deposit = (brandTotalDeposit / brandTotalQty) * item.quantity;
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
      returnedJars: dto.returnedJars || [],
      promoCode: dto.promoCode || null,
    };
  }

  async initiateCheckout(customerId: string, dto: InitiateCheckoutDto) {
    const validation = await this.validateCheckout(customerId, {
      returnedJars: dto.returnedJars,
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
          status: (dto.paymentMethod === 'COD' || dto.paymentMethod === 'WALLET') ? OrderStatus.PENDING_ASSIGNMENT : OrderStatus.PENDING_PAYMENT,
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
          paymentStatus: (dto.paymentMethod === 'COD' || dto.paymentMethod === 'WALLET') ? PaymentStatus.SUCCESS : PaymentStatus.PENDING,
          items: {
            create: items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.product.price,
              deposit: item.deposit,
              total: (item.product.price * item.quantity) + item.deposit,
            })),
          },
          expectedReturns: {
            create: validation.returnedJars.map((rj) => ({
              brandId: rj.brandId,
              quantity: rj.quantity
            }))
          }
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
              status: OrderStatus.PENDING_ASSIGNMENT
            }
          });
        }
      }

      return newOrder;
    });

    // Fire events AFTER successful commit
    if (dto.paymentMethod === 'COD' || dto.paymentMethod === 'WALLET') {
      await this.notifyNewOrder(order.id, customerId, totalAmount, dto.paymentMethod);
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
          data: { status: OrderStatus.PENDING_ASSIGNMENT, paymentStatus: PaymentStatus.SUCCESS },
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
              status: OrderStatus.PENDING_ASSIGNMENT
            }
          });
        }
        return updatedOrder;
      });

      // Notify post-transaction
      await this.notifyNewOrder(order.id, customerId, order.totalAmount, dto.paymentMethod);

      return { success: true, orderId: dto.orderId };
    }

    throw new BadRequestException('Payment confirmation not applicable for this method');
  }
}
