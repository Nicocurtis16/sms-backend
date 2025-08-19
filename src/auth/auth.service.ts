import {
  Injectable,
  ConflictException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import { MailerService } from '@nestjs-modules/mailer';
import * as bcrypt from 'bcrypt';
import { RegisterSchoolDto } from './dto/register.dto';
import { School, SchoolDocument } from '../schemas/school.schema';
import { User, UserDocument } from '../schemas/user.schema';
import { TenantService } from '../tenant/tenant.service';
import { VerifyOtpDto } from './dto/verify-otp.dts';
import { ResendOtpDto } from './dto/resend-opt.dto';

@Injectable()
export class AuthService {
  private otpStore: Map<string, { code: string; expiresAt: number }> = new Map();
  private readonly loginUrl = 'https://your-sms-platform.com/auth/login'; // Update with your actual URL
  private readonly maxResendAttempts = 3;
  private readonly resendCooldownMinutes = 15;
  private resendAttempts: Map<string, { count: number; lastAttempt: number }> = new Map();

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(School.name) private schoolModel: Model<SchoolDocument>,
    private jwtService: JwtService,
    private tenantService: TenantService,
    private readonly mailerService: MailerService,
  ) {}

  async register(registerSchoolDto: RegisterSchoolDto) {
    const {
      adminEmail,
      schoolName,
      password,
      adminFirstName,
      adminLastName,
      adminPhone,
      type,
      curricula,
      digitalAddress,
      region,
      city,
      gesCode,
    } = registerSchoolDto;

    // Check if School or Admin User already exists
    const [existingSchool, existingUser] = await Promise.all([
      this.schoolModel.findOne({ schoolName }).exec(),
      this.userModel.findOne({ email: adminEmail }).exec(),
    ]);

    if (existingSchool) {
      throw new ConflictException('A school with this name is already registered.');
    }
    if (existingUser) {
      throw new ConflictException('A user with this email already exists.');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create School (Tenant)
    const newSchool = await this.tenantService.create({
      schoolName,
      type,
      curricula,
      digitalAddress,
      region,
      city,
      gesCode,
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
      tenantId: newSchool?._id?.toString(),
      isActive: true,
    });
    await newUser.save();

    // Generate and Send Initial Verification Email
    try {
      await this.sendOtpEmail(adminEmail, adminFirstName, schoolName, false);
    } catch (error) {
      // If email fails, clean up the created school and user
      await this.schoolModel.findByIdAndDelete(newSchool._id).exec();
      await this.userModel.findByIdAndDelete(newUser._id).exec();
      throw new InternalServerErrorException('Could not send verification email. Please try again.');
    }

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
    if (!schoolToVerify) {
      throw new BadRequestException('School not found for this email.');
    }

    schoolToVerify.isVerified = true;
    await schoolToVerify.save();

    // Clear OTP and resend attempts
    this.otpStore.delete(email);
    this.resendAttempts.delete(email);

    const user = await this.userModel.findOne({ email });
    const payload = {
      email: user?.email,
      sub: user?._id,
      role: user?.role,
      tenantId: user?.tenantId,
    };

    const access_token = this.jwtService.sign(payload);

    // Send Welcome Email after successful verification
    try {
await this.sendWelcomeEmail(email, user?.firstName ?? '', schoolToVerify.schoolName);    } catch (error) {
      // Log the error but don't fail the verification process
      console.error('Failed to send welcome email:', error);
    }

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

  async resendOtp(resendOtpDto: ResendOtpDto) {
    const { email } = resendOtpDto;

    // Check if user exists and school is not verified
    const user = await this.userModel.findOne({ email });
    if (!user) {
      throw new BadRequestException('User with this email not found.');
    }

    const school = await this.schoolModel.findOne({ adminEmail: email });
    if (school?.isVerified) {
      throw new BadRequestException('School is already verified.');
    }

    // Check resend attempts and cooldown
    const attemptData = this.resendAttempts.get(email) || { count: 0, lastAttempt: 0 };
    const now = Date.now();
    const cooldownExpired = now - attemptData.lastAttempt > this.resendCooldownMinutes * 60 * 1000;

    if (attemptData.count >= this.maxResendAttempts && !cooldownExpired) {
      const minutesLeft = Math.ceil((attemptData.lastAttempt + (this.resendCooldownMinutes * 60 * 1000) - now) / 60000);
      throw new BadRequestException(`Too many resend attempts. Please try again in ${minutesLeft} minutes.`);
    }

    // Reset counter if cooldown expired
    if (cooldownExpired) {
      attemptData.count = 0;
    }

    attemptData.count++;
    attemptData.lastAttempt = now;
    this.resendAttempts.set(email, attemptData);

    // Resend OTP email with resend template
    try {
await this.sendOtpEmail(email, user.firstName ?? '', school?.schoolName ?? '', true);      return { message: 'New verification code has been sent to your email.' };
    } catch (error) {
      throw new InternalServerErrorException('Failed to send verification code. Please try again.');
    }
  }

  private async sendOtpEmail(email: string, firstName: string, schoolName: string, isResend: boolean = false) {
    const otp = this.generateOtp();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Store OTP in memory
    this.otpStore.set(email, { code: otp, expiresAt });

    // Choose template and subject based on resend or initial
    const template = isResend ? './resend-verification' : './initial-verification';
    const subject = isResend
      ? `New Verification Code - ${schoolName}`
      : `Verify Your Account - ${schoolName}`;

    // Send email
    await this.mailerService.sendMail({
      to: email,
      subject: subject,
      template: template,
      context: {
        firstName,
        schoolName,
        otpCode: otp,
        currentYear: new Date().getFullYear(),
        loginUrl: this.loginUrl,
      },
    });
  }

  private async sendWelcomeEmail(email: string, firstName: string, schoolName: string) {
    await this.mailerService.sendMail({
      to: email,
      subject: `Welcome to ${schoolName}!`,
      template: './welcome',
      context: {
        firstName,
        schoolName,
        currentYear: new Date().getFullYear(),
        loginUrl: this.loginUrl,
        supportEmail: 'support@yoursmsplatform.com',
      },
    });
  }

  private generateOtp(length: number = 6): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
}