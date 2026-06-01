import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { CreateSettingDto } from './dto/create-setting.dto';
import { UpdateSettingDto } from './dto/update-setting.dto';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard, Roles } from '../auth/roles.guard';
import { UserRole } from '@prisma/client';

@Controller('settings')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Post('bulk')
  @Roles(UserRole.ADMIN)
  updateBulk(@Body() body: Record<string, string>) {
    return this.settingsService.updateBulk(body);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body() createSettingDto: CreateSettingDto) {
    return this.settingsService.create(createSettingDto);
  }

  @Get()
  findAll() {
    return this.settingsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.settingsService.findOne(+id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  update(@Param('id') id: string, @Body() updateSettingDto: UpdateSettingDto) {
    return this.settingsService.update(+id, updateSettingDto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(@Param('id') id: string) {
    return this.settingsService.remove(+id);
  }
}
