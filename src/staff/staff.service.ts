import { BadRequestException, Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Staff,
  StaffDocument,
  StaffRole,
  Permission,
  StaffStatus,
} from '../schemas/staff.schema';
import { User, UserDocument, UserRole } from '../schemas/user.schema';
import { School, SchoolDocument } from '../schemas/school.schema';
import { CreateStaffDto } from './dto/create-staff.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class StaffService {
  constructor(
    @InjectModel(Staff.name) private readonly staffModel: Model<StaffDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(School.name)
    private readonly schoolModel: Model<SchoolDocument>,
    private readonly mailerService: MailerService,
  ) {}

  private getDefaultPermissions(role: StaffRole): Permission[] {
    switch (role) {
      case StaffRole.PRINCIPAL:
        return [Permission.ALL_ACCESS];
      case StaffRole.VICE_PRINCIPAL:
        return [
          Permission.ACADEMIC_OPS,
          Permission.STAFF_MGMT,
          Permission.STUDENT_MGMT,
        ];
      case StaffRole.HEAD_OF_DEPARTMENT:
        return [Permission.DEPT_MANAGEMENT, Permission.CLASS_MANAGEMENT];
      case StaffRole.TEACHER:
        return [
          Permission.CLASS_MANAGEMENT,
          Permission.GRADE_MANAGEMENT,
          Permission.ATTENDANCE_MGMT,
        ];
      case StaffRole.TEACHING_ASSISTANT:
        return [Permission.ATTENDANCE_MGMT, Permission.GRADE_MANAGEMENT];
      case StaffRole.SCHOOL_ADMINISTRATOR:
        return [Permission.STUDENT_MGMT, Permission.STAFF_MGMT];
      case StaffRole.ADMISSION_OFFICER:
        return [Permission.ADMISSIONS_MGMT];
      case StaffRole.HUMAN_RESOURCES:
        return [Permission.HR_OPS, Permission.STAFF_MGMT];
      case StaffRole.FINANCE_MANAGER:
        return [
          Permission.FINANCE_OPS,
          Permission.FEE_MGMT,
          Permission.INVOICING,
        ];
      case StaffRole.ACCOUNTANT:
        return [Permission.FEE_MGMT, Permission.INVOICING, Permission.PAYMENTS];
      case StaffRole.BURSAR:
        return [Permission.PAYMENTS];
      case StaffRole.IT_ADMINISTRATOR:
        return [Permission.SYSTEM_SETTINGS];
      case StaffRole.LIBRARIAN:
        return [Permission.LIBRARY_MGMT];
      case StaffRole.NURSE:
        return [Permission.HEALTH_RECORDS];
      case StaffRole.COUNSELOR:
        return [Permission.STUDENT_MGMT];
      case StaffRole.TRANSPORT_MANAGER:
        return [Permission.TRANSPORT_MGMT];
      case StaffRole.FACILITIES_MANAGER:
        return [Permission.FACILITIES_MGMT];
      default:
        return [];
    }
  }

  async createManual(tenantId: string, dto: CreateStaffDto) {
    const existingUser = await this.userModel.findOne({ email: dto.email });
    if (existingUser) {
      throw new BadRequestException('A user with this email already exists');
    }

    const school = await this.schoolModel.findById(tenantId);
    if (!school || !school.isVerified) {
      throw new BadRequestException('School not verified');
    }

    const tempPassword = (Math.random().toString(36).slice(-8) + 'Aa1!').slice(
      0,
      12,
    );
    const hashedPassword = await bcrypt.hash(tempPassword, 12);

    const user = new this.userModel({
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email,
      phone: dto.phone || '',
      password: hashedPassword,
      role: UserRole.ADMIN, // platform user role; fine-grained in Staff.role
      tenantId,
      isActive: true,
    });
    await user.save();

    const permissions = Array.from(
      new Set([
        ...(this.getDefaultPermissions(dto.role) || []),
        ...((dto.additionalPermissions || []) as Permission[]),
      ]),
    );
    const staff = new this.staffModel({
      userId: (user as any).id,
      tenantId,
      role: dto.role,
      department: dto.department,
      classes: dto.classes || [],
      subjects: dto.subjects || [],
      additionalPermissions: permissions,
      status: StaffStatus.PENDING_INVITATION,
      employmentStartDate: dto.employmentStartDate
        ? new Date(dto.employmentStartDate)
        : undefined,
      employmentType: dto.employmentType,
      staffId: dto.staffId,
    });
    await staff.save();

    // Send invite email
    const activationBase =
      process.env.FRONTEND_SET_PASSWORD_URL ||
      'https://your-sms-platform.com/set-password';
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      { sub: (user as any).id, purpose: 'staff-invite' },
      process.env.PASSWORD_RESET_SECRET || process.env.JWT_SECRET || 'changeme',
      { expiresIn: '3d' },
    );
    const activationUrl = `${activationBase}?token=${encodeURIComponent(token)}`;
    try {
      await this.mailerService.sendMail({
        to: user.email,
        subject: 'You are invited to join the School Platform',
        template: './staff-invite',
        context: {
          firstName: user.firstName,
          schoolName: school.schoolName,
          role: dto.role,
          activationUrl,
          currentYear: new Date().getFullYear(),
        },
      });
    } catch (e) {}

    return {
      message: 'Staff created. Invitation will be sent via email.',
      staffId: staff._id,
    };
  }

  async bulkImport(tenantId: string, file: any) {
    if (!file || !file.buffer) {
      throw new BadRequestException('CSV file is required');
    }
    const text = file.buffer.toString('utf8');
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) {
      throw new BadRequestException(
        'CSV must include header and at least one row',
      );
    }
    const header = lines[0].split(',').map((h) => h.trim());
    const requiredHeaders = [
      'firstName',
      'lastName',
      'email',
      'phone',
      'role',
      'department',
      'classes',
      'subjects',
      'additionalPermissions',
    ];
    for (const h of requiredHeaders) {
      if (!header.includes(h)) {
        throw new BadRequestException(`Missing column: ${h}`);
      }
    }

    const created: any[] = [];
    for (let i = 1; i < lines.length; i++) {
      const row = lines[i];
      if (!row.trim()) continue;
      const cols = row.split(',').map((c) => c.trim());
      const record: any = {};
      header.forEach((h, idx) => (record[h] = cols[idx] ?? ''));
      const role = record.role as StaffRole;
      if (!Object.values(StaffRole).includes(role)) {
        throw new BadRequestException(`Invalid role at line ${i + 1}: ${role}`);
      }
      const dto: CreateStaffDto = {
        firstName: record.firstName,
        lastName: record.lastName,
        email: record.email,
        phone: record.phone,
        role,
        department: record.department || undefined,
        classes: record.classes ? record.classes.split(/\s*;\s*|\s*,\s*/) : [],
        subjects: record.subjects
          ? record.subjects.split(/\s*;\s*|\s*,\s*/)
          : [],
        additionalPermissions: (record.additionalPermissions
          ? record.additionalPermissions.split(/\s*;\s*|\s*,\s*/)
          : []
        ).filter(Boolean) as Permission[],
      };
      const res = await this.createManual(tenantId, dto);
      created.push(res.staffId);
    }
    return {
      message: 'Bulk import queued',
      count: created.length,
      staffIds: created,
    };
  }
}
