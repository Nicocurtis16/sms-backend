import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
  ForbiddenException,
  Patch,
  Query,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AcademicService } from './academic.service';
import { CreateAcademicYearDto } from './dto/create-academic-year.dto';
import { CreateTermDto } from './dto/create-term.dto';

@UseGuards(JwtAuthGuard)
@Controller('academic')
export class AcademicController {
  constructor(private readonly academicService: AcademicService) {}

  @Get('years')
  @HttpCode(HttpStatus.OK)
  async listYears(@Req() req: any) {
    if (req.user?.role !== 'SUPER_ADMIN') throw new ForbiddenException();
    return this.academicService.listYears(req.user.tenantId);
  }

  @Post('years')
  @HttpCode(HttpStatus.CREATED)
  async createYear(@Req() req: any, @Body() dto: CreateAcademicYearDto) {
    if (req.user?.role !== 'SUPER_ADMIN') throw new ForbiddenException();
    return this.academicService.createYear(req.user.tenantId, dto);
  }

  @Patch('years/:yearId/set-current')
  @HttpCode(HttpStatus.OK)
  async setCurrent(@Req() req: any, @Param('yearId') yearId: string) {
    if (req.user?.role !== 'SUPER_ADMIN') throw new ForbiddenException();
    return this.academicService.setCurrentYear(req.user.tenantId, yearId);
  }

  @Patch('years/:yearId/archive')
  @HttpCode(HttpStatus.OK)
  async archive(@Req() req: any, @Param('yearId') yearId: string) {
    if (req.user?.role !== 'SUPER_ADMIN') throw new ForbiddenException();
    return this.academicService.archiveYear(req.user.tenantId, yearId);
  }

  @Get('terms')
  @HttpCode(HttpStatus.OK)
  async listTerms(
    @Req() req: any,
    @Query('academicYearId') academicYearId: string,
  ) {
    if (req.user?.role !== 'SUPER_ADMIN') throw new ForbiddenException();
    return this.academicService.listTerms(req.user.tenantId, academicYearId);
  }

  @Post('terms')
  @HttpCode(HttpStatus.CREATED)
  async createTerm(@Req() req: any, @Body() dto: CreateTermDto) {
    if (req.user?.role !== 'SUPER_ADMIN') throw new ForbiddenException();
    return this.academicService.createTerm(req.user.tenantId, dto);
  }

  @Patch('terms/:termId/complete')
  @HttpCode(HttpStatus.OK)
  async completeTerm(@Req() req: any, @Param('termId') termId: string) {
    if (req.user?.role !== 'SUPER_ADMIN') throw new ForbiddenException();
    return this.academicService.markTermCompleted(req.user.tenantId, termId);
  }
}
