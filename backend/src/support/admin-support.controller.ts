import {
  Controller,
  Get,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { SupportService } from './support.service';

@Controller('admin/support')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminSupportController {
  constructor(private readonly supportService: SupportService) {}

  @Get('analytics')
  getAnalytics() {
    return this.supportService.getAdminAnalytics();
  }
}
