import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { School, SchoolDocument } from '../schemas/school.schema';

@Injectable()
export class TenantService {
  constructor(
    @InjectModel(School.name) private schoolModel: Model<SchoolDocument>,
  ) {}

  async create(schoolData: Partial<School>): Promise<SchoolDocument> {
    const createdSchool = new this.schoolModel(schoolData);
    return createdSchool.save();
  }

  async findById(id: string): Promise<SchoolDocument | null> {
    return this.schoolModel.findById(id).exec();
  }
}