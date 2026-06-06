import { IsString, IsOptional, IsBoolean, IsArray, ValidateNested, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class BuyNowItemDto {
  @IsString()
  productId: string;
  @IsNumber()
  quantity: number;
}

export class ValidateCheckoutDto {
  @IsBoolean()
  returnEmptyJars: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BuyNowItemDto)
  buyNowItems?: BuyNowItemDto[];
}

export class InitiateCheckoutDto {
  @IsString()
  addressId: string;

  @IsString()
  paymentMethod: string; // 'COD', 'WALLET', 'RAZORPAY', 'HYBRID'

  @IsOptional()
  @IsString()
  timeSlot?: string;

  @IsOptional()
  @IsString()
  scheduledDate?: string;

  @IsBoolean()
  returnEmptyJars: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BuyNowItemDto)
  buyNowItems?: BuyNowItemDto[];
}

export class ConfirmCheckoutDto {
  @IsString()
  orderId: string;

  @IsString()
  paymentMethod: string;

  @IsOptional()
  @IsString()
  razorpayPaymentId?: string;

  @IsOptional()
  @IsString()
  razorpayOrderId?: string;

  @IsOptional()
  @IsString()
  razorpaySignature?: string;
}
