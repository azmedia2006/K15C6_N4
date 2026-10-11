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
      host: process.env.SMTP_HOST || 'smtp81196.bkns.com.vn',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER || 'support_it@quanit206.id.vn',
        pass: process.env.SMTP_PASSWORD || process.env.SMTP_PASS || 'Duong2006@',
      },
      tls: {
        rejectUnauthorized: false,
      },
    });
  }

  /**
   * Gửi email đặt lại mật khẩu (KN-42)
   * @param to - Địa chỉ email người nhận
   * @param resetToken - Token gốc (KHÔNG ĐƯỢC log)
   */
  async sendPasswordResetEmail(to: string, resetToken: string): Promise<void> {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
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
      from: process.env.SMTP_FROM || '"Đào tạo TMS" <support_it@quanit206.id.vn>',
      to,
      subject,
      html,
    });

    console.log(`[EmailService] Đã gửi email đặt lại mật khẩu tới ${to}`);
  }

  /**
   * KN-11 & KN-86: Gửi email kích hoạt tài khoản kèm mật khẩu tạm thời cho nhân sự mới
   * @param to - Địa chỉ email người nhận
   * @param name - Họ tên nhân sự mới
   * @param tempPassword - Mật khẩu tạm thời
   * @param role - Vai trò đảm nhiệm
   */
  async sendActivationEmail(
    to: string,
    name: string,
    tempPassword: string,
    role: string = 'instructor',
  ): Promise<void> {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const loginUrl = `${frontendUrl}/Login.html`;

    const subject = `[TMS] Thông tin tài khoản nhân sự mới và mật khẩu tạm thời - ${name}`;
    const text = `Kính gửi ${name},\n\nTài khoản của bạn đã được khởi tạo trên Hệ thống Quản lý Đào tạo TMS.\nEmail đăng nhập: ${to}\nVai trò: ${role}\nMật khẩu tạm thời: ${tempPassword}\nĐịa chỉ đăng nhập: ${loginUrl}\n\nVui lòng đăng nhập và đổi mật khẩu trong lần đầu tiên sử dụng.\n\nTrân trọng,\nĐào tạo TMS`;

    await this.transporter.sendMail({
      from: process.env.SMTP_FROM || '"Đào tạo TMS" <support_it@quanit206.id.vn>',
      to,
      subject,
      text,
    });

    console.log(`[EmailService] Đã gửi email kích hoạt tài khoản tới ${to}`);
  }
}
