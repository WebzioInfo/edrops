import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from 'redis';

/**
 * OTP Service — stores OTPs in Redis with 5-minute TTL.
 * Supports pluggable SMS providers via SMS_PROVIDER env var.
 * Providers: 'fast2sms' (default, cheapest for India) | 'msg91' | 'twilio' | 'console' (dev)
 */
@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);
  private redisClient: any;
  private readonly OTP_TTL = 300; // 5 minutes in seconds
  private readonly OTP_KEY_PREFIX = 'otp:';

  constructor(private readonly config: ConfigService) {
    this.initRedis();
  }

  private async initRedis() {
    this.redisClient = createClient({
      socket: {
        host: this.config.get('REDIS_HOST', 'localhost'),
        port: parseInt(this.config.get('REDIS_PORT', '6379')),
      },
    });
    this.redisClient.on('error', (err: any) =>
      this.logger.error('Redis Client Error', err),
    );
    await this.redisClient.connect();
  }

  // ─────────────────────────────────────────────
  // SEND OTP
  // ─────────────────────────────────────────────

  async sendOtp(phone: string): Promise<{ message: string }> {
    // Validate Indian phone number
    if (!/^[6-9]\d{9}$/.test(phone)) {
      throw new BadRequestException('Invalid Indian phone number');
    }

    // Rate limit: prevent OTP spam — check if one was sent in last 60 seconds
    const rateLimitKey = `otp_rate:${phone}`;
    const recentlySent = await this.redisClient.get(rateLimitKey);
    if (recentlySent) {
      throw new BadRequestException(
        'OTP already sent. Please wait 60 seconds before requesting again.',
      );
    }

    const otp = this.generateOtp();
    const key = `${this.OTP_KEY_PREFIX}${phone}`;

    // Store OTP in Redis with 5-min TTL
    await this.redisClient.setEx(key, this.OTP_TTL, otp);
    // Rate-limit key: 60-second cooldown
    await this.redisClient.setEx(rateLimitKey, 60, '1');

    // Send OTP via configured provider
    await this.dispatchOtp(phone, otp);

    return { message: `OTP sent to ${phone.slice(0, 3)}****${phone.slice(-3)}` };
  }

  // ─────────────────────────────────────────────
  // VERIFY OTP
  // ─────────────────────────────────────────────

  async verifyOtp(phone: string, otp: string): Promise<boolean> {
    const key = `${this.OTP_KEY_PREFIX}${phone}`;
    const stored = await this.redisClient.get(key);

    if (!stored) {
      throw new UnauthorizedException('OTP expired or not found. Please request a new one.');
    }

    if (stored !== otp) {
      throw new UnauthorizedException('Invalid OTP. Please try again.');
    }

    // Invalidate after successful verification (single-use)
    await this.redisClient.del(key);
    return true;
  }

  // ─────────────────────────────────────────────
  // PRIVATE HELPERS
  // ─────────────────────────────────────────────

  private generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private async dispatchOtp(phone: string, otp: string): Promise<void> {
    const provider = this.config.get('SMS_PROVIDER', 'console');

    switch (provider) {
      case 'fast2sms':
        await this.sendViaFast2SMS(phone, otp);
        break;
      case 'msg91':
        await this.sendViaMsg91(phone, otp);
        break;
      case 'console':
      default:
        // Development fallback — logs OTP to console
        this.logger.warn(
          `[DEV MODE] OTP for ${phone}: ${otp} (set SMS_PROVIDER in .env for production)`,
        );
        break;
    }
  }

  private async sendViaFast2SMS(phone: string, otp: string): Promise<void> {
    const apiKey = this.config.get('SMS_API_KEY');
    if (!apiKey) throw new Error('SMS_API_KEY not configured');

    const url = `https://www.fast2sms.com/dev/bulkV2?authorization=${apiKey}&variables_values=${otp}&route=otp&numbers=${phone}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Fast2SMS failed: ${await res.text()}`);
    }
    this.logger.log(`[Fast2SMS] OTP sent to ${phone}`);
  }

  private async sendViaMsg91(phone: string, otp: string): Promise<void> {
    const apiKey = this.config.get('SMS_API_KEY');
    const templateId = this.config.get('MSG91_TEMPLATE_ID');
    if (!apiKey || !templateId) throw new Error('MSG91 credentials not configured');

    const res = await fetch('https://control.msg91.com/api/v5/otp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        authkey: apiKey,
      },
      body: JSON.stringify({
        template_id: templateId,
        mobile: `91${phone}`,
        otp,
      }),
    });
    if (!res.ok) {
      throw new Error(`MSG91 failed: ${await res.text()}`);
    }
    this.logger.log(`[MSG91] OTP sent to ${phone}`);
  }
}
