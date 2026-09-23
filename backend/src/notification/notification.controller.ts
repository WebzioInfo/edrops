import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { NotificationService } from './notification.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller(['notification', 'notifications'])
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  // =========================================================================
  // CUSTOMER NOTIFICATION ENDPOINTS
  // =========================================================================

  @Get()
  @UseGuards(JwtAuthGuard)
  async getMyNotifications(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    const userId = req.user?.id || req.user?.sub;
    return this.notificationService.getCustomerNotifications(userId, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 30,
      status,
    });
  }

  @Get('unread-count')
  @UseGuards(JwtAuthGuard)
  async getUnreadCount(@Req() req: any) {
    const userId = req.user?.id || req.user?.sub;
    return this.notificationService.getUnreadCount(userId);
  }

  @Patch('read-all')
  @UseGuards(JwtAuthGuard)
  async markAllAsRead(@Req() req: any) {
    const userId = req.user?.id || req.user?.sub;
    return this.notificationService.markAllAsRead(userId);
  }

  @Patch(':id/read')
  @UseGuards(JwtAuthGuard)
  async markAsRead(@Req() req: any, @Param('id') id: string) {
    const userId = req.user?.id || req.user?.sub;
    return this.notificationService.markAsRead(userId, id);
  }

  // =========================================================================
  // LEGACY/INTERNAL CRUD METHODS
  // =========================================================================

  @Post()
  create(@Body() createNotificationDto: CreateNotificationDto) {
    return this.notificationService.create(createNotificationDto);
  }

  @Get('admin/all')
  findAll() {
    return this.notificationService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.notificationService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateNotificationDto: UpdateNotificationDto,
  ) {
    return this.notificationService.update(id, updateNotificationDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.notificationService.remove(id);
  }
}
