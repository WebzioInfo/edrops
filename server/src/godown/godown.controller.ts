import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { GodownService } from './godown.service';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.ADMIN, Role.DISTRIBUTOR)
@Controller('godown')
export class GodownController {
  constructor(private readonly godownService: GodownService) {}

  @Get()
  findAll() { return this.godownService.findAll(); }

  @Get('alerts/low-stock')
  getLowStock() { return this.godownService.getLowStockAlerts(); }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.godownService.findById(id); }

  @Get(':id/inventory')
  getInventory(@Param('id') id: string) { return this.godownService.getInventory(id); }

  @Roles(Role.ADMIN)
  @Post()
  create(@Body() body: any) { return this.godownService.create(body); }

  @Post(':id/batch')
  receiveBatch(@Param('id') id: string, @Body() body: any) {
    return this.godownService.receiveBatch(id, body);
  }

  @Post(':id/adjust')
  adjustStock(@Param('id') id: string, @Body() body: any) {
    return this.godownService.adjustStock(id, body.productId, body.quantity, body.type, body.reason);
  }
}
