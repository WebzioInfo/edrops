import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Headers,
  Req,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { PaymentsService } from './payments.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  // ─────────── Order Checkout ───────────

  @UseGuards(AuthGuard('jwt'))
  @Post('razorpay/create/:orderId')
  createRazorpayOrder(@Param('orderId') orderId: string) {
    return this.paymentsService.createRazorpayOrder(orderId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('razorpay/verify')
  verifyPayment(
    @Body()
    body: {
      orderId: string;
      razorpayOrderId: string;
      razorpayPaymentId: string;
      razorpaySignature: string;
    },
  ) {
    return this.paymentsService.verifyPayment(body);
  }

  // ─────────── Wallet Recharge ───────────

  @UseGuards(AuthGuard('jwt'))
  @Post('wallet/create-recharge')
  createWalletRecharge(
    @CurrentUser() user: any,
    @Body() body: { amount: number },
  ) {
    return this.paymentsService.createWalletRechargeOrder(user.userId, body.amount);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('wallet/verify-recharge')
  verifyWalletRecharge(
    @CurrentUser() user: any,
    @Body()
    body: {
      amount: number;
      razorpayOrderId: string;
      razorpayPaymentId: string;
      razorpaySignature: string;
    },
  ) {
    return this.paymentsService.verifyWalletRecharge({
      userId: user.userId,
      ...body,
    });
  }

  // ─────────── Webhook (no JWT — Razorpay calls this) ───────────

  @Post('webhook')
  handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-razorpay-signature') signature: string,
  ) {
    return this.paymentsService.handleWebhook(req.rawBody!, signature);
  }

  // ─────────── Query ───────────

  @UseGuards(AuthGuard('jwt'))
  @Get('order/:orderId')
  getPayment(@Param('orderId') orderId: string) {
    return this.paymentsService.getPaymentByOrder(orderId);
  }
}
