// prisma.config.ts — Prisma v7 configuration
//
// Prisma v7 reads connection config from here, NOT schema.prisma.
//
// Two URLs are used:
//   DATABASE_URL  — transaction pooler (port 6543) — used for all Prisma queries
//   DIRECT_URL    — direct DB connection (port 5432) — used only for migrations
//
// SSL note: the `pg` adapter strips sslmode from the URL at runtime and passes
// ssl:{rejectUnauthorized:false} explicitly. The URLs below keep ?sslmode=require
// so Prisma CLI (migrate, db push) can also establish encrypted connections.
//
// See: https://pris.ly/d/config-datasource
import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'npx ts-node prisma/seed.ts',
  },
  datasource: {
    // Use DIRECT_URL for migrations so they bypass the pooler (required by Prisma)
    // Fall back to DATABASE_URL if DIRECT_URL is not set
    url: process.env['DIRECT_URL'] ?? process.env['DATABASE_URL'],
  },
});
