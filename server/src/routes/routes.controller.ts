import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RoutesService } from './routes.service';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('routes')
export class RoutesController {
  constructor(private readonly routesService: RoutesService) {}

  @Get()
  @Roles(Role.ADMIN, Role.DISTRIBUTOR)
  findAll() { return this.routesService.findAll(); }

  @Get(':id')
  @Roles(Role.ADMIN, Role.DISTRIBUTOR)
  findOne(@Param('id') id: string) { return this.routesService.findById(id); }

  @Post()
  @Roles(Role.ADMIN)
  create(@Body() body: any) { return this.routesService.create(body); }

  @Patch(':id')
  @Roles(Role.ADMIN)
  update(@Param('id') id: string, @Body() body: any) { return this.routesService.update(id, body); }

  @Delete(':id')
  @Roles(Role.ADMIN)
  remove(@Param('id') id: string) { return this.routesService.delete(id); }
}
