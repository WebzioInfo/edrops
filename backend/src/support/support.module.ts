import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { SupportController } from './support.controller';
import { StaffSupportController } from './staff-support.controller';
import { AdminSupportController } from './admin-support.controller';
import { SupportService } from './support.service';

@Module({
  imports: [EventsModule],
  controllers: [SupportController, StaffSupportController, AdminSupportController],
  providers: [SupportService],
})
export class SupportModule {}
