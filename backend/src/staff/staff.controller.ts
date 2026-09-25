import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserRole } from '@prisma/client';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { StaffService } from './staff.service';
import { OrderService } from '../order/order.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { CreateDistributorDto } from './dto/create-distributor.dto';
import { UpdateDistributorDto } from './dto/update-distributor.dto';
import { DriverService } from '../driver/driver.service';
import { DriverQueryDto } from '../driver/dto/driver-query.dto';
import { CreateDriverDto } from '../driver/dto/create-driver.dto';
import { UpdateDriverDto } from '../driver/dto/update-driver.dto';

@Controller('staff')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class StaffController {
  constructor(
    private readonly staffService: StaffService,
    private readonly orderService: OrderService,
    private readonly driverService: DriverService,
  ) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  create(@Body() createStaffDto: CreateStaffDto) {
    return this.staffService.create(createStaffDto);
  }

  // --- DISTRIBUTOR MANAGEMENT ENDPOINTS ---

  @Get('distributors/summary')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  getDistributorsSummary() {
    return this.staffService.getDistributorsSummary();
  }

  @Get('distributors')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  getDistributors(
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('route') route?: string,
  ) {
    return this.staffService.getDistributors({ search, status, route });
  }

  @Get('distributors/:id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  getDistributorById(@Param('id') id: string) {
    return this.staffService.getDistributorById(id);
  }

  @Post('distributors')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  createDistributor(
    @Body() createDistributorDto: CreateDistributorDto,
    @Req() req: any,
  ) {
    const staffUserId = req.user?.sub || req.user?.id || req.user?.userId;
    return this.staffService.createDistributor(createDistributorDto, staffUserId);
  }

  @Patch('distributors/:id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  updateDistributor(
    @Param('id') id: string,
    @Body() updateDistributorDto: UpdateDistributorDto,
  ) {
    return this.staffService.updateDistributor(id, updateDistributorDto);
  }

  @Patch('distributors/:id/status')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  updateDistributorStatus(
    @Param('id') id: string,
    @Body('isActive') isActive: boolean,
  ) {
    return this.staffService.updateDistributorStatus(id, isActive);
  }

  @Get('delivery-partners')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  getDeliveryPartners() {
    return this.staffService.getDeliveryPartners();
  }

  @Patch('orders/:orderId/status')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  updateOrderStatus(
    @Param('orderId') orderId: string,
    @Body('status') status: any,
    @Body('reason') reason: string,
    @Body('paymentConfirmation') paymentConfirmation: any,
    @Req() req: any,
  ) {
    const userId = req.user?.sub || req.user?.id || req.user?.userId;
    const userRole = req.user?.role;
    return this.orderService.updateOrderStatus(orderId, status, userId, reason, paymentConfirmation, false, userRole);
  }

  @Patch('orders/:orderId/assign')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  assignDeliveryPartner(
    @Param('orderId') orderId: string,
    @Body('distributorId') distributorId: string,
    @Body('deliveryPartnerId') deliveryPartnerId: string,
    @Req() req: any,
  ) {
    const userId = req.user?.sub || req.user?.id || req.user?.userId;
    const targetDistributorId = distributorId || deliveryPartnerId;
    return this.orderService.assignStaffDistributor(orderId, targetDistributorId, userId);
  }

  // --- DRIVER MANAGEMENT ENDPOINTS (GLOBAL STAFF SCOPE) ---

  @Get('drivers')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  getStaffDrivers(@Query() query: DriverQueryDto) {
    return this.driverService.findAllForStaff(query);
  }

  @Get('drivers/:id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  getStaffDriverById(@Param('id') id: string) {
    return this.driverService.findOneForStaff(id);
  }

  @Post('drivers')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  createStaffDriver(@Body() dto: CreateDriverDto) {
    return this.driverService.createForStaff(dto);
  }

  @Put('drivers/:id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  updateStaffDriver(@Param('id') id: string, @Body() dto: UpdateDriverDto) {
    return this.driverService.updateForStaff(id, dto);
  }

  @Patch('drivers/:id/status')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  toggleStaffDriverStatus(
    @Param('id') id: string,
    @Body('isActive') isActive: boolean,
  ) {
    return this.driverService.toggleStatusForStaff(id, isActive);
  }

  @Delete('drivers/:id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  deleteStaffDriver(@Param('id') id: string) {
    return this.driverService.deleteForStaff(id);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  findAll() {
    return this.staffService.findAll();
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  findOne(@Param('id') id: string) {
    return this.staffService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  update(@Param('id') id: string, @Body() updateStaffDto: UpdateStaffDto) {
    return this.staffService.update(id, updateStaffDto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  remove(@Param('id') id: string) {
    return this.staffService.remove(id);
  }
}
