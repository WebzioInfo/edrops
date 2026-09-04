import { Module } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { CatalogController } from './catalog.controller';
import { CloudinaryService } from '../config/cloudinary.service';

@Module({
  providers: [CatalogService, CloudinaryService],
  controllers: [CatalogController],
  exports: [CatalogService, CloudinaryService],
})
export class CatalogModule {}
