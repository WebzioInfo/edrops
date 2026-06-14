import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { StaffNotificationService } from './staff-notification.service';
import { StaffNotificationController } from './staff-notification.controller';

@Module({
  imports: [PrismaModule],
  controllers: [NotificationController, StaffNotificationController],
  providers: [NotificationService, StaffNotificationService],
  exports: [StaffNotificationService],
})
export class NotificationModule {}
