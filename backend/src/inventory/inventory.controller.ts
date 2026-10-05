import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard, Roles } from '../auth/roles.guard';
import { UserRole } from '@prisma/client';
import {
  TransferStockDto,
  ReturnStockDto,
  AdjustDistributorStockDto,
  AdjustCompanyStockDto,
  CentralInventoryMovementQueryDto,
} from './dto/central-inventory.dto';

@Controller('inventory')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.MANAGER)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  // =========================================================================
  // CENTRAL DASHBOARD & REPORTING
  // =========================================================================

  @Get('central-dashboard')
  getCentralDashboard() {
    return this.inventoryService.getCentralDashboard();
  }

  @Get('status')
  getStatus() {
    return this.inventoryService.getStatus();
  }

  @Get('distributors')
  getDistributorStockList(@Query('search') search?: string) {
    return this.inventoryService.getDistributorStockList(search);
  }

  @Get('distributors/:distributorId')
  getDistributorDetail(@Param('distributorId') distributorId: string) {
    return this.inventoryService.getDistributorDetail(distributorId);
  }

  @Get('movements')
  getMovementHistory(@Query() query: CentralInventoryMovementQueryDto) {
    return this.inventoryService.getMovementHistory(query);
  }

  @Get('logs')
  getLogs() {
    return this.inventoryService.getLogs();
  }

  // =========================================================================
  // CENTRAL INVENTORY TRANSACTIONS
  // =========================================================================

  @Post('transfer')
  transferStock(@Body() dto: TransferStockDto, @Req() req: any) {
    const actingUserId = req.user?.sub || req.user?.id || req.user?.userId;
    return this.inventoryService.transferStockToDistributor(dto, actingUserId);
  }

  @Post('return')
  receiveReturn(@Body() dto: ReturnStockDto, @Req() req: any) {
    const actingUserId = req.user?.sub || req.user?.id || req.user?.userId;
    return this.inventoryService.receiveReturnFromDistributor(dto, actingUserId);
  }

  @Post('adjust-distributor')
  adjustDistributorStock(@Body() dto: AdjustDistributorStockDto, @Req() req: any) {
    const actingUserId = req.user?.sub || req.user?.id || req.user?.userId;
    return this.inventoryService.adjustDistributorStock(dto, actingUserId);
  }

  @Post('adjust-company')
  adjustCompanyStock(@Body() dto: AdjustCompanyStockDto, @Req() req: any) {
    const actingUserId = req.user?.sub || req.user?.id || req.user?.userId;
    return this.inventoryService.adjustCompanyStock(dto, actingUserId);
  }

  // =========================================================================
  // PRODUCTION & REPLENISHMENT
  // =========================================================================

  @Post('production')
  addProduction(@Body() body: { qty: number }, @Req() req: any) {
    const actingUserId = req.user?.sub || req.user?.id || req.user?.userId;
    return this.inventoryService.addProduction(body.qty, actingUserId);
  }

  @Post('replenish')
  replenish(@Body() body: { qty: number }, @Req() req: any) {
    const actingUserId = req.user?.sub || req.user?.id || req.user?.userId;
    return this.inventoryService.addRawStock(body.qty, actingUserId);
  }

  @Post('damage')
  reportDamage(
    @Body() body: { qty: number; type: 'FILLED' | 'EMPTY'; reason?: string },
    @Req() req: any,
  ) {
    const actingUserId = req.user?.sub || req.user?.id || req.user?.userId;
    return this.inventoryService.reportDamage(body.qty, body.type, actingUserId, body.reason);
  }
}
