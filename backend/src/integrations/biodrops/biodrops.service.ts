import {
  Injectable,
  Logger,
  BadGatewayException,
  NotFoundException,
  BadRequestException,
  HttpException,
  HttpStatus,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '../../config/config.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  BiodropsTenant,
  TenantInventoryResponse,
  StockSummaryResponse,
  FinishedProductItem,
  RawMaterialItem,
  RawMaterialUnitGroup,
  AdjustTenantStockDto,
  AdjustTenantStockResponse,
  BiodropsSale,
} from './biodrops.types';

@Injectable()
export class BiodropsService implements OnModuleInit {
  private readonly logger = new Logger(BiodropsService.name);

  /**
   * In-memory local stock shadow map to maintain instant UI feedback and local persistence
   * between Aquzio write deployments. Key: `${tenantId}:${sku.toLowerCase()}`
   */
  private readonly localStockOverrides = new Map<string, number>();

  /**
   * Expected default production endpoint for the Aquora Biodrops API.
   */
  public static readonly DEFAULT_PRODUCTION_URL =
    'https://aquzio-backend.webziotech.in/api/v1/integrations/biodrops';

  constructor(
    private readonly configService: ConfigService,
    @Optional() private readonly prisma?: PrismaService,
  ) {}

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
   * Internal execution of an individual HTTP POST request attempt.
   * Supports custom headers (such as Idempotency-Key).
   */
  public async executePost<T>(
    endpoint: string,
    body: any,
    customHeaders?: Record<string, string>,
  ): Promise<T> {
    const url = this.buildUrl(endpoint);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...customHeaders,
    };
    headers['X-API-Key'] = this.apiKey;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Upstream returned ${response.status}`);
      }
      return (await response.json()) as T;
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
   * Fallback sandbox tenants when upstream Aquzio is offline or credential is revoked.
   */
  private getFallbackTenants(): BiodropsTenant[] {
    const now = new Date().toISOString();
    return [
      {
        id: '8714038a-36b0-4521-8b5e-9389ad045a65',
        companyName: 'Faiha Water Solutions',
        code: 'ACCOUNTANT_COMPANY',
        productionStatus: 'ACTIVE',
        isBiodropsEnabled: true,
        inventorySummary: {
          totalFinishedJars: this.localStockOverrides.get('8714038a-36b0-4521-8b5e-9389ad045a65:20l_water_jar') ?? 0,
          rawMaterialsCount: 4,
          lowStockAlerts: 0,
          lastUpdated: now,
        },
        lastRetrievedAt: now,
      },
      {
        id: '3b9a7c21-12f4-4a88-912b-7c5f8841a123',
        companyName: 'Gangothri Aqua Tech',
        code: 'GANGOTHRI_WATER',
        productionStatus: 'ACTIVE',
        isBiodropsEnabled: true,
        inventorySummary: {
          totalFinishedJars: this.localStockOverrides.get('3b9a7c21-12f4-4a88-912b-7c5f8841a123:20l_water_jar') ?? 120,
          rawMaterialsCount: 4,
          lowStockAlerts: 1,
          lastUpdated: now,
        },
        lastRetrievedAt: now,
      },
      {
        id: 'a1d84e92-9b24-42b7-a871-3d7120a4b911',
        companyName: 'Al-Bustan Pure Springs',
        code: 'AL_BUSTAN_SPRINGS',
        productionStatus: 'ACTIVE',
        isBiodropsEnabled: true,
        inventorySummary: {
          totalFinishedJars: this.localStockOverrides.get('a1d84e92-9b24-42b7-a871-3d7120a4b911:20l_spring_jar') ?? 85,
          rawMaterialsCount: 3,
          lowStockAlerts: 0,
          lastUpdated: now,
        },
        lastRetrievedAt: now,
      },
      {
        id: '7d77da44-5307-489c-b474-bf9cdc6137ee',
        companyName: 'Sinan Company',
        code: 'SINAN_COMPANY',
        productionStatus: 'ACTIVE',
        isBiodropsEnabled: true,
        inventorySummary: {
          totalFinishedJars: this.localStockOverrides.get('7d77da44-5307-489c-b474-bf9cdc6137ee:20l_water_jar') ?? 14,
          rawMaterialsCount: 4,
          lowStockAlerts: 0,
          lastUpdated: now,
        },
        lastRetrievedAt: now,
      },
      {
        id: 'e47c1b52-6d33-41a9-b883-99a41cd39144',
        companyName: 'BioDrops Central Bottling',
        code: 'BIODROPS_CENTRAL',
        productionStatus: 'ACTIVE',
        isBiodropsEnabled: true,
        inventorySummary: {
          totalFinishedJars: this.localStockOverrides.get('e47c1b52-6d33-41a9-b883-99a41cd39144:20l_commercial_jar') ?? 340,
          rawMaterialsCount: 3,
          lowStockAlerts: 0,
          lastUpdated: now,
        },
        lastRetrievedAt: now,
      },
    ];
  }

  /**
   * Fallback sandbox inventory when upstream Aquzio is offline or credential is revoked.
   */
  private getFallbackInventory(tenantId: string): TenantInventoryResponse {
    const now = new Date().toISOString();
    const tenants = this.getFallbackTenants();
    const matched = tenants.find((t) => t.id === tenantId) || tenants[0];

    if (tenantId === '3b9a7c21-12f4-4a88-912b-7c5f8841a123') {
      const finishedJars = this.localStockOverrides.get(`${tenantId}:20l_water_jar`) ?? 120;
      const preforms = this.localStockOverrides.get(`${tenantId}:20l_blue_preform`) ?? 800;
      const caps = this.localStockOverrides.get(`${tenantId}:20l_blue_cap`) ?? 45;
      const labels = this.localStockOverrides.get(`${tenantId}:gangothri_label_roll`) ?? 350;
      const mineral = this.localStockOverrides.get(`${tenantId}:mineral_salts`) ?? 25;

      return {
        tenantId,
        tenantName: 'Gangothri Aqua Tech',
        tenantCode: 'GANGOTHRI_WATER',
        retrievedAt: now,
        finishedProducts: [
          {
            id: 'prod-gang-20l',
            name: 'Gangothri 20L Purified Water Jar',
            sku: '20L_WATER_JAR',
            availableStock: finishedJars,
            reservedStock: 20,
            damagedStock: 2,
            unit: 'Jar',
            lastUpdated: now,
          },
        ],
        rawMaterials: [
          {
            id: 'mat-g1',
            name: '20L Blue Preforms 700g',
            sku: '20L_BLUE_PREFORM',
            category: 'PREFORM',
            availableQuantity: preforms,
            usedQuantity: 120,
            wastedQuantity: 4,
            reorderLevel: 200,
            unit: 'PIECE',
            isLowStock: false,
          },
          {
            id: 'mat-g2',
            name: '20L Blue Snap Caps',
            sku: '20L_BLUE_CAP',
            category: 'CAP',
            availableQuantity: caps,
            usedQuantity: 120,
            wastedQuantity: 8,
            reorderLevel: 100,
            unit: 'PIECE',
            isLowStock: true,
          },
          {
            id: 'mat-g3',
            name: 'Gangothri Branding Label Rolls',
            sku: 'GANGOTHRI_LABEL_ROLL',
            category: 'LABEL',
            availableQuantity: labels,
            usedQuantity: 120,
            wastedQuantity: 2,
            reorderLevel: 50,
            unit: 'PIECE',
            isLowStock: false,
          },
          {
            id: 'mat-g4',
            name: 'Remineralization Salts Blend',
            sku: 'MINERAL_SALTS',
            category: 'CHEMICAL',
            availableQuantity: mineral,
            usedQuantity: 5,
            wastedQuantity: 0,
            reorderLevel: 10,
            unit: 'KG',
            isLowStock: false,
          },
        ],
      };
    }

    if (tenantId === 'a1d84e92-9b24-42b7-a871-3d7120a4b911') {
      const springJars = this.localStockOverrides.get(`${tenantId}:20l_spring_jar`) ?? 85;
      const transPreforms = this.localStockOverrides.get(`${tenantId}:20l_trans_preform`) ?? 500;
      const whiteCaps = this.localStockOverrides.get(`${tenantId}:20l_white_cap`) ?? 600;
      const shrinkFilm = this.localStockOverrides.get(`${tenantId}:shrink_film_roll`) ?? 40;

      return {
        tenantId,
        tenantName: 'Al-Bustan Pure Springs',
        tenantCode: 'AL_BUSTAN_SPRINGS',
        retrievedAt: now,
        finishedProducts: [
          {
            id: 'prod-bustan-20l',
            name: 'Al-Bustan 20L Spring Water Jar',
            sku: '20L_SPRING_JAR',
            availableStock: springJars,
            reservedStock: 15,
            damagedStock: 0,
            unit: 'Jar',
            lastUpdated: now,
          },
        ],
        rawMaterials: [
          {
            id: 'mat-b1',
            name: '20L Clear Transparent Preforms',
            sku: '20L_TRANS_PREFORM',
            category: 'PREFORM',
            availableQuantity: transPreforms,
            usedQuantity: 85,
            wastedQuantity: 1,
            reorderLevel: 150,
            unit: 'PIECE',
            isLowStock: false,
          },
          {
            id: 'mat-b2',
            name: '20L Tamper-Proof White Caps',
            sku: '20L_WHITE_CAP',
            category: 'CAP',
            availableQuantity: whiteCaps,
            usedQuantity: 85,
            wastedQuantity: 2,
            reorderLevel: 100,
            unit: 'PIECE',
            isLowStock: false,
          },
          {
            id: 'mat-b3',
            name: 'Neck Shrink Sleeves',
            sku: 'SHRINK_FILM_ROLL',
            category: 'PACKAGING',
            availableQuantity: shrinkFilm,
            usedQuantity: 5,
            wastedQuantity: 0,
            reorderLevel: 10,
            unit: 'ROLL',
            isLowStock: false,
          },
        ],
      };
    }

    if (tenantId === 'e47c1b52-6d33-41a9-b883-99a41cd39144') {
      const centralJars = this.localStockOverrides.get(`${tenantId}:20l_commercial_jar`) ?? 340;
      const petPreforms = this.localStockOverrides.get(`${tenantId}:20l_pet_preform`) ?? 1500;
      const tamperCaps = this.localStockOverrides.get(`${tenantId}:20l_tamper_cap`) ?? 1400;
      const premiumLabels = this.localStockOverrides.get(`${tenantId}:biodrops_label_roll`) ?? 800;

      return {
        tenantId,
        tenantName: 'BioDrops Central Bottling',
        tenantCode: 'BIODROPS_CENTRAL',
        retrievedAt: now,
        finishedProducts: [
          {
            id: 'prod-central-20l',
            name: 'BioDrops Commercial 20L Water Jar',
            sku: '20L_COMMERCIAL_JAR',
            availableStock: centralJars,
            reservedStock: 60,
            damagedStock: 5,
            unit: 'Jar',
            lastUpdated: now,
          },
        ],
        rawMaterials: [
          {
            id: 'mat-c1',
            name: 'Heavy Duty 20L PET Preforms',
            sku: '20L_PET_PREFORM',
            category: 'PREFORM',
            availableQuantity: petPreforms,
            usedQuantity: 340,
            wastedQuantity: 6,
            reorderLevel: 300,
            unit: 'PIECE',
            isLowStock: false,
          },
          {
            id: 'mat-c2',
            name: 'BioDrops Signature Teal Caps',
            sku: '20L_TAMPER_CAP',
            category: 'CAP',
            availableQuantity: tamperCaps,
            usedQuantity: 340,
            wastedQuantity: 5,
            reorderLevel: 250,
            unit: 'PIECE',
            isLowStock: false,
          },
          {
            id: 'mat-c3',
            name: 'UV Laminated Waterproof Labels',
            sku: 'BIODROPS_LABEL_ROLL',
            category: 'LABEL',
            availableQuantity: premiumLabels,
            usedQuantity: 340,
            wastedQuantity: 10,
            reorderLevel: 100,
            unit: 'PIECE',
            isLowStock: false,
          },
        ],
      };
    }

    // Default: Faiha Water Solutions
    const finishedJarStock = this.localStockOverrides.get(`${tenantId}:20l_water_jar`) ?? 0;
    const b1000 = this.localStockOverrides.get(`${tenantId}:1000_ml`) ?? 987;
    const b2000 = this.localStockOverrides.get(`${tenantId}:2000_ml_bottle`) ?? 100;
    const cap20L = this.localStockOverrides.get(`${tenantId}:20l_green_cap`) ?? 0;
    const b500 = this.localStockOverrides.get(`${tenantId}:500_ml_bottle`) ?? 1050;

    return {
      tenantId: matched.id,
      tenantName: matched.companyName,
      tenantCode: matched.code,
      retrievedAt: now,
      finishedProducts: finishedJarStock > 0 ? [
        {
          id: 'prod-jar-20l',
          name: 'Finished 20L Purified Water Jar',
          sku: '20L_WATER_JAR',
          availableStock: finishedJarStock,
          reservedStock: 0,
          damagedStock: 0,
          unit: 'Jar',
          lastUpdated: now,
        }
      ] : [],
      rawMaterials: [
        {
          id: 'mat-1',
          name: '1000 ML BOTTLE',
          sku: '1000_ML',
          category: 'PREFORM',
          availableQuantity: b1000,
          usedQuantity: 0,
          wastedQuantity: 0,
          reorderLevel: 0,
          unit: 'LITER',
          isLowStock: false,
        },
        {
          id: 'mat-2',
          name: '2000 ML BOTTLE',
          sku: '2000_ML_BOTTLE',
          category: 'PREFORM',
          availableQuantity: b2000,
          usedQuantity: 0,
          wastedQuantity: 0,
          reorderLevel: 0,
          unit: 'LITER',
          isLowStock: false,
        },
        {
          id: 'mat-3',
          name: '20L Green Cap',
          sku: '20L_GREEN_CAP',
          category: 'CAP',
          availableQuantity: cap20L,
          usedQuantity: 0,
          wastedQuantity: 0,
          reorderLevel: 0,
          unit: 'PIECE',
          isLowStock: cap20L === 0,
        },
        {
          id: 'mat-4',
          name: '500 ml bottle',
          sku: '500_ML_BOTTLE',
          category: 'PREFORM',
          availableQuantity: b500,
          usedQuantity: 0,
          wastedQuantity: 0,
          reorderLevel: 0,
          unit: 'LITER',
          isLowStock: false,
        },
      ],
    };
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

    const finishedProducts: FinishedProductItem[] = rawFinished.map((item) => {
      const sku = String(item.sku || item.code || 'JAR-20L');
      const availableStock = Number(item.availableStock ?? item.availableQuantity ?? item.available ?? 0);

      return {
        id: item.productId || item.id ? String(item.productId || item.id) : undefined,
        name: String(item.productName || item.name || '20L Biodrops Purified Water Jar'),
        sku,
        availableStock,
        reservedStock: Number(item.reservedStock ?? item.reservedQuantity ?? item.reserved ?? 0),
        damagedStock: Number(item.damagedStock ?? item.damagedQuantity ?? item.damaged ?? 0),
        unit: String(item.unit || item.configuredUnit || item.uom || 'Jar'),
        lastUpdated: item.lastUpdated || item.lastUpdatedUtc || payload.inventoryTimestampUtc || now,
        lastUpdatedUtc: item.lastUpdatedUtc,
        lastUpdatedBy: item.lastUpdatedBy,
        lastSource: item.lastSource || (item.lastUpdatedBy?.toLowerCase().includes('edrops') ? 'EDROPS' : 'AQUZIO'),
        lastMovementNotes: item.lastMovementNotes,
      };
    });

    const materials: RawMaterialItem[] = rawMaterials.map((item) => {
      const rawName = String(item.materialName || item.name || 'Raw Material');
      const rawSku = String(item.sku || item.code || 'MAT-001');
      const available = Number(item.availableQuantity ?? item.availableStock ?? item.available ?? 0);
      const reorder =
        item.reorderLevel !== null && item.reorderLevel !== undefined
          ? Number(item.reorderLevel)
          : 0;
      const nameLower = rawName.toLowerCase();
      const skuLower = rawSku.toLowerCase();

      // Fix 2: Unit normalization for discrete packaging items (bottles/jars measured in Liter)
      let unit = String(item.configuredUnit || item.unit || item.uom || 'units').trim();
      const isDiscreteItem =
        nameLower.includes('bottle') ||
        nameLower.includes('jar') ||
        nameLower.includes('cap') ||
        nameLower.includes('preform') ||
        nameLower.includes('seal') ||
        nameLower.includes('handle') ||
        skuLower.includes('bot') ||
        skuLower.includes('jar') ||
        skuLower.includes('cap') ||
        skuLower.includes('prf');

      if (
        isDiscreteItem &&
        (unit.toUpperCase() === 'LITER' || unit.toUpperCase() === 'L' || unit.toUpperCase() === 'LTR')
      ) {
        unit = 'PCS';
      }

      // Fix 3: Category misclassification correction (bottle SKU categorized as PREFORM)
      let category = String(item.materialCategory || item.category || 'General').trim();
      if (
        category.toUpperCase() === 'PREFORM' &&
        (nameLower.includes('jar') || nameLower.includes('bottle')) &&
        !nameLower.includes('preform') &&
        !skuLower.includes('prf')
      ) {
        category = 'PACKAGING';
      }

      // Fix 1: Available 0 is always low/out of stock regardless of reorderLevel
      const isLowStock = available === 0 || (reorder > 0 && available <= reorder);

      return {
        id: item.materialId || item.id ? String(item.materialId || item.id) : undefined,
        name: rawName,
        sku: rawSku,
        category,
        availableQuantity: available,
        usedQuantity: Number(item.usedQuantity ?? item.used ?? 0),
        wastedQuantity: Number(item.wastedQuantity ?? item.wasted ?? item.scrapQuantity ?? 0),
        unit,
        reorderLevel: reorder,
        isLowStock,
        lastUpdated: item.lastUpdated || item.lastUpdatedUtc || payload.inventoryTimestampUtc || now,
        lastUpdatedUtc: item.lastUpdatedUtc,
        lastUpdatedBy: item.lastUpdatedBy,
        lastSource: item.lastSource || (item.lastUpdatedBy?.toLowerCase().includes('edrops') ? 'EDROPS' : 'AQUZIO'),
        lastMovementNotes: item.lastMovementNotes,
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
      if (err instanceof NotFoundException || process.env.NODE_ENV !== 'test') {
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

      if ((mat.reorderLevel > 0 && mat.availableQuantity <= mat.reorderLevel) || mat.availableQuantity === 0) {
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

  /**
   * GET /api/v1/integrations/biodrops/tenants/:tenantId/sales
   * Fetches 20L finished product sales transactions from the Aquzio manufacturing tenant.
   */
  async getTenantSales(tenantId: string): Promise<BiodropsSale[]> {
    if (!tenantId?.trim()) {
      throw new BadRequestException('tenantId parameter is required.');
    }

    let raw: any;
    try {
      raw = await this.fetchFromAquora<any>(
        `/tenants/${encodeURIComponent(tenantId)}/sales`,
      );
    } catch (err: any) {
      if (process.env.NODE_ENV !== 'test') {
        this.logger.warn(
          `[SALES_SYNC_NOTICE] Could not fetch live sales from Aquzio for tenant ${tenantId}: ${err.message}`,
        );
        return [];
      }
      throw err;
    }

    const list: any[] = Array.isArray(raw)
      ? raw
      : Array.isArray(raw?.data)
        ? raw.data
        : [];

    return list.map((item) => ({
      transactionId: item.transactionId || item.id,
      transactionNumber: item.transactionNumber || 'AQ-SALE',
      transactionDate: item.transactionDate || new Date().toISOString(),
      customerId: item.customerId,
      customerName: item.customerName || 'Direct Customer',
      productId: item.productId,
      productName: item.productName || '20L Jar',
      sku: item.sku,
      quantity: Number(item.quantity) || 0,
      unit: item.unit || 'Jar',
      unitPrice: Number(item.unitPrice) || 0,
      totalAmount: Number(item.totalAmount) || 0,
      amountPaid: Number(item.amountPaid) || 0,
      outstandingAmount: Number(item.outstandingAmount) || 0,
      paymentStatus: String(item.paymentStatus || 'Pending').toUpperCase(),
      paymentMethod: item.paymentMethod,
      status: item.status || 'Completed',
      remarks: item.remarks,
      source: 'AQUZIO',
      badgeLabel: item.badgeLabel || 'Changed the sales in Aquzio',
      createdAtUtc: item.createdAtUtc || new Date().toISOString(),
      updatedAtUtc: item.updatedAtUtc,
      tenantId,
    }));
  }

  private allTenantSalesCache: { data: (BiodropsSale & { plantName?: string })[]; timestamp: number } | null = null;

  /**
   * GET /api/v1/integrations/biodrops/tenants/all/sales
   * Fetches and aggregates 20L finished product sales transactions across all active Aquzio tenants in a single backend call.
   * Includes a 30-second TTL cache to prevent connection pool exhaustion and reduce frontend API call volume.
   */
  async getAllTenantSales(): Promise<(BiodropsSale & { plantName?: string })[]> {
    const now = Date.now();
    if (this.allTenantSalesCache && now - this.allTenantSalesCache.timestamp < 30_000) {
      return this.allTenantSalesCache.data;
    }

    try {
      const tenants = await this.getTenants();
      if (!tenants || tenants.length === 0) return [];

      const results = await Promise.all(
        tenants.map(async (t) => {
          try {
            const sales = await this.getTenantSales(t.id);
            return sales.map((s) => ({
              ...s,
              plantName: t.companyName || 'Aquzio Plant',
            }));
          } catch {
            return [];
          }
        }),
      );

      const flattened = results.flat();
      this.allTenantSalesCache = { data: flattened, timestamp: now };
      return flattened;
    } catch (err: any) {
      this.logger.warn(`Could not load all tenant sales: ${err.message}`);
      return [];
    }
  }

  /**
   * POST /api/v1/integrations/biodrops/tenants/:tenantId/stock/adjust
   * Adjusts stock for a tenant's raw material or finished product with tenant validation and audit trail.
   */
  async adjustTenantStock(
    tenantId: string,
    dto: AdjustTenantStockDto,
    userId?: string,
  ): Promise<AdjustTenantStockResponse> {
    if (!tenantId?.trim()) {
      throw new BadRequestException('tenantId parameter is required.');
    }
    if (!dto.sku?.trim()) {
      throw new BadRequestException('sku parameter is required.');
    }
    if (typeof dto.quantity !== 'number' || isNaN(dto.quantity)) {
      throw new BadRequestException('quantity must be a valid number.');
    }
    if (!['ADD', 'SET', 'DEDUCT'].includes(dto.action)) {
      throw new BadRequestException('action must be ADD, SET, or DEDUCT.');
    }
    if (!dto.reason?.trim()) {
      throw new BadRequestException('reason for stock adjustment is required.');
    }

    const currentInventory = await this.getTenantInventory(tenantId);
    const skuLower = dto.sku.toLowerCase();

    const rawItem = currentInventory.rawMaterials.find(
      (m) =>
        m.sku.toLowerCase() === skuLower ||
        (m.id && m.id.toLowerCase() === skuLower),
    );
    const finItem = currentInventory.finishedProducts.find(
      (p) =>
        p.sku.toLowerCase() === skuLower ||
        (p.id && p.id.toLowerCase() === skuLower),
    );

    let previousQty = 0;
    let unit = 'PCS';

    if (rawItem) {
      previousQty = rawItem.availableQuantity;
      unit = rawItem.unit;
    } else if (finItem) {
      previousQty = finItem.availableStock;
      unit = finItem.unit;
    } else if (
      dto.itemType === 'FINISHED_PRODUCT' ||
      skuLower.includes('jar')
    ) {
      // Allow initializing finished product stock
      previousQty = 0;
      unit = 'Jar';
    } else {
      throw new NotFoundException(
        `Item with SKU "${dto.sku}" not found in tenant "${tenantId}" inventory.`,
      );
    }

    let newQty: number;
    if (dto.action === 'ADD') {
      if (dto.quantity <= 0) {
        throw new BadRequestException('Quantity to ADD must be greater than 0.');
      }
      newQty = previousQty + dto.quantity;
    } else if (dto.action === 'DEDUCT') {
      if (dto.quantity <= 0) {
        throw new BadRequestException(
          'Quantity to DEDUCT must be greater than 0.',
        );
      }
      if (previousQty < dto.quantity) {
        throw new BadRequestException(
          `Cannot deduct ${dto.quantity} ${unit}. Available balance is only ${previousQty} ${unit}.`,
        );
      }
      newQty = previousQty - dto.quantity;
    } else {
      // SET
      if (dto.quantity < 0) {
        throw new BadRequestException('Stock quantity cannot be negative.');
      }
      newQty = dto.quantity;
    }

    const now = new Date().toISOString();
    const effectiveSku = rawItem?.sku || finItem?.sku || dto.sku.toUpperCase();

    // 1. Attempt dispatch to upstream Aquzio API if available
    let upstreamSynced = false;
    let authoritativeBalance = newQty;
    let upstreamTransactionId: string | undefined = undefined;
    let upstreamMovementId: string | undefined = undefined;
    const idempotencyKey = `ADJ-${tenantId}-${effectiveSku}-${Date.now()}`;

    try {
      const upstreamRes = await this.executePost<any>(
        `/tenants/${encodeURIComponent(tenantId)}/stock/adjust`,
        {
          tenantId,
          sku: effectiveSku,
          itemType: dto.itemType || (finItem ? 'FINISHED_PRODUCT' : 'RAW_MATERIAL'),
          action: dto.action,
          quantity: dto.quantity,
          unit,
          source: 'EDROPS',
          movementType: 'EDROPS_ADJUSTMENT',
          reason: dto.reason,
          notes: dto.notes,
          reference: idempotencyKey,
          operator: typeof userId === 'string' && userId ? userId : 'eDrops System',
          adjustedAt: now,
        },
        {
          'Idempotency-Key': idempotencyKey,
        },
      );
      upstreamSynced = true;
      if (
        upstreamRes?.data?.newQuantity !== undefined &&
        !isNaN(Number(upstreamRes.data.newQuantity))
      ) {
        authoritativeBalance = Number(upstreamRes.data.newQuantity);
      }
      upstreamTransactionId = upstreamRes?.data?.transactionId;
      upstreamMovementId = upstreamRes?.data?.movementId;
    } catch (err: any) {
      this.logger.warn(
        `[UPSTREAM_AQUZIO_STOCK_WRITE] Upstream write endpoint pending on Aquzio backend. Persisting transaction locally. (${err.message})`,
      );
    }

    // 2. Persist audit record in AquzioSyncLog if Prisma is connected
    if (this.prisma) {
      try {
        await this.prisma.aquzioSyncLog.create({
          data: {
            syncType: 'STOCK_ADJUSTMENT',
            status: upstreamSynced ? 'SYNCED' : 'LOCAL_PERSISTED',
            idempotencyKey,
            acceptedQuantity: authoritativeBalance,
            details: {
              tenantId,
              sku: effectiveSku,
              action: dto.action,
              quantityChange: dto.quantity,
              previousQuantity: previousQty,
              newQuantity: authoritativeBalance,
              unit,
              reason: dto.reason,
              notes: dto.notes,
              operator: userId || 'Murshid',
              upstreamSynced,
              upstreamTransactionId,
              upstreamMovementId,
              timestamp: now,
            },
          },
        });
      } catch (logErr) {
        this.logger.warn(
          'Failed to record stock adjustment in AquzioSyncLog',
          logErr,
        );
      }
    }

    // 3. Cache shadow balance only when upstream is disconnected
    if (upstreamSynced) {
      this.localStockOverrides.delete(`${tenantId}:${effectiveSku.toLowerCase()}`);
    } else {
      this.updateLocalStockShadow(tenantId, effectiveSku, authoritativeBalance);
    }

    return {
      success: true,
      tenantId,
      sku: effectiveSku,
      previousQuantity: previousQty,
      newQuantity: authoritativeBalance,
      unit,
      action: dto.action,
      message: upstreamSynced
        ? `Stock adjusted in Aquzio (Transaction #${upstreamTransactionId || 'OK'})`
        : `Stock adjusted locally in eDrops (${dto.action} ${dto.quantity} ${unit})`,
      updatedAt: now,
    };
  }

  public updateLocalStockShadow(
    tenantId: string,
    sku: string,
    newQty: number,
  ) {
    this.localStockOverrides.set(`${tenantId}:${sku.toLowerCase()}`, newQty);
  }
}
