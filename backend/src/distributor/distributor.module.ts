import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DistributorServiceAreaController } from './distributor-service-area.controller';
import { DistributorServiceAreaService } from './distributor-service-area.service';

@Module({
  imports: [PrismaModule],
  controllers: [DistributorServiceAreaController],
  providers: [DistributorServiceAreaService],
  exports: [DistributorServiceAreaService],
})
export class DistributorModule {}
