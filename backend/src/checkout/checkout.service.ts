import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { OrderStatus, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentService } from '../payment/payment.service';
import { RazorpayProvider } from '../payment/providers/razorpay.provider';
import {
  ValidateCheckoutDto,
  InitiateCheckoutDto,
  ConfirmCheckoutDto,
} from './dto/checkout.dto';
import * as crypto from 'crypto';
import { NotificationService } from '../notification/notification.service';
import { PromoService } from '../promo/promo.service';
import { AuditService } from '../audit/audit.service';
import { EventsGateway } from '../events/events.gateway';
import { AddressService } from '../address/address.service';
import { SettingsService } from '../settings/settings.service';
import { generateDeliveryOtp } from '../order/utils/delivery-otp.util';

@Injectable()
export class CheckoutService {
  private readonly logger = new Logger(CheckoutService.name);

  constructor(
    private prisma: PrismaService,
    private paymentService: PaymentService,
    private razorpayProvider: RazorpayProvider,
    private notificationService: NotificationService,
    private promoService: PromoService,
    private auditService: AuditService,
    private eventsGateway: EventsGateway,
    private addressService: AddressService,
    private settingsService: SettingsService,
  ) { }

  private async notifyNewOrder(
    orderId: string,
    customerId: string,
    totalAmount: number,
    paymentMethod: string,
  ) {
    const customer = await this.prisma.user.findFirst({
      where: { customer: { id: customerId } },
    });
    const customerName = customer
      ? `${customer.firstName} ${customer.lastName}`
      : 'Customer';
    const customerPhone = customer ? customer.phone : undefined;

    this.notificationService.notifyOrderCreated({
      orderId,
      customerId,
      customerName,
      customerPhone,
      totalAmount,
      paymentMethod,
    });

    try {
      this.notificationService.notifyOrderPlaced({
        orderId,
        customerId,
        userId: customer?.id,
        totalAmount,
        paymentMethod,
      });
    } catch (e) {
      this.logger.warn(`Failed to send notifyOrderPlaced: ${e.message}`);
    }

    try {
      const fullOrder = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: {
          customer: {
            include: {
              user: { select: { firstName: true, lastName: true, phone: true, email: true, id: true } },
            },
          },
          address: true,
          items: {
            include: {
              product: true,
            },
          },
        },
      });

