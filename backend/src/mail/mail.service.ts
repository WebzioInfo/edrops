import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { User } from '@prisma/client';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private mailerService: MailerService) {}

  private getFrontendUrl(): string {
    const raw = process.env.FRONTEND_URL?.trim();
    if (raw) {
      return raw.replace(/\/+$/, '');
    }
    return 'http://localhost:5173';
  }

  private renderEmailShell(options: {
    title: string;
    bodyHtml: string;
    frontendUrl: string;
  }): string {
    const { title, bodyHtml, frontendUrl } = options;
    const logoUrl = `${frontendUrl}/logo-full-blue.svg`;

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td {font-family: Arial, Helvetica, sans-serif !important;}
  </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #F8FAFC; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #16324F;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #F8FAFC; padding: 36px 16px;">
    <tr>
      <td align="center">
        <!-- Container Card -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 580px; background-color: #ffffff; border: 1px solid #E2E8F0; border-radius: 20px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04); overflow: hidden;">
          <!-- Header / Brand -->
          <tr>
            <td align="center" style="padding: 36px 36px 20px 36px; border-bottom: 1px solid #F1F5F9;">
              <a href="${frontendUrl}" target="_blank" style="text-decoration: none; display: inline-block;">
                <img src="${logoUrl}" alt="eDrops" width="145" height="34" style="display: block; border: 0; outline: none; text-decoration: none; max-width: 150px; height: auto;" />
              </a>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 32px 36px 28px 36px;">
              ${bodyHtml}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #F8FAFC; border-top: 1px solid #E2E8F0; padding: 24px 36px; text-align: center;">
              <p style="margin: 0 0 8px; font-size: 13px; color: #64748B;">
                Need help? Contact our support team at <a href="mailto:support@edrops.com" style="color: #00AEEF; font-weight: 600; text-decoration: none;">support@edrops.com</a>
              </p>
              <p style="margin: 0; font-size: 11px; color: #94A3B8;">
                &copy; ${new Date().getFullYear()} eDrops. All rights reserved. Professional Pure Water Delivery.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
  }

  /**
   * EMAIL #1: Welcome / First Password Setup
   * Sent when staff creates a new customer or customer requests activation.
   */
  async sendAccountSetupEmail(user: User, token: string) {
    if (!user.email) return;

    const frontendUrl = this.getFrontendUrl();
    const setupUrl = `${frontendUrl}/setup-password?token=${encodeURIComponent(token)}`;
    const firstName = (user.firstName && user.firstName.trim()) ? user.firstName.trim() : 'there';

    const bodyHtml = `
      <h1 style="font-size: 22px; font-weight: 800; color: #16324F; margin: 0 0 16px; letter-spacing: -0.3px;">
        Welcome to eDrops
      </h1>
      <p style="color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 12px;">
        Hi <strong>${firstName}</strong>,
      </p>
      <p style="color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 8px;">
        Your eDrops customer account has been created successfully.
      </p>
      <p style="color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 28px;">
        You can now set your password and access your account.
      </p>

      <!-- Primary CTA Button -->
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 28px 0;">
        <tr>
          <td align="center">
            <a href="${setupUrl}" target="_blank" style="background-color: #00AEEF; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none; padding: 14px 34px; border-radius: 12px; display: inline-block; letter-spacing: 0.5px; box-shadow: 0 4px 14px rgba(0, 174, 239, 0.35);">
              CREATE YOUR PASSWORD
            </a>
          </td>
        </tr>
      </table>

      <p style="color: #64748B; font-size: 13px; line-height: 1.6; margin: 0 0 6px;">
        This secure link will allow you to create your password.
      </p>
      <p style="color: #64748B; font-size: 13px; line-height: 1.6; margin: 0 0 24px;">
        For your security, this link expires in <strong>24 hours</strong> and can only be used once.
      </p>

      <!-- Login Email Callout -->
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; margin: 0 0 24px 0;">
        <tr>
          <td style="padding: 14px 18px;">
            <span style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #94A3B8; letter-spacing: 0.6px; display: block; margin-bottom: 4px;">Your login email</span>
            <span style="font-size: 14px; font-weight: 700; color: #16324F;">${user.email}</span>
          </td>
        </tr>
      </table>

      <!-- Fallback URL Section -->
      <div style="border-top: 1px dashed #E2E8F0; padding-top: 16px; margin: 24px 0 16px 0;">
        <p style="color: #94A3B8; font-size: 12px; line-height: 1.5; margin: 0 0 6px;">
          Having trouble with the button? Copy and paste this link into your browser:
        </p>
        <p style="margin: 0; font-size: 12px; word-break: break-all; line-height: 1.5;">
          <a href="${setupUrl}" style="color: #00AEEF; text-decoration: underline;">${setupUrl}</a>
        </p>
      </div>

      <p style="font-size: 12px; color: #94A3B8; line-height: 1.5; margin: 18px 0 0 0;">
        If you did not expect this account, you can safely ignore this email.
      </p>
    `;

    const html = this.renderEmailShell({
      title: 'Welcome to eDrops — Create Your Password',
      bodyHtml,
      frontendUrl,
    });

    try {
      await this.mailerService.sendMail({
        to: user.email,
        subject: 'Welcome to eDrops — Create Your Password',
        html,
      });
      this.logger.log(`Account setup email sent to ${user.email}`);
    } catch (error) {
      this.logger.error(`Failed to send account setup email to ${user.email}`, error);
    }
  }

  /**
   * EMAIL #2: Security Confirmation: Password Successfully Changed
   */
  async sendPasswordChanged(user: User) {
    if (!user.email) return;

    const frontendUrl = this.getFrontendUrl();
    const loginUrl = `${frontendUrl}/login`;
    const firstName = (user.firstName && user.firstName.trim()) ? user.firstName.trim() : 'there';

    const bodyHtml = `
      <h1 style="font-size: 22px; font-weight: 800; color: #16324F; margin: 0 0 16px; letter-spacing: -0.3px;">
        Password Successfully Changed
      </h1>
      <p style="color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 12px;">
        Hi <strong>${firstName}</strong>,
      </p>
      <p style="color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
        Your eDrops account password was successfully changed. You can now sign in using your email address and your new password.
      </p>

      <!-- Primary CTA Button -->
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 24px 0;">
        <tr>
          <td align="center">
            <a href="${loginUrl}" target="_blank" style="background-color: #00AEEF; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none; padding: 14px 34px; border-radius: 12px; display: inline-block; letter-spacing: 0.5px; box-shadow: 0 4px 14px rgba(0, 174, 239, 0.35);">
              SIGN IN TO EDROPS
            </a>
          </td>
        </tr>
      </table>

      <!-- Account Details -->
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; margin: 0 0 20px 0;">
        <tr>
          <td style="padding: 14px 18px;">
            <span style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #94A3B8; letter-spacing: 0.6px; display: block; margin-bottom: 4px;">Account</span>
            <span style="font-size: 14px; font-weight: 700; color: #16324F;">${user.email}</span>
          </td>
        </tr>
      </table>

      <!-- Security Notice -->
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #FEF2F2; border: 1px solid #FECACA; border-radius: 12px; margin: 0 0 16px 0;">
        <tr>
          <td style="padding: 14px 18px;">
            <p style="font-size: 13px; color: #991B1B; font-weight: 700; margin: 0 0 4px 0;">
              Security Notice
            </p>
            <p style="font-size: 12px; color: #B91C1C; line-height: 1.5; margin: 0 0 4px 0;">
              For your security, if you did not make this change, please contact eDrops support immediately.
            </p>
            <p style="font-size: 12px; color: #991B1B; font-weight: 600; margin: 0;">
              Never share your password with anyone.
            </p>
          </td>
        </tr>
      </table>
    `;

    const html = this.renderEmailShell({
      title: 'Your eDrops Password Was Changed',
      bodyHtml,
      frontendUrl,
    });

    try {
      await this.mailerService.sendMail({
        to: user.email,
        subject: 'Your eDrops Password Was Changed',
        html,
      });
      this.logger.log(`Password changed confirmation email sent to ${user.email}`);
    } catch (error) {
      this.logger.error(`Failed to send password changed email to ${user.email}`, error);
    }
  }

  /**
   * Password Reset Email
   */
  async sendPasswordReset(user: User, token: string) {
    if (!user.email) return;

    const frontendUrl = this.getFrontendUrl();
    const url = `${frontendUrl}/reset-password?token=${encodeURIComponent(token)}`;
    const firstName = (user.firstName && user.firstName.trim()) ? user.firstName.trim() : 'there';

    const bodyHtml = `
      <h1 style="font-size: 22px; font-weight: 800; color: #16324F; margin: 0 0 16px; letter-spacing: -0.3px;">
        Reset Your Password
      </h1>
      <p style="color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 12px;">
        Hi <strong>${firstName}</strong>,
      </p>
      <p style="color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
        We received a request to reset the password for your eDrops account. Click the button below to choose a new password. This link will expire in <strong>15 minutes</strong>.
      </p>

      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 28px 0;">
        <tr>
          <td align="center">
            <a href="${url}" target="_blank" style="background-color: #00AEEF; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none; padding: 14px 34px; border-radius: 12px; display: inline-block; letter-spacing: 0.5px; box-shadow: 0 4px 14px rgba(0, 174, 239, 0.35);">
              RESET MY PASSWORD
            </a>
          </td>
        </tr>
      </table>

      <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 14px 18px; margin: 20px 0;">
        <strong style="color: #16324F; font-size: 13px;">Didn't request this?</strong><br/>
        <span style="font-size: 12px; color: #64748B;">If you did not make this request, you can safely ignore this email. Your password will remain unchanged.</span>
      </div>

      <div style="border-top: 1px dashed #E2E8F0; padding-top: 14px; margin: 20px 0 0 0;">
        <p style="color: #94A3B8; font-size: 12px; margin: 0 0 4px 0;">Link not opening? Copy and paste this URL into your browser:</p>
        <p style="margin: 0; font-size: 12px; word-break: break-all;">
          <a href="${url}" style="color: #00AEEF; text-decoration: underline;">${url}</a>
        </p>
      </div>
    `;

    const html = this.renderEmailShell({
      title: 'Reset your eDrops Password',
      bodyHtml,
      frontendUrl,
    });

    try {
      await this.mailerService.sendMail({
        to: user.email,
        subject: 'Reset your eDrops Password',
        html,
      });
      this.logger.log(`Password reset email sent to ${user.email}`);
    } catch (error) {
      this.logger.error(`Failed to send email to ${user.email}`, error);
    }
  }

  async sendPasswordOtp(user: User, otp: string) {
    if (!user.email) return;

    const frontendUrl = this.getFrontendUrl();
    const firstName = (user.firstName && user.firstName.trim()) ? user.firstName.trim() : 'there';

    const bodyHtml = `
      <h1 style="font-size: 22px; font-weight: 800; color: #16324F; margin: 0 0 16px; letter-spacing: -0.3px;">
        Password Verification Code
      </h1>
      <p style="color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 12px;">
        Hi <strong>${firstName}</strong>,
      </p>
      <p style="color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 20px;">
        You requested to change your password. Use the verification code below to confirm this change:
      </p>

      <div style="text-align: center; margin: 24px 0; background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 20px;">
        <span style="font-size: 32px; font-weight: 900; letter-spacing: 8px; color: #00AEEF; font-family: monospace;">
          ${otp}
        </span>
      </div>

      <p style="font-size: 12px; color: #64748B; margin: 0;">
        This code is valid for 10 minutes. If you did not request this, please ignore this email.
      </p>
    `;

    const html = this.renderEmailShell({
      title: 'Your eDrops Password Verification Code',
      bodyHtml,
      frontendUrl,
    });

    try {
      await this.mailerService.sendMail({
        to: user.email,
        subject: 'Your eDrops Password Verification Code',
        html,
      });
      this.logger.log(`Password OTP sent to ${user.email}`);
    } catch (error) {
      this.logger.error(`Failed to send OTP to ${user.email}`, error);
    }
  }

  async sendWelcomeEmail(user: User) {
    if (!user.email) return;

    const frontendUrl = this.getFrontendUrl();
    const firstName = (user.firstName && user.firstName.trim()) ? user.firstName.trim() : 'there';

    const bodyHtml = `
      <h1 style="font-size: 22px; font-weight: 800; color: #16324F; margin: 0 0 16px; letter-spacing: -0.3px;">
        Welcome to eDrops
      </h1>
      <p style="color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 12px;">
        Hi <strong>${firstName}</strong>,
      </p>
      <p style="color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 20px;">
        We are thrilled to have you on board! Start managing your pure water deliveries and balance with ease.
      </p>

      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 24px 0;">
        <tr>
          <td align="center">
            <a href="${frontendUrl}/login" target="_blank" style="background-color: #00AEEF; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none; padding: 14px 34px; border-radius: 12px; display: inline-block; letter-spacing: 0.5px; box-shadow: 0 4px 14px rgba(0, 174, 239, 0.35);">
              GO TO MY ACCOUNT
            </a>
          </td>
        </tr>
      </table>
    `;

    const html = this.renderEmailShell({
      title: 'Welcome to eDrops',
      bodyHtml,
      frontendUrl,
    });

    try {
      await this.mailerService.sendMail({
        to: user.email,
        subject: 'Welcome to eDrops',
        html,
      });
    } catch (error) {
      this.logger.error(`Failed to send welcome email to ${user.email}`, error);
    }
  }
}
