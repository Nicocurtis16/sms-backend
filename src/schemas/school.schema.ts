import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SchoolDocument = School & Document;

export enum SchoolType {
  PRIVATE_JHS = 'PRIVATE_JHS',
  PRIVATE_SHS = 'PRIVATE_SHS',
  INTERNATIONAL_SHS = 'INTERNATIONAL_SHS',
}

export enum CurriculumType {
  WASSCE = 'WASSCE',
  IGCSE = 'IGCSE',
  IB = 'IB',
  GES_STANDARD = 'GES_STANDARD',
}

@Schema({ timestamps: true })
export class School {
  @Prop({ required: true, unique: true })
  schoolName: string;

  @Prop({ required: true, type: String, enum: SchoolType })
  type: SchoolType;

  @Prop({
    type: [String],
    enum: CurriculumType,
    default: [CurriculumType.GES_STANDARD],
  })
  curricula: CurriculumType[];

  @Prop({ required: true })
  adminEmail: string;

  @Prop()
  gesCode?: string;

  @Prop({ required: true })
  digitalAddress: string;

  @Prop({ required: true })
  region: string;

  @Prop()
  city: string;

  @Prop({ default: false })
  isVerified: boolean;

  @Prop({ type: Object, default: {} })
  settings: Record<string, any>;
}

export const SchoolSchema = SchemaFactory.createForClass(School);
