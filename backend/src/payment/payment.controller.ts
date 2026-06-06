import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { PaymentService } from './payment.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('create-intent')
  @UseGuards(JwtAuthGuard)
  async createIntent(
    @Req() req,
    @Body() body: { amount: number; description?: string },
  ) {
    const customerId = req.user.customerId;
    if (!customerId) {
      throw new BadRequestException(
        'Only customer accounts can create payment intents',
      );
    }
    return this.paymentService.createPaymentIntent({
      customerId,
      amount: body.amount,
      description: body.description,
    });
  }

  @Post('create-order')
  @UseGuards(JwtAuthGuard)
  async createOrder(
    @Req() req,
    @Body() body: { amount: number; description?: string },
  ) {
    return this.createIntent(req, body);
  }

  @Post('verify')
  @UseGuards(JwtAuthGuard)
  async verifyPayment(
    @Req() req,
    @Body()
    body: {
      razorpay_order_id: string;
      razorpay_payment_id: string;
      razorpay_signature: string;
    },
  ) {
    const customerId = req.user.customerId;
    if (!customerId) {
      throw new BadRequestException(
        'Only customer accounts can verify payments',
      );
    }
    return this.paymentService.verifyPayment(body, customerId);
  }
}
