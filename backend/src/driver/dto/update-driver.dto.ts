import {
  IsString,
  IsOptional,
  IsBoolean,
  Matches,
} from 'class-validator';

export class UpdateDriverDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[0-9+\-\s]{7,15}$/, { message: 'Please provide a valid phone number' })
  phone?: string;

  @IsOptional()
  @IsString()
  alternatePhone?: string;

  @IsOptional()
  @IsString()
  routeOrArea?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[0-9]{6}$/, { message: 'Pincode must be exactly 6 digits' })
  pincode?: string;

  @IsOptional()
  @IsString()
  vehicleType?: string;

  @IsOptional()
  @IsString()
  vehicleNumber?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
