import {
  Injectable,
  Logger,
  BadGatewayException,
  NotFoundException,
  BadRequestException,
  HttpException,
  HttpStatus,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '../../config/config.service';
import {
  BiodropsTenant,
  TenantInventoryResponse,
  StockSummaryResponse,
  FinishedProductItem,
  RawMaterialItem,
  RawMaterialUnitGroup,
} from './biodrops.types';

@Injectable()
export class BiodropsService implements OnModuleInit {
  private readonly logger = new Logger(BiodropsService.name);

  /**
   * Expected default production endpoint for the Aquora Biodrops API.
   */
  public static readonly DEFAULT_PRODUCTION_URL =
    'https://aquzio-backend.webziotech.in/api/v1/integrations/biodrops';

  constructor(private readonly configService: ConfigService) { }

  /**
   * Startup configuration validation.
   * Runs during NestJS bootstrap to verify configuration safety without leaking secrets.
   */
  onModuleInit() {
    const isProd =
      process.env.NODE_ENV === 'production' ||
      process.env.VERCEL_ENV === 'production' ||
      process.env.VERCEL === '1' ||
      Boolean(process.env.RAILWAY_ENVIRONMENT);

    const rawUrl = this.configService.get<string>('AQUORA_BIODROPS_API_URL')?.trim();
    const rawKey = this.configService.get<string>('AQUORA_BIODROPS_API_KEY')?.trim();

    if (!rawUrl && !rawKey) {
      this.logger.log('Aquora Biodrops Integration: Unconfigured (optional module idle)');
      return;
    }

    if (rawUrl && !rawKey) {
      this.logger.warn(
        'Aquora Biodrops Integration: AQUORA_BIODROPS_API_URL is configured but AQUORA_BIODROPS_API_KEY is missing.',
      );
    } else if (!rawUrl && rawKey) {
      this.logger.warn(
        'Aquora Biodrops Integration: AQUORA_BIODROPS_API_KEY is configured but AQUORA_BIODROPS_API_URL is missing.',
      );
    } else {
      try {
        const parsed = new URL(rawUrl!);
        if (isProd && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')) {
          this.logger.error(
            '[CONFIG_VALIDATION] Loopback address detected in production for AQUORA_BIODROPS_API_URL.',
          );
        } else {
          this.logger.log(
            `Aquora Biodrops Integration: Ready (Target host: ${parsed.hostname}, Key: Configured)`,
          );
        }
      } catch {
        this.logger.error('[CONFIG_VALIDATION] AQUORA_BIODROPS_API_URL is an invalid URL format.');
      }
    }
  }

  /**
   * Base URL for the Aquora Biodrops API read from ConfigService.
   * In production, protects against accidental loopback address misconfigurations and enforces HTTPS.
   */
  public get baseUrl(): string {
    const raw = (this.configService.get<string>('AQUZIO_BIODROPS_API_URL') || this.configService.get<string>('AQUORA_BIODROPS_API_URL'))?.trim();
    const isProd =
      process.env.NODE_ENV === 'production' ||
      process.env.VERCEL_ENV === 'production' ||
      process.env.VERCEL === '1' ||
      Boolean(process.env.RAILWAY_ENVIRONMENT);

    if (!raw) {
      if (isProd) {
        this.logger.error('[CONFIG_ERROR] AQUORA_BIODROPS_API_URL is missing in production.');
        throw new BadGatewayException(
          'Aquora integration service is not configured. Missing API URL.',
        );
      }
      return BiodropsService.DEFAULT_PRODUCTION_URL;
    }

    const clean = raw.replace(/\/$/, '');

    // In production environments, loopback addresses are unreachable and insecure
    if (isProd) {
      if (clean.includes('localhost') || clean.includes('127.0.0.1')) {
        this.logger.error(
          `[CONFIG_ERROR] Loopback address "${clean}" cannot be used in a production environment.`,
        );
        throw new BadGatewayException(
          'Invalid Aquora configuration: Loopback address is not permitted in production.',
        );
      }
      if (!clean.startsWith('https://')) {
        this.logger.error(
          `[CONFIG_ERROR] Production requires secure HTTPS protocol for Aquora integration.`,
        );
        throw new BadGatewayException(
          'Invalid Aquora configuration: HTTPS protocol is required in production.',
        );
      }
    }

    return clean;
  }

  /**
   * Secret API key read from ConfigService.
   * Sent strictly server-side via X-API-Key header.
   * Never falls back to a hardcoded key.
   */
  public get apiKey(): string {
    const key = (this.configService.get<string>('AQUZIO_BIODROPS_API_KEY') || this.configService.get<string>('AQUORA_BIODROPS_API_KEY'))?.trim();
    if (!key) {
      this.logger.error('[CONFIG_ERROR] AQUORA_BIODROPS_API_KEY is not configured on the backend.');
      throw new BadGatewayException(
        'Aquora integration service is not configured. Missing API key.',
      );
    }
    return key;
  }

  /**
   * Normalizes upstream endpoint URL.
   * Handles bases with or without '/api/v1/integrations/biodrops'.
   */
  public buildUrl(endpoint: string): string {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    let base = this.baseUrl;

    if (!base.includes('/integrations/biodrops')) {
      if (base.endsWith('/api/v1')) {
        base = `${base}/integrations/biodrops`;
      } else {
        base = `${base}/api/v1/integrations/biodrops`;
      }
    }

    return `${base}${cleanEndpoint}`;
  }

  /**
   * Classifies network-level errors to log precise diagnostic reasons without leaking secrets.
   */
  public classifyNetworkError(
    err: any,
    targetUrl: string,
  ): { type: string; message: string; safeClientMessage: string } {
    let hostname = 'unknown-host';
    let pathname = 'unknown-path';
    try {
      const parsed = new URL(targetUrl);
      hostname = parsed.hostname;
      pathname = parsed.pathname;
    } catch {
      // URL parsing failed
    }

    const msg = String(err?.message || '');
    const code = String(err?.code || err?.cause?.code || '');
    const name = String(err?.name || err?.cause?.name || '');

    if (
      name === 'AbortError' ||
      code === 'ETIMEDOUT' ||
      msg.toLowerCase().includes('timeout') ||
      msg.toLowerCase().includes('timed out')
    ) {
      return {
        type: 'CONNECTION_TIMEOUT',
        message: `Connection timed out after 10000ms reaching host "${hostname}" on path "${pathname}".`,
        safeClientMessage:
          'Aquora integration service connection timed out. Upstream server may be slow or overloaded.',
      };
    }

    if (code === 'ECONNREFUSED' || msg.includes('ECONNREFUSED')) {
      return {
        type: 'CONNECTION_REFUSED',
        message: `Connection refused by host "${hostname}" on path "${pathname}". Verify that Aquora backend is running and reachable from this network environment.`,
        safeClientMessage:
          'Unable to connect to Aquora service: Connection refused. Verify that the Aquora server is active and reachable.',
      };
    }

    if (
      code === 'ENOTFOUND' ||
      code === 'EAI_AGAIN' ||
      msg.toLowerCase().includes('enotfound') ||
      msg.toLowerCase().includes('getaddrinfo')
    ) {
      return {
        type: 'DNS_RESOLUTION_FAILURE',
        message: `DNS resolution failed for host "${hostname}" on path "${pathname}". Hostname could not be resolved.`,
        safeClientMessage:
          'Unable to reach Aquora service: DNS hostname resolution failed. Verify AQUORA_BIODROPS_API_URL.',
      };
    }

    if (
      code.startsWith('CERT_') ||
      code.startsWith('ERR_TLS_') ||
      code === 'DEPTH_ZERO_SELF_SIGNED_CERT' ||
      code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' ||
      msg.toLowerCase().includes('tls') ||
      msg.toLowerCase().includes('ssl') ||
      msg.toLowerCase().includes('certificate')
    ) {
      return {
        type: 'TLS_SSL_FAILURE',
        message: `TLS/SSL handshake failure for host "${hostname}" on path "${pathname}": ${msg}`,
        safeClientMessage:
          'TLS/SSL connection failure when connecting to Aquora service. Verify HTTPS certificates.',
      };
    }

    return {
      type: 'NETWORK_FAILURE',
      message: `Network communication failure with host "${hostname}" on path "${pathname}": ${msg || 'fetch failed'} (code: ${code || 'UNKNOWN'})`,
      safeClientMessage:
        'Unable to communicate with Aquora Biodrops integration service. Network failure.',
    };
  }

  /**
   * Internal execution of an individual HTTP request attempt.
   */
  public async executeFetch<T>(endpoint: string): Promise<T> {
    const url = this.buildUrl(endpoint);
    let hostname = 'unknown-host';
    let pathname = 'unknown-path';
    try {
      const parsed = new URL(url);
      hostname = parsed.hostname;
      pathname = parsed.pathname;
    } catch {
      // URL parsing failed
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'eDrops-Backend-Production/1.0',
    };

    // Forward API key via X-API-Key (Aquora hardened auth)
    headers['X-API-Key'] = this.apiKey;

    try {
      this.logger.log(`Dispatching Aquora API request: GET https://${hostname}${pathname}`);
      const response = await fetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });

      if (!response.ok) {
        let errorBody: any = null;
        try {
          errorBody = await response.json();
        } catch {
          // Response body was not JSON
        }

        const upstreamMessage =
          errorBody?.message ||
          (Array.isArray(errorBody?.errors) ? errorBody.errors.join('; ') : null) ||
          errorBody?.error ||
          `HTTP ${response.status}`;

        // 1. HTTP 401 / 403: Invalid or revoked API key
        if (response.status === 401 || response.status === 403) {
          this.logger.error(
            `[HTTP_AUTH_FAILURE] Aquora rejected API key with status ${response.status} from host "${hostname}" on path "${pathname}". Message: ${upstreamMessage}`,
          );
          const authErr = new BadGatewayException(
            'Aquzio integration service authentication failed (formerly Aquora integration service authentication failed). Invalid or revoked API key.',
          );
          (authErr as any).upstreamStatus = response.status;
          throw authErr;
        }

        // 2. HTTP 404: Resource not found
        if (response.status === 404) {
          this.logger.warn(
            `[HTTP_NOT_FOUND] Aquora resource not found from host "${hostname}" on path "${pathname}": ${upstreamMessage}`,
          );
          throw new NotFoundException(
            upstreamMessage || 'Requested tenant or inventory resource not found in Aquora.',
          );
        }

        // 3. HTTP 429: Rate limit exceeded
        if (response.status === 429) {
          this.logger.warn(
            `[HTTP_RATE_LIMITED] Aquora API rate limit exceeded from host "${hostname}" on path "${pathname}". Upstream message: ${upstreamMessage}`,
          );
          throw new HttpException(
            'Aquora integration service rate limit exceeded. Please retry shortly.',
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }

        // 4. HTTP 400: Bad Request
        if (response.status === 400) {
          this.logger.warn(
            `[HTTP_BAD_REQUEST] Aquora rejected request from host "${hostname}" on path "${pathname}": ${upstreamMessage}`,
          );
          throw new BadRequestException(upstreamMessage);
        }

        // 5. HTTP 500 / 5xx: Server Error
        this.logger.error(
          `[HTTP_SERVER_ERROR] Aquora internal server error (${response.status}) from host "${hostname}" on path "${pathname}": ${upstreamMessage}`,
        );
        throw new BadGatewayException(
          `Aquora integration service returned an error (${response.status}).`,
        );
      }

      return (await response.json()) as T;
    } catch (err: any) {
      // Re-throw already handled Nest HTTP exceptions
      if (
        err instanceof BadGatewayException ||
        err instanceof NotFoundException ||
        err instanceof BadRequestException ||
        err instanceof HttpException
      ) {
        throw err;
      }

      const classified = this.classifyNetworkError(err, url);
      this.logger.error(`[${classified.type}] ${classified.message}`);
      throw new BadGatewayException(classified.safeClientMessage);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Internal HTTP proxy helper with single transient retry for network hiccups.
   * Client errors (400, 401, 403, 404, 429) are never retried.
   */
  /**
   * Primary Aquzio HTTP client proxy with transient retry support.
   */
  public async fetchFromAquzio<T>(endpoint: string): Promise<T> {
    let lastError: any = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        return await this.executeFetch<T>(endpoint);
      } catch (err: any) {
        lastError = err;
        // Do not retry client errors (400, 401, 403, 404, 429)
        if (
          err?.upstreamStatus === 401 ||
          err?.upstreamStatus === 403 ||
          err instanceof NotFoundException ||
          err instanceof BadRequestException ||
          (err instanceof HttpException &&
            (err.getStatus() === 401 ||
              err.getStatus() === 403 ||
              err.getStatus() === 429))
        ) {
          throw err;
        }

        if (attempt < 2) {
          this.logger.warn(
            `Aquzio request attempt ${attempt} encountered transient error (${err.message}). Retrying in 500ms...`,
          );
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
    }
    throw lastError;
  }

  /**
   * Backward-compatible alias for existing test suites and internal callers.
   */
  public async fetchFromAquora<T>(endpoint: string): Promise<T> {
    return this.fetchFromAquzio<T>(endpoint);
  }

  private async fetchWithRetryLegacy<T>(endpoint: string): Promise<T> {
    let lastError: any = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        return await this.executeFetch<T>(endpoint);
      } catch (err: any) {
        lastError = err;
        // Do not retry client errors (400, 401, 403, 404, 429)
        if (
          err?.upstreamStatus === 401 ||
          err?.upstreamStatus === 403 ||
          err instanceof NotFoundException ||
          err instanceof BadRequestException ||
          (err instanceof HttpException &&
            (err.getStatus() === 401 ||
              err.getStatus() === 403 ||
              err.getStatus() === 429))
        ) {
          throw err;
        }

        if (attempt < 2) {
          this.logger.warn(
            `Aquora request attempt ${attempt} encountered transient error (${err.message}). Retrying in 500ms...`,
          );
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
    }
    throw lastError;
  }

  /**
   * GET /api/v1/integrations/biodrops/tenants
   * Returns only tenants where Biodrops Production is enabled.
   */
  async getTenants(): Promise<BiodropsTenant[]> {
    const rawResponse = await this.fetchFromAquora<any>('/tenants');

    // Unpack data whether wrapped in { success: true, data: [...] } or bare array
    const list: any[] = Array.isArray(rawResponse)
      ? rawResponse
      : Array.isArray(rawResponse?.data)
        ? rawResponse.data
        : Array.isArray(rawResponse?.tenants)
          ? rawResponse.tenants
          : [];

    const now = new Date().toISOString();

    // Filter to only tenants where Biodrops Production is enabled
    const enabledTenants = list.filter((t) => {
      const prodStatus = String(
        t.productionStatus || t.status || '',
      ).toUpperCase();

      const isEnabledFlag =
        t.isBiodropsProduction === true ||
        t.biodropsEnabled === true ||
        t.isBiodropsEnabled === true ||
        t.biodropsProductionEnabled === true;

      const statusEnabled =
        prodStatus === 'ACTIVE' ||
        prodStatus === 'ENABLED' ||
        prodStatus === 'PRODUCTION_ACTIVE';

      // Explicit disabled flag takes precedence
      if (
        t.isBiodropsProduction === false ||
        t.biodropsEnabled === false ||
        t.isBiodropsEnabled === false ||
        t.biodropsProductionEnabled === false ||
        prodStatus === 'DISABLED' ||
        prodStatus === 'INACTIVE'
      ) {
        return false;
      }

      return isEnabledFlag || statusEnabled;
    });

    return enabledTenants.map((t): BiodropsTenant => {
      const summary = t.inventorySummary || t.summary || {};
      const tenantId = String(t.tenantId || t.id || '');
      const code = String(t.code || t.tenantCode || tenantId).toUpperCase();
      const companyName = String(
        t.companyName || t.displayName || t.name || t.company || 'Unknown Facility',
      );

      return {
        id: tenantId,
        companyName,
        code,
        subdomain: t.subdomain?.trim() ? t.subdomain.trim() : undefined,
        productionStatus: (
          t.productionStatus ||
          t.status ||
          'ACTIVE'
        ).toUpperCase(),
        isBiodropsEnabled: true,
        inventorySummary: {
          totalFinishedJars: Number(
            summary.totalFinishedJars ?? summary.finishedStock ?? 0,
          ),
          rawMaterialsCount: Number(
            summary.rawMaterialsCount ?? summary.materialsCount ?? 0,
          ),
          lowStockAlerts: Number(
            summary.lowStockAlerts ?? summary.alertsCount ?? 0,
          ),
          lastUpdated: summary.lastUpdated || t.createdAtUtc || now,
        },
        lastRetrievedAt: now,
      };
    });
  }

  /**
   * GET /api/v1/integrations/biodrops/tenants/:tenantId/inventory
   * Fetches actual finished products and raw materials for a specific tenant.
   */
  async getTenantInventory(tenantId: string): Promise<TenantInventoryResponse> {
    if (!tenantId?.trim()) {
      throw new BadRequestException('tenantId parameter is required.');
    }

    const rawResponse = await this.fetchFromAquora<any>(
      `/tenants/${encodeURIComponent(tenantId)}/inventory`,
    );

    const payload = rawResponse?.data || rawResponse || {};
    const now = new Date().toISOString();

    // Verify tenant production status if returned
    if (
      payload.productionStatus === 'DISABLED' ||
      payload.isBiodropsEnabled === false ||
      payload.biodropsEnabled === false ||
      payload.isBiodropsProduction === false
    ) {
      throw new BadRequestException(
        `Biodrops Production is currently disabled for tenant "${tenantId}".`,
      );
    }

    const rawFinished: any[] = Array.isArray(payload.finishedProducts)
      ? payload.finishedProducts
      : Array.isArray(payload.finished)
        ? payload.finished
        : [];

    const rawMaterials: any[] = Array.isArray(payload.rawMaterials)
      ? payload.rawMaterials
      : Array.isArray(payload.materials)
        ? payload.materials
        : [];

    const finishedProducts: FinishedProductItem[] = rawFinished.map((item) => ({
      id: item.productId || item.id ? String(item.productId || item.id) : undefined,
      name: String(item.productName || item.name || '20L Biodrops Purified Water Jar'),
      sku: String(item.sku || item.code || 'JAR-20L'),
      availableStock: Number(item.availableStock ?? item.availableQuantity ?? item.available ?? 0),
      reservedStock: Number(item.reservedStock ?? item.reservedQuantity ?? item.reserved ?? 0),
      damagedStock: Number(item.damagedStock ?? item.damagedQuantity ?? item.damaged ?? 0),
      unit: String(item.unit || item.configuredUnit || item.uom || 'Jar'),
      lastUpdated: item.lastUpdated || payload.inventoryTimestampUtc || now,
    }));

    const materials: RawMaterialItem[] = rawMaterials.map((item) => {
      const available = Number(item.availableQuantity ?? item.availableStock ?? item.available ?? 0);
      const reorder =
        item.reorderLevel !== null && item.reorderLevel !== undefined
          ? Number(item.reorderLevel)
          : 0;

      return {
        id: item.materialId || item.id ? String(item.materialId || item.id) : undefined,
        name: String(item.materialName || item.name || 'Raw Material'),
        sku: String(item.sku || item.code || 'MAT-001'),
        category: String(item.materialCategory || item.category || 'General'),
        availableQuantity: available,
        usedQuantity: Number(item.usedQuantity ?? item.used ?? 0),
        wastedQuantity: Number(item.wastedQuantity ?? item.wasted ?? item.scrapQuantity ?? 0),
        unit: String(item.configuredUnit || item.unit || item.uom || 'units'),
        reorderLevel: reorder,
        isLowStock: reorder > 0 ? available <= reorder : false,
        lastUpdated: item.lastUpdated || payload.inventoryTimestampUtc || now,
      };
    });

    return {
      tenantId,
      tenantName: payload.companyName || payload.tenantName,
      tenantCode: payload.tenantCode || payload.code,
      retrievedAt: payload.inventoryTimestampUtc || now,
      finishedProducts,
      rawMaterials: materials,
    };
  }

  /**
   * GET /api/v1/integrations/biodrops/tenants/:tenantId/stock-summary
   * Returns aggregated stock summary with raw materials grouped strictly by dynamic unit.
   * Never combines different units into a single total.
   */
  async getTenantStockSummary(
    tenantId: string,
  ): Promise<StockSummaryResponse> {
    if (!tenantId?.trim()) {
      throw new BadRequestException('tenantId parameter is required.');
    }

    let summaryResponse: any;
    try {
      summaryResponse = await this.fetchFromAquora<any>(
        `/tenants/${encodeURIComponent(tenantId)}/stock-summary`,
      );
    } catch (err) {
      if (err instanceof NotFoundException) {
        // Fallback: If upstream does not have dedicated /stock-summary, compute from /inventory
        const inv = await this.getTenantInventory(tenantId);
        return this.computeStockSummaryFromInventory(inv);
      }
      throw err;
    }

    const payload = summaryResponse?.data || summaryResponse || {};

    // If upstream returns full pre-aggregated summary with finished products and units
    if (payload.finishedProductsSummary && payload.rawMaterialsGroupedByUnit) {
      return {
        ...payload,
        tenantId,
        retrievedAt: payload.inventorySummaryTimestampUtc || new Date().toISOString(),
      };
    }

    // Always compute structured, strictly unit-isolated summary from full inventory
    const inv = await this.getTenantInventory(tenantId);
    const computed = this.computeStockSummaryFromInventory(inv);

    // If upstream provided totalTwentyLStock, ensure finished stock aligns
    if (typeof payload.totalTwentyLStock === 'number') {
      computed.finishedProductsSummary.totalAvailableStock = Math.max(
        computed.finishedProductsSummary.totalAvailableStock,
        payload.totalTwentyLStock,
      );
      computed.finishedProductsSummary.totalStock = Math.max(
        computed.finishedProductsSummary.totalStock,
        payload.totalTwentyLStock,
      );
      if (payload.totalTwentyLUnit) {
        computed.finishedProductsSummary.unit = payload.totalTwentyLUnit;
      }
    }

    return computed;
  }

  /**
   * Pure aggregation helper: strictly groups raw materials by their unit,
   * guaranteeing no two differing units are ever summed together.
   */
  computeStockSummaryFromInventory(
    inventory: TenantInventoryResponse,
  ): StockSummaryResponse {
    const now = inventory.retrievedAt || new Date().toISOString();

    const finished = inventory.finishedProducts;
    const totalAvail = finished.reduce((sum, item) => sum + item.availableStock, 0);
    const totalRes = finished.reduce((sum, item) => sum + item.reservedStock, 0);
    const totalDam = finished.reduce((sum, item) => sum + item.damagedStock, 0);
    const primaryUnit = finished[0]?.unit || 'Jar';

    // Group raw materials strictly by unit
    const unitMap = new Map<string, RawMaterialUnitGroup>();
    const lowStockAlerts: Array<{
      name: string;
      sku: string;
      category: string;
      availableQuantity: number;
      reorderLevel: number;
      unit: string;
      deficit: number;
    }> = [];

    for (const mat of inventory.rawMaterials) {
      const unitKey = mat.unit.trim().toLowerCase();
      const displayUnit = mat.unit.trim();

      if (!unitMap.has(unitKey)) {
        unitMap.set(unitKey, {
          unit: displayUnit,
          totalAvailable: 0,
          totalUsed: 0,
          totalWasted: 0,
          itemCount: 0,
          lowStockCount: 0,
          items: [],
        });
      }

      const group = unitMap.get(unitKey)!;
      group.totalAvailable += mat.availableQuantity;
      group.totalUsed += mat.usedQuantity;
      group.totalWasted += mat.wastedQuantity;
      group.itemCount += 1;
      group.items.push(mat);

      if (mat.reorderLevel > 0 && mat.availableQuantity <= mat.reorderLevel) {
        group.lowStockCount += 1;
        lowStockAlerts.push({
          name: mat.name,
          sku: mat.sku,
          category: mat.category,
          availableQuantity: mat.availableQuantity,
          reorderLevel: mat.reorderLevel,
          unit: mat.unit,
          deficit: Math.max(0, mat.reorderLevel - mat.availableQuantity),
        });
      }
    }

    return {
      tenantId: inventory.tenantId,
      tenantName: inventory.tenantName,
      tenantCode: inventory.tenantCode,
      retrievedAt: now,
      finishedProductsSummary: {
        totalAvailableStock: totalAvail,
        totalReservedStock: totalRes,
        totalDamagedStock: totalDam,
        totalStock: totalAvail + totalRes + totalDam,
        unit: primaryUnit,
        items: finished,
      },
      rawMaterialsGroupedByUnit: Array.from(unitMap.values()),
      individualMaterialBalances: inventory.rawMaterials,
      lowStockAlerts,
    };
  }
}
