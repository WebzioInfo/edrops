import { Module } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';
import { PaymentModule } from '../payment/payment.module';
import { NotificationModule } from '../notification/notification.module';
import { EnginesModule } from '../engines/engines.module';

@Module({
  imports: [PaymentModule, NotificationModule, EnginesModule],
  controllers: [WebhookController],
  providers: [WebhookService],
})
export class WebhookModule {}
