import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PrismaService, DbConnectionStatus } from '../prisma/prisma.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  getStatus() {
    return {
      status: 'ok',
      service: 'edrops-backend',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('database')
  @ApiOperation({ summary: 'Check database connection health' })
  @ApiResponse({
    status: 200,
    description:
      'Database is connected (or connected with pending migrations).',
    schema: {
      example: {
        status: 'healthy',
        database: 'connected',
        host: 'aws-1-ap-southeast-1.pooler.supabase.com',
        port: 6543,
        pooler: true,
        sslEnabled: true,
        latencyMs: 75,
        migrations: 'up_to_date',
        checkedAt: '2026-05-31T08:00:00.000Z',
      },
    },
  })
  @ApiResponse({
    status: 503,
    description:
      'Database authentication failed, disconnected, or other error.',
    schema: {
      example: {
        status: 'error',
        database: 'authentication_failed',
        host: 'aws-1-ap-southeast-1.pooler.supabase.com',
        port: 6543,
        pooler: true,
        sslEnabled: true,
        latencyMs: null,
        reason: 'password authentication failed for user "postgres.xxx"',
        checkedAt: '2026-05-31T08:00:00.000Z',
      },
    },
  })
  async checkDatabase() {
    const health = await this.prisma.checkHealth();

    const meta = {
      host: health.host,
      port: health.port,
      pooler: health.pooler,
      sslEnabled: health.sslEnabled,
      latencyMs: health.latencyMs,
      checkedAt: health.checkedAt,
    };

    switch (health.status) {
      case DbConnectionStatus.CONNECTED:
        return {
          status: 'healthy',
          database: 'connected',
          migrations: 'up_to_date',
          ...meta,
        };

      case DbConnectionStatus.MIGRATION_PENDING:
        // Connected but has unapplied migrations — degraded, not failed
        return {
          status: 'degraded',
          database: 'connected',
          migrations: 'pending',
          ...meta,
        };

      case DbConnectionStatus.AUTHENTICATION_FAILED:
        throw new HttpException(
          {
            status: 'error',
            database: 'authentication_failed',
            reason:
              health.error ?? 'Database credentials are invalid or missing.',
            fix: 'Check DATABASE_URL in backend/.env — verify host, user, and password match your Supabase project.',
            ...meta,
          },
          HttpStatus.SERVICE_UNAVAILABLE,
        );

      case DbConnectionStatus.DISCONNECTED:
        throw new HttpException(
          {
            status: 'error',
            database: 'disconnected',
            reason: health.error ?? 'Cannot reach database host.',
            fix: 'Check that the database host is correct and reachable. Verify the Supabase project is not paused.',
            ...meta,
          },
          HttpStatus.SERVICE_UNAVAILABLE,
        );

      default:
        throw new HttpException(
          {
            status: 'error',
            database: 'unknown',
            reason: health.error ?? 'An unknown database error occurred.',
            ...meta,
          },
          HttpStatus.SERVICE_UNAVAILABLE,
        );
    }
  }
}
