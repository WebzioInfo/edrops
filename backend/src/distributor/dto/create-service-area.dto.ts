import { IsString, Matches, IsOptional } from 'class-validator';

export class CreateServiceAreaDto {
  @IsString()
  @Matches(/^\d{6}$/, { message: 'Pincode must be exactly 6 digits' })
  pincode: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  district?: string;

  @IsOptional()
  @IsString()
  state?: string;
}
