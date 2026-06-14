const { Pool } = require('pg');

const rawUrl = 'postgresql://postgres.nidxohmjrbszhatnosln:EdRoPsEdRoPS2026@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require';
const cleanUrl = rawUrl.replace('?sslmode=require', '');

const pool = new Pool({
  connectionString: cleanUrl,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  try {
    console.log('Connecting to database to create notifications table...');
    
    // Create the table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "notifications" (
          "id" TEXT NOT NULL,
          "orderId" TEXT NOT NULL,
          "type" TEXT NOT NULL,
          "title" TEXT NOT NULL,
          "message" TEXT NOT NULL,
          "isRead" BOOLEAN NOT NULL DEFAULT false,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

          CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
      );
    `);
    console.log('Table created or already exists.');

    // Add the foreign key constraint
    // We catch errors in case the constraint already exists
    try {
      await pool.query(`
        ALTER TABLE "notifications" 
        ADD CONSTRAINT "notifications_orderId_fkey" 
        FOREIGN KEY ("orderId") REFERENCES "Order"("id") 
        ON DELETE CASCADE ON UPDATE CASCADE;
      `);
      console.log('Foreign key added.');
    } catch (fkErr) {
      if (fkErr.code === '42710') {
        console.log('Foreign key already exists.');
      } else {
        console.warn('Foreign key warning:', fkErr.message);
      }
    }

    console.log('Done!');
  } catch (err) {
    console.error('Error creating table:', err);
  } finally {
    await pool.end();
  }
}

run();
