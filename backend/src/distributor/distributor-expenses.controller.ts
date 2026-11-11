import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserRole } from '@prisma/client';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { DistributorIdentityResolver } from './distributor-identity.resolver';
import { DistributorExpensesService } from './distributor-expenses.service';
import {
  CreateDistributorExpenseDto,
  UpdateDistributorExpenseDto,
  QueryDistributorExpenseDto,
} from './dto/distributor-expense.dto';

@Controller('distributor/expenses')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.DISTRIBUTOR, UserRole.ADMIN)
export class DistributorExpensesController {
  constructor(
    private readonly resolver: DistributorIdentityResolver,
    private readonly expensesService: DistributorExpensesService,
  ) {}

  @Get()
  async findAll(@Req() req: any, @Query() query: QueryDistributorExpenseDto) {
    const identity = await this.resolver.resolve(req.user);
    return this.expensesService.findAll(identity.distributorId, query);
  }

  @Post()
  async create(@Req() req: any, @Body() dto: CreateDistributorExpenseDto) {
    const identity = await this.resolver.resolve(req.user);
    return this.expensesService.create(identity.distributorId, dto, identity.userId);
  }

  @Get(':id')
  async findOne(@Req() req: any, @Param('id') id: string) {
    const identity = await this.resolver.resolve(req.user);
    return this.expensesService.findOne(id, identity.distributorId);
  }

  @Patch(':id')
  async update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateDistributorExpenseDto,
  ) {
    const identity = await this.resolver.resolve(req.user);
    return this.expensesService.update(id, identity.distributorId, dto);
  }

  @Delete(':id')
  async delete(@Req() req: any, @Param('id') id: string) {
    const identity = await this.resolver.resolve(req.user);
    return this.expensesService.delete(id, identity.distributorId);
  }
}
