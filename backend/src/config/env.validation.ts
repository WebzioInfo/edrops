/**
 * Startup environment validation.
 *
 * Called once during app bootstrap before Nest modules initialise.
 * The process exits immediately with a clear error listing all missing
 * variables: no silent failures, no cryptic downstream errors.
 */

interface EnvSpec {
  key: string;
  description: string;
  required: boolean;
}

const ENV_SPEC: EnvSpec[] = [
  {
    key: 'DATABASE_URL',
    description: 'PostgreSQL connection string',
    required: true,
  },
  {
    key: 'DIRECT_URL',
    description: 'Direct database connection URL for Prisma migrations',
    required: true,
  },
  {
    key: 'JWT_SECRET',
    description: 'JWT signing secret (min 32 chars)',
    required: true,
  },
  { key: 'SMTP_HOST', description: 'SMTP server hostname', required: true },
  { key: 'SMTP_PORT', description: 'SMTP server port', required: true },
  {
    key: 'SMTP_USER',
    description: 'SMTP authentication username',
    required: true,
  },
  {
    key: 'SMTP_PASS',
    description: 'SMTP authentication password',
    required: true,
  },
  {
    key: 'RAZORPAY_KEY_ID',
    description: 'Razorpay API key ID',
    required: true,
  },
  {
    key: 'RAZORPAY_SECRET',
    description: 'Razorpay API secret',
    required: true,
  },
  {
    key: 'RAZORPAY_WEBHOOK_SECRET',
    description: 'Razorpay webhook signing secret',
    required: true,
  },
  {
    key: 'FRONTEND_ORIGIN',
    description: 'Allowed frontend CORS origin(s)',
    required: true,
  },
  {
    key: 'FRONTEND_URL',
    description: 'Public frontend URL for email links',
    required: true,
  },
  {
    key: 'SUPABASE_ANON_KEY',
    description: 'Supabase anonymous API key',
    required: false,
  },
];

const PLACEHOLDER_PATTERNS = [
  /^\[.+\]$/,
  /^CHANGE_ME/i,
  /^your[-_]/i,
  /^<.+>$/,
];

function isPlaceholder(value: string): boolean {
  return PLACEHOLDER_PATTERNS.some((re) => re.test(value.trim()));
}

export function validateEnvironment(): void {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const spec of ENV_SPEC) {
    const value = process.env[spec.key];

    if (!value || value.trim() === '') {
      const message = `${spec.key} - ${spec.description}`;
      if (spec.required) {
        errors.push(`  [required] ${message}`);
      } else {
        warnings.push(`  [optional] ${message} (feature may be unavailable)`);
      }
      continue;
    }

    if (isPlaceholder(value)) {
      const message = `${spec.key} - contains placeholder value`;
      if (spec.required) {
        errors.push(`  [invalid] ${message}`);
      } else {
        warnings.push(`  [optional] ${message}`);
      }
    }
  }

  const dbUrl = process.env.DATABASE_URL ?? '';
  if (
    dbUrl &&
    !dbUrl.includes('sslmode=require') &&
    dbUrl.includes('supabase.co')
  ) {
    warnings.push(
      '  [warning] DATABASE_URL - missing "sslmode=require" for Supabase SSL',
    );
  }

  const jwtSecret = process.env.JWT_SECRET ?? '';
  if (jwtSecret && jwtSecret.length < 32) {
    errors.push(
      `  [invalid] JWT_SECRET - too short (${jwtSecret.length} chars). Minimum 32 characters required.`,
    );
  }

  if (warnings.length > 0) {
    console.warn('\nEnvironment warnings (non-fatal):');
    warnings.forEach((warning) => console.warn(warning));
  }

  if (errors.length > 0) {
    console.error('\nEDROPS STARTUP FAILED - MISSING CONFIGURATION');
    console.error(
      '\nThe following required environment variables are missing or invalid:\n',
    );
    errors.forEach((error) => console.error(error));
    console.error('\nHow to fix:');
    console.error('  1. Open backend/.env');
    console.error(
      '  2. Fill in all variables marked required or invalid above',
    );
    console.error('  3. Restart the application\n');
    process.exit(1);
  }
}
