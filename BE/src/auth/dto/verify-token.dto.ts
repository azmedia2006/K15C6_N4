import { IsNotEmpty, IsString } from 'class-validator';

/**
 * KN-43 (bonus): DTO cho GET /auth/verify-reset-token
 */
export class VerifyTokenDto {
  @IsString({ message: 'Token không hợp lệ.' })
  @IsNotEmpty({ message: 'Token là bắt buộc.' })
  token: string;
}
