import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProductsModule } from './products/products.module';
import { OrdersModule } from './orders/orders.module';
import { RoutesModule } from './routes/routes.module';
import { GodownModule } from './godown/godown.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { WalletModule } from './wallet/wallet.module';
import { DistributorsModule } from './distributors/distributors.module';
import { DeliveryModule } from './delivery/delivery.module';
import { JarsModule } from './jars/jars.module';
import { PaymentsModule } from './payments/payments.module';
import { CrmModule } from './crm/crm.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { SettlementsModule } from './settlements/settlements.module';
import { PromoModule } from './promo/promo.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot({
      ttl: 60,
      limit: 20,
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get('REDIS_HOST', 'localhost'),
          port: config.get('REDIS_PORT', 6379),
        },
      }),
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    ProductsModule,
    OrdersModule,
    RoutesModule,
    GodownModule,
    SubscriptionsModule,
    WalletModule,
    DistributorsModule,
    DeliveryModule,
    JarsModule,
    PaymentsModule,
    CrmModule,
    AnalyticsModule,
    SettlementsModule,
    PromoModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
