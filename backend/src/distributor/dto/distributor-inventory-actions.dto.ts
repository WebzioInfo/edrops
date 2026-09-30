import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum JarPhysicalState {
  FILLED_YARD = 'FILLED_YARD',
  EMPTY_YARD = 'EMPTY_YARD',
  WASHING = 'WASHING',
  FILLING = 'FILLING',
  QUARANTINE = 'QUARANTINE',
  DAMAGED = 'DAMAGED',
  LOST = 'LOST',
  CUSTOMER = 'CUSTOMER',
}

export class MoveJarStateDto {
  @IsString()
  @IsNotEmpty()
  jarItemId: string;

  @IsEnum(JarPhysicalState)
  @IsNotEmpty()
  fromState: JarPhysicalState;

  @IsEnum(JarPhysicalState)
  @IsNotEmpty()
  toState: JarPhysicalState;

  @IsNumber()
  @Min(1)
  @Type(() => Number)
  quantity: number;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class AdjustJarStockDto {
  @IsString()
  @IsNotEmpty()
  jarItemId: string;

  @IsEnum(JarPhysicalState)
  @IsNotEmpty()
  state: JarPhysicalState;

  @IsNumber()
  @Type(() => Number)
  quantity: number;

  @IsString()
  @IsNotEmpty()
  reason: string;

  @IsOptional()
  @IsBoolean()
  isOwnershipChange?: boolean;
}

export class CustomerJarReturnDto {
  @IsString()
  @IsNotEmpty()
  customerId: string;

  @IsString()
  @IsNotEmpty()
  jarItemId: string;

  @IsNumber()
  @Min(1)
  @Type(() => Number)
  quantity: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
