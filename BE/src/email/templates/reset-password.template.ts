/**
 * KN-42: Template email đặt lại mật khẩu — tiếng Việt
 */
export function getResetPasswordEmailTemplate(
  resetLink: string,
  expiryMinutes: number,
): { subject: string; html: string } {
  const subject = '[TMS] Yêu cầu đặt lại mật khẩu';

  const html = `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:0; background-color:#f4f4f9; font-family:Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f4f4f9; padding:40px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="480" cellspacing="0" cellpadding="0" style="background-color:#ffffff; border-radius:8px; box-shadow:0 2px 8px rgba(0,0,0,0.08); overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="background-color:#007bff; padding:24px 32px; text-align:center;">
              <h1 style="margin:0; color:#ffffff; font-size:22px; font-weight:bold;">
                Hệ thống Quản lý Đào tạo
              </h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <h2 style="margin:0 0 16px 0; color:#333333; font-size:18px;">
                Đặt lại mật khẩu
              </h2>
              <p style="margin:0 0 16px 0; color:#555555; font-size:14px; line-height:1.6;">
                Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.
                Vui lòng nhấn nút bên dưới để tạo mật khẩu mới:
              </p>
              <!-- Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:24px auto;">
                <tr>
                  <td style="background-color:#007bff; border-radius:6px;">
                    <a href="${resetLink}"
                       target="_blank"
                       style="display:inline-block; padding:14px 32px; color:#ffffff; text-decoration:none; font-size:16px; font-weight:bold;">
                      Đặt lại mật khẩu
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:16px 0 0 0; color:#555555; font-size:13px; line-height:1.6;">
                Hoặc sao chép liên kết sau vào trình duyệt:<br>
                <a href="${resetLink}" style="color:#007bff; word-break:break-all; font-size:12px;">
                  ${resetLink}
                </a>
              </p>
              <!-- Cảnh báo -->
              <div style="margin-top:24px; padding:12px 16px; background-color:#fff3cd; border-left:4px solid #ffc107; border-radius:4px;">
                <p style="margin:0; color:#856404; font-size:13px; line-height:1.5;">
                  ⏱ Liên kết này có hiệu lực trong <strong>${expiryMinutes} phút</strong> và chỉ sử dụng được <strong>một lần</strong>.
                </p>
              </div>
              <!-- Disclaimer -->
              <p style="margin:24px 0 0 0; color:#999999; font-size:12px; line-height:1.5;">
                Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này.
                Tài khoản của bạn vẫn an toàn.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#f8f9fa; padding:16px 32px; text-align:center; border-top:1px solid #e9ecef;">
              <p style="margin:0; color:#aaaaaa; font-size:11px;">
                © ${new Date().getFullYear()} TMS - Hệ thống Quản lý Đào tạo. Không trả lời email này.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  return { subject, html };
}
