import {
  IsString,
  IsOptional,
  IsEmail,
  IsNotEmpty,
  IsEnum,
  IsNumber,
  Min,
  IsBoolean,
  ValidateNested,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AddressDto {
  @IsString() @IsOptional() houseName?: string;
  @IsString() @IsOptional() buildingName?: string;
  @IsString() street: string;
  @IsString() @IsOptional() area?: string;
  @IsString() @IsOptional() landmark?: string;
  @IsString() city: string;
  @IsString() state: string;
  @IsString() country: string;
  @IsString() zipCode: string;
  @IsNumber() @IsOptional() latitude?: number;
  @IsNumber() @IsOptional() longitude?: number;
  @IsBoolean() @IsOptional() isDefault?: boolean;
}

export class CreateCustomerDto {
  @IsString() @IsNotEmpty() firstName: string;
  @IsString() @IsNotEmpty() lastName: string;
  @IsString() @IsNotEmpty() phone: string;
  @IsString() @IsOptional() alternatePhone?: string;
  @IsEmail() @IsOptional() email?: string;
  @IsString() @IsOptional() gender?: string;
  @IsString() @IsOptional() dateOfBirth?: string;

  @IsString() @IsOptional() customerType?: string;
  @IsString() @IsOptional() gstNumber?: string;
  @IsString() @IsOptional() companyName?: string;
  @IsString() @IsOptional() contactPerson?: string;
  @IsString() @IsOptional() businessCategory?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AddressDto)
  @IsOptional()
  addresses?: AddressDto[];

  @IsString() @IsOptional() preferredTimeSlot?: string;
  @IsArray()
  @IsOptional()
  @IsNumber({}, { each: true })
  preferredDeliveryDays?: number[];
  @IsString() @IsOptional() deliveryInstructions?: string;

  @IsNumber() @IsOptional() @Min(0) openingWalletBalance?: number;
  @IsNumber() @IsOptional() @Min(0) openingJarBalance?: number;
  @IsNumber() @IsOptional() @Min(0) openingDeposit?: number;

  @IsString() @IsOptional() referralCode?: string;
  @IsString() @IsOptional() referredById?: string;

  @IsString() @IsOptional() password?: string;
  @IsBoolean() @IsOptional() generateRandomPassword?: boolean;
}
