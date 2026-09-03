import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserRole } from '@prisma/client';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { AdminUsersService } from './admin-users.service';

@Controller('admin/users')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MANAGER)
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Get()
  findAllUsers(
    @Query('role') role?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.adminUsersService.findAllUsers({ role, status, search });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.adminUsersService.findOne(id);
  }

  @Post()
  create(@Body() body: any) {
    return this.adminUsersService.create(body);
  }

  @Patch(':id/jar-unit-price')
  updateJarUnitPrice(
    @Param('id') id: string,
    @Body('jarUnitPrice') jarUnitPrice: number | string,
  ) {
    return this.adminUsersService.updateJarUnitPrice(id, jarUnitPrice);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.adminUsersService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.adminUsersService.remove(id);
  }
}

@Controller('admin/delivery-partners')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MANAGER)
export class AdminDeliveryPartnersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Get()
  findDeliveryPartners(
    @Query('status') status?: string,
    @Query('availability') availability?: string,
    @Query('search') search?: string,
  ) {
    return this.adminUsersService.findDeliveryPartners({
      status,
      availability,
      search,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.adminUsersService.findOne(id);
  }

  @Patch(':id/jar-unit-price')
  updateJarUnitPrice(
    @Param('id') id: string,
    @Body('jarUnitPrice') jarUnitPrice: number | string,
  ) {
    return this.adminUsersService.updateJarUnitPrice(id, jarUnitPrice);
  }
}
