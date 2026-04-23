import { IsString, IsPhoneNumber, MinLength, IsEnum, IsOptional, IsEmail } from 'class-validator';
import { Role } from '@prisma/client';

export class RegisterDto {
  @IsString()
  name: string;

  @IsString()
  phone: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsEnum(Role)
  @IsOptional()
  role?: Role = Role.CUSTOMER;
}
