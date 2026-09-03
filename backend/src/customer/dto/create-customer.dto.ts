import {
  IsString,
  IsOptional,
  IsEmail,
  IsNotEmpty,
  IsEnum,
  IsNumber,
  IsInt,
  Min,
  IsBoolean,
  ValidateNested,
  IsArray,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AddressDto {
  @IsString() @IsOptional() @MaxLength(100) houseName?: string;
  @IsString() @IsOptional() @MaxLength(100) buildingName?: string;
  @IsString() @IsNotEmpty() @MinLength(3) @MaxLength(255) street: string;
  @IsString() @IsOptional() @MaxLength(100) area?: string;
  @IsString() @IsOptional() @MaxLength(100) landmark?: string;
  @IsString() @IsNotEmpty() @MinLength(2) @MaxLength(100) city: string;
  @IsString() @IsOptional() @MaxLength(100) district?: string;
  @IsString() @IsNotEmpty() @MinLength(2) @MaxLength(100) state: string;
  @IsString() @IsNotEmpty() country: string;
  @IsString() @IsNotEmpty() @MinLength(4) @MaxLength(20) zipCode: string;
  @IsNumber() @IsOptional() latitude?: number;
  @IsNumber() @IsOptional() longitude?: number;
  @IsString() @IsOptional() googleMapsUrl?: string;
  @IsString() @IsOptional() @MaxLength(500) addressNotes?: string;
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
  @IsInt() @IsOptional() @Min(0) @Type(() => Number) jars_at_customer?: number;
  @IsInt() @IsOptional() @Min(0) @Type(() => Number) jarsAtCustomer?: number;

  @IsString() @IsOptional() referralCode?: string;
  @IsString() @IsOptional() referredById?: string;

  @IsString() @IsOptional() password?: string;
  @IsBoolean() @IsOptional() generateRandomPassword?: boolean;
}
