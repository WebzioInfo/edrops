import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsArray,
  ValidateNested,
  IsNumber,
  Min,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePartnerOrderItemDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsNumber()
  @Min(1)
  @Type(() => Number)
  quantity: number;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  unitPrice: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  partnerCost?: number;
}

export class OverrideAddressDto {
  @IsString()
  @IsNotEmpty()
  street: string;

  @IsOptional()
  @IsString()
  houseName?: string;

  @IsOptional()
  @IsString()
  buildingName?: string;

  @IsOptional()
  @IsString()
  area?: string;

  @IsOptional()
  @IsString()
  landmark?: string;

  @IsString()
  @IsNotEmpty()
  city: string;

  @IsOptional()
  @IsString()
  district?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsString()
  @IsNotEmpty()
  zipCode: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  latitude?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  longitude?: number;

  @IsOptional()
  @IsString()
  googleMapsUrl?: string;
}

export class CreatePartnerOrderDto {
  @IsString()
  @IsNotEmpty()
  customerId: string;

  @IsOptional()
  @IsEnum(['SAVED', 'OVERRIDE'])
  deliveryLocationMode?: 'SAVED' | 'OVERRIDE';

  @IsOptional()
  @IsString()
  deliveryAddressId?: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => OverrideAddressDto)
  overrideAddress?: OverrideAddressDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePartnerOrderItemDto)
  items: CreatePartnerOrderItemDto[];

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  adminNotes?: string;

  @IsOptional()
  @IsString()
  timeSlot?: string;
}
