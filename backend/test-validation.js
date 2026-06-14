const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

const rawUrl = 'postgresql://postgres.nidxohmjrbszhatnosln:EdRoPsEdRoPS2026@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require';
const cleanUrl = rawUrl.replace('?sslmode=require', '');

const pool = new Pool({
  connectionString: cleanUrl,
  ssl: { rejectUnauthorized: false },
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function run() {
  try {
    console.log('Testing notification creation...');
    
    // 1. Get an existing order ID to avoid foreign key errors
    const order = await prisma.order.findFirst();
    if (!order) {
      console.log('No orders found to use for test.');
      return;
    }

    const notification = await prisma.staffNotification.create({
      data: {
        orderId: order.id,
        type: 'NEW_ORDER',
        title: 'System Validation Test',
        message: 'Validating Prisma schema drift fix.',
      }
    });
    
    console.log('✅ Success! Notification created:', notification);

    // 2. Fetch the notification to verify
    const fetched = await prisma.staffNotification.findUnique({
      where: { id: notification.id }
    });
    console.log('✅ Success! Fetched notification:', fetched.id);

  } catch (err) {
    console.error('❌ Validation failed:', err);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

run();
