import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../../schemas/user.schema';
import { School, SchoolDocument } from '../../schemas/school.schema';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(School.name)
    private readonly schoolModel: Model<SchoolDocument>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader: string | undefined =
      request.headers['authorization'] || request.headers['Authorization'];
    if (
      !authHeader ||
      typeof authHeader !== 'string' ||
      !authHeader.startsWith('Bearer ')
    ) {
      throw new UnauthorizedException('Missing authentication token');
    }
    const token = authHeader.substring('Bearer '.length);
    let payload: any;
    try {
      payload = await this.jwtService.verifyAsync(token);
    } catch {
      throw new UnauthorizedException(
        'Invalid or expired authentication token',
      );
    }

    const user = await this.userModel.findById(payload.sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }
    // Optional: token version invalidation
    if (
      typeof payload.tokenVersion === 'number' &&
      payload.tokenVersion !== user.tokenVersion
    ) {
      throw new UnauthorizedException('Token is no longer valid');
    }

    // Ensure tenant/school is verified
    if (user.tenantId) {
      const school = await this.schoolModel.findById(user.tenantId);
      if (!school) {
        throw new ForbiddenException('Tenant not found');
      }
      if (!school.isVerified) {
        throw new ForbiddenException('Tenant is not verified');
      }
    }

    request.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      tokenVersion: user.tokenVersion,
    };
    return true;
  }
}
