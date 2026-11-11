import { PartialType } from '@nestjs/swagger';
import { CreateExpenseDto } from './create-expense.dto';
import { IsOptional, IsString } from 'class-validator';

export class UpdateExpenseDto extends PartialType(CreateExpenseDto) {
  @IsOptional()
  @IsString()
  status?: string; // DRAFT, PENDING_APPROVAL, APPROVED, REJECTED
}
