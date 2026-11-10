import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserRole } from '@prisma/client';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { AnalyticsService } from './analytics.service';
import { CreateAnalyticsDto } from './dto/create-analytics.dto';
import { UpdateAnalyticsDto } from './dto/update-analytics.dto';

@Controller('analytics')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.ADMIN, UserRole.STAFF)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Post()
  create(@Body() createAnalyticsDto: CreateAnalyticsDto) {
    return this.analyticsService.create(createAnalyticsDto);
  }

  @Get('snapshot')
  getSnapshot() {
    return this.analyticsService.getLiveSnapshot();
  }

  @Get()
  findAll() {
    return this.analyticsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.analyticsService.findOne(+id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateAnalyticsDto: UpdateAnalyticsDto,
  ) {
    return this.analyticsService.update(+id, updateAnalyticsDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.analyticsService.remove(+id);
  }
}
