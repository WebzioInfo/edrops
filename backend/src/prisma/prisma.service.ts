import { Injectable, Logger, OnModuleInit, INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { URL } from 'url';

export enum DbConnectionStatus {
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  AUTHENTICATION_FAILED = 'authentication_failed',
  MIGRATION_PENDING = 'migration_pending',
  UNKNOWN = 'unknown',
}

export interface DbHealth {
  status: DbConnectionStatus;
  host: string;
  port: number | null;
  pooler: boolean;
  sslEnabled: boolean;
  latencyMs: number | null;
  error: string | null;
  checkedAt: string;
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name);
  private _dbHost: string = 'unknown';
  private _dbPort: number | null = null;
  private _isPooler: boolean = false;
  private _sslEnabled: boolean = false;

  constructor() {
    const rawUrl = process.env.DATABASE_URL ?? '';

    // -------------------------------------------------------------------------
    // SSL / TLS fix for Supabase + pg v8 + Node.js 20+
    //
    // Problem: pg v8 parses `sslmode=require` from the connection string and
    //          internally maps it to `verify-full` (full certificate chain
    //          validation). Supabase's pooler uses a self-signed certificate
    //          chain, so this causes:
    //            "Error: self-signed certificate in certificate chain"
    //
    // Fix:     Strip `sslmode` from the connection string entirely, then pass
    //          `ssl: { rejectUnauthorized: false }` explicitly to pg.Pool.
    //          This encrypts the connection (TLS is ON) but skips CA chain
    //          verification — the correct mode for Supabase poolers.
    //
    // Reference: https://supabase.com/docs/guides/database/connecting-to-postgres
    //            https://node-postgres.com/features/ssl
    // -------------------------------------------------------------------------
    let cleanUrl = rawUrl;
    let sslEnabled = false;

    try {
      const parsed = new URL(rawUrl);
      // Remove sslmode from query params so pg doesn't override our ssl object
      parsed.searchParams.delete('sslmode');
      cleanUrl = parsed.toString();
      sslEnabled = true; // We always use SSL explicitly via the ssl object below
    } catch {
      // Malformed URL — let it fail at connect time with a clear error
    }

    // pg.Pool with explicit SSL config (encrypts, no CA verification)
    const pool = new Pool({
      connectionString: cleanUrl,
      ssl: sslEnabled ? { rejectUnauthorized: false } : false,
    });

    const adapter = new PrismaPg(pool);
    super({ adapter });

    // Extract metadata for logging and health checks
    try {
      const parsed = new URL(rawUrl);
      this._dbHost = parsed.hostname;
      this._dbPort = parsed.port ? parseInt(parsed.port, 10) : 5432;
      // Supabase transaction pooler runs on 6543, session pooler on 5432
      this._isPooler = parsed.port === '6543' || parsed.hostname.includes('pooler');
      this._sslEnabled = sslEnabled;
    } catch {
      this._dbHost = 'invalid-url';
    }
  }

  get dbHost(): string {
    return this._dbHost;
  }

  async onModuleInit(): Promise<void> {
    const mode = this._isPooler ? 'pooler' : 'direct';
    const sslStatus = this._sslEnabled ? 'SSL=on (rejectUnauthorized=false)' : 'SSL=off';
    this.logger.log(`Connecting to database at ${this._dbHost}:${this._dbPort} [${mode}] [${sslStatus}]...`);

    const start = Date.now();

    try {
      await this.$connect();
      const latency = Date.now() - start;
      this.logger.log(
        `✅ Database connected (${this._dbHost}) — mode: ${mode} | ${sslStatus} | latency: ${latency}ms`,
      );
    } catch (error: unknown) {
      const status = this.classifyError(error);

      if (status === DbConnectionStatus.AUTHENTICATION_FAILED) {
        this.logger.error('╔═════════════════════════════════════════════════════════════╗');
        this.logger.error('║       DATABASE AUTHENTICATION FAILED — APP CANNOT START     ║');
        this.logger.error('╚═════════════════════════════════════════════════════════════╝');
        this.logger.error(`Host:  ${this._dbHost}:${this._dbPort} [${mode}]`);
        this.logger.error('Cause: Wrong password, revoked credentials, or invalid user.');
        this.logger.error('Fix:');
        this.logger.error('  1. Open backend/.env');
        this.logger.error('  2. Correct DATABASE_URL (password in the URL)');
        this.logger.error(
          '  3. Get the real password from: https://supabase.com/dashboard/project/_/settings/database',
        );
        this.logger.error(`Raw error: ${(error as Error).message}`);
        process.exit(1);
      } else if (status === DbConnectionStatus.DISCONNECTED) {
        this.logger.error(`❌ Cannot reach database at ${this._dbHost}:${this._dbPort}`);
        this.logger.error('Cause: Network unreachable, wrong host, or Supabase project paused.');
        this.logger.error(`Raw error: ${(error as Error).message}`);
        // Non-fatal — health checks will reflect the failure
      } else {
        this.logger.error(`❌ Database connection failed: ${(error as Error).message}`);
      }
    }
  }

  /** Classify a pg/Prisma connection error into a DbConnectionStatus. */
  classifyError(error: unknown): DbConnectionStatus {
    const msg = (error as Error)?.message ?? '';
    const cause = String((error as { cause?: unknown })?.cause ?? '');
    const aggregateMessages = (error as { errors?: Error[] })?.errors?.map((e) => e.message).join(' ') ?? '';
    const full = [msg, cause, aggregateMessages].join(' ');

    // Authentication failures
    if (
      full.includes('AuthenticationFailed') ||
      full.includes('authentication failed') ||
      full.includes('password authentication failed') ||
      full.includes('P1000')
    ) {
      return DbConnectionStatus.AUTHENTICATION_FAILED;
    }

    // Network / unreachable
    if (
      full.includes('ENOTFOUND') ||
      full.includes('ECONNREFUSED') ||
      full.includes('ETIMEDOUT') ||
      full.includes('P1001') ||
      full.includes('P1002')
    ) {
      return DbConnectionStatus.DISCONNECTED;
    }

    return DbConnectionStatus.UNKNOWN;
  }

  /** Run a lightweight health check and return structured DbHealth. */
  async checkHealth(): Promise<DbHealth> {
    const base: Omit<DbHealth, 'status' | 'latencyMs' | 'error'> = {
      host: this._dbHost,
      port: this._dbPort,
      pooler: this._isPooler,
      sslEnabled: this._sslEnabled,
      checkedAt: new Date().toISOString(),
    };

    const start = Date.now();
    try {
      await this.$queryRaw`SELECT 1`;
      const latencyMs = Date.now() - start;

      // Check for pending migrations
      let migrationStatus = DbConnectionStatus.CONNECTED;
      try {
        const pending = await this.$queryRaw<{ count: bigint }[]>`
          SELECT COUNT(*) AS count
          FROM _prisma_migrations
          WHERE finished_at IS NULL
            AND rolled_back_at IS NULL
        `;
        const pendingCount = Number(pending[0]?.count ?? 0);
        if (pendingCount > 0) {
          migrationStatus = DbConnectionStatus.MIGRATION_PENDING;
        }
      } catch {
        // _prisma_migrations table may not exist yet — not an error
      }

      return { ...base, status: migrationStatus, latencyMs, error: null };
    } catch (error: unknown) {
      const msg = (error as Error).message;
      const aggregated =
        (error as { errors?: Error[] })?.errors?.map((e) => e.message).join('; ') ?? msg;
      return {
        ...base,
        status: this.classifyError(error),
        latencyMs: null,
        error: aggregated || msg,
      };
    }
  }

  async enableShutdownHooks(app: INestApplication): Promise<void> {
    this.$on('beforeExit' as never, async () => {
      await app.close();
    });
  }
}
