import { Test, TestingModule } from '@nestjs/testing';
import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
  BadGatewayException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { BiodropsController } from './biodrops.controller';
import { BiodropsService } from './biodrops.service';
import { BiodropsRoleGuard } from './biodrops-role.guard';
import { ConfigService } from '../../config/config.service';

describe('Aquora Biodrops Integration Security Audit & Test Suite', () => {
  let controller: BiodropsController;
  let service: BiodropsService;
  let guard: BiodropsRoleGuard;
  let configService: ConfigService;

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
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              if (key === 'AQUORA_BIODROPS_API_URL') {
                return 'https://aquzio-backend.webziotech.in/api/v1/integrations/biodrops';
              }
              if (key === 'AQUORA_BIODROPS_API_KEY') {
                return 'test_secure_configured_api_key';
              }
              return defaultValue;
            }),
          },
        },
      ],
    }).compile();

    controller = module.get<BiodropsController>(BiodropsController);
    service = module.get<BiodropsService>(BiodropsService);
    guard = module.get<BiodropsRoleGuard>(BiodropsRoleGuard);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function createMockContext(user: any): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
        getResponse: () => ({}),
      }),
    } as unknown as ExecutionContext;
  }

  // --------------------------------------------------------------------------
  // Requirement 9: 20 Automated Tests
  // --------------------------------------------------------------------------

  it('1. Valid new Aquora API credential: sets X-API-Key header properly', async () => {
    let capturedHeaders: Record<string, string> = {};
    (global as any).fetch = jest.fn().mockImplementation((url, opts) => {
      capturedHeaders = opts.headers;
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockTenantsResponse),
      });
    });

    const tenants = await service.getTenants();
    expect(capturedHeaders['X-API-Key']).toBe('test_secure_configured_api_key');
    expect(tenants.length).toBeGreaterThan(0);
  });

  it('2. Missing API URL: fails safely with BadGatewayException', () => {
    jest.spyOn(configService, 'get').mockImplementation((key: string) => {
      if (key === 'AQUZIO_BIODROPS_API_URL' || key === 'AQUORA_BIODROPS_API_URL') return '';
      return 'some_key';
    });

    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      expect(() => service.baseUrl).toThrow(BadGatewayException);
      expect(() => service.baseUrl).toThrow('Missing API URL');
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it('3. Missing API key: fails safely with BadGatewayException', () => {
    jest.spyOn(configService, 'get').mockImplementation((key: string) => {
      if (key === 'AQUZIO_BIODROPS_API_KEY' || key === 'AQUORA_BIODROPS_API_KEY') return '';
      return 'https://aquzio-backend.webziotech.in/api/v1/integrations/biodrops';
    });

    expect(() => service.apiKey).toThrow(BadGatewayException);
    expect(() => service.apiKey).toThrow('Missing API key');
  });

  it('4. Invalid API key: rejects request and throws BadGatewayException', async () => {
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ message: 'Invalid API key provided.' }),
    });

    await expect(service.getTenants()).rejects.toThrow(BadGatewayException);
    await expect(service.getTenants()).rejects.toThrow(
      'Aquora integration service authentication failed',
    );
  });

  it('5. Aquora 401 response: mapped to BadGatewayException without retrying', async () => {
    const fetchSpy = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ message: 'Unauthorized: Key revoked or expired' }),
    });
    (global as any).fetch = fetchSpy;

    await expect(service.getTenants()).rejects.toThrow(BadGatewayException);
    // Verify client error is NOT retried
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('6. Aquora 403 response: mapped to BadGatewayException without retrying', async () => {
    const fetchSpy = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: () => Promise.resolve({ message: 'Forbidden: IP or credential not allowed' }),
    });
    (global as any).fetch = fetchSpy;

    await expect(service.getTenants()).rejects.toThrow(BadGatewayException);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('7. Disabled tenant 404 response: handles NotFoundException cleanly', async () => {
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ message: 'Tenant not found or disabled.' }),
    });

    await expect(service.getTenantInventory('ten-disabled-999')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('8. Connection refused: classifies error as CONNECTION_REFUSED with safe message', () => {
    const classified = service.classifyNetworkError(
      { code: 'ECONNREFUSED', message: 'connect ECONNREFUSED 127.0.0.1:5000' },
      'http://127.0.0.1:5000/api/v1/integrations/biodrops/tenants',
    );

    expect(classified.type).toBe('CONNECTION_REFUSED');
    expect(classified.safeClientMessage).toContain('Connection refused');
  });

  it('9. DNS failure: classifies error as DNS_RESOLUTION_FAILURE with safe message', () => {
    const classified = service.classifyNetworkError(
      { code: 'ENOTFOUND', message: 'getaddrinfo ENOTFOUND invalid-host' },
      'https://invalid-host.webziotech.in/api/v1/integrations/biodrops/tenants',
    );

    expect(classified.type).toBe('DNS_RESOLUTION_FAILURE');
    expect(classified.safeClientMessage).toContain('DNS hostname resolution failed');
  });

  it('10. Connection timeout: classifies error as CONNECTION_TIMEOUT with safe message', () => {
    const classified = service.classifyNetworkError(
      { name: 'AbortError', message: 'The operation was aborted due to timeout' },
      'https://aquzio-backend.webziotech.in/api/v1/integrations/biodrops/tenants',
    );

    expect(classified.type).toBe('CONNECTION_TIMEOUT');
    expect(classified.safeClientMessage).toContain('connection timed out');
  });

  it('11. Tenant listing: retrieves and filters out disabled tenants', async () => {
    jest.spyOn<any, any>(service, 'fetchFromAquora').mockResolvedValue(mockTenantsResponse);

    const tenants = await controller.getTenants();
    expect(tenants).toHaveLength(2);
    expect(tenants.map((t) => t.id)).toEqual(['ten-alpha-001', 'ten-gamma-003']);
    expect(tenants.find((t) => t.id === 'ten-beta-002')).toBeUndefined();
  });

  it('12. Inventory retrieval: retrieves finished products and raw materials', async () => {
    jest.spyOn<any, any>(service, 'fetchFromAquora').mockResolvedValue(mockInventoryResponse);

    const inv = await controller.getTenantInventory('ten-alpha-001');
    expect(inv.tenantId).toBe('ten-alpha-001');
    expect(inv.finishedProducts).toHaveLength(1);
    expect(inv.rawMaterials).toHaveLength(4);
    expect(inv.finishedProducts[0].name).toBe('20L Biodrops Purified Water Jar');
  });

  it('13. Stock summary: retrieves 20L totals and grouped materials', async () => {
    jest.spyOn<any, any>(service, 'fetchFromAquora').mockResolvedValue(mockInventoryResponse);

    const summary = await controller.getTenantStockSummary('ten-alpha-001');
    expect(summary.tenantId).toBe('ten-alpha-001');
    expect(summary.finishedProductsSummary.totalAvailableStock).toBe(1850);
    expect(summary.finishedProductsSummary.totalStock).toBe(2225);
    expect(summary.rawMaterialsGroupedByUnit.length).toBe(3);
  });

  it('14. Dynamic raw material units: strictly isolates units without cross-unit summing', async () => {
    jest.spyOn<any, any>(service, 'fetchFromAquora').mockResolvedValue(mockInventoryResponse);

    const summary = await controller.getTenantStockSummary('ten-alpha-001');
    const units = summary.rawMaterialsGroupedByUnit.map((g) => g.unit);

    expect(units).toContain('pcs');
    expect(units).toContain('rolls');
    expect(units).toContain('liters');

    const pcs = summary.rawMaterialsGroupedByUnit.find((g) => g.unit === 'pcs');
    expect(pcs?.totalAvailable).toBe(4200 + 850); // 5050 pcs only
  });

  it('15. Upper Admin access: UPPER_ADMIN, SUPER_ADMIN, and Admin level > 1 permitted', () => {
    expect(guard.canActivate(createMockContext({ role: 'UPPER_ADMIN' }))).toBe(true);
    expect(guard.canActivate(createMockContext({ role: 'SUPER_ADMIN' }))).toBe(true);
    expect(guard.canActivate(createMockContext({ role: 'ADMIN', admin: { level: 2 } }))).toBe(true);
  });

  it('16. Admin access: ADMIN role permitted', () => {
    expect(guard.canActivate(createMockContext({ role: 'ADMIN' }))).toBe(true);
  });

  it('17. Staff access: STAFF role permitted', () => {
    expect(guard.canActivate(createMockContext({ role: 'STAFF' }))).toBe(true);
  });

  it('18. Unauthorized roles: MANAGER, CUSTOMER, DELIVERY_PARTNER, DISTRIBUTOR denied (HTTP 403)', () => {
    expect(() => guard.canActivate(createMockContext({ role: 'MANAGER' }))).toThrow(ForbiddenException);
    expect(() => guard.canActivate(createMockContext({ role: 'CUSTOMER' }))).toThrow(ForbiddenException);
    expect(() => guard.canActivate(createMockContext({ role: 'DELIVERY_PARTNER' }))).toThrow(ForbiddenException);
    expect(() => guard.canActivate(createMockContext({ role: 'DISTRIBUTOR' }))).toThrow(ForbiddenException);
  });

  it('19. Unauthenticated requests: null or empty user denied (HTTP 401)', () => {
    expect(() => guard.canActivate(createMockContext(null))).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(createMockContext({}))).toThrow(UnauthorizedException);
  });

  it('20. API credential never exposed to frontend: responses contain zero API secrets', async () => {
    jest.spyOn<any, any>(service, 'fetchFromAquora').mockResolvedValue(mockTenantsResponse);

    const tenants = await controller.getTenants();
    const serialized = JSON.stringify(tenants);

    expect(serialized).not.toContain('test_secure_configured_api_key');
    expect(serialized).not.toContain('X-API-Key');
    expect(serialized).not.toContain('aquora_secret_key');
  });
  it('21. Canonical Aquzio configuration: AQUZIO_* takes precedence over AQUORA_*', () => {
    jest.spyOn(configService, 'get').mockImplementation((key: string) => {
      if (key === 'AQUZIO_BIODROPS_API_URL') return 'https://aquzio.custom.in/api/v1/integrations/biodrops';
      if (key === 'AQUORA_BIODROPS_API_URL') return 'https://legacy-aquora.in/api/v1/integrations/biodrops';
      if (key === 'AQUZIO_BIODROPS_API_KEY') return 'aquzio_canonical_key';
      if (key === 'AQUORA_BIODROPS_API_KEY') return 'aquora_legacy_key';
      return '';
    });

    expect(service.baseUrl).toBe('https://aquzio.custom.in/api/v1/integrations/biodrops');
    expect(service.apiKey).toBe('aquzio_canonical_key');
  });

  it('22. Backward compatibility fallback: AQUORA_* works when AQUZIO_* is unset', () => {
    jest.spyOn(configService, 'get').mockImplementation((key: string) => {
      if (key === 'AQUZIO_BIODROPS_API_URL') return '';
      if (key === 'AQUORA_BIODROPS_API_URL') return 'https://aquzio-backend.webziotech.in/api/v1/integrations/biodrops';
      if (key === 'AQUZIO_BIODROPS_API_KEY') return '';
      if (key === 'AQUORA_BIODROPS_API_KEY') return 'fallback_legacy_key';
      return '';
    });

    expect(service.baseUrl).toBe('https://aquzio-backend.webziotech.in/api/v1/integrations/biodrops');
    expect(service.apiKey).toBe('fallback_legacy_key');
  });

  it('23. Available quantity 0 is always flagged as isLowStock even if reorderLevel is 0', async () => {
    jest.spyOn<any, any>(service, 'fetchFromAquora').mockResolvedValue({
      tenantId: 'ten-alpha-001',
      productionStatus: 'ACTIVE',
      isBiodropsEnabled: true,
      rawMaterials: [
        {
          id: 'rm-zero-stock',
          name: 'Mineral Blend Salt',
          sku: 'MAT-MIN-00',
          category: 'Chemicals',
          availableQuantity: 0,
          usedQuantity: 10,
          wastedQuantity: 0,
          unit: 'kg',
          reorderLevel: 0,
        },
      ],
    });

    const inv = await controller.getTenantInventory('ten-alpha-001');
    expect(inv.rawMaterials[0].availableQuantity).toBe(0);
    expect(inv.rawMaterials[0].reorderLevel).toBe(0);
    expect(inv.rawMaterials[0].isLowStock).toBe(true);
  });

  it('24. Normalizes discrete packaging items mistakenly measured in liters to pcs', async () => {
    jest.spyOn<any, any>(service, 'fetchFromAquora').mockResolvedValue({
      tenantId: 'ten-alpha-001',
      productionStatus: 'ACTIVE',
      isBiodropsEnabled: true,
      rawMaterials: [
        {
          id: 'rm-discrete-bottle',
          name: '20L Empty Water Bottle Container',
          sku: 'JAR-20L-BOT',
          category: 'Packaging',
          availableQuantity: 500,
          usedQuantity: 100,
          wastedQuantity: 5,
          unit: 'LITER',
          reorderLevel: 200,
        },
      ],
    });

    const inv = await controller.getTenantInventory('ten-alpha-001');
    expect(inv.rawMaterials[0].unit).toBe('PCS');
  });

  it('25. Corrects misclassified bottle/jar items from PREFORM to PACKAGING', async () => {
    jest.spyOn<any, any>(service, 'fetchFromAquora').mockResolvedValue({
      tenantId: 'ten-alpha-001',
      productionStatus: 'ACTIVE',
      isBiodropsEnabled: true,
      rawMaterials: [
        {
          id: 'rm-misclassified',
          name: '20L Biodrops Molded Bottle Jar',
          sku: 'JAR-20L-DISP',
          category: 'PREFORM',
          availableQuantity: 300,
          usedQuantity: 50,
          wastedQuantity: 2,
          unit: 'pcs',
          reorderLevel: 100,
        },
      ],
    });

    const inv = await controller.getTenantInventory('ten-alpha-001');
    expect(inv.rawMaterials[0].category).toBe('PACKAGING');
  });

  it('26. Adjust stock (ADD): increases available quantity and updates shadow inventory', async () => {
    jest.spyOn<any, any>(service, 'fetchFromAquora').mockResolvedValue(mockInventoryResponse);

    const result = await controller.adjustTenantStock(
      'ten-alpha-001',
      {
        sku: 'MAT-PREF-20L',
        action: 'ADD',
        quantity: 500,
        reason: 'Received shipment from supplier',
      },
      { user: { id: 'staff-001' } },
    );

    expect(result.success).toBe(true);
    expect(result.previousQuantity).toBe(4200);
    expect(result.newQuantity).toBe(4700);
    expect(result.action).toBe('ADD');

    // Subsequent inventory get should reflect the new stock
    const updatedInv = await controller.getTenantInventory('ten-alpha-001');
    const updatedItem = updatedInv.rawMaterials.find((m) => m.sku === 'MAT-PREF-20L');
    expect(updatedItem?.availableQuantity).toBe(4700);
  });

  it('27. Adjust stock (SET): sets absolute available quantity', async () => {
    jest.spyOn<any, any>(service, 'fetchFromAquora').mockResolvedValue(mockInventoryResponse);

    const result = await controller.adjustTenantStock(
      'ten-alpha-001',
      {
        sku: 'MAT-CAP-NS',
        action: 'SET',
        quantity: 1500,
        reason: 'Physical inventory count reconciliation',
      },
      { user: { id: 'staff-001' } },
    );

    expect(result.success).toBe(true);
    expect(result.newQuantity).toBe(1500);

    const updatedInv = await controller.getTenantInventory('ten-alpha-001');
    const updatedCap = updatedInv.rawMaterials.find((m) => m.sku === 'MAT-CAP-NS');
    expect(updatedCap?.availableQuantity).toBe(1500);
    expect(updatedCap?.isLowStock).toBe(false); // 1500 > 1000 reorderLevel
  });

  it('28. Adjust stock (DEDUCT): decreases stock and prevents negative balance', async () => {
    jest.spyOn<any, any>(service, 'fetchFromAquora').mockResolvedValue(mockInventoryResponse);

    const result = await controller.adjustTenantStock(
      'ten-alpha-001',
      {
        sku: 'MAT-MIN-SOL',
        action: 'DEDUCT',
        quantity: 20,
        reason: 'Used for batch production test',
      },
      { user: { id: 'staff-001' } },
    );

    expect(result.success).toBe(true);
    expect(result.previousQuantity).toBe(120);
    expect(result.newQuantity).toBe(100);

    // Should reject deduction greater than available
    await expect(
      controller.adjustTenantStock(
        'ten-alpha-001',
        {
          sku: 'MAT-MIN-SOL',
          action: 'DEDUCT',
          quantity: 200,
          reason: 'Excessive deduction attempt',
        },
        { user: { id: 'staff-001' } },
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('29. Adjust stock validation: rejects missing SKU or empty reason', async () => {
    await expect(
      controller.adjustTenantStock(
        'ten-alpha-001',
        {
          sku: '',
          action: 'ADD',
          quantity: 10,
          reason: 'Test',
        },
        { user: { id: 'staff-001' } },
      ),
    ).rejects.toThrow(BadRequestException);

    await expect(
      controller.adjustTenantStock(
        'ten-alpha-001',
        {
          sku: 'MAT-CAP-NS',
          action: 'ADD',
          quantity: 10,
          reason: '',
        },
        { user: { id: 'staff-001' } },
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('30. Adjust stock tenant isolation: throws NotFoundException for invalid SKU', async () => {
    jest.spyOn<any, any>(service, 'fetchFromAquora').mockResolvedValue(mockInventoryResponse);

    await expect(
      controller.adjustTenantStock(
        'ten-alpha-001',
        {
          sku: 'NON_EXISTENT_SKU_999',
          action: 'ADD',
          quantity: 50,
          reason: 'Attempting invalid item',
        },
        { user: { id: 'staff-001' } },
      ),
    ).rejects.toThrow(NotFoundException);
  });
});
