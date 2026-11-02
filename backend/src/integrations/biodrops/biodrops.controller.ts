import {
  Controller,
  Get,
  Param,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { BiodropsRoleGuard } from './biodrops-role.guard';
import { BiodropsService } from './biodrops.service';
import {
  BiodropsTenant,
  TenantInventoryResponse,
  StockSummaryResponse,
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
}

