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
import { SupplierService } from './supplier.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { RecordSupplierPaymentDto } from './dto/record-supplier-payment.dto';
import { AdjustSupplierBalanceDto } from './dto/adjust-supplier-balance.dto';

@Controller('suppliers')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.DISTRIBUTOR, UserRole.ADMIN)
export class SupplierController {
  constructor(private readonly supplierService: SupplierService) {}

  @Get()
  findAll(
    @Req() req: any,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    const distributorId = req.user.id || req.user.sub;
    return this.supplierService.findAll(distributorId, { search, status });
  }

  @Get(':id')
  findOne(@Req() req: any, @Param('id') id: string) {
    const distributorId = req.user.id || req.user.sub;
    return this.supplierService.findOne(id, distributorId);
  }

  @Post()
  create(@Req() req: any, @Body() dto: CreateSupplierDto) {
    const distributorId = req.user.id || req.user.sub;
    return this.supplierService.create(distributorId, dto);
  }

  @Put(':id')
  update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateSupplierDto,
  ) {
    const distributorId = req.user.id || req.user.sub;
    return this.supplierService.update(id, distributorId, dto);
  }

  @Delete(':id')
  delete(@Req() req: any, @Param('id') id: string) {
    const distributorId = req.user.id || req.user.sub;
    return this.supplierService.delete(id, distributorId);
  }

  @Post(':id/payments')
  recordPayment(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: RecordSupplierPaymentDto,
  ) {
    const distributorId = req.user.id || req.user.sub;
    return this.supplierService.recordPayment(id, distributorId, dto);
  }

  @Post(':id/adjust-balance')
  adjustBalance(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: AdjustSupplierBalanceDto,
  ) {
    const distributorId = req.user.id || req.user.sub;
    const userId = req.user.id || req.user.sub;
    const userName = req.user.name || req.user.fullName || req.user.email || 'Distributor';
    return this.supplierService.adjustBalance(id, distributorId, dto, { userId, userName });
  }
}