      if (fullOrder && fullOrder.assignmentStatus === 'UNASSIGNED') {
        this.eventsGateway.emitNewOrderAvailable(fullOrder);
      }
    } catch (err) {
      this.logger.warn(`Failed to broadcast new order to distributors: ${err.message}`);
    }
  }

  formatDeliverySlot(slot?: string): string {
    if (!slot) return '6AM - 9AM';
    const lower = slot.toLowerCase().trim();
    if (lower === 'morning') return '6AM - 9AM';
    if (lower === 'midday') return '9AM - 12PM';
    if (lower === 'afternoon') return '12PM - 3PM';
    if (lower === 'evening') return '3PM - 6PM';
    return slot;
  }

  getDeliverySlots() {
    return [
      { id: '6AM - 9AM', label: '6AM - 9AM' },
      { id: '9AM - 12PM', label: '9AM - 12PM' },
      { id: '12PM - 3PM', label: '12PM - 3PM' },
      { id: '3PM - 6PM', label: '3PM - 6PM' },
    ];
  }

  async validateCheckout(customerId: string, dto: ValidateCheckoutDto) {
    let items: any[] = [];

    if (dto.buyNowItems && dto.buyNowItems.length > 0) {
      const productIds = dto.buyNowItems.map((i) => i.productId);
      const products = await this.prisma.product.findMany({
        where: { id: { in: productIds } },
      });

      items = dto.buyNowItems.map((bItem) => {
        const product = products.find((p) => p.id === bItem.productId);
        if (!product || product.status !== 'ACTIVE') {
          throw new BadRequestException(
            `Product ${product?.name || bItem.productId} is no longer active`,
          );
        }
        const itemReturn = dto.itemReturns?.find(
          (r) => r.productId === bItem.productId,
        );
        if (itemReturn && itemReturn.quantity > bItem.quantity) {
          throw new BadRequestException(
            `Cannot return more jars than purchased for ${product.name}`,
          );
        }
        return {
          productId: product.id,
          quantity: bItem.quantity,
          product: product,
          deposit: 0,
          declaredReturnQuantity: itemReturn?.quantity || 0,
        };
      });
    } else {
      throw new BadRequestException('Product items are required for checkout');
    }

    let subTotal = 0;
    let depositTotal = 0;
    const expectedReturnsByBrand: Record<string, number> = {};
    const defaultDepositAmount = await this.settingsService.getDepositAmountPerJar();

    for (const item of items) {
      if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
        throw new BadRequestException(
          `Invalid quantity for product ${item.product.name}`,
        );
      }
      if (item.product.status !== 'ACTIVE') {
        throw new BadRequestException(
          `Product ${item.product.name} is no longer active`,
        );
      }
      subTotal += item.product.price * item.quantity;

      const isJar =
        item.product.isJar ||
        (item.product.depositAmount && item.product.depositAmount > 0);

      if (isJar) {
        const depositPerJar =
          item.product.depositAmount && item.product.depositAmount > 0
            ? item.product.depositAmount
            : defaultDepositAmount;
        const declaredReturn = Math.max(
          0,
          Math.min(item.quantity, item.declaredReturnQuantity || 0),
        );
        const unreturnedJars = Math.max(0, item.quantity - declaredReturn);
        item.deposit = unreturnedJars * depositPerJar;
        depositTotal += item.deposit;

        if (item.product.brandId && declaredReturn > 0) {
          expectedReturnsByBrand[item.product.brandId] =
            (expectedReturnsByBrand[item.product.brandId] || 0) + declaredReturn;
        }
      } else {
        item.deposit = 0;
      }
    }

    if (dto.additionalReturns) {
      for (const additional of dto.additionalReturns) {
        if (additional.brandId && additional.quantity > 0) {
          expectedReturnsByBrand[additional.brandId] =
            (expectedReturnsByBrand[additional.brandId] || 0) + additional.quantity;
        }
      }
    }

    // Delivery fee is always ₹0 — customers are never charged for delivery.
    const deliveryCharge = 0;

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

    if (dto.adminOverride?.customDiscount) {
      discountTotal += dto.adminOverride.customDiscount;
    }

    if (dto.adminOverride?.waiveDeposit) {
      const oldDepositTotal = depositTotal;
      depositTotal = 0;
      // also zero out item deposits so it reflects on the order
      for (const item of items) {
        item.deposit = 0;
      }
      // Attempt to log but we don't have the user ID easily accessible here.
      // We'll log it during initiateCheckout.
    }

    const totalAmount = Math.max(
      0,
      subTotal + depositTotal + deliveryCharge - discountTotal,
    );

    return {
      subTotal,
      depositTotal,
      deliveryCharge,
      discountTotal,
      totalAmount,
      items,
      additionalReturns: dto.additionalReturns || [],
      promoCode: dto.promoCode || null,
      expectedReturns: Object.entries(expectedReturnsByBrand).map(
        ([brandId, quantity]) => ({
          brandId,
          quantity,
        }),
      ),
    };
  }

  async initiateCheckout(customerId: string, dto: InitiateCheckoutDto) {
    const validation = await this.validateCheckout(customerId, {
      additionalReturns: dto.additionalReturns,
      itemReturns: dto.itemReturns,
      buyNowItems: dto.buyNowItems,
      promoCode: dto.promoCode,
      adminOverride: dto.adminOverride,
    });
    const {
      subTotal,
      depositTotal,
      deliveryCharge,
      discountTotal,
      totalAmount,
      items,
    } = validation;

    const orderId = crypto.randomUUID();
    let razorpayOrderId: string | undefined;

    // Validate that the selected address belongs to customer and pincode is serviceable
    const deliveryAddress = await this.prisma.address.findFirst({
      where: { id: dto.addressId, customerId },
      select: { zipCode: true },
    });
    if (!deliveryAddress) {
      throw new BadRequestException('Selected delivery address not found');
    }
    const serviceability = await this.addressService.checkServiceability(
      deliveryAddress.zipCode,
    );
    if (!serviceability.serviceable) {
      throw new BadRequestException(
        `Delivery is not available for the pincode of your selected address (${deliveryAddress.zipCode}). ` +
        `Please update your delivery address.`,
      );
    }

    if (dto.paymentMethod === 'COD' && totalAmount > 2000) {
      throw new BadRequestException('COD not allowed for orders above ₹2000');
    }

    let hybridRemainingAmount = 0;
    let walletBalance = 0;

    if (dto.paymentMethod === 'HYBRID') {
      const wallet = await this.prisma.wallet.findUnique({
        where: { customerId },
      });
      walletBalance = wallet ? wallet.balance : 0;
      if (walletBalance === 0)
        throw new BadRequestException('Wallet is empty, cannot use HYBRID');
      hybridRemainingAmount = totalAmount - walletBalance;

      if (hybridRemainingAmount <= 0) {
        dto.paymentMethod = 'WALLET'; // Wallet covers everything
      }
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

      // 2. Check wallet balance strictly inside transaction with row lock to prevent race conditions
      let walletDeducted = 0;
      if (dto.paymentMethod === 'WALLET' || dto.paymentMethod === 'HYBRID') {
        if (typeof tx.$executeRawUnsafe === 'function') {
          await tx.$executeRawUnsafe(
            `SELECT id FROM "Wallet" WHERE "customerId" = $1 FOR UPDATE`,
            customerId,
          );
        }
        const wallet = await tx.wallet.findUnique({ where: { customerId } });
        const currentBalance = wallet ? wallet.balance : 0;
        const requiredDeduction =
          dto.paymentMethod === 'WALLET' ? totalAmount : walletBalance;
        walletDeducted = requiredDeduction;

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
            description:
              dto.paymentMethod === 'HYBRID'
                ? `Hybrid Order Partial Payment #${orderId}`
                : `Order Payment #${orderId}`,
          },
        });
      }

      // 3. Create the order
      const newOrder = await tx.order.create({
        data: {
          id: orderId,
          customerId,
          status: OrderStatus.ORDER_PLACED,
          orderType: 'ONETIME_ORDER',
          subTotal,
          depositTotal,
          deliveryCharge,
          discountTotal,
          totalAmount,
          promoCode: dto.promoCode ? dto.promoCode.toUpperCase() : null,
          deliveryAddressId: dto.addressId,
          timeSlot: this.formatDeliverySlot(dto.timeSlot),
          paymentMethod: dto.paymentMethod,
          hybridSecondaryMethod: dto.hybridSecondaryMethod || null,
          orderSource: (dto.orderSource as any) || 'CUSTOMER_APP',
          adminNotes: dto.adminOverride?.adminNotes || null,
          paymentStatus:
            dto.paymentMethod === 'WALLET'
              ? PaymentStatus.SUCCESS
              : PaymentStatus.PENDING,
          deliveryVerification: {
            create: {
              otp: generateDeliveryOtp(),
            },
          },
          items: {
            create: items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.product.price,
              deposit: item.deposit,
              total: item.product.price * item.quantity + item.deposit,
              declaredReturnQuantity: item.declaredReturnQuantity,
            })),
          },
          expectedReturns: {
            create: validation.expectedReturns,
          },
        },
      });

      // Log admin overrides if any
      if (dto.adminOverride) {
        await this.auditService.log(
          null, // Ideally we would pass the admin's user ID here
          'ADMIN_OVERRIDE_CHECKOUT',
          'Order',
          orderId,
          null,
          dto.adminOverride,
        );
      }

      // Record payment ledger row for WALLET or HYBRID wallet portion
      if (dto.paymentMethod === 'WALLET') {
        await tx.payment.create({
          data: {
            orderId: newOrder.id,
            customerId,
            amount: totalAmount,
            currency: 'INR',
            status: PaymentStatus.PAID,
            provider: 'WALLET',
            receiptId: `WAL-${newOrder.id}`,
            description: `Wallet Payment for Order #${newOrder.id.slice(0, 8)}`,
          },
        });
      } else if (dto.paymentMethod === 'HYBRID' && walletDeducted > 0) {
        await tx.payment.create({
          data: {
            orderId: newOrder.id,
            customerId,
            amount: walletDeducted,
            currency: 'INR',
            status: PaymentStatus.PAID,
            provider: 'WALLET',
            receiptId: `WAL-HYB-${newOrder.id}`,
            description: `Wallet Portion for Hybrid Order #${newOrder.id.slice(0, 8)}`,
          },
        });
      }

      // 4. Schedule delivery if payment is instantly confirmed
      if (dto.paymentMethod === 'COD' || dto.paymentMethod === 'WALLET') {
        const requiredQuantity = items.reduce((acc, i) => acc + i.quantity, 0);
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);

        // Always create a dedicated delivery row linked to this order
        await tx.delivery.create({
          data: {
            orderId: newOrder.id,
            customerId,
            addressId: dto.addressId,
            scheduledFor: today,
            requiredQuantity: requiredQuantity || 1,
            status: OrderStatus.ORDER_PLACED,
          },
        });
      }

      return newOrder;
    });

    if (dto.paymentMethod === 'HYBRID' && hybridRemainingAmount > 0) {
      const paymentIntent = await this.paymentService.createPaymentIntent({
        customerId,
        amount: hybridRemainingAmount,
        orderId: order.id,
        description: `Order #${order.id.substring(0, 8)} (Hybrid)`,
      });
      razorpayOrderId = paymentIntent.orderId;
    } else if (dto.paymentMethod === 'RAZORPAY') {
      const paymentIntent = await this.paymentService.createPaymentIntent({
        customerId,
        amount: totalAmount,
        orderId: order.id,
        description: `Order #${order.id.substring(0, 8)}`,
      });
      razorpayOrderId = paymentIntent.orderId;
    }

    // Fire events AFTER successful commit
    if (dto.paymentMethod === 'COD' || dto.paymentMethod === 'WALLET') {
      await this.notifyNewOrder(
        order.id,
        customerId,
        totalAmount,
        dto.paymentMethod,
      );
      return { orderId: order.id, status: 'SUCCESS' };
    }

    return {
      orderId: order.id,
      razorpayOrderId,
      amount:
        dto.paymentMethod === 'HYBRID' ? hybridRemainingAmount : totalAmount,
      currency: 'INR',
    };
  }

  async confirmCheckout(customerId: string, dto: ConfirmCheckoutDto) {
    if (dto.paymentMethod === 'RAZORPAY' || dto.paymentMethod === 'HYBRID') {
      if (
        !dto.razorpayOrderId ||
        !dto.razorpayPaymentId ||
        !dto.razorpaySignature
      ) {
        throw new BadRequestException('Missing payment signature details');
      }

      const isValid = this.razorpayProvider.verifyPaymentSignature({
        providerOrderId: dto.razorpayOrderId,
        providerPaymentId: dto.razorpayPaymentId,
        signature: dto.razorpaySignature,
      });

      if (!isValid) {
        throw new BadRequestException('Invalid payment signature');
      }

      // Wrap updates in transaction to prevent partial delivery tracking
      const order = await this.prisma.$transaction(async (tx) => {
        // Concurrency row-lock on Order
        if (typeof tx.$executeRawUnsafe === 'function') {
          await tx.$executeRawUnsafe(
            `SELECT id FROM "Order" WHERE id = $1 FOR UPDATE`,
            dto.orderId,
          );
        }

        const existingOrder = await tx.order.findUnique({
          where: { id: dto.orderId },
          include: { items: true },
        });
        if (!existingOrder || existingOrder.customerId !== customerId) {
          throw new BadRequestException('Order not found for this customer');
        }
        if (existingOrder.paymentStatus === PaymentStatus.SUCCESS) {
          return existingOrder;
        }

        // Verify Payment record belongs to this customer, order, and Razorpay order
        const paymentRecord = await tx.payment.findFirst({
          where: {
            providerId: dto.razorpayOrderId,
            orderId: dto.orderId,
            customerId,
            provider: 'RAZORPAY',
          },
        });
        if (!paymentRecord) {
          throw new BadRequestException(
            'Payment record does not match this order or customer',
          );
        }

        const updatedOrder = await tx.order.update({
          where: { id: dto.orderId },
          data: {
            status: OrderStatus.ORDER_PLACED,
            paymentStatus: PaymentStatus.SUCCESS,
          },
          include: { items: true },
        });

        if (paymentRecord) {
          await tx.payment.update({
            where: { id: paymentRecord.id },
            data: {
              status: PaymentStatus.SUCCESS,
              receiptId: dto.razorpayPaymentId,
            },
          });

          const existingAttempt = await tx.paymentAttempt.findFirst({
            where: {
              paymentId: paymentRecord.id,
              providerId: dto.razorpayPaymentId,
            },
          });

          if (!existingAttempt) {
            await tx.paymentAttempt.create({
              data: {
                paymentId: paymentRecord.id,
                providerId: dto.razorpayPaymentId,
                status: 'SUCCESS',
              },
            });
          }

          await tx.paymentAuditLog.create({
            data: {
              paymentId: paymentRecord.id,
              action: 'CLIENT_SIGNATURE_VERIFIED',
              previousStatus: paymentRecord.status,
              newStatus: PaymentStatus.SUCCESS,
              notes: `Order #${dto.orderId} verified via Razorpay ID ${dto.razorpayPaymentId}`,
            },
          });
        }

        const requiredQuantity = updatedOrder.items.reduce(
          (acc, i) => acc + i.quantity,
          0,
        );
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);

        // Always create a dedicated delivery row linked to this order
        await tx.delivery.create({
          data: {
            orderId: updatedOrder.id,
            customerId,
            addressId: updatedOrder.deliveryAddressId,
            scheduledFor: today,
            requiredQuantity: requiredQuantity || 1,
            status: OrderStatus.ORDER_PLACED,
          },
        });
        return updatedOrder;
      });

      // Notify post-transaction
      await this.notifyNewOrder(
        order.id,
        customerId,
        order.totalAmount,
        dto.paymentMethod,
      );

      try {
        this.notificationService.notifyPaymentEvent({
          paymentId: dto.razorpayPaymentId || `pay_${Date.now()}`,
          orderId: order.id,
          customerId,
          amount: order.totalAmount,
          status: 'SUCCESS',
        });
      } catch (e) {
        this.logger.warn(`Failed to send notifyPaymentEvent: ${e.message}`);
      }

      return { success: true, orderId: dto.orderId };
    }

    throw new BadRequestException(
      'Payment confirmation not applicable for this method',
    );
  }
}
