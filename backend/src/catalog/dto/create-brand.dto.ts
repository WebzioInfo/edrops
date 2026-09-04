import { IsString, IsOptional, IsBoolean, IsUrl } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateBrandDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  description?: string;

  @IsUrl()
  @IsOptional()
  logoUrl?: string;

  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
