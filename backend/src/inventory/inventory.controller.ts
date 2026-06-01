import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('inventory')
@UseGuards(AuthGuard('jwt'))
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('status')
  getStatus() {
    return this.inventoryService.getStatus();
  }

  @Get('logs')
  getLogs() {
    return this.inventoryService.getLogs();
  }

  @Post('production')
  addProduction(@Body() body: { qty: number }) {
    return this.inventoryService.addProduction(body.qty);
  }

  @Post('replenish')
  replenish(@Body() body: { qty: number }) {
    return this.inventoryService.addRawStock(body.qty);
  }

  @Post('damage')
  reportDamage(@Body() body: { qty: number; type: 'FILLED' | 'EMPTY' }) {
    return this.inventoryService.reportDamage(body.qty, body.type);
  }
}
