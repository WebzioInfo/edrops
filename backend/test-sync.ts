import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { ScheduleService } from './src/schedule/schedule.service';
import { DeliveryEngine } from './src/engines/delivery.engine';
import { PrismaService } from './src/prisma/prisma.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const prisma = app.get(PrismaService);
  const deliveryEngine = app.get(DeliveryEngine);

  const schedules = await prisma.deliverySchedule.findMany({ include: { rules: true } });
  console.log("Schedules found:", schedules.length);
  
  if (schedules.length > 0) {
    const schedule = schedules[0];
    console.log("Syncing schedule for customer:", schedule.customerId);
    console.log("Rules:", schedule.rules);
    const result = await deliveryEngine.syncCustomerSchedule(schedule.customerId, 8);
    console.log("Sync result:", result);
    
    const futureDeliveries = await prisma.delivery.findMany({
      where: { customerId: schedule.customerId, status: 'PENDING' }
    });
    console.log("Future pending deliveries:", futureDeliveries.length);
    if (futureDeliveries.length > 0) {
      console.log("First delivery:", futureDeliveries[0]);
    }
  }

  await app.close();
}
bootstrap();
