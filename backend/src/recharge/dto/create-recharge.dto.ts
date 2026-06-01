import { IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class CreateRechargeDto {
  @IsString()
  customerId: string;

  @IsString()
  jarPackId: string;

  @IsNumber()
  @IsPositive()
  amount: number;

  @IsNumber()
  @IsPositive()
  jarsAdded: number;

  @IsOptional()
  @IsString()
  offerId?: string;
}
