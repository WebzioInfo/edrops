import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { WalletService } from './wallet.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@UseGuards(AuthGuard('jwt'))
@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  // ─────────── Customer: Get full wallet with recent transactions ───────────

  @Get()
  getWallet(@CurrentUser() user: any) {
    return this.walletService.getWallet(user.userId);
  }

  @Get('balance')
  getBalance(@CurrentUser() user: any) {
    return this.walletService.getBalance(user.userId);
  }

  @Get('transactions')
  getTransactions(
    @CurrentUser() user: any,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.walletService.getTransactions(user.userId, page, limit);
  }

  // ─────────── Admin: Manual Top-up ───────────

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Post('admin-topup')
  adminTopup(
    @Body() body: { userId: string; amount: number; note?: string },
  ) {
    return this.walletService.recharge(body.userId, body.amount, undefined, body.note);
  }
}
