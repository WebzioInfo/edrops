const { Pool } = require('pg');

const rawUrl = 'postgresql://postgres.nidxohmjrbszhatnosln:EdRoPsEdRoPS2026@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require';
const cleanUrl = rawUrl.replace('?sslmode=require', '');

const pool = new Pool({
  connectionString: cleanUrl,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  try {
    console.log('Connecting to database to create order_status_history table...');
    
    // Create the table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "order_status_history" (
          "id" TEXT NOT NULL,
          "orderId" TEXT NOT NULL,
          "previousStatus" TEXT NOT NULL,
          "newStatus" TEXT NOT NULL,
          "changedByUserId" TEXT,
          "reason" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

          CONSTRAINT "order_status_history_pkey" PRIMARY KEY ("id")
      );
    `);
    console.log('Table created or already exists.');

    // Add the foreign key constraints
    try {
      await pool.query(`
        ALTER TABLE "order_status_history" 
        ADD CONSTRAINT "order_status_history_orderId_fkey" 
        FOREIGN KEY ("orderId") REFERENCES "Order"("id") 
        ON DELETE CASCADE ON UPDATE CASCADE;
      `);
      console.log('Foreign key added for Order.');
    } catch (fkErr) {
      if (fkErr.code === '42710') {
        console.log('Foreign key for Order already exists.');
      } else {
        console.warn('Foreign key warning for Order:', fkErr.message);
      }
    }

    try {
      await pool.query(`
        ALTER TABLE "order_status_history" 
        ADD CONSTRAINT "order_status_history_changedByUserId_fkey" 
        FOREIGN KEY ("changedByUserId") REFERENCES "User"("id") 
        ON DELETE SET NULL ON UPDATE CASCADE;
      `);
      console.log('Foreign key added for User.');
    } catch (fkErr) {
      if (fkErr.code === '42710') {
        console.log('Foreign key for User already exists.');
      } else {
        console.warn('Foreign key warning for User:', fkErr.message);
      }
    }

    // Add indexes
    await pool.query(`
      CREATE INDEX IF NOT EXISTS "order_status_history_orderId_idx" ON "order_status_history"("orderId");
      CREATE INDEX IF NOT EXISTS "order_status_history_createdAt_idx" ON "order_status_history"("createdAt");
    `);
    console.log('Indexes added.');

    console.log('Done!');
  } catch (err) {
    console.error('Error creating table:', err);
  } finally {
    await pool.end();
  }
}

run();
