import { IsString, IsBoolean, IsOptional, IsNumber } from 'class-validator';

export class CreateAddressDto {
  @IsString() label: string;
  @IsString() fullName: string;
  @IsString() mobileNumber: string;
  @IsOptional() @IsString() houseName?: string;
  @IsOptional() @IsString() buildingName?: string;
  @IsString() street: string;
  @IsOptional() @IsString() landmark?: string;
  @IsOptional() @IsString() area?: string;
  @IsString() city: string;
  @IsString() state: string;
  @IsString() zipCode: string;
  @IsOptional() @IsBoolean() isDefault?: boolean;
  @IsOptional() @IsNumber() latitude?: number;
  @IsOptional() @IsNumber() longitude?: number;
}
