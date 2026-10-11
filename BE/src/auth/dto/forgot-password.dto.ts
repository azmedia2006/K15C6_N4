import { IsEmail, IsNotEmpty } from 'class-validator';

/**
 * KN-39: DTO cho POST /auth/forgot-password
 */
export class ForgotPasswordDto {
  @IsEmail({}, { message: 'Email không hợp lệ.' })
  @IsNotEmpty({ message: 'Vui lòng nhập email.' })
  email: string;
}
