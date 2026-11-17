import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsOptional()
  identifier?: string; // Accepts email or phone number

  @IsString()
  @IsOptional()
  email?: string; // Backwards compatibility for legacy API callers

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsString()
  @IsOptional()
  roleHint?: string; // Optional preferred role (e.g. 'DISTRIBUTOR', 'CUSTOMER', 'STAFF', 'ADMIN')
}
