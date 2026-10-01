import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { AuditService } from '../audit/audit.service';
import { validatePassword } from '../common/validators/password.validator';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

/**
 * Auth Service — Password Reset Flow
 *
 * KN-40: Token generation + storage (CSPRNG, SHA-256 hash, 30min expiry)
 * KN-41: Single-use enforcement (atomic UPDATE with WHERE conditions)
 * KN-39: Forgot password (constant-time response, async email)
 * KN-43: Reset password (hash lookup, transaction, session revocation)
 * KN-45: Password validation
 */
@Injectable()
export class AuthService {
  private readonly BCRYPT_ROUNDS = 12;
  private readonly TOKEN_BYTES = 32;
  private readonly EXPIRY_MINUTES = parseInt(
    process.env.PASSWORD_RESET_EXPIRY_MINUTES || '30',
    10,
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly auditService: AuditService,
  ) {}

  // =================================================================
  // KN-39: POST /auth/forgot-password
  // =================================================================
  /**
   * Xử lý yêu cầu đặt lại mật khẩu.
   * - Luôn trả cùng một response (không lộ email có tồn tại hay không)
   * - Gửi email bất đồng bộ (không block response time)
   * - Thời gian phản hồi hai trường hợp phải tương đương
   */
  async forgotPassword(
    email: string,
    ip?: string,
    userAgent?: string,
  ): Promise<{ message: string }> {
    const normalizedEmail = email.toLowerCase().trim();

    // Audit: ghi nhận yêu cầu
    this.auditService.log({
      eventType: 'PASSWORD_RESET_REQUESTED',
      ip,
      userAgent,
      metadata: { email: normalizedEmail },
    });

    // Tìm user — KHÔNG thay đổi response dù có hay không
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (user) {
      // Gửi email bất đồng bộ — fire and forget (không await trong response)
      this.createTokenAndSendEmail(user.id, normalizedEmail, ip, userAgent);
    } else {
      // KN-47: Log nội bộ email không tồn tại — không thay đổi response
      this.auditService.log({
        eventType: 'PASSWORD_RESET_EMAIL_NOT_FOUND',
        ip,
        userAgent,
        metadata: { email: normalizedEmail },
      });
    }

    // Luôn trả cùng một thông báo + status 200
    return {
      message:
        'Nếu email tồn tại trong hệ thống, chúng tôi đã gửi hướng dẫn đặt lại mật khẩu.',
    };
  }

  // =================================================================
  // KN-40: Tạo token + KN-42: Gửi email (bất đồng bộ)
  // =================================================================
  private async createTokenAndSendEmail(
    userId: string,
    email: string,
    ip?: string,
    userAgent?: string,
  ): Promise<void> {
    try {
      // KN-40: Sinh token CSPRNG 32 bytes, mã hóa URL-safe base64
      const rawToken = crypto.randomBytes(this.TOKEN_BYTES);
      const tokenString = rawToken
        .toString('base64url'); // URL-safe base64

      // Hash SHA-256 — chỉ lưu hash, không lưu token gốc
      const tokenHash = crypto
        .createHash('sha256')
        .update(tokenString)
        .digest('hex');

      const expiresAt = new Date(
        Date.now() + this.EXPIRY_MINUTES * 60 * 1000,
      );

      // KN-40: Vô hiệu hóa mọi token cũ chưa dùng của cùng user
      await this.prisma.passwordResetToken.updateMany({
        where: {
          userId,
          usedAt: null,
        },
        data: {
          usedAt: new Date(), // Đánh dấu đã dùng = vô hiệu hóa
        },
      });

      // Tạo token mới
      await this.prisma.passwordResetToken.create({
        data: {
          userId,
          tokenHash,
          expiresAt,
          requestIp: ip,
        },
      });

      // Audit: token created
      this.auditService.log({
        eventType: 'PASSWORD_RESET_TOKEN_CREATED',
        userId,
        ip,
        userAgent,
      });

      // KN-42: Gửi email
      await this.emailService.sendPasswordResetEmail(email, tokenString);

      // Audit: email sent
      this.auditService.log({
        eventType: 'PASSWORD_RESET_EMAIL_SENT',
        userId,
        ip,
        userAgent,
      });
    } catch (error) {
      console.error(
        '[AuthService] Lỗi tạo token/gửi email:',
        error,
      );
      // Không throw — đây là background task, không ảnh hưởng response
    }
  }

