import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Put,
  Req,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SchoolService } from './school.service';
import { UpdateSchoolProfileDto } from './dto/update-school-profile.dto';

@UseGuards(JwtAuthGuard)
@Controller('school')
export class SchoolController {
  constructor(private readonly schoolService: SchoolService) {}

  @Get('profile')
  @HttpCode(HttpStatus.OK)
  async getProfile(@Req() req: any) {
    if (req.user?.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException(
        'Only school owners can view the school profile',
      );
    }
    return this.schoolService.getProfile(req.user.tenantId);
  }

  @Put('profile')
  @HttpCode(HttpStatus.OK)
  async updateProfile(@Req() req: any, @Body() dto: UpdateSchoolProfileDto) {
    if (req.user?.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException(
        'Only school owners can update the school profile',
      );
    }
    return this.schoolService.updateProfile(req.user.tenantId, dto);
  }
}
