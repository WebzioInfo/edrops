import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserRole } from '@prisma/client';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { PurchaseService } from './purchase.service';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { UpdatePurchaseDto } from './dto/update-purchase.dto';
import { RecordPurchasePaymentDto } from './dto/record-purchase-payment.dto';

@Controller('purchases')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.DISTRIBUTOR, UserRole.ADMIN)
export class PurchaseController {
  constructor(private readonly purchaseService: PurchaseService) {}

  @Get()
  findAll(
    @Req() req: any,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    const distributorId = req.user.id || req.user.sub;
    return this.purchaseService.findAll(distributorId, { search, status });
  }

  @Get(':id')
  findOne(@Req() req: any, @Param('id') id: string) {
    const distributorId = req.user.id || req.user.sub;
    return this.purchaseService.findOne(id, distributorId);
  }

  @Post()
  create(@Req() req: any, @Body() dto: CreatePurchaseDto) {
    const distributorId = req.user.id || req.user.sub;
    return this.purchaseService.create(distributorId, dto);
  }

  @Put(':id')
  update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdatePurchaseDto,
  ) {
    const distributorId = req.user.id || req.user.sub;
    return this.purchaseService.update(id, distributorId, dto);
  }

  @Post(':id/payments')
  recordPayment(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: RecordPurchasePaymentDto,
  ) {
    const distributorId = req.user.id || req.user.sub;
    return this.purchaseService.recordPayment(id, distributorId, dto);
  }

  @Delete(':id')
  delete(@Req() req: any, @Param('id') id: string) {
    const distributorId = req.user.id || req.user.sub;
    return this.purchaseService.delete(id, distributorId);
  }
}
