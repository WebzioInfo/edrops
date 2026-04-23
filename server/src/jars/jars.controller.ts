import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { JarsService } from './jars.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@UseGuards(AuthGuard('jwt'))
@Controller('jars')
export class JarsController {
  constructor(private readonly jarsService: JarsService) {}

  @Get('my-account')
  getMyAccount(@CurrentUser() user: any) {
    return this.jarsService.getCustomerJarBalance(user.userId);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.DISTRIBUTOR)
  @Get('customers/:customerId')
  getCustomerAccount(@Param('customerId') id: string) {
    return this.jarsService.getCustomerJarBalance(id);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Post('batch')
  createBatch(@Body() body: { productId: string; quantity: number }) {
    return this.jarsService.createBatch(body.productId, body.quantity);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.DELIVERY_PARTNER)
  @Post('status')
  updateStatus(@Body() body: { serialNumber: string; status: any; customerId?: string; orderId?: string; notes?: string }) {
    return this.jarsService.updateStatus(body.serialNumber, body.status, body.customerId, body.orderId, body.notes);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.DELIVERY_PARTNER, Role.DISTRIBUTOR)
  @Post('manual-collection')
  recordManualCollection(@Body() body: { customerId: string; quantity: number; notes?: string }) {
    return this.jarsService.recordManualCollection(body.customerId, body.quantity, body.notes);
  }
}
