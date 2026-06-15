import { Controller, Get, Post, Req, Body, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { WalletService } from './wallet.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { RechargeWalletDto } from './dto/recharge-wallet.dto';
import { Idempotent } from '../common/decorators/idempotent.decorator';

@Controller('wallet')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get()
  async getWallet(@Req() req) {
    const userId = req.user.sub || req.user.id;
    return this.walletService.getWallet(userId);
  }

  @Get('admin/ledger')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async getAdminLedger() {
    return this.walletService.getAdminLedger();
  }

  @Get('transactions')
  async getTransactions(@Req() req) {
    const userId = req.user.sub || req.user.id;
    return this.walletService.getTransactions(userId);
  }

  @Post('own-jar')
  @Idempotent()
  async ownJar(@Req() req) {
    const userId = req.user.sub || req.user.id;
    return this.walletService.ownJar(userId);
  }

  @Post('recharge/initiate')
  @Idempotent()
  async initiateRecharge(@Req() req, @Body() dto: RechargeWalletDto) {
    const userId = req.user.sub || req.user.id;
    return this.walletService.initiateRecharge(userId, dto.amount);
  }

  @Post('recharge/confirm')
  @Idempotent()
  async confirmRecharge(@Req() req, @Body() body: { razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string }) {
    const userId = req.user.sub || req.user.id;
    return this.walletService.confirmRecharge(
      userId,
      body.razorpayOrderId,
      body.razorpayPaymentId,
      body.razorpaySignature
    );
  }
}
