import {
  Controller,
  Post,
  UseGuards,
  Req,
  ForbiddenException,
  UploadedFile,
  UseInterceptors,
  HttpCode,
  HttpStatus,
  Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { StaffService } from './staff.service';
import { CreateStaffDto } from './dto/create-staff.dto';

@UseGuards(JwtAuthGuard)
@Controller('staff')
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Post('bulk-import')
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.OK)
  async bulkImport(@Req() req: any, @UploadedFile() file: any) {
    if (req.user?.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Only school owners can import staff');
    }
    return this.staffService.bulkImport(req.user.tenantId, file);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Req() req: any, @Body() dto: CreateStaffDto) {
    if (req.user?.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Only school owners can add staff');
    }
    return this.staffService.createManual(req.user.tenantId, dto);
  }
}
