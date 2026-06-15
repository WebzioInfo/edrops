const { Client } = require('pg');
const fs = require('fs');

const envFile = fs.readFileSync('.env', 'utf-8');
const dbUrlLine = envFile.split('\n').find(l => l.startsWith('DATABASE_URL='));
const dbUrl = dbUrlLine ? dbUrlLine.split('=')[1].trim().replace(/^"|"$/g, '') : null;

if (!dbUrl) {
    console.error('DATABASE_URL not found in .env');
    process.exit(1);
}

const client = new Client({ connectionString: dbUrl });

async function run() {
  await client.connect();
  const queries = [
    `ALTER TYPE "TicketStatus" ADD VALUE IF NOT EXISTS 'ASSIGNED';`,
    `ALTER TABLE "SupportTicket" ADD COLUMN IF NOT EXISTS "assignedToId" text;`,
    `ALTER TABLE "SupportTicket" DROP CONSTRAINT IF EXISTS "SupportTicket_assignedToId_fkey";`,
    `ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;`,
    
    `CREATE TABLE IF NOT EXISTS "SupportMessage" (
        "id" TEXT NOT NULL,
        "ticketId" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "message" TEXT NOT NULL,
        "isInternal" BOOLEAN NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "SupportMessage_pkey" PRIMARY KEY ("id")
    );`,
    `ALTER TABLE "SupportMessage" DROP CONSTRAINT IF EXISTS "SupportMessage_ticketId_fkey";`,
    `ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;`,
    `ALTER TABLE "SupportMessage" DROP CONSTRAINT IF EXISTS "SupportMessage_userId_fkey";`,
    `ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;`,
    
    `CREATE TABLE IF NOT EXISTS "SupportAttachment" (
        "id" TEXT NOT NULL,
        "messageId" TEXT NOT NULL,
        "fileUrl" TEXT NOT NULL,
        "fileName" TEXT NOT NULL,
        "fileType" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "SupportAttachment_pkey" PRIMARY KEY ("id")
    );`,
    `ALTER TABLE "SupportAttachment" DROP CONSTRAINT IF EXISTS "SupportAttachment_messageId_fkey";`,
    `ALTER TABLE "SupportAttachment" ADD CONSTRAINT "SupportAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "SupportMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;`,
    
    `CREATE TABLE IF NOT EXISTS "SupportActivityLog" (
        "id" TEXT NOT NULL,
        "ticketId" TEXT NOT NULL,
        "userId" TEXT,
        "action" TEXT NOT NULL,
        "details" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "SupportActivityLog_pkey" PRIMARY KEY ("id")
    );`,
    `ALTER TABLE "SupportActivityLog" DROP CONSTRAINT IF EXISTS "SupportActivityLog_ticketId_fkey";`,
    `ALTER TABLE "SupportActivityLog" ADD CONSTRAINT "SupportActivityLog_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;`,
    `ALTER TABLE "SupportActivityLog" DROP CONSTRAINT IF EXISTS "SupportActivityLog_userId_fkey";`,
    `ALTER TABLE "SupportActivityLog" ADD CONSTRAINT "SupportActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;`
  ];

  for (const q of queries) {
    try {
      await client.query(q);
      console.log('Success:', q.substring(0, 50));
    } catch(e) {
      console.log('Error on:', q.substring(0, 50), e.message);
    }
  }

  await client.end();
}

run();
