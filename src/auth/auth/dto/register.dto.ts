import { IsEmail, IsIn, IsString } from 'class-validator';

export class RegisterDto{
  @IsString()
  schoolName: string;

  @IsEmail()
  email: string;

  @IsString()
  password: string;

  @IsIn(['JHS', 'SHS', 'University'])
  curriculum: string;
}