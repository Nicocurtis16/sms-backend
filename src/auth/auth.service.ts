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
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ConfigService } from '@nestjs/config';
import { VerifyOtpDto } from './dto/verify-otp.dts';
import { ResendOtpDto } from './dto/resend-opt.dto';

@Injectable()
export class AuthService {
  private otpStore: Map<string, { code: string; expiresAt: number }> =
    new Map();
  private readonly loginUrl = 'https://your-sms-platform.com/auth/login'; // Update with your actual URL
  private readonly maxResendAttempts = 3;
  private readonly resendCooldownMinutes = 15;
  private resendAttempts: Map<string, { count: number; lastAttempt: number }> =
    new Map();

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(School.name) private schoolModel: Model<SchoolDocument>,
    private jwtService: JwtService,
    private tenantService: TenantService,
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
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
      throw new ConflictException(
        'A school with this name is already registered.',
      );
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
      throw new InternalServerErrorException(
        'Could not send verification email. Please try again.',
      );
    }

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
      await this.sendWelcomeEmail(
        email,
        user?.firstName ?? '',
        schoolToVerify.schoolName,
      );
    } catch (error) {
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
    const attemptData = this.resendAttempts.get(email) || {
      count: 0,
      lastAttempt: 0,
    };
    const now = Date.now();
    const cooldownExpired =
      now - attemptData.lastAttempt > this.resendCooldownMinutes * 60 * 1000;

    if (attemptData.count >= this.maxResendAttempts && !cooldownExpired) {
      const minutesLeft = Math.ceil(
        (attemptData.lastAttempt +
          this.resendCooldownMinutes * 60 * 1000 -
          now) /
          60000,
      );
      throw new BadRequestException(
        `Too many resend attempts. Please try again in ${minutesLeft} minutes.`,
      );
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
      await this.sendOtpEmail(
        email,
        user.firstName ?? '',
        school?.schoolName ?? '',
        true,
      );
      return { message: 'New verification code has been sent to your email.' };
    } catch (error) {
      throw new InternalServerErrorException(
        'Failed to send verification code. Please try again.',
      );
    }
  }

  private async sendOtpEmail(
    email: string,
    firstName: string,
    schoolName: string,
    isResend: boolean = false,
  ) {
    const otp = this.generateOtp();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Store OTP in memory
    this.otpStore.set(email, { code: otp, expiresAt });

    // Choose template and subject based on resend or initial
    const template = isResend
      ? './resend-verification'
      : './initial-verification';
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

  private async sendWelcomeEmail(
    email: string,
    firstName: string,
    schoolName: string,
  ) {
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

  // =====================
  // Authentication flows
  // =====================

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;
    const user = await this.userModel.findOne({ email });
    if (!user) {
      throw new BadRequestException('Invalid credentials');
    }

    const school = await this.schoolModel.findById(user.tenantId);
    if (!school || !school.isVerified) {
      throw new BadRequestException('Account is not verified');
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new BadRequestException('Invalid credentials');
    }

    const payload = {
      sub: user._id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      tokenVersion: user.tokenVersion ?? 0,
    };
    const access_token = await this.jwtService.signAsync(payload);
    return {
      access_token,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const { email } = dto;
    const user = await this.userModel.findOne({ email });
    // Always pretend success to avoid enumeration
    if (!user) {
      return { message: 'If the email exists, a reset link has been sent.' };
    }

    const school = await this.schoolModel.findById(user.tenantId);
    if (!school || !school.isVerified) {
      // Still return generic response
      return { message: 'If the email exists, a reset link has been sent.' };
    }

    const resetToken = await this.jwtService.signAsync(
      {
        sub: user._id,
        purpose: 'password-reset',
        tokenVersion: user.tokenVersion ?? 0,
      },
      {
        secret:
          this.configService.get<string>('PASSWORD_RESET_SECRET') ||
          this.configService.get<string>('JWT_SECRET'),
        expiresIn: '1h',
      },
    );

    const resetUrlBase =
      this.configService.get<string>('FRONTEND_RESET_PASSWORD_URL') ||
      'https://your-sms-platform.com/reset-password';
    const resetUrl = `${resetUrlBase}?token=${encodeURIComponent(resetToken)}`;

    try {
      await this.mailerService.sendMail({
        to: email,
        subject: 'Password Reset Request',
        template: './password-reset',
        context: {
          firstName: user.firstName,
          resetUrl,
          currentYear: new Date().getFullYear(),
        },
      });
    } catch (e) {
      // swallow to avoid enumeration; optionally log
    }

    return { message: 'If the email exists, a reset link has been sent.' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const { token, newPassword } = dto;
    let payload: any;
    try {
      payload = await this.jwtService.verifyAsync(token, {
        secret:
          this.configService.get<string>('PASSWORD_RESET_SECRET') ||
          this.configService.get<string>('JWT_SECRET'),
      });
    } catch (e) {
      throw new BadRequestException('Invalid or expired token');
    }

    if (payload.purpose !== 'password-reset') {
      throw new BadRequestException('Invalid token');
    }

    const user = await this.userModel.findById(payload.sub);
    if (!user) {
      throw new BadRequestException('Invalid token');
    }

    const hashed = await bcrypt.hash(newPassword, 12);
    user.password = hashed;
    user.passwordChangedAt = new Date();
    user.tokenVersion = (user.tokenVersion ?? 0) + 1; // invalidate existing tokens
    await user.save();

    try {
      await this.mailerService.sendMail({
        to: user.email,
        subject: 'Your password has been changed',
        template: './password-changed',
        context: {
          firstName: user.firstName,
          currentYear: new Date().getFullYear(),
        },
      });
    } catch (e) {}

    return { message: 'Password has been reset successfully.' };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const { currentPassword, newPassword } = dto;
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      throw new BadRequestException('Current password is incorrect');
    }
    const hashed = await bcrypt.hash(newPassword, 12);
    user.password = hashed;
    user.passwordChangedAt = new Date();
    user.tokenVersion = (user.tokenVersion ?? 0) + 1; // invalidate existing tokens
    await user.save();

    try {
      await this.mailerService.sendMail({
        to: user.email,
        subject: 'Your password has been changed',
        template: './password-changed',
        context: {
          firstName: user.firstName,
          currentYear: new Date().getFullYear(),
        },
      });
    } catch (e) {}

    return { message: 'Password updated successfully.' };
  }
}
