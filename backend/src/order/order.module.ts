import { Module } from '@nestjs/common';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';
import { EventsModule } from '../events/events.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [EventsModule, NotificationModule],
  providers: [OrderService],
  controllers: [OrderController],
  exports: [OrderService],
})
export class OrderModule {}
