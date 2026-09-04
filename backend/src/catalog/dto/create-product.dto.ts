import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsUUID,
  IsUrl,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateProductDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  description?: string;

  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0)
  price: number;

  @IsUUID()
  brandId: string;

  @IsUUID()
  categoryId: string;

  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  @IsOptional()
  isJar?: boolean;

  @Transform(({ value }) => (value === '' || value === undefined || value === null ? 0 : Number(value)))
  @IsNumber()
  @Min(0)
  @IsOptional()
  depositAmount?: number;

  @IsUrl()
  @IsOptional()
  imageUrl?: string;
}
