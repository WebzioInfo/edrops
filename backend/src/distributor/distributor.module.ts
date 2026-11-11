import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DistributorServiceAreaController } from './distributor-service-area.controller';
import { DistributorServiceAreaService } from './distributor-service-area.service';
import { DistributorInventoryController } from './distributor-inventory.controller';
import { DistributorInventoryService } from './distributor-inventory.service';
import { DistributorIdentityResolver } from './distributor-identity.resolver';
import { DistributorExpensesService } from './distributor-expenses.service';
import { DistributorExpensesController } from './distributor-expenses.controller';
import { DistributorPnlService } from './distributor-pnl.service';
import { DistributorPnlController } from './distributor-pnl.controller';
import { CatalogModule } from '../catalog/catalog.module';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [PrismaModule, CatalogModule, InventoryModule],
  controllers: [
    DistributorServiceAreaController,
    DistributorInventoryController,
    DistributorExpensesController,
    DistributorPnlController,
  ],
  providers: [
    DistributorServiceAreaService,
    DistributorInventoryService,
    DistributorIdentityResolver,
    DistributorExpensesService,
    DistributorPnlService,
  ],
  exports: [
    DistributorServiceAreaService,
    DistributorIdentityResolver,
    DistributorExpensesService,
    DistributorPnlService,
  ],
})
export class DistributorModule {}
