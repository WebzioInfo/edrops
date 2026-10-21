import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserRole } from '@prisma/client';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { RawMaterialService } from './raw-material.service';
import {
  CreateRawMaterialDto,
  IssueRawMaterialsDto,
  RecordProductionBatchDto,
  SettleJarsDto,
} from './dto/raw-material.dto';

@Controller('inventory/raw-materials')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class RawMaterialController {
  constructor(private readonly rawMaterialService: RawMaterialService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.MANAGER)
  getMaterials() {
    return this.rawMaterialService.getMaterials();
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.MANAGER)
  createMaterial(@Body() dto: CreateRawMaterialDto) {
    return this.rawMaterialService.createMaterial(dto);
  }

  @Get('distributor/:distributorId')
  @Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.MANAGER)
  getDistributorStock(@Param('distributorId') distributorId: string) {
    return this.rawMaterialService.getDistributorStock(distributorId);
  }

  @Post('issue')
  @Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.MANAGER)
  issueMaterials(
    @Req() req: { user: { id: string } },
    @Body() dto: IssueRawMaterialsDto,
  ) {
    return this.rawMaterialService.issueMaterials(dto, req.user.id);
  }

  @Get('movements')
  @Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.MANAGER)
  getMovements(@Query('distributorId') distributorId?: string) {
    return this.rawMaterialService.getMovements(distributorId);
  }

  @Get('batches')
  @Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.MANAGER)
  getBatches(@Query('distributorId') distributorId?: string) {
    return this.rawMaterialService.getProductionBatches(distributorId);
  }

  @Post('settle')
  @Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.MANAGER)
  settleJars(
    @Req() req: { user: { id: string } },
    @Body() body: SettleJarsDto & { distributorId: string },
  ) {
    return this.rawMaterialService.settleJars(body.distributorId, body, req.user.id);
  }

  @Get('settlements')
  @Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.MANAGER)
  getSettlements(@Query('distributorId') distributorId?: string) {
    return this.rawMaterialService.getSettlements(distributorId);
  }
}
