import {
  IsString,
  IsOptional,
  IsEmail,
  IsBoolean,
  IsInt,
  Min,
  Matches,
  IsArray,
} from 'class-validator';

export class UpdateDistributorDto {
  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsEmail({}, { message: 'Must be a valid email address' })
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  @Matches(/^[A-Za-z0-9-_]+$/, {
    message: 'Referral code must contain only letters, numbers, hyphens and underscores',
  })
  referralCode?: string;

  @IsString()
  @IsOptional()
  password?: string;

  @IsString()
  @IsOptional()
  agencyName?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  routeOrArea?: string;

  @IsString()
  @IsOptional()
  vehicleType?: string;

  @IsString()
  @IsOptional()
  vehiclePlate?: string;

  @IsString()
  @IsOptional()
  jarOwnership?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  companyOwnedJars?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  distributorOwnedJars?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  servicePincodes?: string[];
}
