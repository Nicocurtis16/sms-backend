import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { School, SchoolDocument } from '../schemas/school.schema';

@Injectable()
export class DashboardService {
  constructor(
    @InjectModel(School.name)
    private readonly schoolModel: Model<SchoolDocument>,
  ) {}

  async getSetupProgress(tenantId: string) {
    // Simple, profile-only initial computation. Extend later with counts when modules are added.
    const school = await this.schoolModel.findById(tenantId);
    const profile = Boolean(
      (school as any)?.logoUrl &&
        (school as any)?.contactEmail &&
        (school as any)?.contactPhone,
    );

    // Placeholders until academic/staff/students modules are added
    const academic = false;
    const staff = false;
    const students = false;
    const completedCount = [profile, academic, staff, students].filter(
      Boolean,
    ).length;
    const percentComplete = (completedCount / 4) * 100;

    return {
      profile,
      academic,
      staff,
      students,
      percentComplete,
    };
  }
}
