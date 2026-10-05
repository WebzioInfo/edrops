import { PrismaService } from '../src/prisma/prisma.service';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import * as dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaService();

async function audit() {
  const users = await prisma.user.findMany({
    select: { id: true, phone: true, email: true, firstName: true, role: true },
  });

  console.log(`Auditing ${users.length} user records...`);

  const normalizedMap = new Map<string, any[]>();
  const invalidList: any[] = [];

  for (const u of users) {
    const raw = u.phone;
    let normalized = '';

    const parsed = parsePhoneNumberFromString(raw, 'IN');
    if (parsed && parsed.isValid()) {
      normalized = parsed.number; // e.g. +919876543210
    } else {
      // Fallback clean
      const digits = raw.replace(/\D/g, '');
      if (digits.length === 10) {
        normalized = `+91${digits}`;
      } else if (digits.length === 12 && digits.startsWith('91')) {
        normalized = `+${digits}`;
      } else {
        invalidList.push({ id: u.id, email: u.email, phone: raw });
        continue;
      }
    }

    if (!normalizedMap.has(normalized)) {
      normalizedMap.set(normalized, []);
    }
    normalizedMap.get(normalized)!.push({ id: u.id, email: u.email, phone: raw, role: u.role });
  }

  console.log(`Unique normalized numbers: ${normalizedMap.size}`);
  console.log(`Invalid numbers: ${invalidList.length}`, invalidList);

  const duplicates = Array.from(normalizedMap.entries()).filter(([_, list]) => list.length > 1);
  console.log(`Duplicate conflicts count: ${duplicates.length}`);
  if (duplicates.length > 0) {
    console.log('Duplicates found:', JSON.stringify(duplicates, null, 2));
  } else {
    console.log('No duplicate phone conflicts found across existing accounts!');
  }

  // Show sample of current phones
  console.log('Sample of existing phones:', users.slice(0, 10).map(u => ({ raw: u.phone, email: u.email })));

  await prisma.$disconnect();
}

audit().catch(console.error);
