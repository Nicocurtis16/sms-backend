import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, Matches, MinLength, IsPhoneNumber } from 'class-validator';
import { SchoolType, CurriculumType } from '../../schemas/school.schema';

export class RegisterSchoolDto {
  // School Details
  @IsNotEmpty()
  @IsString()
  schoolName: string;

  @IsNotEmpty()
  @IsEnum(SchoolType)
  type: SchoolType;

  @IsNotEmpty({ each: true })
  @IsEnum(CurriculumType, { each: true })
  curricula: CurriculumType[];

  @IsOptional()
  @IsString()
  gesCode?: string;

  @IsNotEmpty()
  @IsString()
  @Matches(/^[A-Z]{2}-\d{3}-\d{4}$/, {
    message: 'Digital Address must be in the format XX-XXX-XXXX',
  })
  digitalAddress: string;

  @IsNotEmpty()
  @IsString()
  region: string;

  @IsNotEmpty()
  @IsString()
  city: string;

  // Admin User Details
  @IsNotEmpty()
  @IsString()
  adminFirstName: string;

  @IsNotEmpty()
  @IsString()
  adminLastName: string;

  @IsNotEmpty()
  @IsEmail()
  adminEmail: string;

  @IsNotEmpty()
  @IsPhoneNumber('GH')
  adminPhone: string;

  @IsNotEmpty()
  @MinLength(8)
  password: string;
}