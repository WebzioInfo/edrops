import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DriverController, StaffDriverController } from './driver.controller';
import { DriverService } from './driver.service';

@Module({
  imports: [PrismaModule],
  controllers: [DriverController, StaffDriverController],
  providers: [DriverService],
  exports: [DriverService],
})
export class DriverModule {}
