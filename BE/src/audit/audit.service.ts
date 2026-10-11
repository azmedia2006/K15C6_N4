import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * KN-47: Audit log service
 *
 * Event types cho password reset flow:
 * - PASSWORD_RESET_REQUESTED: user yêu cầu đặt lại mật khẩu
 * - PASSWORD_RESET_TOKEN_CREATED: token được tạo thành công
 * - PASSWORD_RESET_EMAIL_SENT: email đã gửi
 * - PASSWORD_RESET_SUCCESS: đặt lại mật khẩu thành công
 * - PASSWORD_RESET_FAILED: đặt lại thất bại (lý do chung, không lộ chi tiết)
 * - PASSWORD_RESET_RATE_LIMITED: bị rate limit
 * - PASSWORD_RESET_EMAIL_NOT_FOUND: email không tồn tại (chỉ log nội bộ)
 *
 * TUYỆT ĐỐI KHÔNG log: token, mật khẩu, nội dung email
 */

export interface AuditLogEntry {
  eventType: string;
  userId?: string;
  ip?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>; // Không chứa dữ liệu nhạy cảm
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditLogEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          eventType: entry.eventType,
          userId: entry.userId || null,
          ip: entry.ip || null,
          userAgent: entry.userAgent || null,
          metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
        },
      });
    } catch (error) {
      // Audit log failure phải không làm crash request chính
      console.error('[AuditService] Lỗi ghi audit log:', error);
    }
  }
}
