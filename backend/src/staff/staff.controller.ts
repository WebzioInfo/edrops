import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
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

@Controller('staff')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class StaffController {
  constructor(
    private readonly staffService: StaffService,
    private readonly orderService: OrderService,
  ) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  create(@Body() createStaffDto: CreateStaffDto) {
    return this.staffService.create(createStaffDto);
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
    return this.orderService.updateOrderStatus(orderId, status, userId, reason, paymentConfirmation);
  }

  @Patch('orders/:orderId/assign')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  assignDeliveryPartner(
    @Param('orderId') orderId: string,
    @Body('deliveryPartnerId') deliveryPartnerId: string,
    @Req() req: any,
  ) {
    const userId = req.user?.sub || req.user?.id || req.user?.userId;
    return this.orderService.assignDeliveryPartner(orderId, deliveryPartnerId, userId);
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
