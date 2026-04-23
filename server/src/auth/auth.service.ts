import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { OtpService } from './otp.service';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly otpService: OtpService,
  ) {}

  // ─────────────────────────────────────────────
  // OTP FLOW (Primary — Customer App)
  // ─────────────────────────────────────────────

  async sendOtp(phone: string) {
    return this.otpService.sendOtp(phone);
  }

  /**
   * Verifies OTP and either logs in an existing user or auto-registers them.
   * This is the primary auth flow for customers (no password needed).
   */
  async verifyOtpAndLogin(phone: string, otp: string, name?: string) {
    await this.otpService.verifyOtp(phone, otp);

    let user = await this.usersService.findByPhone(phone);

    if (!user) {
      // Auto-register new customer
      const tempPassword = await bcrypt.hash(
        Math.random().toString(36),
        10,
      );
      user = await this.usersService.create({
        phone,
        name: name ?? 'Customer',
        role: 'CUSTOMER',
        password: tempPassword,
      });
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is disabled. Contact support.');
    }

    const token = this.generateToken(user.id, user.role, user.phone);
    return { user: this.sanitize(user), token, isNewUser: !user };
  }

  // ─────────────────────────────────────────────
  // PASSWORD FLOW (Admin / Distributor Dashboard)
  // ─────────────────────────────────────────────

  async register(dto: RegisterDto) {
    const existing = await this.usersService.findByPhone(dto.phone);
    if (existing) throw new ConflictException('Phone number already registered');

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const user = await this.usersService.create({
      ...dto,
      password: hashedPassword,
    });

    const token = this.generateToken(user.id, user.role, user.phone);
    return { user: this.sanitize(user), token };
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByPhone(dto.phone);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    if (!user.isActive) {
      throw new UnauthorizedException('Account is disabled. Contact support.');
    }

    const token = this.generateToken(user.id, user.role, user.phone);
    return { user: this.sanitize(user), token };
  }

  async validateUser(phone: string, password: string) {
    const user = await this.usersService.findByPhone(phone);
    if (!user) return null;
    const valid = await bcrypt.compare(password, user.password);
    return valid ? user : null;
  }

  // ─────────────────────────────────────────────
  // PRIVATE
  // ─────────────────────────────────────────────

  private generateToken(userId: string, role: string, phone: string) {
    return this.jwtService.sign({ sub: userId, role, phone });
  }

  private sanitize(user: any) {
    const { password, ...rest } = user;
    return rest;
  }
}
