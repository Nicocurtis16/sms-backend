import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TermDocument = Term & Document;

@Schema({ timestamps: true })
export class Term {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  academicYearId: string;

  @Prop({ required: true })
  startDate: Date;

  @Prop({ required: true })
  endDate: Date;

  @Prop({ default: false })
  isActive: boolean;

  @Prop({ default: false })
  isCompleted: boolean;

  @Prop({ required: true })
  tenantId: string;
}

export const TermSchema = SchemaFactory.createForClass(Term);

TermSchema.index({ tenantId: 1, academicYearId: 1, name: 1 }, { unique: true });