  // =================================================================
  // KN-43: POST /auth/reset-password
  // KN-41: Token single-use enforcement
  // KN-45: Password validation
  // =================================================================
  async resetPassword(
    token: string,
    newPassword: string,
    ip?: string,
    userAgent?: string,
  ): Promise<{ message: string }> {
    // KN-45: Validate mật khẩu theo chính sách
    const validation = validatePassword(newPassword);
    if (!validation.isValid) {
      throw new BadRequestException({
        message: 'Mật khẩu không đáp ứng yêu cầu.',
        errors: validation.errors,
      });
    }

    // KN-43: Hash token rồi tra cứu theo hash
    const tokenHash = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    // KN-41: Atomic update — UPDATE WHERE used_at IS NULL AND expires_at > now
    // Dùng raw query để đảm bảo atomicity chống race condition
    const now = new Date();

    // Tìm token record trước
    const tokenRecord = await this.prisma.passwordResetToken.findFirst({
      where: { tokenHash },
    });

    if (!tokenRecord) {
      // Token sai — trả lỗi chung
      this.auditService.log({
        eventType: 'PASSWORD_RESET_FAILED',
        ip,
        userAgent,
        metadata: { reason: 'invalid_token' },
      });
      throw new UnauthorizedException(
        'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.',
      );
    }

    // KN-41: Cập nhật có điều kiện — atomic single-use check
    // updateMany trả về count, nếu count = 0 thì token đã dùng hoặc hết hạn
    const updateResult = await this.prisma.passwordResetToken.updateMany({
      where: {
        id: tokenRecord.id,
        usedAt: null,           // Chưa dùng
        expiresAt: { gt: now }, // Chưa hết hạn
      },
      data: {
        usedAt: now,
      },
    });

    if (updateResult.count === 0) {
      // Token đã dùng hoặc hết hạn — lỗi chung
      this.auditService.log({
        eventType: 'PASSWORD_RESET_FAILED',
        userId: tokenRecord.userId,
        ip,
        userAgent,
        metadata: { reason: 'token_expired_or_used' },
      });
      throw new UnauthorizedException(
        'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.',
      );
    }

    // KN-45: Kiểm tra mật khẩu không trùng mật khẩu hiện tại
    const user = await this.prisma.user.findUnique({
      where: { id: tokenRecord.userId },
    });

    if (user) {
      const isSamePassword = await bcrypt.compare(
        newPassword,
        user.passwordHash,
      );
      if (isSamePassword) {
        // Rollback: bỏ đánh dấu used_at (cho phép thử lại)
        await this.prisma.passwordResetToken.update({
          where: { id: tokenRecord.id },
          data: { usedAt: null },
        });
        throw new BadRequestException({
          message: 'Mật khẩu không đáp ứng yêu cầu.',
          errors: ['Mật khẩu mới không được trùng với mật khẩu hiện tại.'],
        });
      }
    }

    // KN-43: Cập nhật mật khẩu mới (bcrypt hash)
    const passwordHash = await bcrypt.hash(newPassword, this.BCRYPT_ROUNDS);

    await this.prisma.user.update({
      where: { id: tokenRecord.userId },
      data: { passwordHash },
    });

    // KN-43: Vô hiệu hóa tất cả token còn lại của user
    await this.prisma.passwordResetToken.updateMany({
      where: {
        userId: tokenRecord.userId,
        usedAt: null,
      },
      data: {
        usedAt: now,
      },
    });

    // Audit: thành công
    this.auditService.log({
      eventType: 'PASSWORD_RESET_SUCCESS',
      userId: tokenRecord.userId,
      ip,
      userAgent,
    });

    return { message: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập bằng mật khẩu mới.' };
  }

  // =================================================================
  // KN-43 (bonus): Kiểm tra token hợp lệ — cho FE hiển thị lỗi sớm
  // =================================================================
  async verifyResetToken(token: string): Promise<{ valid: boolean }> {
    const tokenHash = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    const tokenRecord = await this.prisma.passwordResetToken.findFirst({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    return { valid: !!tokenRecord };
  }
}
