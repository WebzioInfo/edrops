import { Injectable, Logger } from '@nestjs/common';
import {
  INotificationProvider,
  NotificationPayload,
  NotificationChannel,
} from './interfaces/notification-provider.interface';

@Injectable()
export class NotificationDispatcher {
  private readonly logger = new Logger(NotificationDispatcher.name);
  private providers: Map<NotificationChannel, INotificationProvider> =
    new Map();

  registerProvider(provider: INotificationProvider) {
    this.providers.set(provider.channel, provider);
    this.logger.log(`Registered notification provider: ${provider.channel}`);
  }

  /**
   * Dispatches the notification payload to all requested channels asynchronously.
   * Uses setImmediate to prevent blocking the main request thread, simulating queue behavior.
   * Failures inside providers are caught and logged to prevent application crashes.
   */
  dispatch(payload: NotificationPayload): void {
    setImmediate(async () => {
      for (const channel of payload.channels) {
        const provider = this.providers.get(channel);
        if (provider) {
          try {
            const start = Date.now();
            await provider.send(payload);
            this.logger.log(
              `[${channel}] Successfully sent notification for event ${payload.type} (Duration: ${Date.now() - start}ms)`,
            );
          } catch (error: any) {
            // NEVER throw errors from the dispatcher to avoid crashing the main thread
            this.logger.error(
              `[${channel}] Failed to send notification for event ${payload.type}: ${error.message}`,
              error.stack,
            );
          }
        } else {
          this.logger.warn(`No provider registered for channel: ${channel}`);
        }
      }
    });
  }
}
