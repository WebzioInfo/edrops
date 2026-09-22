import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class AdjustSupplierBalanceDto {
  @IsNotEmpty()
  @IsNumber()
  newBalance: number;

  @IsNotEmpty()
  @IsString()
  reason: string;

  @IsOptional()
  @IsString()
  reference?: string;
}
