import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserRole } from '@prisma/client';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';

@Controller('expenses')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.MANAGER)
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Post()
  create(@Req() req: any, @Body() createExpenseDto: CreateExpenseDto) {
    const userId = req.user?.id || req.user?.sub;
    return this.expensesService.createExpense(createExpenseDto, userId);
  }

  @Get()
  findAll(
    @Query('category') category?: string,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.expensesService.getExpenses({
      category,
      status,
      startDate,
      endDate,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get('summary')
  getSummary(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    if (end && endDate && endDate.length <= 10) {
      end.setHours(23, 59, 59, 999);
    }
    return this.expensesService.getExpenseSummary(start, end);
  }

  @Patch(':id')
  update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() updateExpenseDto: UpdateExpenseDto,
  ) {
    const userId = req.user?.id || req.user?.sub;
    return this.expensesService.updateExpense(id, updateExpenseDto, userId);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.expensesService.deleteExpense(id);
  }
}
