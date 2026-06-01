import { BadRequestException, Body, Controller, Headers, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) { }

  @Post('create-order')
  @UseGuards(JwtAuthGuard)
  async createOrder(@Req() req, @Body() body: { amount: number }) {
    const customerId = req.user.customerId;
    if (!customerId) {
      throw new BadRequestException('Only customer accounts can create payment orders');
    }
    return this.paymentService.createOrder(customerId, body.amount);
  }

  @Post('verify')
  @UseGuards(JwtAuthGuard)
  async verifyPayment(
    @Req() req,
    @Body() body: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string },
  ) {
    const customerId = req.user.customerId;
    if (!customerId) {
      throw new BadRequestException('Only customer accounts can verify payments');
    }
    return this.paymentService.verifyPayment(customerId, body);
  }

  @Post('webhook')
  @HttpCode(200)
  async razorpayWebhook(
    @Headers('x-razorpay-signature') signature: string,
    @Body() payload: any,
  ) {
    return this.paymentService.verifyWebhook(signature, payload);
  }
}
