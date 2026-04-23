import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Get,
  Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ─────────── OTP Flow (Customer App) ───────────

  @Post('send-otp')
  @HttpCode(HttpStatus.OK)
  sendOtp(@Body() body: { phone: string }) {
    return this.authService.sendOtp(body.phone);
  }

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  verifyOtp(@Body() body: { phone: string; otp: string; name?: string }) {
    return this.authService.verifyOtpAndLogin(body.phone, body.otp, body.name);
  }

  // ─────────── Password Flow (Admin / Distributor) ───────────

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  // ─────────── Session ───────────

  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  me(@CurrentUser() user: any) {
    return user;
  }
}
