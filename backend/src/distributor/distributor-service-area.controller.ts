import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserRole } from '@prisma/client';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { DistributorServiceAreaService } from './distributor-service-area.service';
import { CreateServiceAreaDto } from './dto/create-service-area.dto';

@Controller('distributor/service-areas')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.DISTRIBUTOR, UserRole.ADMIN)
export class DistributorServiceAreaController {
  constructor(private readonly serviceAreaService: DistributorServiceAreaService) {}

  @Get('lookup')
  lookup(@Query('pincode') pincode: string) {
    return this.serviceAreaService.lookupPincode(pincode);
  }

  @Get()
  findAll(@Req() req: any) {
    const distributorId = req.user.id || req.user.sub;
    return this.serviceAreaService.findAll(distributorId);
  }

  @Post()
  create(@Req() req: any, @Body() dto: CreateServiceAreaDto) {
    const distributorId = req.user.id || req.user.sub;
    return this.serviceAreaService.create(distributorId, dto);
  }

  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) {
    const distributorId = req.user.id || req.user.sub;
    return this.serviceAreaService.remove(distributorId, id);
  }

  @Patch(':id/toggle')
  toggleActive(@Req() req: any, @Param('id') id: string) {
    const distributorId = req.user.id || req.user.sub;
    return this.serviceAreaService.toggleActive(distributorId, id);
  }
}
