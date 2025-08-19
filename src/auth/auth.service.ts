import { Injectable, ConflictException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { RegisterSchoolDto } from './dto/register.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { School, SchoolDocument } from '../schemas/school.schema';
import { User, UserDocument } from '../schemas/user.schema';
import { TenantService } from '../tenant/tenant.service';

@Injectable()
export class AuthService {
  private otpStore: Map<string, { code: string; expiresAt: number }> = new Map();

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(School.name) private schoolModel: Model<SchoolDocument>,
    private jwtService: JwtService,
    private tenantService: TenantService,
  ) {}

  async register(registerSchoolDto: RegisterSchoolDto) {
    const { adminEmail, schoolName, password, adminFirstName, adminLastName, adminPhone, ...schoolData } = registerSchoolDto;

    // Check if School or Admin User already exists
    const [existingSchool, existingUser] = await Promise.all([
      this.schoolModel.findOne({ schoolName }).exec(),
      this.userModel.findOne({ email: adminEmail }).exec(),
    ]);

    if (existingSchool) throw new ConflictException('A school with this name is already registered.');
    if (existingUser) throw new ConflictException('A user with this email already exists.');

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create School (Tenant)
    const newSchool = await this.tenantService.create({
      ...schoolData,
      adminEmail,
      isVerified: false,
    });

    // Create SUPER_ADMIN User
    const newUser = new this.userModel({
      firstName: adminFirstName,
      lastName: adminLastName,
      email: adminEmail,
      phone: adminPhone,
      password: hashedPassword,
      role: 'SUPER_ADMIN',
      tenantId: newSchool._id.toString(),
      isActive: true,
    });
    await newUser.save();

    // Generate and "Send" OTP
    const otp = this.generateOtp();
    this.otpStore.set(adminEmail, {
      code: otp,
      expiresAt: Date.now() + 10 * 60 * 1000 // 10 minutes
    });

    console.log(`OTP for ${adminEmail}: ${otp}`); // Replace with email/SMS service

    return {
      message: 'School registered successfully. Please check your email for the verification OTP.',
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

    const schoolToVerify = await this.schoolModel.findOne({ adminEmail: email });
    if (!schoolToVerify) throw new BadRequestException('School not found for this email.');

    schoolToVerify.isVerified = true;
    await schoolToVerify.save();

    this.otpStore.delete(email);

    const user = await this.userModel.findOne({ email });
    const payload = {
      email: user.email,
      sub: user._id,
      role: user.role,
      tenantId: user.tenantId
    };

    const access_token = this.jwtService.sign(payload);

    return {
      message: 'School verified successfully!',
      access_token,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName
      },
    };
  }

  private generateOtp(length: number = 6): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  // Add your login method here later
  // async login(loginDto: LoginDto) { ... }
}