import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  IsDateString,
} from 'class-validator';

export class InventoryTransactionsQuery {
  @IsOptional()
  @IsIn(['COMPANY_OWNED', 'DISTRIBUTOR_OWNED'])
  ownership?: 'COMPANY_OWNED' | 'DISTRIBUTOR_OWNED';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @IsOptional()
  @IsIn(['OPENING_BALANCE', 'ADJUSTMENT', 'OUT_FOR_DELIVERY', 'RETURN', 'ALLOCATION_RELEASED'])
  type?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @IsString()
  jarItemId?: string;
}
