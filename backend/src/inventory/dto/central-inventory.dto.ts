import { IsNotEmpty, IsNumber, IsOptional, IsString, Min, IsIn, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class TransferStockDto {
  @IsNotEmpty()
  @IsString()
  distributorId: string;

  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  @Min(1, { message: 'Transfer quantity must be at least 1 jar.' })
  quantity: number;

  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

export class ReturnStockDto {
  @IsNotEmpty()
  @IsString()
  distributorId: string;

  @IsNotEmpty()
  @IsIn(['EMPTY', 'FILLED'], { message: "Stock type must be either 'EMPTY' or 'FILLED'." })
  stockType: 'EMPTY' | 'FILLED';

  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  @Min(1, { message: 'Return quantity must be at least 1 jar.' })
  quantity: number;

  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

export class AdjustDistributorStockDto {
  @IsNotEmpty()
  @IsString()
  distributorId: string;

  @IsOptional()
  @IsString()
  jarItemId?: string;

  @IsOptional()
  @IsIn(['COMPANY', 'DISTRIBUTOR'])
  ownershipType?: 'COMPANY' | 'DISTRIBUTOR';

  @IsNotEmpty()
  @IsIn([
    'FILLED_YARD',
    'EMPTY_YARD',
    'CUSTOMER',
    'WASHING',
    'FILLING',
    'QUARANTINE',
    'DAMAGED',
    'LOST',
  ])
  state:
    | 'FILLED_YARD'
    | 'EMPTY_YARD'
    | 'CUSTOMER'
    | 'WASHING'
    | 'FILLING'
    | 'QUARANTINE'
    | 'DAMAGED'
    | 'LOST';

  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  @Min(0, { message: 'New quantity cannot be negative.' })
  newQuantity: number;

  @IsNotEmpty({ message: 'Adjustment reason is required.' })
  @IsString()
  @MaxLength(255)
  reason: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class AdjustCompanyStockDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  filledJars?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  emptyJars?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  damagedJars?: number;

  @IsNotEmpty({ message: 'Adjustment reason is required.' })
  @IsString()
  @MaxLength(255)
  reason: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class CentralInventoryMovementQueryDto {
  @IsOptional()
  @IsString()
  distributorId?: string;

  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number = 30;
}
