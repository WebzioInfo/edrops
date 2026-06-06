import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthGuard } from '@nestjs/passport';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('forgot-password')
  forgotPassword(@Body() body: { email: string }) {
    return this.authService.forgotPassword(body.email);
  }

  @Post('reset-password')
  resetPassword(@Body() body: { token: string; password: string }) {
    return this.authService.resetPassword(body.token, body.password);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  getProfile(@Request() req) {
    return this.authService.getProfile(req.user.id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('update-profile')
  updateProfile(@Request() req, @Body() body: any) {
    return this.authService.updateProfile(req.user.id, body);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('request-password-otp')
  requestPasswordOtp(@Request() req) {
    return this.authService.requestPasswordOtp(req.user.id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('change-password')
  changePassword(
    @Request() req,
    @Body() body: { otp: string; newPassword: string },
  ) {
    return this.authService.changePassword(req.user.id, body);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('refresh')
  refresh(@Request() req) {
    return this.authService.refreshToken(req.user.id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('logout')
  logout() {
    return { success: true, message: 'Logged out successfully' };
  }
}
