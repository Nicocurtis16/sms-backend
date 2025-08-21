import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  AcademicYear,
  AcademicYearDocument,
} from '../schemas/academic-year.schema';
import { Term, TermDocument } from '../schemas/term.schema';
import { CreateAcademicYearDto } from './dto/create-academic-year.dto';
import { CreateTermDto } from './dto/create-term.dto';

@Injectable()
export class AcademicService {
  constructor(
    @InjectModel(AcademicYear.name)
    private readonly yearModel: Model<AcademicYearDocument>,
    @InjectModel(Term.name) private readonly termModel: Model<TermDocument>,
  ) {}

  async listYears(tenantId: string) {
    return this.yearModel.find({ tenantId }).sort({ startDate: -1 }).lean();
  }

  async createYear(tenantId: string, dto: CreateAcademicYearDto) {
    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);
    if (end <= start)
      throw new BadRequestException('endDate must be after startDate');
    // prevent overlaps
    const overlap = await this.yearModel.exists({
      tenantId,
      $or: [{ startDate: { $lte: end }, endDate: { $gte: start } }],
    });
    if (overlap)
      throw new BadRequestException(
        'Academic year overlaps with an existing one',
      );

    if (dto.isCurrent) {
      await this.yearModel.updateMany(
        { tenantId, isCurrent: true },
        { $set: { isCurrent: false } },
      );
    }

    const created = new this.yearModel({
      name: dto.name,
      startDate: start,
      endDate: end,
      isCurrent: !!dto.isCurrent,
      isArchived: false,
      tenantId,
    });
    return created.save();
  }

  async setCurrentYear(tenantId: string, yearId: string) {
    const year = await this.yearModel.findOne({ _id: yearId, tenantId });
    if (!year) throw new NotFoundException('Academic year not found');
    await this.yearModel.updateMany(
      { tenantId, isCurrent: true },
      { $set: { isCurrent: false } },
    );
    year.isCurrent = true;
    await year.save();
    return { message: 'Current academic year set' };
  }

  async archiveYear(tenantId: string, yearId: string) {
    const year = await this.yearModel.findOne({ _id: yearId, tenantId });
    if (!year) throw new NotFoundException('Academic year not found');
    year.isArchived = true;
    year.isCurrent = false;
    await year.save();
    return { message: 'Academic year archived' };
  }

  async listTerms(tenantId: string, academicYearId: string) {
    return this.termModel
      .find({ tenantId, academicYearId })
      .sort({ startDate: 1 })
      .lean();
  }

  async createTerm(tenantId: string, dto: CreateTermDto) {
    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);
    if (end <= start)
      throw new BadRequestException('endDate must be after startDate');
    const year = await this.yearModel.findOne({
      _id: dto.academicYearId,
      tenantId,
    });
    if (!year) throw new BadRequestException('Academic year not found');
    if (start < year.startDate || end > year.endDate) {
      throw new BadRequestException(
        'Term must be within the academic year dates',
      );
    }
    // prevent term conflicts within same year
    const overlap = await this.termModel.exists({
      tenantId,
      academicYearId: dto.academicYearId,
      $or: [{ startDate: { $lte: end }, endDate: { $gte: start } }],
    });
    if (overlap)
      throw new BadRequestException(
        'Term dates conflict with an existing term',
      );

    if (dto.isActive) {
      await this.termModel.updateMany(
        { tenantId, academicYearId: dto.academicYearId, isActive: true },
        { $set: { isActive: false } },
      );
    }

    const created = new this.termModel({
      name: dto.name,
      academicYearId: dto.academicYearId,
      startDate: start,
      endDate: end,
      isActive: !!dto.isActive,
      isCompleted: false,
      tenantId,
    });
    return created.save();
  }

  async markTermCompleted(tenantId: string, termId: string) {
    const term = await this.termModel.findOne({ _id: termId, tenantId });
    if (!term) throw new NotFoundException('Term not found');
    term.isActive = false;
    term.isCompleted = true;
    await term.save();
    return { message: 'Term marked as completed' };
  }
}
