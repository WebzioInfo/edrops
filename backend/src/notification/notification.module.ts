import { Module, OnModuleInit } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { StaffNotificationService } from './staff-notification.service';
import { StaffNotificationController } from './staff-notification.controller';
import { NotificationDispatcher } from './notification.dispatcher';
import { SlackProvider } from './providers/slack.provider';
import { SocketProvider } from './providers/socket.provider';
import { DatabaseProvider } from './providers/database.provider';
import { EmailProvider } from './providers/email.provider';
import { PushProvider } from './providers/push.provider';
import { WhatsAppProvider } from './providers/whatsapp.provider';
import { EventsModule } from '../events/events.module';
// The project already uses @nestjs-modules/mailer somewhere, but if not we can dynamically inject MailerService.
// Since it's in package.json, we assume MailerModule is imported in AppModule.

@Module({
  imports: [PrismaModule, EventsModule],
  controllers: [NotificationController, StaffNotificationController],
  providers: [
    NotificationService, 
    StaffNotificationService,
    NotificationDispatcher,
    SlackProvider,
    SocketProvider,
    DatabaseProvider,
    EmailProvider,
    PushProvider,
    WhatsAppProvider
  ],
  exports: [NotificationService, StaffNotificationService], // Exported for use in other modules
})
export class NotificationModule implements OnModuleInit {
  constructor(
    private readonly dispatcher: NotificationDispatcher,
    private readonly slackProvider: SlackProvider,
    private readonly socketProvider: SocketProvider,
    private readonly databaseProvider: DatabaseProvider,
    private readonly emailProvider: EmailProvider,
    private readonly pushProvider: PushProvider,
    private readonly whatsappProvider: WhatsAppProvider,
  ) {}

  onModuleInit() {
    this.dispatcher.registerProvider(this.slackProvider);
    this.dispatcher.registerProvider(this.socketProvider);
    this.dispatcher.registerProvider(this.databaseProvider);
    this.dispatcher.registerProvider(this.emailProvider);
    this.dispatcher.registerProvider(this.pushProvider);
    this.dispatcher.registerProvider(this.whatsappProvider);
  }
}
