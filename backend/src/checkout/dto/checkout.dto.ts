import {
  IsString,
  IsOptional,
  IsBoolean,
  IsArray,
  ValidateNested,
  IsNumber,
  IsInt,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class BuyNowItemDto {
  @IsString()
  productId: string;
  @IsInt()
  @Min(1)
  quantity: number;
}

export class ItemReturnDto {
  @IsString()
  productId: string;
  @IsInt()
  @Min(0)
  quantity: number;
}

export class AdditionalReturnDto {
  @IsString()
  brandId: string;
  @IsInt()
  @Min(0)
  quantity: number;
}

export class AdminOverrideDto {
  @IsOptional()
  @IsBoolean()
  waiveDeposit?: boolean;

  @IsOptional()
  @IsBoolean()
  waiveDelivery?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  customDiscount?: number;

  @IsOptional()
  @IsString()
  adminNotes?: string;
}

export class ValidateCheckoutDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItemReturnDto)
  itemReturns?: ItemReturnDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdditionalReturnDto)
  additionalReturns?: AdditionalReturnDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BuyNowItemDto)
  buyNowItems?: BuyNowItemDto[];

  @IsOptional()
  @IsString()
  promoCode?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => AdminOverrideDto)
  adminOverride?: AdminOverrideDto;
}

export class InitiateCheckoutDto {
  @IsString()
  addressId: string;

  @IsString()
  paymentMethod: string; // 'COD', 'WALLET', 'RAZORPAY', 'HYBRID'

  @IsOptional()
  @IsString()
  hybridSecondaryMethod?: string; // 'CASH', 'ONLINE'

  @IsOptional()
  @IsString()
  orderSource?: string; // 'CUSTOMER_APP', 'STAFF_CREATED', 'ADMIN_CREATED', 'PHONE_ORDER', 'WALK_IN'

  @IsOptional()
  @IsString()
  timeSlot?: string;

  @IsOptional()
  @IsString()
  scheduledDate?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItemReturnDto)
  itemReturns?: ItemReturnDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdditionalReturnDto)
  additionalReturns?: AdditionalReturnDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BuyNowItemDto)
  buyNowItems?: BuyNowItemDto[];

  @IsOptional()
  @IsString()
  promoCode?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => AdminOverrideDto)
  adminOverride?: AdminOverrideDto;
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
