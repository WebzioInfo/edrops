import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // 1. Create Admin
  const hashedPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { phone: '9999999999' },
    update: {},
    create: {
      phone: '9999999999',
      name: 'E-Drops Admin',
      password: hashedPassword,
      role: Role.ADMIN,
      email: 'admin@edrops.com',
    },
  });
  console.log(`Admin created/updated: ${admin.phone}`);

  // 2. Create Brands
  const brands = [
    { name: 'Bisleri', description: 'Pure and safe drinking water' },
    { name: 'Aquafina', description: 'Purity Guaranteed' },
    { name: 'E-Drops Local', description: 'Fresh local mountain water' },
  ];

  const brandEntities = [];
  for (const b of brands) {
    const brand = await prisma.brand.upsert({
      where: { name: b.name },
      update: {},
      create: b,
    });
    brandEntities.push(brand);
  }
  console.log(`Created ${brandEntities.length} brands`);

  // 3. Create Products
  const products = [
    {
      name: '20L Jar',
      sku: 'JAR-20L',
      price: 80,
      deposit: 150,
      isJar: true,
      brandName: 'E-Drops Local',
    },
    {
      name: '1L Bottle (Case of 12)',
      sku: 'BOT-1L-C12',
      price: 200,
      deposit: 0,
      isJar: false,
      brandName: 'Bisleri',
    },
    {
      name: '500ml Bottle (Case of 24)',
      sku: 'BOT-500ML-C24',
      price: 240,
      deposit: 0,
      isJar: false,
      brandName: 'Aquafina',
    },
  ];

  for (const p of products) {
    const brand = brandEntities.find((b) => b.name === p.brandName);
    if (brand) {
      const { brandName, ...productData } = p;
      await prisma.product.upsert({
        where: { sku: p.sku },
        update: {},
        create: {
          ...productData,
          brandId: brand.id,
        },
      });
    }
  }
  console.log(`Created ${products.length} products`);

  // 4. Create Routes
  const routes = [
    { name: 'Cochin West', area: 'Fort Kochi', district: 'Ernakulam', pincodes: ['682001', '682002'] },
    { name: 'Cochin East', area: 'Kakkanad', district: 'Ernakulam', pincodes: ['682030', '682037'] },
  ];

  for (const r of routes) {
    await prisma.route.create({
      data: r,
    });
  }
  console.log(`Created ${routes.length} routes`);

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
