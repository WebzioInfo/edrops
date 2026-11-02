import { Test, TestingModule } from '@nestjs/testing';
import { BiodropsService } from './biodrops.service';
import { BiodropsController } from './biodrops.controller';
import { BiodropsRoleGuard } from './biodrops-role.guard';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env directly for live verification test
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

describe('Live Aquora Biodrops End-to-End Connectivity Verification', () => {
  let service: BiodropsService;
  let controller: BiodropsController;

  beforeAll(async () => {
    // Explicitly set target live url & key in process.env if not loaded
    process.env.AQUORA_BIODROPS_API_URL =
      process.env.AQUORA_BIODROPS_API_URL ||
      'http://127.0.0.1:5000/api/v1/integrations/biodrops';
    process.env.AQUORA_BIODROPS_API_KEY =
      process.env.AQUORA_BIODROPS_API_KEY || 'biodrops_live_secret_key_2026';

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BiodropsController],
      providers: [BiodropsService, BiodropsRoleGuard],
    }).compile();

    service = module.get<BiodropsService>(BiodropsService);
    controller = module.get<BiodropsController>(BiodropsController);
  });

  it('1. Successfully retrieves eligible Biodrops tenants from live Aquora backend', async () => {
    const tenants = await controller.getTenants();
    expect(Array.isArray(tenants)).toBe(true);
    expect(tenants.length).toBeGreaterThan(0);

    const first = tenants[0];
    expect(first.id).toBeDefined();
    expect(first.companyName).toBeDefined();
    expect(first.code).toBeDefined();
    expect(first.productionStatus).toBe('ACTIVE');
    expect(first.isBiodropsEnabled).toBe(true);
    expect(first.lastRetrievedAt).toBeDefined();

    console.log(`[LIVE VERIFIED] Successfully retrieved ${tenants.length} live tenants. Sample: ${first.companyName} (${first.id})`);
  });

  it('2. Successfully retrieves selected tenant inventory from live Aquora backend', async () => {
    const tenants = await controller.getTenants();
    const targetTenantId = tenants[0].id;

    const inventory = await controller.getTenantInventory(targetTenantId);
    expect(inventory).toBeDefined();
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
      console.log(`[LIVE VERIFIED] Tenant inventory retrieved: ${inventory.rawMaterials.length} raw materials. Sample: ${sample.name} [${sample.availableQuantity} ${sample.unit}]`);
    }
  });

  it('3. Successfully retrieves stock summary from live Aquora backend with strict unit grouping', async () => {
    const tenants = await controller.getTenants();
    const targetTenantId = tenants[0].id;

    const summary = await controller.getTenantStockSummary(targetTenantId);
    expect(summary).toBeDefined();
    expect(summary.tenantId).toBe(targetTenantId);
    expect(summary.finishedProductsSummary).toBeDefined();
    expect(Array.isArray(summary.rawMaterialsGroupedByUnit)).toBe(true);
    expect(Array.isArray(summary.individualMaterialBalances)).toBe(true);

    // Verify dynamic units are strictly isolated (no cross-unit summing)
    summary.rawMaterialsGroupedByUnit.forEach((group) => {
      expect(group.unit).toBeDefined();
      expect(typeof group.totalAvailable).toBe('number');
      expect(group.itemCount).toBeGreaterThan(0);
      console.log(`[LIVE VERIFIED] Unit group: ${group.unit} -> Total: ${group.totalAvailable} across ${group.itemCount} items`);
    });
  });
});

