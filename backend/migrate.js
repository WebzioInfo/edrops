const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "SupportTicket" ADD COLUMN IF NOT EXISTS "category" text, ADD COLUMN IF NOT EXISTS "imageUrl" text, ADD COLUMN IF NOT EXISTS "invoiceUrl" text;`);
    console.log('Columns added');
  } catch(e) { console.log(e); }
  
  try {
    await prisma.$executeRawUnsafe(`ALTER TYPE "TicketStatus" ADD VALUE IF NOT EXISTS 'WAITING_FOR_CUSTOMER';`);
    console.log('Enum updated');
  } catch(e) { console.log(e); }

  await prisma.$disconnect();
}
run();
