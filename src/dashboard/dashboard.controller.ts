import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Req,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { DashboardService } from './dashboard.service';

@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('setup-progress')
  @HttpCode(HttpStatus.OK)
  async getSetupProgress(@Req() req: any) {
    if (req.user?.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException(
        'Only school owners can access setup progress',
      );
    }
    return this.dashboardService.getSetupProgress(req.user.tenantId);
  }
}
