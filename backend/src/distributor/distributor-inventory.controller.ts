import { InventoryTransactionsQuery } from './dto/inventory-transactions-query.dto';
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserRole } from '@prisma/client';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { multerOptions } from '../config/multer.config';
import type { MulterFile } from '../config/cloudinary.service';
import { DistributorInventoryService } from './distributor-inventory.service';
import { CreateJarItemDto, UpdateJarItemDto } from './dto/distributor-jar-item.dto';

@Controller('distributor/inventory')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.DISTRIBUTOR)
export class DistributorInventoryController {
  constructor(private readonly inventory: DistributorInventoryService) {}

  @Get()
  getInventory(@Req() req: { user: { id: string } }) {
    return this.inventory.getInventory(req.user.id);
  }

  @Get('items')
  getJarItems(@Req() req: { user: { id: string } }) {
    return this.inventory.getJarItems(req.user.id);
  }

  @Post('items')
  @UseInterceptors(FileInterceptor('file', multerOptions))
  createJarItem(
    @Req() req: { user: { id: string } },
    @UploadedFile() file: MulterFile,
    @Body() dto: CreateJarItemDto,
  ) {
    return this.inventory.createJarItem(req.user.id, file, dto);
  }

  @Patch('items/:id')
  updateJarItem(
    @Req() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() dto: UpdateJarItemDto,
  ) {
    return this.inventory.updateJarItem(req.user.id, id, dto);
  }

  @Post('items/:id/image')
  @UseInterceptors(FileInterceptor('file', multerOptions))
  uploadJarItemImage(
    @Req() req: { user: { id: string } },
    @Param('id') id: string,
    @UploadedFile() file: MulterFile,
  ) {
    return this.inventory.uploadJarItemImage(req.user.id, id, file);
  }

  @Get('transactions')
  getTransactions(
    @Req() req: { user: { id: string } },
    @Query() query: InventoryTransactionsQuery,
  ) {
    return this.inventory.getTransactions(req.user.id, query);
  }

  @Post('image')
  @UseInterceptors(FileInterceptor('file', multerOptions))
  uploadImage(
    @Req() req: { user: { id: string } },
    @UploadedFile() file: MulterFile,
  ) {
    return this.inventory.uploadImage(req.user.id, file);
  }
}
