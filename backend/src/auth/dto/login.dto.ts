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
}
