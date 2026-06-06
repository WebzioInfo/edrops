import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { PrismaService } from './src/prisma/prisma.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const prisma = app.get(PrismaService);

  const res = await prisma.delivery.deleteMany({
    where: { status: 'PENDING' }
  });
  console.log("Deleted pending deliveries:", res.count);

  await app.close();
}
bootstrap();
