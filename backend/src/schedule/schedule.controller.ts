import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ScheduleService } from './schedule.service';
import type { ScheduleUpdateInput } from './schedule.service';

@Controller('schedule')
@UseGuards(AuthGuard('jwt'))
export class ScheduleController {
  constructor(private readonly scheduleService: ScheduleService) {}

  @Get()
  getSchedule(@Request() req) {
    return this.scheduleService.getSchedule(req.user.sub ?? req.user.id);
  }

  @Post()
  updateSchedule(@Request() req, @Body() body: ScheduleUpdateInput) {
    return this.scheduleService.updateSchedule(
      req.user.sub ?? req.user.id,
      body,
    );
  }

  @Post(':customerId')
  updateCustomerSchedule(
    @Param('customerId') customerId: string,
    @Body() body: ScheduleUpdateInput,
  ) {
    return this.scheduleService.updateScheduleByCustomerId(customerId, body);
  }
}
