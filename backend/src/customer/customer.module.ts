import { Module } from '@nestjs/common';
import { CustomerService } from './customer.service';
import { CustomerController } from './customer.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationModule } from '../notification/notification.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [PrismaModule, NotificationModule, MailModule],
  controllers: [CustomerController],
  providers: [CustomerService],
})
export class CustomerModule {}
