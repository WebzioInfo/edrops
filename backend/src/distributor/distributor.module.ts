import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DistributorServiceAreaController } from './distributor-service-area.controller';
import { DistributorServiceAreaService } from './distributor-service-area.service';
import { DistributorInventoryController } from './distributor-inventory.controller';
import { DistributorInventoryService } from './distributor-inventory.service';
import { CatalogModule } from '../catalog/catalog.module';

@Module({
  imports: [PrismaModule, CatalogModule],
  controllers: [
    DistributorServiceAreaController,
    DistributorInventoryController,
  ],
  providers: [DistributorServiceAreaService, DistributorInventoryService],
  exports: [DistributorServiceAreaService],
})
export class DistributorModule {}
