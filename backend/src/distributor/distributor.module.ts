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
import { DistributorWalletService } from './distributor-wallet.service';
import { DistributorWalletController } from './distributor-wallet.controller';
import { CatalogModule } from '../catalog/catalog.module';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [PrismaModule, CatalogModule, InventoryModule],
  controllers: [
    DistributorServiceAreaController,
    DistributorInventoryController,
    DistributorExpensesController,
    DistributorPnlController,
    DistributorWalletController,
  ],
  providers: [
    DistributorServiceAreaService,
    DistributorInventoryService,
    DistributorIdentityResolver,
    DistributorExpensesService,
    DistributorPnlService,
    DistributorWalletService,
  ],
  exports: [
    DistributorServiceAreaService,
    DistributorIdentityResolver,
    DistributorExpensesService,
    DistributorPnlService,
    DistributorWalletService,
  ],
})
export class DistributorModule {}
