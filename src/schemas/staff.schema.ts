import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type StaffDocument = Staff & Document;

export enum StaffRole {
  // Academic Leadership
  PRINCIPAL = 'PRINCIPAL',
  VICE_PRINCIPAL = 'VICE_PRINCIPAL',
  HEAD_OF_DEPARTMENT = 'HEAD_OF_DEPARTMENT',

  // Teaching Staff
  TEACHER = 'TEACHER',
  TEACHING_ASSISTANT = 'TEACHING_ASSISTANT',

  // Administrative
  SCHOOL_ADMINISTRATOR = 'SCHOOL_ADMINISTRATOR',
  ADMISSION_OFFICER = 'ADMISSION_OFFICER',
  HUMAN_RESOURCES = 'HUMAN_RESOURCES',

  // Financial
  FINANCE_MANAGER = 'FINANCE_MANAGER',
  ACCOUNTANT = 'ACCOUNTANT',
  BURSAR = 'BURSAR',

  // Support Staff
  IT_ADMINISTRATOR = 'IT_ADMINISTRATOR',
  LIBRARIAN = 'LIBRARIAN',
  NURSE = 'NURSE',
  COUNSELOR = 'COUNSELOR',

  // Auxiliary
  TRANSPORT_MANAGER = 'TRANSPORT_MANAGER',
  FACILITIES_MANAGER = 'FACILITIES_MANAGER',
}

export enum StaffStatus {
  PENDING_INVITATION = 'PENDING_INVITATION',
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export enum Permission {
  // System-wide permissions
  ALL_ACCESS = 'ALL_ACCESS',
  SYSTEM_SETTINGS = 'SYSTEM_SETTINGS',

  // Academic permissions
  ACADEMIC_OPS = 'ACADEMIC_OPS',
  DEPT_MANAGEMENT = 'DEPT_MANAGEMENT',
  CLASS_MANAGEMENT = 'CLASS_MANAGEMENT',
  GRADE_MANAGEMENT = 'GRADE_MANAGEMENT',
  ATTENDANCE_MGMT = 'ATTENDANCE_MGMT',

  // Student management
  STUDENT_MGMT = 'STUDENT_MGMT',
  ADMISSIONS_MGMT = 'ADMISSIONS_MGMT',
  PARENT_MGMT = 'PARENT_MGMT',

  // Staff management
  STAFF_MGMT = 'STAFF_MGMT',
  HR_OPS = 'HR_OPS',

  // Financial permissions
  FINANCE_OPS = 'FINANCE_OPS',
  FEE_MGMT = 'FEE_MGMT',
  INVOICING = 'INVOICING',
  PAYMENTS = 'PAYMENTS',

  // Support services
  LIBRARY_MGMT = 'LIBRARY_MGMT',
  TRANSPORT_MGMT = 'TRANSPORT_MGMT',
  FACILITIES_MGMT = 'FACILITIES_MGMT',
  HEALTH_RECORDS = 'HEALTH_RECORDS',
}

@Schema({ timestamps: true })
export class Staff {
  @Prop({ required: true })
  userId: string; // references User._id

  @Prop({ required: true })
  tenantId: string;

  @Prop({ type: String, enum: StaffRole, required: true })
  role: StaffRole;

  @Prop()
  department?: string;

  @Prop({ type: [String], default: [] })
  classes: string[]; // to be replaced with ObjectId[] when Academic module is ready

  @Prop({ type: [String], default: [] })
  subjects: string[]; // to be replaced with ObjectId[] when Academic module is ready

  @Prop({ type: [String], enum: Permission, default: [] })
  additionalPermissions: Permission[];

  @Prop({
    type: String,
    enum: StaffStatus,
    default: StaffStatus.PENDING_INVITATION,
  })
  status: StaffStatus;

  @Prop()
  employmentStartDate?: Date;

  @Prop()
  employmentType?: string; // FULL_TIME, PART_TIME, CONTRACT

  @Prop()
  staffId?: string; // School-specific staff ID
}

export const StaffSchema = SchemaFactory.createForClass(Staff);
