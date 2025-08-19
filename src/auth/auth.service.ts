import {
  Injectable,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { RegisterSchoolDto } from './dto/register.dto';
import { School, SchoolDocument } from '../schemas/school.schema';
import { User, UserDocument } from '../schemas/user.schema';
import { TenantService } from '../tenant/tenant.service';
import { VerifyOtpDto } from './dto/verify-otp.dts';

@Injectable()
export class AuthService {
  private otpStore: Map<string, { code: string; expiresAt: number }> =
    new Map();

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(School.name) private schoolModel: Model<SchoolDocument>,
    private jwtService: JwtService,
    private tenantService: TenantService,
  ) {}

  async register(registerSchoolDto: RegisterSchoolDto) {
    // 1. Extract ALL necessary fields correctly
    const {
      adminEmail,
      schoolName, // This is extracted
      password,
      adminFirstName,
      adminLastName,
      adminPhone,
      type,         // These must also be extracted individually
      curricula,    // because they are required for the School schema
      digitalAddress,
      region,
      city,
      gesCode,      // This is optional, so it's okay
    } = registerSchoolDto;

    // 2. Check if School or Admin User already exists
    const [existingSchool, existingUser] = await Promise.all([
      this.schoolModel.findOne({ schoolName }).exec(),
      this.userModel.findOne({ email: adminEmail }).exec(),
    ]);

    if (existingSchool)
      throw new ConflictException(
        'A school with this name is already registered.',
      );
    if (existingUser)
      throw new ConflictException('A user with this email already exists.');

    // 3. Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // 4. Create School (Tenant) - MUST include all required fields explicitly
    const newSchool = await this.tenantService.create({
      schoolName,      // Now explicitly included
      type,            // Now explicitly included
      curricula,       // Now explicitly included
      digitalAddress,  // Now explicitly included
      region,          // Now explicitly included
      city,            // Now explicitly included
      gesCode,         // Now explicitly included
      adminEmail,
      isVerified: false,
    });

    // 5. Create SUPER_ADMIN User
    const newUser = new this.userModel({
      firstName: adminFirstName,
      lastName: adminLastName,
      email: adminEmail,
      phone: adminPhone,
      password: hashedPassword,
      role: 'SUPER_ADMIN',
      tenantId: newSchool?._id?.toString(), // Remove optional chaining, it's safe now
      isActive: true,
    });
    await newUser.save();

    // 6. Generate and "Send" OTP
    const otp = this.generateOtp();
    this.otpStore.set(adminEmail, {
      code: otp,
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
    });

    console.log(`OTP for ${adminEmail}: ${otp}`);

    return {
      message:
        'School registered successfully. Please check your email for the verification OTP.',
      schoolId: newSchool._id,
    };
  }
  async verifyOtp(verifyOtpDto: VerifyOtpDto) {
    const { email, otpCode } = verifyOtpDto;
    const storedOtpData = this.otpStore.get(email);

    if (!storedOtpData || storedOtpData.expiresAt < Date.now()) {
      throw new BadRequestException('Invalid or expired OTP.');
    }

    if (storedOtpData.code !== otpCode) {
      throw new BadRequestException('Invalid OTP.');
    }

    const schoolToVerify = await this.schoolModel.findOne({
      adminEmail: email,
    });
    if (!schoolToVerify)
      throw new BadRequestException('School not found for this email.');

    schoolToVerify.isVerified = true;
    await schoolToVerify.save();

    this.otpStore.delete(email);

    const user = await this.userModel.findOne({ email });
    const payload = {
      email: user?.email,
      sub: user?._id,
      role: user?.role,
      tenantId: user?.tenantId,
    };

    const access_token = this.jwtService.sign(payload);

    return {
      message: 'School verified successfully!',
      access_token,
      user: {
        id: user?._id,
        email: user?.email,
        role: user?.role,
        firstName: user?.firstName,
        lastName: user?.lastName,
      },
    };
  }

  private generateOtp(length: number = 6): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
}
