import { IsString, IsOptional, IsBoolean, IsNumber, IsUUID, IsUrl } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class CreateProductDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @Type(() => Number)
  @IsNumber()
  price: number;

  @IsUUID()
  brandId: string;

  @IsUUID()
  categoryId: string;

  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  @IsOptional()
  isJar?: boolean;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  depositAmount?: number;

  @IsUrl()
  @IsOptional()
  imageUrl?: string;
}
