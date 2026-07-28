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

async function check() {
  const user = await prisma.user.findFirst({
    where: { email: 'admin@edrops.in' }
  });
  console.log("User found:", user ? "YES" : "NO");
  if (user) {
    console.log("User email:", user.email);
    console.log("User phone:", user.phone);
    const valid = await bcrypt.compare("Production!2026", user.passwordHash);
    console.log("Password valid:", valid);
  } else {
    // try to list all users
    const users = await prisma.user.findMany();
    console.log("All users:", users.map(u => u.email));
  }
}

check().finally(() => prisma.$disconnect());
