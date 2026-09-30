import { IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class SetupPasswordDto {
  @IsString()
  @IsNotEmpty({ message: 'Activation token is required.' })
  token: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long.' })
  password: string;

  @IsOptional()
  @IsString()
  confirmPassword?: string;
}

export class ResendActivationDto {
  @IsString()
  @IsNotEmpty({ message: 'Email is required.' })
  email: string;
}
