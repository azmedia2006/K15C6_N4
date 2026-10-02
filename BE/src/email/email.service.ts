import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { getResetPasswordEmailTemplate } from './templates/reset-password.template';

/**
 * KN-42: Email service
 * - Gửi email qua SMTP (cấu hình từ .env)
 * - KHÔNG log nội dung token
 */
@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  /**
   * Gửi email đặt lại mật khẩu
   * @param to - Địa chỉ email người nhận
   * @param resetToken - Token gốc (KHÔNG ĐƯỢC log)
   */
  async sendPasswordResetEmail(to: string, resetToken: string): Promise<void> {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5500/FE';
    const resetLink = `${frontendUrl}/ResetPassword.html?token=${encodeURIComponent(resetToken)}`;
    const expiryMinutes = parseInt(
      process.env.PASSWORD_RESET_EXPIRY_MINUTES || '30',
      10,
    );

    const { subject, html } = getResetPasswordEmailTemplate(
      resetLink,
      expiryMinutes,
    );

    await this.transporter.sendMail({
      from: process.env.SMTP_FROM || '"TMS" <noreply@tms.vn>',
      to,
      subject,
      html,
    });

    // Log gửi email thành công — KHÔNG log token hay nội dung email
    console.log(`[EmailService] Đã gửi email đặt lại mật khẩu tới ${to}`);
  }
}
