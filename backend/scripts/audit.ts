import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const models = [
    'user', 'role', 'permission', 'customer', 'staff', 'deliveryPartner', 'admin', 'branch',
    'address', 'package', 'packagePurchase', 'deliverySchedule', 'deliveryScheduleRule', 'delivery',
    'deliveryAssignment', 'deliveryReport', 'jarBalance', 'jarDeposit', 'jarOwnership', 'transaction',
    'notification', 'settings', 'auditLog', 'report', 'analyticsSnapshot', 'wallet', 'walletTransaction',
    'payment', 'paymentLog', 'promoCampaign', 'promoCode', 'promoRedemption', 'referralTier', 'referralReward',
    'supportTicket', 'ticketReply', 'customerHealth', 'consumptionForecast', 'inventory', 'inventoryLog'
  ];

  const report: Record<string, number> = {};
  for (const model of models) {
    try {
      const count = await (prisma as any)[model].count();
      report[model] = count;
    } catch (e) {
      report[model] = -1;
    }
  }

  console.log(JSON.stringify(report, null, 2));
}

main().finally(() => prisma.$disconnect());
