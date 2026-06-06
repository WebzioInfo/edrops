import { Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { WalletService } from './wallet.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/roles.guard';

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
  async ownJar(@Req() req) {
    const userId = req.user.sub || req.user.id;
    return this.walletService.ownJar(userId);
  }
}
