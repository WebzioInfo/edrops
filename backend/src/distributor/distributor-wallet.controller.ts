import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/roles.guard';
import { UserRole } from '@prisma/client';
import { DistributorWalletService } from './distributor-wallet.service';
import {
  TopUpDistributorWalletDto,
  PayPurchaseFromWalletDto,
  RequestDistributorWithdrawalDto,
  QueryDistributorWalletTransactionsDto,
} from './dto/distributor-wallet.dto';

@Controller('distributor/wallet')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.DISTRIBUTOR, UserRole.ADMIN, UserRole.MANAGER)
export class DistributorWalletController {
  constructor(
    private readonly walletService: DistributorWalletService,
  ) {}

  @Get('overview')
  async getOverview(
    @Req() req: any,
    @Query('distributorId') explicitDistributorId?: string,
  ) {
    return this.walletService.getWalletOverview(req.user, explicitDistributorId);
  }

  @Get('transactions')
  async getTransactions(
    @Req() req: any,
    @Query() query: QueryDistributorWalletTransactionsDto,
    @Query('distributorId') explicitDistributorId?: string,
  ) {
    return this.walletService.getTransactions(req.user, query, explicitDistributorId);
  }

  @Post('topup')
  @HttpCode(HttpStatus.OK)
  async topUp(
    @Req() req: any,
    @Body() dto: TopUpDistributorWalletDto,
    @Query('distributorId') explicitDistributorId?: string,
  ) {
    return this.walletService.topUp(req.user, dto, explicitDistributorId);
  }

  @Post('pay-purchase')
  @HttpCode(HttpStatus.OK)
  async payPurchase(
    @Req() req: any,
    @Body() dto: PayPurchaseFromWalletDto,
    @Query('distributorId') explicitDistributorId?: string,
  ) {
    return this.walletService.payPurchase(req.user, dto, explicitDistributorId);
  }

  @Post('withdraw')
  @HttpCode(HttpStatus.OK)
  async withdraw(
    @Req() req: any,
    @Body() dto: RequestDistributorWithdrawalDto,
    @Query('distributorId') explicitDistributorId?: string,
  ) {
    return this.walletService.requestWithdrawal(req.user, dto, explicitDistributorId);
  }
}
