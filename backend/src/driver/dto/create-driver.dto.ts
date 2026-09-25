import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  Matches,
} from 'class-validator';

export class CreateDriverDto {
  @IsString()
  @IsNotEmpty({ message: 'Full name is required' })
  name: string;

  @IsString()
  @IsNotEmpty({ message: 'Phone number is required' })
  @Matches(/^[0-9+\-\s]{7,15}$/, { message: 'Please provide a valid phone number' })
  phone: string;

  @IsOptional()
  @IsString()
  alternatePhone?: string;

  @IsOptional()
  @IsString()
  routeOrArea?: string;

  @IsString()
  @IsNotEmpty({ message: 'Pincode is required' })
  @Matches(/^[0-9]{6}$/, { message: 'Pincode must be exactly 6 digits' })
  pincode: string;

  @IsString()
  @IsNotEmpty({ message: 'Vehicle type is required' })
  vehicleType: string; // '2 Wheeler', '3 Wheeler', '4 Wheeler', 'Other'

  @IsString()
  @IsNotEmpty({ message: 'Vehicle number is required' })
  vehicleNumber: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  // Optional: only permitted when staff/admin creates a driver for a distributor
  @IsOptional()
  @IsString()
  distributorId?: string;
}
