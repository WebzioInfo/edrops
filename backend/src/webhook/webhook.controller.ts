import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { WebhookService } from './webhook.service';

@Controller('webhooks')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Post('razorpay')
  @HttpCode(HttpStatus.OK) // Always return 200 to Razorpay quickly
  async handleRazorpayWebhook(
    @Body() payload: any,
    @Headers('x-razorpay-signature') signature: string,
    @Headers('x-razorpay-event-id') eventId: string,
    @Req() req: RawBodyRequest<Request>,
  ) {
    if (!signature) {
      throw new UnauthorizedException('Missing Razorpay signature');
    }

    // In NestJS with rawBody: true, req.rawBody preserves the exact incoming buffer for HMAC-SHA256 signature verification.
    // Fall back to JSON.stringify if not present.
    const rawPayload = req?.rawBody
      ? req.rawBody.toString('utf8')
      : JSON.stringify(payload);

    const accepted = await this.webhookService.handleEvent(
      rawPayload,
      payload,
      signature,
      eventId,
    );
    if (accepted === false) {
      throw new UnauthorizedException('Invalid Razorpay webhook signature');
    }

    return { status: 'received' };
  }
}
