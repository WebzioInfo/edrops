import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { DistributorsService } from './distributors.service';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';

@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('distributors')
export class DistributorsController {
  constructor(private readonly distributorsService: DistributorsService) {}

  @Roles(Role.ADMIN)
  @Get()
  findAll() { return this.distributorsService.findAll(); }

  @Roles(Role.ADMIN, Role.DISTRIBUTOR)
  @Get(':id')
  findOne(@Param('id') id: string) { return this.distributorsService.findById(id); }

  @Roles(Role.ADMIN, Role.DISTRIBUTOR)
  @Get(':id/orders/pending')
  getPendingOrders(@Param('id') id: string) { return this.distributorsService.getPendingOrders(id); }

  @Roles(Role.ADMIN)
  @Post()
  create(@Body() body: any) { return this.distributorsService.create(body); }

  @Roles(Role.ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any) { return this.distributorsService.update(id, body); }
}
