import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { EnginesModule } from './engines/engines.module';
import { AuthModule } from './auth/auth.module';
import { CustomerModule } from './customer/customer.module';
import { StaffModule } from './staff/staff.module';
import { AdminModule } from './admin/admin.module';
import { ScheduleModule } from './schedule/schedule.module';
import { DeliveryModule } from './delivery/delivery.module';
import { RechargeModule } from './recharge/recharge.module';
import { NotificationModule } from './notification/notification.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { ReportModule } from './report/report.module';
import { SettingsModule } from './settings/settings.module';
import { AuditModule } from './audit/audit.module';
import { RoleModule } from './role/role.module';
import { PermissionModule } from './permission/permission.module';
import { BranchModule } from './branch/branch.module';
import { HealthModule } from './health/health.module';
import { WalletModule } from './wallet/wallet.module';
import { PaymentModule } from './payment/payment.module';
import { PromoModule } from './promo/promo.module';
import { MailModule } from './mail/mail.module';
import { InventoryModule } from './inventory/inventory.module';
import { CatalogModule } from './catalog/catalog.module';
import { WarehouseModule } from './warehouse/warehouse.module';
import { OrderModule } from './order/order.module';
import { WebhookModule } from './webhook/webhook.module';
import { CheckoutModule } from './checkout/checkout.module';
import { CartModule } from './cart/cart.module';
import { SupportModule } from './support/support.module';
import { AddressModule } from './address/address.module';

@Module({
  imports: [
    PrismaModule,
    EnginesModule,
    AuthModule,
    CustomerModule,
    StaffModule,
    AdminModule,
    ScheduleModule,
    DeliveryModule,
    RechargeModule,
    NotificationModule,
    AnalyticsModule,
    ReportModule,
    SettingsModule,
    AuditModule,
    RoleModule,
    PermissionModule,
    BranchModule,
    HealthModule,
    WalletModule,
    PaymentModule,
    PromoModule,
    MailModule,
    InventoryModule,
    CatalogModule,
    WarehouseModule,
    OrderModule,
    WebhookModule,
    CheckoutModule,
    CartModule,
    SupportModule,
    AddressModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
