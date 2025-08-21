import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { School, SchoolDocument } from '../schemas/school.schema';
import { UpdateSchoolProfileDto } from './dto/update-school-profile.dto';

@Injectable()
export class SchoolService {
  constructor(
    @InjectModel(School.name)
    private readonly schoolModel: Model<SchoolDocument>,
  ) {}

  async getProfile(tenantId: string) {
    const school = await this.schoolModel.findById(tenantId).lean();
    if (!school) {
      throw new NotFoundException('School not found');
    }
    return school;
  }

  async updateProfile(tenantId: string, dto: UpdateSchoolProfileDto) {
    const school = await this.schoolModel.findById(tenantId);
    if (!school) {
      throw new NotFoundException('School not found');
    }

    // Update fields
    school.logoUrl = dto.logoUrl ?? school.logoUrl;
    school.description = dto.description ?? school.description;
    school.contactEmail = dto.contactEmail ?? school.contactEmail;
    school.contactPhone = dto.contactPhone ?? school.contactPhone;
    school.websiteUrl = dto.websiteUrl ?? school.websiteUrl;
    school.socials = {
      ...(school.socials || {}),
      ...(dto.socials || {}),
    } as any;
    school.operatingHours = Array.isArray(dto.operatingHours)
      ? dto.operatingHours
      : school.operatingHours;

    // Compute completion
    const profileCompleted = Boolean(
      school.logoUrl && school.contactEmail && school.contactPhone,
    );
    school.profileCompleted = profileCompleted;

    await school.save();
    return { message: 'Profile updated', profileCompleted };
  }
}
