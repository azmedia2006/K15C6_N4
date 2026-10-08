import { Controller, Post, Body, Query, Get, Req, HttpCode } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyTokenDto } from './dto/verify-token.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * KN-39: POST /auth/forgot-password
   * Rate limit: 5 lần / giờ (3600000ms)
   * Luôn trả 200 + thông báo chung
   */
  @Post('forgot-password')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 3600000 } })
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
    @Req() req: Request,
  ) {
    const ip = req.ip || req.socket?.remoteAddress;
    const userAgent = req.headers['user-agent'];

    return this.authService.forgotPassword(dto.email, ip, userAgent);
  }

  /**
   * KN-43: POST /auth/reset-password
   */
  @Post('reset-password')
  @HttpCode(200)
  async resetPassword(
    @Body() dto: ResetPasswordDto,
    @Req() req: Request,
  ) {
    const ip = req.ip || req.socket?.remoteAddress;
    const userAgent = req.headers['user-agent'];

    return this.authService.resetPassword(
      dto.token,
      dto.newPassword,
      ip,
      userAgent,
    );
  }

  /**
   * KN-43 (bonus): GET /auth/verify-reset-token?token=xxx
   * Cho FE kiểm tra token hợp lệ trước khi hiển thị form
   */
  @Get('verify-reset-token')
  async verifyResetToken(@Query() dto: VerifyTokenDto) {
    return this.authService.verifyResetToken(dto.token);
  }
}
