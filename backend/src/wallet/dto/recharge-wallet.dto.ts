import { IsNumber, Min } from 'class-validator';

export class RechargeWalletDto {
  @IsNumber()
  @Min(1)
  amount: number;
}
