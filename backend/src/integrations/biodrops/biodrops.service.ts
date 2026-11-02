import {
  Injectable,
  Logger,
  BadGatewayException,
  NotFoundException,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import {
  BiodropsTenant,
  TenantInventoryResponse,
  StockSummaryResponse,
  FinishedProductItem,
  RawMaterialItem,
  RawMaterialUnitGroup,
} from './biodrops.types';

@Injectable()
export class BiodropsService {
  private readonly logger = new Logger(BiodropsService.name);

  /**
   * Base URL for the Aquora Biodrops API from environment configuration.
   */
  private get baseUrl(): string {
    return (
      process.env.AQUORA_BIODROPS_API_URL?.trim().replace(/\/$/, '') ||
      'http://127.0.0.1:5000/api/v1/integrations/biodrops'
    );
  }

  /**
   * Secret API key sent strictly server-side via X-API-Key header.
   */
  private get apiKey(): string {
    return process.env.AQUORA_BIODROPS_API_KEY?.trim() || '';
  }

  /**
   * Normalizes upstream endpoint URL.
   * Supports base URLs with or without '/api/v1/integrations/biodrops'.
   */
  private buildUrl(endpoint: string): string {
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
   * Classifies network-level errors to log precise diagnostic reasons.
   */
  private classifyNetworkError(
    err: any,
    sanitizedUrl: string,
  ): { type: string; message: string; safeClientMessage: string } {
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
        message: `Connection timed out after 10000ms while reaching Aquora API at ${sanitizedUrl}.`,
        safeClientMessage:
          'Aquora integration service connection timed out. Upstream server may be slow or overloaded.',
      };
    }

    if (code === 'ECONNREFUSED' || msg.includes('ECONNREFUSED')) {
      return {
        type: 'CONNECTION_REFUSED',
        message: `Connection refused at ${sanitizedUrl}. Ensure Aquora backend is running and listening on the configured address/port.`,
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
        message: `DNS resolution failed for ${sanitizedUrl}. Hostname could not be resolved.`,
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
        message: `TLS/SSL handshake failure for ${sanitizedUrl}: ${msg}`,
        safeClientMessage:
          'TLS/SSL connection failure when connecting to Aquora service. Verify HTTPS certificates.',
      };
    }

    return {
      type: 'NETWORK_FAILURE',
      message: `Network communication failure with Aquora API at ${sanitizedUrl}: ${msg || 'fetch failed'} (code: ${code || 'UNKNOWN'})`,
      safeClientMessage:
        'Unable to communicate with Aquora Biodrops integration service. Network failure.',
    };
  }

  /**
   * Internal HTTP proxy helper to connect securely to Aquora Biodrops API.
   * Sends X-API-Key server-side, logs diagnostics, and enforces timeouts.
   */
  private async fetchFromAquora<T>(endpoint: string): Promise<T> {
    const url = this.buildUrl(endpoint);
    const sanitizedUrl = url.split('?')[0];

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'eDrops-Backend-Integration/1.0',
    };

    if (this.apiKey) {
      headers['X-API-Key'] = this.apiKey;
    }

    try {
      this.logger.log(`Dispatching Aquora API request: GET ${sanitizedUrl}`);
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
            `[HTTP_AUTH_FAILURE] Aquora rejected API key with status ${response.status} at ${sanitizedUrl}. Message: ${upstreamMessage}`,
          );
          throw new BadGatewayException(
            'Aquora integration service authentication failed. Invalid or revoked API key.',
          );
        }

        // 2. HTTP 404: Resource not found
        if (response.status === 404) {
          this.logger.warn(
            `[HTTP_NOT_FOUND] Aquora resource not found at ${sanitizedUrl}: ${upstreamMessage}`,
          );
          throw new NotFoundException(
            upstreamMessage || 'Requested tenant or inventory resource not found in Aquora.',
          );
        }

        // 3. HTTP 429: Rate limit exceeded
        if (response.status === 429) {
          this.logger.warn(
            `[HTTP_RATE_LIMITED] Aquora API rate limit exceeded at ${sanitizedUrl}. Upstream message: ${upstreamMessage}`,
          );
          throw new HttpException(
            'Aquora integration service rate limit exceeded. Please retry shortly.',
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }

        // 4. HTTP 400: Bad Request
        if (response.status === 400) {
          this.logger.warn(
            `[HTTP_BAD_REQUEST] Aquora rejected request at ${sanitizedUrl}: ${upstreamMessage}`,
          );
          throw new BadRequestException(upstreamMessage);
        }

        // 5. HTTP 500 / 5xx: Server Error
        this.logger.error(
          `[HTTP_SERVER_ERROR] Aquora internal server error (${response.status}) at ${sanitizedUrl}: ${upstreamMessage}`,
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

      const classified = this.classifyNetworkError(err, sanitizedUrl);
      this.logger.error(`[${classified.type}] ${classified.message}`);
      throw new BadGatewayException(classified.safeClientMessage);
    } finally {
      clearTimeout(timeoutId);
    }
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
      const reorder = item.reorderLevel !== null && item.reorderLevel !== undefined
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
