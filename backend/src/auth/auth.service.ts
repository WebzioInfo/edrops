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
        OR: [
          { email },
          { phone: email }
        ]
      }
    });

    if (!user) {
      throw new NotFoundException('Account not found with the provided details.');
    }

    if (!user.isActive) {
      throw new BadRequestException('This account has been deactivated. Please contact support.');
    }

    if (!user.email) {
      throw new BadRequestException('No email address is associated with this account.');
    }

    // Rate Limiting Logic: Check if a token was recently generated
    if (user.resetPasswordExpires && user.resetPasswordExpires > new Date(Date.now() + 3540000)) {
      // Assuming 1-hour expiry, if it expires more than 59 mins from now, they just requested one.
      throw new BadRequestException('A password reset request was just made. Please wait a minute before requesting another.');
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
          newValues: { email: user.email }
        }
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
          entityId: user.id
        }
      });
    });

    // Send confirmation email
    try {
      await this.mailService.sendPasswordChanged(user);
    } catch (e) {
      this.logger.warn(`Failed to send password changed email: ${(e as Error).message}`);
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
              include: { brand: true }
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

  async changePassword(userId: string, data: { otp: string; newPassword }) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

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
