import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsNumber,
  Min,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateRawMaterialDto {
  @IsString()
  @IsNotEmpty({ message: 'Material name is required' })
  name: string;

  @IsString()
  @IsNotEmpty({ message: 'Material code is required' })
  code: string;

  @IsString()
  @IsOptional()
  category?: string; // 'PACKAGING', 'PREFORM', 'CAP', 'LABEL', 'EMPTY_JAR'

  @IsString()
  @IsOptional()
  unit?: string; // 'PCS', 'KG', 'ROLL'

  @IsInt()
  @Min(0)
  @IsOptional()
  centralStock?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  reorderLevel?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  unitCost?: number;
}

export class IssueRawMaterialItemDto {
  @IsString()
  @IsNotEmpty({ message: 'Material ID is required' })
  materialId: string;

  @IsInt()
  @Min(1, { message: 'Quantity must be at least 1' })
  quantity: number;
}

export class IssueRawMaterialsDto {
  @IsString()
  @IsNotEmpty({ message: 'Distributor ID is required' })
  distributorId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IssueRawMaterialItemDto)
  items: IssueRawMaterialItemDto[];

  @IsString()
  @IsOptional()
  referenceId?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class ProductionConsumptionItemDto {
  @IsString()
  @IsNotEmpty({ message: 'Material ID is required' })
  materialId: string;

  @IsInt()
  @Min(1, { message: 'Consumed quantity must be at least 1' })
  quantity: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  wastageQuantity?: number;
}

export class RecordProductionBatchDto {
  @IsInt()
  @Min(1, { message: 'Output quantity must be at least 1' })
  outputQuantity: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  rejectedQuantity?: number;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ProductionConsumptionItemDto)
  consumptions?: ProductionConsumptionItemDto[];

  @IsString()
  @IsOptional()
  notes?: string;
}

export class SettleJarsDto {
  @IsInt()
  @Min(1, { message: 'Jars to settle must be at least 1' })
  jarsToSettle: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  unitPrice?: number;

  @IsString()
  @IsOptional()
  paymentMethod?: string; // 'BANK_TRANSFER', 'CASH', 'UPI', 'ONLINE'

  @IsString()
  @IsOptional()
  paymentReference?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
