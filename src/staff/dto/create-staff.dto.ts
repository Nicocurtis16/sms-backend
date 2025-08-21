import {
  IsArray,
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { StaffRole, Permission } from '../../schemas/staff.schema';

export class CreateStaffDto {
  @IsNotEmpty()
  @IsString()
  firstName: string;

  @IsNotEmpty()
  @IsString()
  lastName: string;

  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsNotEmpty()
  @IsEnum(StaffRole)
  role: StaffRole;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsArray()
  classes?: string[];

  @IsOptional()
  @IsArray()
  subjects?: string[];

  @IsOptional()
  @IsArray()
  @IsEnum(Permission, { each: true })
  additionalPermissions?: Permission[];

  @IsOptional()
  @IsDateString()
  employmentStartDate?: string;

  @IsOptional()
  @IsString()
  employmentType?: string;

  @IsOptional()
  @IsString()
  staffId?: string;
}
