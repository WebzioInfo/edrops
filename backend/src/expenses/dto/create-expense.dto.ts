import { IsNotEmpty, IsNumber, IsString, IsOptional, IsEnum, Min } from 'class-validator';

export class CreateExpenseDto {
  @IsNotEmpty()
  @IsString()
  category: string; // FUEL, RENT, SALARIES, MAINTENANCE, UTILITIES, MARKETING, PACKAGING, OTHER

  @IsNotEmpty()
  @IsString()
  title: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsOptional()
  @IsString()
  expenseDate?: string;

  @IsOptional()
  @IsString()
  paymentMethod?: string; // CASH, BANK_TRANSFER, UPI, CHEQUE

  @IsOptional()
  @IsString()
  paymentStatus?: string; // PENDING, PAID

  @IsOptional()
  @IsString()
  vendorName?: string;

  @IsOptional()
  @IsString()
  invoiceNumber?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
