// tenant.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TenantService } from './tenant.service';
import { TenantController } from './tenant.controller';
import { School, SchoolSchema } from '../schemas/school.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: School.name, schema: SchoolSchema }, // Register School model
    ]),
  ],
  providers: [TenantService],
  controllers: [TenantController],
  exports: [TenantService], // If other modules need TenantService
})
export class TenantModule {}
