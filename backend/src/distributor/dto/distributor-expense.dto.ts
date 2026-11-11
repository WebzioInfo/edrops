import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsOptional,
  IsDateString,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

export const DISTRIBUTOR_EXPENSE_CATEGORIES = [
  'FUEL',
  'VEHICLE_MAINTENANCE',
  'DRIVER_SALARY',
  'HELPER_SALARY',
  'RENT',
  'ELECTRICITY',
  'WATER',
  'LOADING_UNLOADING',
  'TRANSPORTATION',
  'PACKAGING',
  'INTERNET',
  'MARKETING',
  'REPAIRS',
  'BANK_CHARGES',
  'OTHER',
] as const;

export type DistributorExpenseCategory = typeof DISTRIBUTOR_EXPENSE_CATEGORIES[number];

export class CreateDistributorExpenseDto {
  @IsNotEmpty()
  @IsString()
  category: DistributorExpenseCategory;

  @IsNotEmpty()
  @IsString()
  title: string;

  @IsNotEmpty()
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  amount: number;

  @IsOptional()
  @IsDateString()
  expenseDate?: string;

  @IsOptional()
  @IsString()
  @IsIn(['CASH', 'BANK_TRANSFER', 'UPI', 'CHEQUE'])
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  @IsIn(['PAID', 'PENDING'])
  paymentStatus?: string;

  @IsOptional()
  @IsString()
  @IsIn(['APPROVED', 'PENDING_APPROVAL', 'DRAFT', 'CANCELLED'])
  status?: string;

  @IsOptional()
  @IsString()
  vendorName?: string;

  @IsOptional()
  @IsString()
  invoiceNumber?: string;

  @IsOptional()
  @IsString()
  receiptUrl?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateDistributorExpenseDto {
  @IsOptional()
  @IsString()
  category?: DistributorExpenseCategory;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  amount?: number;

  @IsOptional()
  @IsDateString()
  expenseDate?: string;

  @IsOptional()
  @IsString()
  @IsIn(['CASH', 'BANK_TRANSFER', 'UPI', 'CHEQUE'])
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  @IsIn(['PAID', 'PENDING'])
  paymentStatus?: string;

  @IsOptional()
  @IsString()
  @IsIn(['APPROVED', 'PENDING_APPROVAL', 'DRAFT', 'CANCELLED'])
  status?: string;

  @IsOptional()
  @IsString()
  vendorName?: string;

  @IsOptional()
  @IsString()
  invoiceNumber?: string;

  @IsOptional()
  @IsString()
  receiptUrl?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class QueryDistributorExpenseDto {
  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  page?: number | string;

  @IsOptional()
  limit?: number | string;
}
