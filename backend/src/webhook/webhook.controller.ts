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
    @Req() req: RawBodyRequest<Request>,
  ) {
    if (!signature) {
      throw new UnauthorizedException('Missing Razorpay signature');
    }

    // In a real NestJS app, raw body is required for verification.
    // Assuming raw body is configured or we use JSON.stringify(payload)
    const rawPayload = JSON.stringify(payload);

    // Pass to service for async processing (return immediately to prevent timeouts)
    this.webhookService
      .handleEvent(rawPayload, payload, signature)
      .catch((err) => {
        // Log errors but don't block the 200 OK response
        console.error('Webhook async processing failed', err);
      });

    return { status: 'received' };
  }
}
