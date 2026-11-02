import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException, UnauthorizedException, BadGatewayException, BadRequestException } from '@nestjs/common';
import { BiodropsController } from './biodrops.controller';
import { BiodropsService } from './biodrops.service';
import { BiodropsRoleGuard } from './biodrops-role.guard';

describe('Aquora Biodrops Integration Module', () => {
  let controller: BiodropsController;
  let service: BiodropsService;
  let guard: BiodropsRoleGuard;

  const mockTenantsResponse = [
    {
      id: 'ten-alpha-001',
      companyName: 'Alpha Bottling Co.',
      code: 'ALPHA',
      subdomain: 'alpha.biodrops.io',
      productionStatus: 'ACTIVE',
      biodropsEnabled: true,
      inventorySummary: {
        totalFinishedJars: 2450,
        rawMaterialsCount: 8,
        lowStockAlerts: 1,
        lastUpdated: '2026-11-02T10:00:00.000Z',
      },
    },
    {
      id: 'ten-beta-002',
      companyName: 'Beta Springs Ltd.',
      code: 'BETA',
      subdomain: 'beta.biodrops.io',
      productionStatus: 'DISABLED',
      biodropsEnabled: false,
      inventorySummary: {
        totalFinishedJars: 0,
        rawMaterialsCount: 2,
        lowStockAlerts: 0,
      },
    },
    {
      id: 'ten-gamma-003',
      companyName: 'Gamma Pure Water',
      code: 'GAMMA',
      productionStatus: 'ENABLED',
      isBiodropsEnabled: true,
      inventorySummary: {
        totalFinishedJars: 890,
        rawMaterialsCount: 5,
        lowStockAlerts: 0,
      },
    },
  ];

  const mockInventoryResponse = {
    tenantId: 'ten-alpha-001',
    companyName: 'Alpha Bottling Co.',
    code: 'ALPHA',
    productionStatus: 'ACTIVE',
    isBiodropsEnabled: true,
    finishedProducts: [
      {
        id: 'fp-20l',
        name: '20L Biodrops Purified Water Jar',
        sku: 'JAR-20L-BIO',
        availableStock: 1850,
        reservedStock: 350,
        damagedStock: 25,
        unit: 'Jars',
      },
    ],
    rawMaterials: [
      {
        id: 'rm-preforms',
        name: '20L Polycarbonate Preforms',
        sku: 'MAT-PREF-20L',
        category: 'Preforms',
        availableQuantity: 4200,
        usedQuantity: 12000,
        wastedQuantity: 65,
        unit: 'pcs',
        reorderLevel: 2000,
      },
      {
        id: 'rm-caps',
        name: 'Biodrops Non-Spill Caps',
        sku: 'MAT-CAP-NS',
        category: 'Caps',
        availableQuantity: 850,
        usedQuantity: 14500,
        wastedQuantity: 120,
        unit: 'pcs',
        reorderLevel: 1000, // Low stock: 850 <= 1000
      },
      {
        id: 'rm-labels',
        name: 'Biodrops Security Heat-Shrink Film',
        sku: 'MAT-FILM-HS',
        category: 'Packaging',
        availableQuantity: 15.5,
        usedQuantity: 84.0,
        wastedQuantity: 1.2,
        unit: 'rolls',
        reorderLevel: 5.0,
      },
      {
        id: 'rm-mineral',
        name: 'Food-Grade Mineral Enrichment Solution',
        sku: 'MAT-MIN-SOL',
        category: 'Chemicals',
        availableQuantity: 120,
        usedQuantity: 480,
        wastedQuantity: 4,
        unit: 'liters',
        reorderLevel: 50,
      },
    ],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BiodropsController],
      providers: [
        BiodropsService,
        BiodropsRoleGuard,
      ],
    }).compile();

    controller = module.get<BiodropsController>(BiodropsController);
    service = module.get<BiodropsService>(BiodropsService);
    guard = module.get<BiodropsRoleGuard>(BiodropsRoleGuard);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('1. Access Control – CRITICAL RBAC REQUIREMENT', () => {
    function createMockContext(user: any): ExecutionContext {
      return {
        switchToHttp: () => ({
          getRequest: () => ({ user }),
          getResponse: () => ({}),
        }),
      } as unknown as ExecutionContext;
    }

    it('Permits Upper Admin (UPPER_ADMIN role)', () => {
      const ctx = createMockContext({ role: 'UPPER_ADMIN' });
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('Permits Upper Admin (SUPER_ADMIN role)', () => {
      const ctx = createMockContext({ role: 'SUPER_ADMIN' });
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('Permits Upper Admin (Admin with level > 1)', () => {
      const ctx = createMockContext({ role: 'ADMIN', admin: { level: 2 } });
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('Permits Admin (ADMIN role)', () => {
      const ctx = createMockContext({ role: 'ADMIN' });
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('Permits Staff (STAFF role)', () => {
      const ctx = createMockContext({ role: 'STAFF' });
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('Denies Manager role with HTTP 403 Forbidden', () => {
      const ctx = createMockContext({ role: 'MANAGER' });
      expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    });

    it('Denies Customer role with HTTP 403 Forbidden', () => {
      const ctx = createMockContext({ role: 'CUSTOMER' });
      expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    });

    it('Denies Delivery Partner role with HTTP 403 Forbidden', () => {
      const ctx = createMockContext({ role: 'DELIVERY_PARTNER' });
      expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    });

    it('Denies Distributor role with HTTP 403 Forbidden', () => {
      const ctx = createMockContext({ role: 'DISTRIBUTOR' });
      expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    });

    it('Denies Unauthenticated request with HTTP 401 Unauthorized', () => {
      const ctx = createMockContext(null);
      expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
    });
  });

  describe('2. Biodrops Tenants Endpoint (GET /api/v1/integrations/biodrops/tenants)', () => {
    it('Filters out disabled tenants and returns only production-enabled tenants', async () => {
      jest.spyOn<any, any>(service, 'fetchFromAquora').mockResolvedValue(mockTenantsResponse);

      const tenants = await controller.getTenants();
      expect(tenants).toHaveLength(2);

      const ids = tenants.map((t) => t.id);
      expect(ids).toContain('ten-alpha-001');
      expect(ids).toContain('ten-gamma-003');
      expect(ids).not.toContain('ten-beta-002'); // Disabled tenant excluded

      const alpha = tenants.find((t) => t.id === 'ten-alpha-001');
      expect(alpha).toBeDefined();
      expect(alpha?.companyName).toBe('Alpha Bottling Co.');
      expect(alpha?.code).toBe('ALPHA');
      expect(alpha?.subdomain).toBe('alpha.biodrops.io');
      expect(alpha?.productionStatus).toBe('ACTIVE');
      expect(alpha?.inventorySummary.totalFinishedJars).toBe(2450);
      expect(alpha?.lastRetrievedAt).toBeDefined();
    });
  });

  describe('3. Tenant Inventory Endpoint (GET /api/v1/integrations/biodrops/tenants/:tenantId/inventory)', () => {
    it('Returns finished products and raw materials with dynamic units', async () => {
      jest.spyOn<any, any>(service, 'fetchFromAquora').mockResolvedValue(mockInventoryResponse);

      const inv = await controller.getTenantInventory('ten-alpha-001');
      expect(inv.tenantId).toBe('ten-alpha-001');
      expect(inv.finishedProducts).toHaveLength(1);
      expect(inv.finishedProducts[0].name).toBe('20L Biodrops Purified Water Jar');
      expect(inv.finishedProducts[0].sku).toBe('JAR-20L-BIO');
      expect(inv.finishedProducts[0].availableStock).toBe(1850);
      expect(inv.finishedProducts[0].reservedStock).toBe(350);
      expect(inv.finishedProducts[0].damagedStock).toBe(25);
      expect(inv.finishedProducts[0].unit).toBe('Jars');

      expect(inv.rawMaterials).toHaveLength(4);
      // Verify dynamic units are preserved
      const units = inv.rawMaterials.map((m) => m.unit);
      expect(units).toContain('pcs');
      expect(units).toContain('rolls');
      expect(units).toContain('liters');

      // Verify low stock calculation
      const caps = inv.rawMaterials.find((m) => m.sku === 'MAT-CAP-NS');
      expect(caps?.isLowStock).toBe(true);

      const preforms = inv.rawMaterials.find((m) => m.sku === 'MAT-PREF-20L');
      expect(preforms?.isLowStock).toBe(false);
    });

    it('Rejects disabled tenant inventory request with BadRequestException', async () => {
      jest.spyOn<any, any>(service, 'fetchFromAquora').mockResolvedValue({
        tenantId: 'ten-beta-002',
        productionStatus: 'DISABLED',
        isBiodropsEnabled: false,
      });

      await expect(controller.getTenantInventory('ten-beta-002')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('4. Stock Overview Endpoint (GET /api/v1/integrations/biodrops/tenants/:tenantId/stock-summary)', () => {
    it('Strictly groups raw materials by unit and NEVER combines different units', async () => {
      jest.spyOn<any, any>(service, 'fetchFromAquora').mockResolvedValue(mockInventoryResponse);

      const summary = await controller.getTenantStockSummary('ten-alpha-001');
      expect(summary.tenantId).toBe('ten-alpha-001');

      // Finished products summary
      expect(summary.finishedProductsSummary.totalAvailableStock).toBe(1850);
      expect(summary.finishedProductsSummary.totalReservedStock).toBe(350);
      expect(summary.finishedProductsSummary.totalDamagedStock).toBe(25);
      expect(summary.finishedProductsSummary.totalStock).toBe(2225);

      // Raw materials strictly grouped by unit
      const groups = summary.rawMaterialsGroupedByUnit;
      expect(groups).toHaveLength(3); // pcs, rolls, liters

      const pcsGroup = groups.find((g) => g.unit.toLowerCase() === 'pcs');
      expect(pcsGroup).toBeDefined();
      expect(pcsGroup?.itemCount).toBe(2); // preforms + caps
      expect(pcsGroup?.totalAvailable).toBe(4200 + 850); // 5050 pcs only!
      expect(pcsGroup?.totalUsed).toBe(12000 + 14500);

      const rollsGroup = groups.find((g) => g.unit.toLowerCase() === 'rolls');
      expect(rollsGroup?.totalAvailable).toBe(15.5);

      const litersGroup = groups.find((g) => g.unit.toLowerCase() === 'liters');
      expect(litersGroup?.totalAvailable).toBe(120);

      // Low stock alerts
      expect(summary.lowStockAlerts).toHaveLength(1);
      expect(summary.lowStockAlerts[0].sku).toBe('MAT-CAP-NS');
      expect(summary.lowStockAlerts[0].deficit).toBe(150);
    });
  });

  describe('5. Error Handling & Security Credentials Protection', () => {
    it('Transforms upstream 401/403 into BadGatewayException without exposing API credentials', async () => {
      // Simulate fetch rejecting with BadGatewayException
      jest.spyOn<any, any>(service, 'fetchFromAquora').mockRejectedValue(
        new BadGatewayException(
          'Aquora integration service authentication failed. Please verify the backend API key.',
        ),
      );

      await expect(controller.getTenants()).rejects.toThrow(BadGatewayException);
      try {
        await controller.getTenants();
      } catch (err: any) {
        expect(err.message).not.toContain('aq_live_biodrops_sec_key');
        expect(err.message).toContain('Aquora integration service authentication failed');
      }
    });

    it('Handles connection timeouts and server unreachable states', async () => {
      jest.spyOn<any, any>(service, 'fetchFromAquora').mockRejectedValue(
        new BadGatewayException(
          'Aquora integration service connection timed out.',
        ),
      );

      await expect(controller.getTenants()).rejects.toThrow(BadGatewayException);
    });
  });
});

