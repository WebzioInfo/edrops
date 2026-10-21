import { Module } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { RawMaterialService } from './raw-material.service';
import { RawMaterialController } from './raw-material.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [InventoryController, RawMaterialController],
  providers: [InventoryService, RawMaterialService],
  exports: [InventoryService, RawMaterialService],
})
export class InventoryModule {}

