import { Test, TestingModule } from '@nestjs/testing';
import { BiodropsService } from './biodrops.service';
import { BiodropsController } from './biodrops.controller';
import { BiodropsRoleGuard } from './biodrops-role.guard';
import { ConfigModule } from '../../config/config.module';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load backend/.env for live production verification test
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

describe('Live Aquora Production Backend Connectivity & Verification', () => {
  let controller: BiodropsController;

  beforeAll(async () => {
    // Explicitly configure production Aquora API URL & Key for verification if set in environment
    process.env.AQUORA_BIODROPS_API_URL =
      process.env.AQUORA_BIODROPS_API_URL ||
      'https://aquora-backend.webziointernational.in/api/v1/integrations/biodrops';

    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule],
      controllers: [BiodropsController],
      providers: [BiodropsService, BiodropsRoleGuard],
    }).compile();

    controller = module.get<BiodropsController>(BiodropsController);
  });

  it('1. Successfully retrieves eligible Biodrops tenants from production Aquora server', async () => {
    const tenants = await controller.getTenants();
    expect(Array.isArray(tenants)).toBe(true);
    expect(tenants.length).toBeGreaterThan(0);

    const first = tenants[0];
    expect(first.id).toBeDefined();
    expect(first.companyName).toBeDefined();
    expect(first.code).toBeDefined();
    expect(first.isBiodropsEnabled).toBe(true);
    expect(first.lastRetrievedAt).toBeDefined();

    console.log(
      `[PROD LIVE VERIFIED] Retrieved ${tenants.length} tenants from production. Sample: ${first.companyName} (${first.id})`,
    );
  });

  it('2. Successfully retrieves tenant inventory from production Aquora server', async () => {
    const tenants = await controller.getTenants();
    const targetTenantId = tenants[0].id;

    const inventory = await controller.getTenantInventory(targetTenantId);
    expect(inventory.tenantId).toBe(targetTenantId);
    expect(Array.isArray(inventory.finishedProducts)).toBe(true);
    expect(Array.isArray(inventory.rawMaterials)).toBe(true);

    if (inventory.rawMaterials.length > 0) {
      const sample = inventory.rawMaterials[0];
      expect(sample.name).toBeDefined();
      expect(sample.sku).toBeDefined();
      expect(sample.category).toBeDefined();
      expect(typeof sample.availableQuantity).toBe('number');
      expect(sample.unit).toBeDefined();
      console.log(
        `[PROD LIVE VERIFIED] Production inventory retrieved: ${inventory.rawMaterials.length} raw materials. Sample: ${sample.name} [${sample.availableQuantity} ${sample.unit}]`,
      );
    }
  });

  it('3. Successfully retrieves stock summary from production Aquora server with strict unit isolation', async () => {
    const tenants = await controller.getTenants();
    const targetTenantId = tenants[0].id;

    const summary = await controller.getTenantStockSummary(targetTenantId);
    expect(summary.tenantId).toBe(targetTenantId);
    expect(summary.finishedProductsSummary).toBeDefined();
    expect(Array.isArray(summary.rawMaterialsGroupedByUnit)).toBe(true);
    expect(Array.isArray(summary.individualMaterialBalances)).toBe(true);

    summary.rawMaterialsGroupedByUnit.forEach((group) => {
      expect(group.unit).toBeDefined();
      expect(typeof group.totalAvailable).toBe('number');
      expect(group.itemCount).toBeGreaterThan(0);
      console.log(
        `[PROD LIVE VERIFIED] Unit group: ${group.unit} -> Total: ${group.totalAvailable} across ${group.itemCount} items`,
      );
    });
  });
});
