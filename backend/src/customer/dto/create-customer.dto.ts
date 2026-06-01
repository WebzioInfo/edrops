import { IsOptional, IsString } from 'class-validator';

export class CreateCustomerDto {
  @IsString()
  userId: string;

  @IsOptional()
  @IsString()
  referralCode?: string;
}
