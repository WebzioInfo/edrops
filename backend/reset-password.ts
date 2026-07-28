import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL ?? '';
let cleanUrl = connectionString;
try {
  const parsed = new URL(connectionString);
  parsed.searchParams.delete('sslmode');
  cleanUrl = parsed.toString();
} catch {}

const pool = new Pool({ connectionString: cleanUrl, ssl: { rejectUnauthorized: false } });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function resetPassword() {
  const passwordHash = await bcrypt.hash("Production!2026", 10);
  const emails = ['admin@edrops.in', 'staff@edrops.in', 'driver@edrops.in', 'customer@edrops.in'];
  
  for (const email of emails) {
    await prisma.user.updateMany({
      where: { email },
      data: { passwordHash }
    });
    console.log(`Password reset successfully for ${email}`);
  }
}

resetPassword().finally(() => prisma.$disconnect());
