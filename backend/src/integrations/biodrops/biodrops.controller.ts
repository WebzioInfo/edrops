import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { BiodropsRoleGuard } from './biodrops-role.guard';
import { BiodropsService } from './biodrops.service';
import {
  BiodropsTenant,
  TenantInventoryResponse,
  StockSummaryResponse,
  AdjustTenantStockDto,
  AdjustTenantStockResponse,
  BiodropsSale,
} from './biodrops.types';

@ApiTags('Aquora Biodrops Integration')
@ApiBearerAuth()
@Controller(['api/v1/integrations/biodrops', 'integrations/biodrops'])
@UseGuards(AuthGuard('jwt'), BiodropsRoleGuard)
export class BiodropsController {
  constructor(private readonly biodropsService: BiodropsService) {}

  @Get('tenants')
  @ApiOperation({
    summary: 'List all Aquora Biodrops Production enabled tenants',
    description:
      'Accessible strictly to Upper Admin, Admin, and Staff roles. Returns only tenants where Biodrops Production is enabled.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of enabled Biodrops tenants',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT session',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User does not have Upper Admin, Admin, or Staff role',
  })
  async getTenants(): Promise<BiodropsTenant[]> {
    return this.biodropsService.getTenants();
  }

  @Get('tenants/:tenantId/inventory')
  @ApiOperation({
    summary: 'Get live inventory for a specific Aquora Biodrops tenant',
    description:
      'Accessible strictly to Upper Admin, Admin, and Staff roles. Returns finished 20L jars and dynamic raw materials.',
  })
  @ApiResponse({
    status: 200,
    description: 'Tenant live inventory',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Unauthorized role or tenant disabled for production',
  })
  @ApiResponse({
    status: 404,
    description: 'Tenant not found',
  })
  async getTenantInventory(
    @Param('tenantId') tenantId: string,
  ): Promise<TenantInventoryResponse> {
    return this.biodropsService.getTenantInventory(tenantId);
  }

  @Get('tenants/:tenantId/stock-summary')
  @ApiOperation({
    summary: 'Get stock overview summary for a specific Aquora Biodrops tenant',
    description:
      'Accessible strictly to Upper Admin, Admin, and Staff roles. Groups materials strictly by unit, never combining differing units.',
  })
  @ApiResponse({
    status: 200,
    description: 'Tenant stock summary',
  })
  async getTenantStockSummary(
    @Param('tenantId') tenantId: string,
  ): Promise<StockSummaryResponse> {
    return this.biodropsService.getTenantStockSummary(tenantId);
  }

  @Get('tenants/:tenantId/sales')
  @ApiOperation({
    summary: 'Get 20L finished product sales for a specific Aquora Biodrops tenant',
    description:
      'Accessible strictly to Upper Admin, Admin, and Staff roles. Returns 20L Jar sales transactions with Aquzio origin badge.',
  })
  @ApiResponse({
    status: 200,
    description: 'Tenant sales transactions',
  })
  async getTenantSales(
    @Param('tenantId') tenantId: string,
  ): Promise<BiodropsSale[]> {
    return this.biodropsService.getTenantSales(tenantId);
  }

  @Post('tenants/:tenantId/stock/adjust')
  @ApiOperation({
    summary: 'Adjust or update stock for a tenant product or raw material',
    description:
      'Accessible to Upper Admin, Admin, and Staff roles. Validates tenant existence, updates stock atomically, and records audit trail.',
  })
  @ApiResponse({
    status: 200,
    description: 'Stock updated successfully',
  })
  async adjustTenantStock(
    @Param('tenantId') tenantId: string,
    @Body() body: AdjustTenantStockDto,
    @Request() req,
  ): Promise<AdjustTenantStockResponse> {
    const userId = req.user?.sub || req.user?.id;
    return this.biodropsService.adjustTenantStock(tenantId, body, userId);
  }
}
