const { Pool } = require('pg');

const rawUrl = 'postgresql://postgres.nidxohmjrbszhatnosln:EdRoPsEdRoPS2026@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require';
const cleanUrl = rawUrl.replace('?sslmode=require', '');

const pool = new Pool({
  connectionString: cleanUrl,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  try {
    console.log('Connecting to database to alter notifications table...');
    
    // Add missing columns
    await pool.query(`
      ALTER TABLE "notifications" 
      ADD COLUMN IF NOT EXISTS "companyId" TEXT,
      ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    `);
    console.log('Columns companyId and updatedAt added.');

    // Add missing indexes
    await pool.query(`
      CREATE INDEX IF NOT EXISTS "notifications_companyId_idx" ON "notifications"("companyId");
      CREATE INDEX IF NOT EXISTS "notifications_orderId_idx" ON "notifications"("orderId");
      CREATE INDEX IF NOT EXISTS "notifications_isRead_idx" ON "notifications"("isRead");
      CREATE INDEX IF NOT EXISTS "notifications_createdAt_idx" ON "notifications"("createdAt");
    `);
    console.log('Indexes added.');

    console.log('Done!');
  } catch (err) {
    console.error('Error altering table:', err);
  } finally {
    await pool.end();
  }
}

run();
