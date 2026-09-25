import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
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
import { DriverService } from './driver.service';
import { CreateDriverDto } from './dto/create-driver.dto';
import { UpdateDriverDto } from './dto/update-driver.dto';
import { DriverQueryDto } from './dto/driver-query.dto';

// -------------------------------------------------------------
// UNIFIED DRIVER CONTROLLER
// Prefix: /drivers
// Intelligently separates authorization context based on user role:
// - DISTRIBUTOR: strictly isolated to the authenticated distributor ID.
// - STAFF / MANAGER / ADMIN: global scope across all distributors.
// -------------------------------------------------------------
@Controller('drivers')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.DISTRIBUTOR, UserRole.STAFF, UserRole.MANAGER, UserRole.ADMIN)
export class DriverController {
  constructor(private readonly driverService: DriverService) {}

  @Get()
  findAll(@Req() req: any, @Query() query: DriverQueryDto) {
    const role = req.user?.role;
    if (role === UserRole.DISTRIBUTOR) {
      const distributorId = req.user.id || req.user.sub;
      return this.driverService.findAllForDistributor(distributorId, query);
    }
    // Staff / Manager / Admin -> Global driver scope
    return this.driverService.findAllForStaff(query);
  }

  @Get(':id')
  findOne(@Req() req: any, @Param('id') id: string) {
    const role = req.user?.role;
    if (role === UserRole.DISTRIBUTOR) {
      const distributorId = req.user.id || req.user.sub;
      return this.driverService.findOneForDistributor(id, distributorId);
    }
    // Staff / Manager / Admin -> Global driver scope
    return this.driverService.findOneForStaff(id);
  }

  @Post()
  create(@Req() req: any, @Body() dto: CreateDriverDto) {
    const role = req.user?.role;
    if (role === UserRole.DISTRIBUTOR) {
      // Distributor: ownership is strictly derived from authenticated user
      const distributorId = req.user.id || req.user.sub;
      return this.driverService.createForDistributor(distributorId, dto);
    }
    // Staff / Manager / Admin: create driver for selected distributor
    return this.driverService.createForStaff(dto);
  }

  @Put(':id')
  update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateDriverDto,
  ) {
    const role = req.user?.role;
    if (role === UserRole.DISTRIBUTOR) {
      const distributorId = req.user.id || req.user.sub;
      return this.driverService.updateForDistributor(id, distributorId, dto);
    }
    // Staff / Manager / Admin: can update driver across distributors
    return this.driverService.updateForStaff(id, dto);
  }

  @Patch(':id/status')
  toggleStatus(
    @Req() req: any,
    @Param('id') id: string,
    @Body('isActive') isActive: boolean,
  ) {
    const role = req.user?.role;
    if (role === UserRole.DISTRIBUTOR) {
      const distributorId = req.user.id || req.user.sub;
      return this.driverService.toggleStatusForDistributor(id, distributorId, isActive);
    }
    // Staff / Manager / Admin: can toggle status globally
    return this.driverService.toggleStatusForStaff(id, isActive);
  }

  @Delete(':id')
  delete(@Req() req: any, @Param('id') id: string) {
    const role = req.user?.role;
    if (role === UserRole.DISTRIBUTOR) {
      const distributorId = req.user.id || req.user.sub;
      return this.driverService.deleteForDistributor(id, distributorId);
    }
    // Staff / Manager / Admin: can delete/deactivate globally
    return this.driverService.deleteForStaff(id);
  }
}

// -------------------------------------------------------------
// STAFF DRIVER CONTROLLER
// Prefix: /staff/drivers
// Specifically dedicated for Staff portal operations
// -------------------------------------------------------------
@Controller('staff/drivers')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
export class StaffDriverController {
  constructor(private readonly driverService: DriverService) {}

  @Get()
  findAll(@Query() query: DriverQueryDto) {
    return this.driverService.findAllForStaff(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.driverService.findOneForStaff(id);
  }

  @Post()
  create(@Body() dto: CreateDriverDto) {
    return this.driverService.createForStaff(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateDriverDto) {
    return this.driverService.updateForStaff(id, dto);
  }

  @Patch(':id/status')
  toggleStatus(@Param('id') id: string, @Body('isActive') isActive: boolean) {
    return this.driverService.toggleStatusForStaff(id, isActive);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.driverService.deleteForStaff(id);
  }
}
