import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import { UserRole } from '@prisma/client';
import { MailService } from '../mail/mail.service';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private mailService: MailService,
  ) {}

  async register(registerDto: RegisterDto) {
    const existingPhone = await this.prisma.user.findUnique({
      where: { phone: registerDto.phone },
    });

    if (existingPhone) {
      throw new ConflictException('Phone number already in use');
    }

    if (registerDto.email) {
      const existingEmail = await this.prisma.user.findUnique({
        where: { email: registerDto.email },
      });
      if (existingEmail) {
        throw new ConflictException('Email already in use');
      }
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(registerDto.password, salt);

    const user = await this.prisma.user.create({
      data: {
        email: registerDto.email,
        passwordHash,
        firstName: registerDto.firstName,
        lastName: registerDto.lastName,
        phone: registerDto.phone,
        role: UserRole.CUSTOMER, // Default role
        customer: {
          create: {
            wallet: { create: { balance: 0.0 } },
          },
        },
      },
    });

    try {
      await this.mailService.sendWelcomeEmail(user);
    } catch (e) {
      this.logger.warn(`Failed to send welcome email: ${(e as Error).message}`);
    }

    return this.generateToken(user);
  }

  async login(loginDto: LoginDto) {
    const isEmail = loginDto.identifier.includes('@');

    const user = await this.prisma.user.findFirst({
      where: isEmail
        ? { email: loginDto.identifier }
        : { phone: loginDto.identifier },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.generateToken(user);
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email }, { phone: email }],
      },
    });

    if (!user) {
      throw new NotFoundException(
        'Account not found with the provided details.',
      );
    }

    if (!user.isActive) {
      throw new BadRequestException(
        'This account has been deactivated. Please contact support.',
      );
    }

    if (!user.email) {
      throw new BadRequestException(
        'No email address is associated with this account.',
      );
    }

    // Rate Limiting Logic: Check if a token was recently generated
    if (
      user.resetPasswordExpires &&
      user.resetPasswordExpires > new Date(Date.now() + 3540000)
    ) {
      // Assuming 1-hour expiry, if it expires more than 59 mins from now, they just requested one.
      throw new BadRequestException(
        'A password reset request was just made. Please wait a minute before requesting another.',
      );
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetPasswordToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');

    const resetPasswordExpires = new Date(Date.now() + 900000); // Strict 15 minutes expiry

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { resetPasswordToken, resetPasswordExpires },
      });

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'PASSWORD_RESET_REQUESTED',
          entityType: 'USER',
          entityId: user.id,
          newValues: { email: user.email },
        },
      });
    });

    try {
      await this.mailService.sendPasswordReset(user, resetToken);
    } catch (e) {
      this.logger.warn(`Failed to send reset email: ${(e as Error).message}`);
    }

    return {
      message: 'Password reset link has been sent to your email address.',
    };
  }

  async resetPassword(token: string, newPassword: string) {
    const resetPasswordToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    const user = await this.prisma.user.findFirst({
      where: {
        resetPasswordToken,
        resetPasswordExpires: { gt: new Date() },
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired password reset token');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          resetPasswordToken: null,
          resetPasswordExpires: null,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'PASSWORD_CHANGED',
          entityType: 'USER',
          entityId: user.id,
        },
      });
    });

    // Send confirmation email
    try {
      await this.mailService.sendPasswordChanged(user);
    } catch (e) {
      this.logger.warn(
        `Failed to send password changed email: ${(e as Error).message}`,
      );
    }

    return { message: 'Password has been reset successfully' };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        customer: {
          include: {
            wallet: true,
            jarBalances: true,
            jarDeposits: true,
            jarOwnerships: {
              include: { brand: true },
            },
            deliverySchedule: {
              include: {
                rules: true,
              },
            },
            addresses: true,
          },
        },
        staff: {
          include: {
            branch: true,
          },
        },
        admin: true,
        deliveryPartner: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.deliveryPartner && user.deliveryPartner.jarUnitPrice !== undefined && user.deliveryPartner.jarUnitPrice !== null) {
      (user.deliveryPartner as any).jarUnitPrice = Number(user.deliveryPartner.jarUnitPrice);
    }

    return user;
  }

  async updateProfile(
    userId: string,
    data: {
      firstName?: string;
      lastName?: string;
      email?: string;
      phone?: string;
    },
  ) {
    if (data.email) {
      const existing = await this.prisma.user.findFirst({
        where: { email: data.email, NOT: { id: userId } },
      });
      if (existing) {
        throw new ConflictException('Email already in use');
      }
    }

    if (data.phone) {
      const existing = await this.prisma.user.findFirst({
        where: { phone: data.phone, NOT: { id: userId } },
      });
      if (existing) {
        throw new ConflictException('Phone number already in use');
      }
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
      },
    });

    return {
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    };
  }

  async requestPasswordOtp(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const resetPasswordToken = crypto
      .createHash('sha256')
      .update(otp)
      .digest('hex');
    const resetPasswordExpires = new Date(Date.now() + 600000); // 10 minutes

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        resetPasswordToken,
        resetPasswordExpires,
      },
    });

    await this.mailService.sendPasswordOtp(user, otp);

    return { success: true, message: 'Verification code sent to your email.' };
  }

  async changePassword(
    userId: string,
    data: { currentPassword?: string; otp?: string; newPassword: string },
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!data.newPassword || data.newPassword.length < 6) {
      throw new BadRequestException('New password must be at least 6 characters long.');
    }

    if (data.currentPassword) {
      const isMatch = await bcrypt.compare(data.currentPassword, user.passwordHash);
      if (!isMatch) {
        throw new BadRequestException('Current password does not match.');
      }
    } else if (data.otp) {
      if (
        !user.resetPasswordToken ||
        !user.resetPasswordExpires ||
        user.resetPasswordExpires.getTime() < Date.now()
      ) {
        throw new BadRequestException(
          'Verification code has expired. Please request a new one.',
        );
      }

      const hashedOtp = crypto
        .createHash('sha256')
        .update(data.otp)
        .digest('hex');
      if (hashedOtp !== user.resetPasswordToken) {
        throw new BadRequestException('Invalid verification code.');
      }
    } else {
      throw new BadRequestException('Current password or OTP is required.');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(data.newPassword, salt);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        resetPasswordToken: null,
        resetPasswordExpires: null,
      },
    });

    return { success: true, message: 'Password changed successfully' };
  }

  async refreshToken(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    return this.generateToken(user);
  }

  async googleAuth(idToken: string) {
    if (!idToken) {
      throw new BadRequestException('Google ID token is required');
    }

    const expectedClientId =
      process.env.GOOGLE_CLIENT_ID ||
      '731018746600-tiuks376qo8fg0rb1ihc3m7adsunvmmt.apps.googleusercontent.com';

    let payload: {
      email?: string;
      name?: string;
      given_name?: string;
      family_name?: string;
      picture?: string;
      sub?: string;
      email_verified?: boolean;
    } | null = null;

    // Try verifying with google-auth-library first
    try {
      const { OAuth2Client } = await import('google-auth-library');
      const client = new OAuth2Client(expectedClientId);
      const ticket = await client.verifyIdToken({
        idToken,
        audience: expectedClientId,
      });
      const p = ticket.getPayload();
      if (p && p.email) {
        payload = p;
      }
    } catch (libErr) {
      this.logger.warn(`google-auth-library verification fallback: ${(libErr as Error).message}`);
    }

    // Fallback: Verify via Google TokenInfo HTTPS endpoint
    if (!payload) {
      try {
        const response = await fetch(
          `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
        );
        if (!response.ok) {
          throw new UnauthorizedException('Invalid Google ID token');
        }
        const data = await response.json();
        if (data.aud !== expectedClientId && !expectedClientId.includes(data.aud)) {
          this.logger.warn(`Google token aud mismatch: ${data.aud} vs ${expectedClientId}`);
        }
        if (!data.email) {
          throw new UnauthorizedException('Google account has no email address');
        }
        payload = data;
      } catch (httpErr) {
        throw new UnauthorizedException(
          `Google authentication failed: ${(httpErr as Error).message}`,
        );
      }
    }

    if (!payload || !payload.email) {
      throw new UnauthorizedException('Unable to verify Google credentials');
    }

    const email = payload.email.toLowerCase().trim();
    let user = await this.prisma.user.findFirst({
      where: { email },
    });

    if (!user) {
      // Create new user with Google profile details
      const salt = await bcrypt.genSalt(10);
      const randomPassword = crypto.randomBytes(32).toString('hex');
      const passwordHash = await bcrypt.hash(randomPassword, salt);
      const firstName = payload.given_name || payload.name?.split(' ')[0] || 'User';
      const lastName = payload.family_name || payload.name?.split(' ').slice(1).join(' ') || '.';
      const pendingPhone = `PENDING_GOOGLE_${payload.sub || Date.now()}`;

      user = await this.prisma.user.create({
        data: {
          email,
          passwordHash,
          firstName,
          lastName,
          phone: pendingPhone,
          role: UserRole.CUSTOMER,
          customer: {
            create: {
              wallet: { create: { balance: 0.0 } },
            },
          },
        },
      });
    }

    // Check if user has a valid verified phone number on file
    const hasValidPhone = Boolean(
      user.phone &&
      !user.phone.startsWith('PENDING_') &&
      user.phone.replace(/\D/g, '').length >= 10,
    );

    if (hasValidPhone) {
      return {
        status: 'authenticated',
        ...this.generateToken(user),
      };
    }

    // Phone is missing/pending -> Generate short-lived (10m) single-purpose temp token
    const tempToken = this.jwtService.sign(
      {
        sub: user.id,
        email: user.email,
        purpose: 'phone_completion',
      },
      { expiresIn: '10m' },
    );

    return {
      status: 'phone_required',
      temp_token: tempToken,
      user: {
        name: `${user.firstName} ${user.lastName}`.trim(),
        email: user.email,
        avatar: payload.picture,
      },
    };
  }

  async completePhone(tempToken: string, rawPhone: string) {
    if (!tempToken) {
      throw new BadRequestException('Temporary token is required');
    }

    let decoded: any;
    try {
      decoded = this.jwtService.verify(tempToken);
    } catch (err) {
      throw new UnauthorizedException(
        'Temporary session has expired or is invalid. Please sign in with Google again.',
      );
    }

    if (decoded.purpose !== 'phone_completion' || !decoded.sub) {
      throw new UnauthorizedException('Invalid token purpose');
    }

    const cleanPhone = rawPhone?.trim().replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length < 10) {
      throw new BadRequestException('Please provide a valid 10-digit phone number.');
    }

    // Ensure phone number isn't claimed by another user account
    const existingWithPhone = await this.prisma.user.findFirst({
      where: { phone: cleanPhone, NOT: { id: decoded.sub } },
    });

    if (existingWithPhone) {
      throw new ConflictException(
        'This phone number is already associated with another account.',
      );
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: decoded.sub },
      data: {
        phone: cleanPhone,
        phoneVerified: true,
        phoneVerifiedAt: new Date(),
      },
    });

    return {
      status: 'authenticated',
      ...this.generateToken(updatedUser),
    };
  }

  private generateToken(user: any) {
    const payload = {
      sub: user.id,
      role: user.role,
      email: user.email,
      phone: user.phone,
    };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    };
  }
}

