import {
  Controller, Get, Patch, Delete, Body, Param, Query,
  UseGuards, Post,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UsersService } from './users.service';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';

@UseGuards(AuthGuard('jwt'))
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  findAll(@Query('role') role?: Role) {
    return this.usersService.findAll(role);
  }

  @Get('me')
  getMe(@CurrentUser() user: any) {
    return this.usersService.findById(user.userId);
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  findOne(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  update(@Param('id') id: string, @Body() body: any) {
    return this.usersService.update(id, body);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  remove(@Param('id') id: string) {
    return this.usersService.softDelete(id);
  }

  // Address endpoints
  @Get('me/addresses')
  getAddresses(@CurrentUser() user: any) {
    return this.usersService.getAddresses(user.userId);
  }

  @Post('me/addresses')
  addAddress(@CurrentUser() user: any, @Body() body: any) {
    return this.usersService.addAddress(user.userId, body);
  }
}
