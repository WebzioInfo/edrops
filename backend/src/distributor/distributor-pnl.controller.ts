import {
  Controller,
  Get,
  Query,
  Req,
  UseGuards,
  Header,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserRole } from '@prisma/client';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { DistributorIdentityResolver } from './distributor-identity.resolver';
import { DistributorPnlService, PnlQueryDto } from './distributor-pnl.service';

@Controller('distributor/reports/pnl')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.DISTRIBUTOR, UserRole.ADMIN)
export class DistributorPnlController {
  constructor(
    private readonly resolver: DistributorIdentityResolver,
    private readonly pnlService: DistributorPnlService,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate')
  async getPnlStatement(
    @Req() req: any,
    @Query() query: PnlQueryDto,
    @Query('distributorId') explicitDistributorId?: string,
  ) {
    const identity = await this.resolver.resolve(req.user, explicitDistributorId);
    return this.pnlService.getPnlStatement(identity, query);
  }

  @Get('summary')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate')
  async getPnlSummary(
    @Req() req: any,
    @Query() query: PnlQueryDto,
    @Query('distributorId') explicitDistributorId?: string,
  ) {
    const identity = await this.resolver.resolve(req.user, explicitDistributorId);
    return this.pnlService.getPnlSummary(identity, query);
  }

  @Get('details')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate')
  async getPnlDetails(
    @Req() req: any,
    @Query() query: PnlQueryDto,
    @Query('distributorId') explicitDistributorId?: string,
  ) {
    const identity = await this.resolver.resolve(req.user, explicitDistributorId);
    return this.pnlService.getPnlDetails(identity, query);
  }
}
