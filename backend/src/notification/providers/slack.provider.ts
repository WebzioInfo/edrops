import { Injectable, Logger } from '@nestjs/common';
import { INotificationProvider, NotificationChannel, NotificationPayload } from '../interfaces/notification-provider.interface';

@Injectable()
export class SlackProvider implements INotificationProvider {
  channel = NotificationChannel.SLACK;
  private readonly logger = new Logger(SlackProvider.name);
  private webhookUrl: string | undefined;

  constructor() {
    this.webhookUrl = process.env.SLACK_WEBHOOK_URL;
  }

  async send(payload: NotificationPayload): Promise<void> {
    if (!this.webhookUrl) {
      this.logger.warn('SLACK_WEBHOOK_URL not configured. Skipping Slack notification.');
      return;
    }

    const blocks = this.buildBlockKit(payload);

    const response = await fetch(this.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blocks }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Slack API error: ${response.status} ${errorText}`);
    }
  }

  private buildBlockKit(payload: NotificationPayload) {
    const blocks: any[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: payload.title,
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: payload.message,
        },
      },
    ];

    if (payload.data) {
      const fields: any[] = [];
      for (const [key, value] of Object.entries(payload.data)) {
        if (value !== undefined && value !== null && typeof value !== 'object') {
          fields.push({
            type: 'mrkdwn',
            text: `*${key}:*\n${value}`,
          });
        }
      }
      
      // Slack limits fields to 10 per section block
      for (let i = 0; i < fields.length; i += 10) {
        blocks.push({
          type: 'section',
          fields: fields.slice(i, i + 10),
        });
      }
    }

    blocks.push({ type: 'divider' });
    return blocks;
  }
}
