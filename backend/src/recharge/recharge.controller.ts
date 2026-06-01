import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request } from '@nestjs/common';
import { RechargeService } from './recharge.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard, Roles } from '../auth/roles.guard';
import { UserRole } from '@prisma/client';

@Controller('recharge')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class RechargeController {
  constructor(private readonly rechargeService: RechargeService) {}

  @Post('purchase')
  purchase(@Request() req, @Body() body: { packageId: string; paymentId?: string }) {
    // Find customer record from user id
    return this.prismaFindCustomerAndPurchase(req.user.sub ?? req.user.id, body);
  }

  @Post('package')
  @Roles(UserRole.ADMIN)
  createPackage(@Body() body: any) {
    return this.rechargeService.createPackage(body);
  }

  @Get('packages')
  getPackages() {
    return this.rechargeService.getPackages();
  }

  @Get('packages/all')
  getAllPackages() {
    return this.rechargeService.getAllPackages();
  }

  @Patch('package/:id')
  @Roles(UserRole.ADMIN)
  updatePackage(@Param('id') id: string, @Body() body: any) {
    return this.rechargeService.updatePackage(id, body);
  }

  @Delete('package/:id')
  @Roles(UserRole.ADMIN)
  removePackage(@Param('id') id: string) {
    return this.rechargeService.removePackage(id);
  }

  @Get('purchases')
  getPurchases(@Request() req) {
    // Staff/Admin can view all purchases, customer only sees their own
    if (req.user.role === 'CUSTOMER') {
      return this.prismaFindCustomerAndGetPurchases(req.user.sub ?? req.user.id);
    }
    return this.rechargeService.getPurchases();
  }

  private async prismaFindCustomerAndPurchase(userId: string, body: any) {
    // Retrieve customer record
    const userProfile = await this.rechargeService.purchase(userId, body);
    return userProfile;
  }

  private async prismaFindCustomerAndGetPurchases(userId: string) {
    // Helper to get customer specific purchases
    const customer = await this.rechargeService.getPurchases(userId);
    return customer;
  }
}
