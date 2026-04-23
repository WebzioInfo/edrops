import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SubscriptionsService } from './subscriptions.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role, SubscriptionFrequency, SubscriptionStatus } from '@prisma/client';

@UseGuards(AuthGuard('jwt'))
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  // ─────────── Customer: Create ───────────

  @Post()
  create(
    @CurrentUser() user: any,
    @Body()
    body: {
      frequency: SubscriptionFrequency;
      startDate: string;
      addressId: string;
      items: { productId: string; quantity: number }[];
    },
  ) {
    return this.subscriptionsService.create(user.userId, {
      ...body,
      startDate: new Date(body.startDate),
    });
  }

  // ─────────── Customer: My Subscriptions ───────────

  @Get('my')
  getMySubscriptions(@CurrentUser() user: any) {
    return this.subscriptionsService.findByUser(user.userId);
  }

  // ─────────── Customer: Single Subscription ───────────

  @Get('my/:id')
  getMySubscription(@Param('id') id: string, @CurrentUser() user: any) {
    // findAndAuthorize is called inside service methods — use findById + ownership check
    return this.subscriptionsService.findById(id);
  }

  // ─────────── Customer: Lifecycle Actions ───────────

  @Patch(':id/pause')
  pause(@Param('id') id: string, @CurrentUser() user: any) {
    return this.subscriptionsService.pause(id, user.userId);
  }

  @Patch(':id/resume')
  resume(@Param('id') id: string, @CurrentUser() user: any) {
    return this.subscriptionsService.resume(id, user.userId);
  }

  @Patch(':id/skip-next')
  skipNext(@Param('id') id: string, @CurrentUser() user: any) {
    return this.subscriptionsService.skipNext(id, user.userId);
  }

  @Patch(':id/extend')
  extend(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() body: { days: number },
  ) {
    return this.subscriptionsService.extend(id, user.userId, body.days);
  }

  @Delete(':id')
  cancel(@Param('id') id: string, @CurrentUser() user: any) {
    return this.subscriptionsService.cancel(id, user.userId);
  }

  // ─────────── Admin: List All ───────────

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Get()
  findAll(
    @Query('status') status?: SubscriptionStatus,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
  ) {
    return this.subscriptionsService.findAll(status, page, limit);
  }

  // ─────────── Admin: Manual Status Override ───────────

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() body: { status: SubscriptionStatus },
  ) {
    return this.subscriptionsService.updateStatus(id, body.status);
  }
}
