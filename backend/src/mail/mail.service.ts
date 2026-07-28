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
      <div style="font-family: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0F172A; max-w-2xl mx-auto p-6 bg-white border border-[#E2E8F0] rounded-[16px] shadow-sm max-width: 600px; margin: 0 auto; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #1E88E5; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.5px;">EDROPS</h1>
        </div>
        <h2 style="font-size: 22px; font-weight: 700; margin-top: 0; color: #0F172A;">Reset your password</h2>
        <p style="color: #475569; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">Hi <strong>${user.firstName}</strong>,</p>
        <p style="color: #475569; font-size: 16px; line-height: 1.6; margin-bottom: 32px;">We received a request to reset the password for your Edrops account. Click the button below to choose a new password. This link will expire in <strong>15 minutes</strong>.</p>
        
        <div style="text-align: center; margin-bottom: 32px;">
          <a href="${url}" style="background-color: #1E88E5; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 16px; display: inline-block; box-shadow: 0 4px 12px rgba(30, 136, 229, 0.25);">
            Reset My Password
          </a>
        </div>
        
        <p style="font-size: 14px; color: #64748B; line-height: 1.5; margin-bottom: 24px; padding: 16px; background-color: #F8FAFC; border-radius: 8px;">
          <strong style="color: #0F172A;">Didn't request this?</strong><br/>
          If you did not make this request, you can safely ignore this email. Your password will remain unchanged.
        </p>
        
        <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 32px 0;" />
        
        <p style="font-size: 13px; color: #94A3B8; text-align: center; margin: 0;">
          Need help? Contact our support team at <a href="mailto:support@edrops.com" style="color: #1E88E5; text-decoration: none;">support@edrops.com</a>
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
  async sendPasswordChanged(user: User) {
    const html = `
      <div style="font-family: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0F172A; max-w-2xl mx-auto p-6 bg-white border border-[#E2E8F0] rounded-[16px] shadow-sm max-width: 600px; margin: 0 auto; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #10B981; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.5px;">EDROPS</h1>
        </div>
        <h2 style="font-size: 22px; font-weight: 700; margin-top: 0; color: #0F172A;">Password Successfully Changed</h2>
        <p style="color: #475569; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">Hi <strong>${user.firstName}</strong>,</p>
        <p style="color: #475569; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">This is a confirmation that the password for your Edrops account was recently changed.</p>
        
        <p style="font-size: 14px; color: #B91C1C; line-height: 1.5; margin-bottom: 24px; padding: 16px; background-color: #FEF2F2; border-radius: 8px; border: 1px solid #FCA5A5;">
          <strong style="color: #991B1B;">Security Notice:</strong><br/>
          If you did not perform this action, please contact our support team <strong>immediately</strong> as your account may be compromised.
        </p>
        
        <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 32px 0;" />
        
        <p style="font-size: 13px; color: #94A3B8; text-align: center; margin: 0;">
          Need help? Contact our support team at <a href="mailto:support@edrops.com" style="color: #1E88E5; text-decoration: none;">support@edrops.com</a>
        </p>
      </div>
    `;

    try {
      await this.mailerService.sendMail({
        to: user.email ?? undefined,
        subject: 'Security Alert: Your password was changed',
        html,
      });
      this.logger.log(`Password changed confirmation email sent to ${user.email}`);
    } catch (error) {
      this.logger.error(`Failed to send password changed email to ${user.email}`, error);
    }
  }
}
