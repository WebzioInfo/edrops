import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as webpush from 'web-push';
import { PrismaService } from '../prisma/prisma.service';
import { SubscribePushDto } from './dto/push-subscription.dto';

export interface WebPushPayload {
  title: string;
  body: string;
  type?: string;
  entityId?: string;
  url?: string;
  notificationId?: string;
  timestamp?: string;
  icon?: string;
  badge?: string;
  image?: string;
  data?: any;
}

@Injectable()
export class WebPushService implements OnModuleInit {
  private readonly logger = new Logger(WebPushService.name);
  private isConfigured = false;
  private vapidPublicKey: string = '';
  private vapidPrivateKey: string = '';
  private vapidSubject: string = '';

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    this.vapidPublicKey =
      process.env.VAPID_PUBLIC_KEY || process.env.PUSH_PUBLIC_KEY || '';
    this.vapidPrivateKey =
      process.env.VAPID_PRIVATE_KEY || process.env.PUSH_PRIVATE_KEY || '';
    this.vapidSubject =
      process.env.VAPID_SUBJECT || 'mailto:support@edrops.in';

    if (this.vapidPublicKey && this.vapidPrivateKey) {
      try {
        webpush.setVapidDetails(
          this.vapidSubject,
          this.vapidPublicKey,
          this.vapidPrivateKey,
        );
        this.isConfigured = true;
        this.logger.log('Web Push initialized with VAPID credentials.');
      } catch (err: any) {
        this.logger.error(`Failed to configure VAPID: ${err.message}`);
      }
    } else {
      this.logger.warn(
        'VAPID keys not configured. Web Push notifications will be disabled.',
      );
    }
  }

  getPublicKey(): { publicKey: string } {
    return {
      publicKey: this.vapidPublicKey,
    };
  }

  async subscribe(userId: string, dto: SubscribePushDto) {
    if (!userId) {
      throw new Error('User ID is required to subscribe to push notifications');
    }

    this.logger.log(`Registering push subscription for user ${userId}`);

    // If an existing subscription with this endpoint exists (even if previously assigned to another user),
    // update it so the current authenticated user owns it exclusively.
    const subscription = await this.prisma.pushSubscription.upsert({
      where: { endpoint: dto.endpoint },
      update: {
        userId,
        p256dh: dto.keys.p256dh,
        auth: dto.keys.auth,
        userAgent: dto.userAgent || null,
        device: dto.device || null,
        isActive: true,
        updatedAt: new Date(),
      },
      create: {
        userId,
        endpoint: dto.endpoint,
        p256dh: dto.keys.p256dh,
        auth: dto.keys.auth,
        userAgent: dto.userAgent || null,
        device: dto.device || null,
        isActive: true,
      },
    });

    return {
      success: true,
      subscriptionId: subscription.id,
      isActive: subscription.isActive,
    };
  }

  async unsubscribe(userId: string, endpoint: string) {
    if (!userId || !endpoint) {
      return { success: false, message: 'Invalid request' };
    }

    this.logger.log(`Unsubscribing push endpoint for user ${userId}`);

    // Deactivate subscriptions matching endpoint and owned by user
    const result = await this.prisma.pushSubscription.updateMany({
      where: {
        userId,
        endpoint,
      },
      data: {
        isActive: false,
      },
    });

    return {
      success: true,
      count: result.count,
    };
  }

  async getStatus(userId: string) {
    if (!userId) {
      return { isSubscribed: false, count: 0 };
    }

    const count = await this.prisma.pushSubscription.count({
      where: {
        userId,
        isActive: true,
      },
    });

    return {
      isSubscribed: count > 0,
      count,
    };
  }

  async sendToUser(userId: string, payload: WebPushPayload): Promise<void> {
    if (!this.isConfigured) {
      this.logger.debug(
        `WebPush is not configured, skipping push for user ${userId}`,
      );
      return;
    }

    if (!userId) return;

    try {
      const subscriptions = await this.prisma.pushSubscription.findMany({
        where: {
          userId,
          isActive: true,
        },
      });

      if (!subscriptions || subscriptions.length === 0) {
        this.logger.debug(
          `No active push subscriptions found for user ${userId}`,
        );
        return;
      }

      const standardizedPayload = {
        title: payload.title,
        body: payload.body,
        type: payload.type || 'SYSTEM',
        entityId: payload.entityId || null,
        url: payload.url || '/',
        notificationId: payload.notificationId || null,
        timestamp: payload.timestamp || new Date().toISOString(),
        icon: payload.icon || '/icon-192.png',
        badge: payload.badge || '/icon-192.png',
        image: payload.image || null,
        data: {
          url: payload.url || '/',
          type: payload.type || 'SYSTEM',
          entityId: payload.entityId || null,
          notificationId: payload.notificationId || null,
          ...payload.data,
        },
      };

      const payloadStr = JSON.stringify(standardizedPayload);

      await Promise.all(
        subscriptions.map(async (sub) => {
          try {
            await webpush.sendNotification(
              {
                endpoint: sub.endpoint,
                keys: {
                  p256dh: sub.p256dh,
                  auth: sub.auth,
                },
              },
              payloadStr,
              {
                TTL: 60 * 60 * 24, // 24 hours
                urgency: 'high',
              },
            );

            // Update lastUsedAt on successful delivery
            await this.prisma.pushSubscription
              .update({
                where: { id: sub.id },
                data: { lastUsedAt: new Date() },
              })
              .catch(() => {});
          } catch (err: any) {
            // Automatically disable expired/invalid subscriptions
            if (err.statusCode === 404 || err.statusCode === 410) {
              this.logger.warn(
                `Push subscription ${sub.id} expired/gone (${err.statusCode}). Marking inactive.`,
              );
              await this.prisma.pushSubscription
                .update({
                  where: { id: sub.id },
                  data: { isActive: false },
                })
                .catch(() => {});
            } else {
              this.logger.error(
                `Failed to deliver push to subscription ${sub.id}: ${err.message}`,
              );
            }
          }
        }),
      );
    } catch (err: any) {
      this.logger.error(
        `Error sending web push to user ${userId}: ${err.message}`,
      );
    }
  }
}
