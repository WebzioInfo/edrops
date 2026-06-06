import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentService } from '../payment/payment.service';

@Injectable()
export class CheckoutService {
  private readonly logger = new Logger(CheckoutService.name);

  constructor(
    private prisma: PrismaService,
    private paymentService: PaymentService,
  ) {}

  async initializeCheckout(customerId: string) {
    // 1. Fetch Cart
    const cart = await this.prisma.cart.findUnique({
      where: { customerId },
      include: {
        items: {
          include: { product: true },
        },
      },
    });

    if (!cart || cart.items.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    // 2. Validate Cart & Calculate Totals
    let subTotal = 0;
    let depositTotal = 0;

    for (const item of cart.items) {
      if (item.product.status !== 'ACTIVE') {
        throw new BadRequestException(
          `Product ${item.product.name} is no longer active`,
        );
      }

      const itemSubtotal = item.product.price * item.quantity;
      const itemDeposit = (item.product.depositAmount || 0) * item.quantity;

      subTotal += itemSubtotal;
      depositTotal += itemDeposit;
    }

    const totalAmount = subTotal + depositTotal;

    // 3. Create Pending Order & Reserve Inventory
    // We use a transaction to ensure we hold the items before allowing payment
    const checkoutResult = await this.prisma.$transaction(async (tx) => {
      // Inventory Reservation Logic (Simplified for demonstration)
      // In production, you would lock the WarehouseStock row:
      // await tx.$queryRaw`SELECT * FROM "WarehouseStock" WHERE ... FOR UPDATE`

      const order = await tx.order.create({
        data: {
          customerId,
          status: 'PENDING',
          orderType: 'ONETIME_ORDER',
          subTotal,
          depositTotal,
          totalAmount,
          deliveryAddressId: await this.getDefaultAddressId(tx, customerId),
          items: {
            create: cart.items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.product.price,
              deposit: item.product.depositAmount || 0,
              total:
                (item.product.price + (item.product.depositAmount || 0)) *
                item.quantity,
            })),
          },
        },
      });

      await tx.cartItem.deleteMany({
        where: { cart: { customerId } },
      });

      // 4. Initialize Razorpay Payment
      // Note: In real app, calling an external API inside a DB transaction is risky.
      // But for this V2 architecture, we can call it outside or handle it gracefully.
      return order;
    });

    try {
      // Call external payment service OUTSIDE the database transaction to prevent locking issues
      const paymentIntent = await this.paymentService.createPaymentIntent({
        customerId,
        amount: checkoutResult.totalAmount,
        orderId: checkoutResult.id,
        description: `Marketplace Order #${checkoutResult.id.substring(0, 8)}`,
      });

      return {
        orderId: checkoutResult.id,
        razorpayOrderId: paymentIntent.orderId,
        amount: paymentIntent.amount,
        currency: 'INR',
      };
    } catch (error) {
      this.logger.error(
        'Payment intent failed, rolling back order status',
        error,
      );
      // Rollback logic: mark order as cancelled and release inventory
      await this.prisma.order.update({
        where: { id: checkoutResult.id },
        data: { status: 'CANCELLED' },
      });
      throw new InternalServerErrorException(
        'Could not initialize payment gateway',
      );
    }
  }

  private async getDefaultAddressId(
    tx: any,
    customerId: string,
  ): Promise<string> {
    const address = await tx.address.findFirst({
      where: { customerId, isDefault: true },
    });

    if (!address) {
      const anyAddress = await tx.address.findFirst({ where: { customerId } });
      if (!anyAddress)
        throw new BadRequestException('Customer has no delivery address');
      return anyAddress.id;
    }

    return address.id;
  }
}
