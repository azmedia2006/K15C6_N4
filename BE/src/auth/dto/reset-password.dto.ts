import { IsNotEmpty, IsString, MinLength } from 'class-validator';

/**
 * KN-43: DTO cho POST /auth/reset-password
 */
export class ResetPasswordDto {
  @IsString({ message: 'Token không hợp lệ.' })
  @IsNotEmpty({ message: 'Token là bắt buộc.' })
  token: string;

  @IsString({ message: 'Mật khẩu không hợp lệ.' })
  @IsNotEmpty({ message: 'Vui lòng nhập mật khẩu mới.' })
  @MinLength(8, { message: 'Mật khẩu phải có ít nhất 8 ký tự.' })
  newPassword: string;
}
