import {
  IsDateString,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';

export class CreateDeliveryDto {
  @IsString()
  customerId: string;

  @IsString()
  addressId: string;

  @IsDateString()
  scheduledFor: string;

  @IsInt()
  @IsPositive()
  quantity: number;

  @IsOptional()
  @IsString()
  scheduleId?: string;

  @IsOptional()
  @IsString()
  staffId?: string;
}
