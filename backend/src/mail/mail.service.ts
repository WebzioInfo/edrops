import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { User } from '@prisma/client';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private mailerService: MailerService) {}

  async sendPasswordReset(user: User, token: string) {
    const url = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

    const html = `
      <div style="font-family: 'Outfit', sans-serif; color: #245361;">
        <h2>Password Reset Request</h2>
        <p>Hi ${user.firstName},</p>
        <p>You requested to reset your password. Please click the link below to set a new password:</p>
        <p>
          <a href="${url}" style="background-color: #F69C14; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; margin-top: 10px;">
            Reset Password
          </a>
        </p>
        <p style="margin-top: 20px; font-size: 0.85em; color: #7EBFE4;">
          If you did not request this, please ignore this email.
        </p>
      </div>
    `;

    try {
      await this.mailerService.sendMail({
        to: user.email ?? undefined,
        subject: 'Reset your Edrops Password',
        html,
      });
      this.logger.log(`Password reset email sent to ${user.email}`);
    } catch (error) {
      this.logger.error(`Failed to send email to ${user.email}`, error);
    }
  }

  async sendPasswordOtp(user: User, otp: string) {
    const html = `
      <div style="font-family: 'Outfit', sans-serif; color: #245361;">
        <h2>Password Verification Code</h2>
        <p>Hi ${user.firstName},</p>
        <p>You requested to change your password. Use the verification code below to confirm this change:</p>
        <p style="font-size: 2em; font-weight: bold; letter-spacing: 4px; color: #F69C14; margin: 20px 0;">
          ${otp}
        </p>
        <p style="font-size: 0.85em; color: #7EBFE4;">
          This code is valid for 10 minutes. If you did not request this, please ignore this email.
        </p>
      </div>
    `;

    try {
      await this.mailerService.sendMail({
        to: user.email ?? undefined,
        subject: 'Your Edrops Password Verification Code',
        html,
      });
      this.logger.log(`Password OTP sent to ${user.email}`);
    } catch (error) {
      this.logger.error(`Failed to send OTP to ${user.email}`, error);
    }
  }

  async sendWelcomeEmail(user: User) {
    const html = `
      <div style="font-family: 'Outfit', sans-serif; color: #245361;">
        <h2>Welcome to Edrops!</h2>
        <p>Hi ${user.firstName},</p>
        <p>We are thrilled to have you on board. Start managing your water balance with ease.</p>
      </div>
    `;

    try {
      await this.mailerService.sendMail({
        to: user.email ?? undefined,
        subject: 'Welcome to Edrops',
        html,
      });
    } catch (error) {
      this.logger.error(`Failed to send welcome email to ${user.email}`, error);
    }
  }
}
