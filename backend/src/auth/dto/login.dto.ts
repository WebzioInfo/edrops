import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  identifier: string; // Accepts email or phone number

  @IsString()
  @IsNotEmpty()
  password: string;
}
