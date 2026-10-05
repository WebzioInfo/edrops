import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

let cleanUrl = process.env.DATABASE_URL ?? '';
try {
  const parsed = new URL(cleanUrl);
  parsed.searchParams.delete('sslmode');
  cleanUrl = parsed.toString();
} catch {}

const pool = new Pool({ connectionString: cleanUrl, ssl: { rejectUnauthorized: false } });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  try {
    const logs = await prisma.inventoryLog.findMany({
      orderBy: { sequence: 'desc' },
      take: 10,
    });

    console.log(`Found ${logs.length} recent inventory logs:`);
    for (const log of logs) {
      console.log({
        sequence: log.sequence,
        action: log.action,
        fromState: log.fromState,
        toState: log.toState,
        quantity: log.quantity,
        balanceAfter: log.balanceAfter,
        referenceId: log.referenceId,
        description: log.description,
        createdAt: log.createdAt.toISOString(),
      });
    }

    const items = await prisma.jarInventoryItem.findMany();
    console.log('\nJar Inventory Items:', items.map((i: any) => ({
      id: i.id,
      name: i.name,
      ownershipType: i.ownershipType,
      ownedQuantity: i.ownedQuantity,
      filledYardQuantity: i.filledYardQuantity,
      emptyYardQuantity: i.emptyYardQuantity,
      customerQuantity: i.customerQuantity,
    })));
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch(console.error);
