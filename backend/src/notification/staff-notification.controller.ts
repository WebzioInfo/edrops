import { Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { StaffNotificationService } from './staff-notification.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/roles.guard';
import { UserRole } from '@prisma/client';

@Controller('staff-notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
export class StaffNotificationController {
  constructor(private readonly staffNotificationService: StaffNotificationService) {}

  @Get('unread')
  async getUnread() {
    const notifications = await this.staffNotificationService.getUnreadNotifications();
    return { data: notifications };
  }

  @Patch(':id/read')
  async markAsRead(@Param('id') id: string) {
    const notification = await this.staffNotificationService.markAsRead(id);
    return { data: notification };
  }

  @Patch('read-all')
  async markAllAsRead() {
    const result = await this.staffNotificationService.markAllAsRead();
    return { data: result };
  }
}
