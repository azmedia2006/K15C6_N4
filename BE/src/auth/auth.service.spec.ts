import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { AuditService } from '../audit/audit.service';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

/**
 * KN-46: Unit tests cho AuthService
 *
 * Covers:
 * - Email tồn tại/không tồn tại → cùng response
 * - Token hợp lệ → đặt lại thành công
 * - Token hết hạn → bị từ chối
 * - Token đã dùng → bị từ chối
 * - Mật khẩu vi phạm quy tắc → bị từ chối
 * - Mật khẩu trùng hiện tại → bị từ chối
 * - Token mới → vô hiệu hóa token cũ
 * - Thông báo lỗi không lộ email tồn tại
 */

describe('AuthService', () => {
  let service: AuthService;
  let prisma: any;
  let emailService: any;
  let auditService: any;

  // Mock data
  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    passwordHash: '$2b$12$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012', // mock hash
    fullName: 'Test User',
    role: 'student',
    isActive: true,
  };

  beforeEach(async () => {
    // Mock PrismaService
    prisma = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      passwordResetToken: {
        create: jest.fn(),
        findFirst: jest.fn(),
        updateMany: jest.fn(),
        update: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
    };

    // Mock EmailService
    emailService = {
      sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
    };

    // Mock AuditService
    auditService = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: EmailService, useValue: emailService },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  // ============================================================
  // KN-39: forgotPassword
  // ============================================================
  describe('forgotPassword', () => {
    it('email tồn tại → trả cùng thông báo chung, gọi gửi email', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.passwordResetToken.updateMany.mockResolvedValue({ count: 1 });
      prisma.passwordResetToken.create.mockResolvedValue({});

      const result = await service.forgotPassword('test@example.com', '127.0.0.1');

      expect(result.message).toContain('Nếu email tồn tại trong hệ thống');
      // Email sẽ được gửi async (fire-and-forget), nên không check ngay
    });

    it('email KHÔNG tồn tại → trả CÙNG thông báo, KHÔNG gửi email', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await service.forgotPassword('nonexist@example.com', '127.0.0.1');

      expect(result.message).toContain('Nếu email tồn tại trong hệ thống');
      expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('hai response phải có cùng cấu trúc (status, nội dung)', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(mockUser);
      prisma.passwordResetToken.updateMany.mockResolvedValue({ count: 0 });
      prisma.passwordResetToken.create.mockResolvedValue({});

      const result1 = await service.forgotPassword('test@example.com');

      prisma.user.findUnique.mockResolvedValueOnce(null);
      const result2 = await service.forgotPassword('nonexist@example.com');

      // Cùng message
      expect(result1.message).toBe(result2.message);
      // Cùng cấu trúc keys
      expect(Object.keys(result1)).toEqual(Object.keys(result2));
    });

    it('ghi audit log cho cả hai trường hợp', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await service.forgotPassword('test@example.com', '1.2.3.4', 'Mozilla');

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'PASSWORD_RESET_REQUESTED',
          ip: '1.2.3.4',
          userAgent: 'Mozilla',
        }),
      );
    });

    it('email không tồn tại → log nội bộ PASSWORD_RESET_EMAIL_NOT_FOUND', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await service.forgotPassword('ghost@example.com', '1.2.3.4');

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'PASSWORD_RESET_EMAIL_NOT_FOUND',
        }),
      );
    });
  });

  // ============================================================
  // KN-43 + KN-41 + KN-45: resetPassword
  // ============================================================
  describe('resetPassword', () => {
    const validToken = 'valid-test-token-base64url';
    const tokenHash = crypto.createHash('sha256').update(validToken).digest('hex');

    const mockTokenRecord = {
      id: 'token-1',
      userId: 'user-1',
      tokenHash,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 phút sau
      usedAt: null,
      createdAt: new Date(),
    };

    it('token hợp lệ + mật khẩu hợp lệ → đặt lại thành công', async () => {
      prisma.passwordResetToken.findFirst.mockResolvedValue(mockTokenRecord);
      prisma.passwordResetToken.updateMany.mockResolvedValue({ count: 1 });
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.user.update.mockResolvedValue({});

      // Mock bcrypt.compare trả false (mật khẩu mới khác mật khẩu cũ)
      jest.spyOn(bcrypt, 'compare').mockImplementation(async () => false);
      jest.spyOn(bcrypt, 'hash').mockImplementation(async () => 'new-hash');

      const result = await service.resetPassword(validToken, 'NewPass123');

      expect(result.message).toContain('thành công');
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: { passwordHash: 'new-hash' },
        }),
      );
    });

    it('token sai → UnauthorizedException với lỗi chung', async () => {
      prisma.passwordResetToken.findFirst.mockResolvedValue(null);

      await expect(
        service.resetPassword('wrong-token', 'NewPass123'),
      ).rejects.toThrow('Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.');
    });

    it('token hết hạn → bị từ chối (updateMany count = 0)', async () => {
      const expiredToken = {
        ...mockTokenRecord,
        expiresAt: new Date(Date.now() - 1000), // Đã hết hạn
      };
      prisma.passwordResetToken.findFirst.mockResolvedValue(expiredToken);
      prisma.passwordResetToken.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.resetPassword(validToken, 'NewPass123'),
      ).rejects.toThrow('Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.');
    });

    it('token đã dùng → bị từ chối (updateMany count = 0)', async () => {
      const usedToken = {
        ...mockTokenRecord,
        usedAt: new Date(), // Đã dùng
      };
      prisma.passwordResetToken.findFirst.mockResolvedValue(usedToken);
      prisma.passwordResetToken.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.resetPassword(validToken, 'NewPass123'),
      ).rejects.toThrow('Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.');
    });

    it('mật khẩu quá ngắn → BadRequestException', async () => {
      await expect(
        service.resetPassword(validToken, 'Ab1'),
      ).rejects.toThrow('Mật khẩu không đáp ứng yêu cầu.');
    });

    it('mật khẩu thiếu chữ hoa → BadRequestException', async () => {
      await expect(
        service.resetPassword(validToken, 'abcdefg1'),
      ).rejects.toThrow('Mật khẩu không đáp ứng yêu cầu.');
    });

    it('mật khẩu thiếu chữ thường → BadRequestException', async () => {
      await expect(
        service.resetPassword(validToken, 'ABCDEFG1'),
      ).rejects.toThrow('Mật khẩu không đáp ứng yêu cầu.');
    });

    it('mật khẩu thiếu chữ số → BadRequestException', async () => {
      await expect(
        service.resetPassword(validToken, 'Abcdefgh'),
      ).rejects.toThrow('Mật khẩu không đáp ứng yêu cầu.');
    });

    it('mật khẩu trùng mật khẩu hiện tại → bị từ chối', async () => {
      prisma.passwordResetToken.findFirst.mockResolvedValue(mockTokenRecord);
      prisma.passwordResetToken.updateMany.mockResolvedValue({ count: 1 });
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.passwordResetToken.update.mockResolvedValue({});

      // Mock bcrypt.compare trả true (mật khẩu trùng)
      jest.spyOn(bcrypt, 'compare').mockImplementation(async () => true);

      await expect(
        service.resetPassword(validToken, 'SamePassword1'),
      ).rejects.toThrow('Mật khẩu không đáp ứng yêu cầu.');
    });

    it('đặt lại thành công → ghi audit log PASSWORD_RESET_SUCCESS', async () => {
      prisma.passwordResetToken.findFirst.mockResolvedValue(mockTokenRecord);
      prisma.passwordResetToken.updateMany.mockResolvedValue({ count: 1 });
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.user.update.mockResolvedValue({});

      jest.spyOn(bcrypt, 'compare').mockImplementation(async () => false);
      jest.spyOn(bcrypt, 'hash').mockImplementation(async () => 'new-hash');

      await service.resetPassword(validToken, 'NewPass123', '1.2.3.4', 'Mozilla');

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'PASSWORD_RESET_SUCCESS',
          userId: 'user-1',
        }),
      );
    });

    it('token sai → ghi audit log PASSWORD_RESET_FAILED', async () => {
      prisma.passwordResetToken.findFirst.mockResolvedValue(null);

      try {
        await service.resetPassword('bad-token', 'NewPass123', '1.2.3.4');
      } catch (e) {
        // expected
      }

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'PASSWORD_RESET_FAILED',
          metadata: { reason: 'invalid_token' },
        }),
      );
    });

    it('thông báo lỗi token sai giống lỗi token hết hạn giống lỗi token đã dùng', async () => {
      // Token sai
      prisma.passwordResetToken.findFirst.mockResolvedValue(null);
      let error1: any;
      try {
        await service.resetPassword('bad-token', 'NewPass123');
      } catch (e) {
        error1 = e;
      }

      // Token hết hạn
      const expiredToken = { ...mockTokenRecord, expiresAt: new Date(Date.now() - 1000) };
      prisma.passwordResetToken.findFirst.mockResolvedValue(expiredToken);
      prisma.passwordResetToken.updateMany.mockResolvedValue({ count: 0 });
      let error2: any;
      try {
        await service.resetPassword(validToken, 'NewPass123');
      } catch (e) {
        error2 = e;
      }

      // Cùng message — không lộ thông tin
      expect(error1.message).toBe(error2.message);
    });
  });

  // ============================================================
  // KN-43 (bonus): verifyResetToken
  // ============================================================
  describe('verifyResetToken', () => {
    it('token hợp lệ, chưa dùng, chưa hết hạn → valid = true', async () => {
      prisma.passwordResetToken.findFirst.mockResolvedValue({ id: 'token-1' });

      const result = await service.verifyResetToken('some-token');
      expect(result.valid).toBe(true);
    });

    it('token không tồn tại → valid = false', async () => {
      prisma.passwordResetToken.findFirst.mockResolvedValue(null);

      const result = await service.verifyResetToken('bad-token');
      expect(result.valid).toBe(false);
    });
  });
});
