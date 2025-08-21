import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AcademicController } from './academic.controller';
import { AcademicService } from './academic.service';
import {
  AcademicYear,
  AcademicYearSchema,
} from '../schemas/academic-year.schema';
import { Term, TermSchema } from '../schemas/term.schema';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { User, UserSchema } from '../schemas/user.schema';
import { School, SchoolSchema } from '../schemas/school.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AcademicYear.name, schema: AcademicYearSchema },
      { name: Term.name, schema: TermSchema },
      { name: User.name, schema: UserSchema },
      { name: School.name, schema: SchoolSchema },
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: configService.get<string>('JWT_EXPIRATION') },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AcademicController],
  providers: [AcademicService, JwtAuthGuard],
})
export class AcademicModule {}
