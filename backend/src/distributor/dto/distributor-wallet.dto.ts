import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class TopUpDistributorWalletDto {
  @IsNumber()
  @Min(1)
  amount: number;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  referenceId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class PayPurchaseFromWalletDto {
  @IsString()
  @IsNotEmpty()
  purchaseId: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  amount?: number;
}

export class RequestDistributorWithdrawalDto {
  @IsNumber()
  @Min(1)
  amount: number;

  @IsString()
  @IsNotEmpty()
  bankName: string;

  @IsString()
  @IsNotEmpty()
  accountNumber: string;

  @IsString()
  @IsNotEmpty()
  ifscCode: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class QueryDistributorWalletTransactionsDto {
  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  page?: number | string;

  @IsOptional()
  limit?: number | string;
}
