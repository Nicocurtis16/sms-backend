import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AcademicYearDocument = AcademicYear & Document;

@Schema({ timestamps: true })
export class AcademicYear {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  startDate: Date;

  @Prop({ required: true })
  endDate: Date;

  @Prop({ default: false })
  isCurrent: boolean;

  @Prop({ default: false })
  isArchived: boolean;

  @Prop({ required: true })
  tenantId: string;
}

export const AcademicYearSchema = SchemaFactory.createForClass(AcademicYear);

AcademicYearSchema.index({ tenantId: 1, name: 1 }, { unique: true });
