/**
 * KN-11 & KN-86: Email Service for User Account Activation & Credentials Delivery
 * Dịch vụ gửi email kích hoạt tài khoản kèm mật khẩu tạm cho nhân sự mới qua SMTP thật.
 */
const nodemailer = require("nodemailer");
const path = require("path");

// Load .env nếu chưa được nạp
require("dotenv").config({
    path: [path.join(__dirname, ".env"), path.join(__dirname, "../.env")]
});

// Cấu hình SMTP
const SMTP_CONFIG = {
    host: process.env.SMTP_HOST || "smtp81196.bkns.com.vn",
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    user: process.env.SMTP_USER || "support_it@quanit206.id.vn",
    pass: process.env.SMTP_PASSWORD || process.env.SMTP_PASS || "Duong2006@",
    fromEmail: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || "support_it@quanit206.id.vn",
    fromName: process.env.SMTP_FROM_NAME || "Đào tạo TMS",
    secure: process.env.SMTP_SECURE === "true" || process.env.SMTP_PORT === "465",
    tls: process.env.SMTP_TLS !== "false"
};

// Khởi tạo nodemailer transporter
let transporter = null;
try {
    transporter = nodemailer.createTransport({
        host: SMTP_CONFIG.host,
        port: SMTP_CONFIG.port,
        secure: SMTP_CONFIG.secure,
        auth: {
            user: SMTP_CONFIG.user,
            pass: SMTP_CONFIG.pass
        },
        tls: {
            rejectUnauthorized: false
        },
        pool: true,
        maxConnections: 5,
        maxMessages: 100
    });
} catch (err) {
    console.error("[EmailService] Khởi tạo SMTP Transporter thất bại:", err.message);
}

// Danh mục nhãn vai trò hiển thị tiếng Việt
const ROLE_NAMES = {
    "administrator": "Quản trị viên hệ thống (Administrator)",
    "training_manager": "Quản lý đào tạo (Training Manager)",
    "instructor": "Giảng viên (Instructor)",
    "teaching_assistant": "Trợ giảng (Teaching Assistant)",
    "student": "Học viên (Student)",
    "admissions": "Tư vấn tuyển sinh (Admissions)",
    "accountant": "Kế toán (Accountant)",
    "visitor": "Khách tham quan (Visitor)"
};

// Hàng đợi lưu vết các email đã phát hành (Audit Trail & Unit Test verification)
const sentEmails = [];

/**
 * Tạo mẫu HTML email thông báo kích hoạt tài khoản chuyên nghiệp
 */
function buildActivationEmailHtml({ name, email, temporaryPassword, role, loginUrl }) {
    const roleTitle = ROLE_NAMES[role] || role || "Nhân sự mới";
    const currentYear = new Date().getFullYear();

    return `
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Thông tin kích hoạt tài khoản TMS</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.6;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 32px 16px;">
        <tr>
            <td align="center">
                <table role="presentation" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1); border: 1px solid #e2e8f0;">
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 32px 36px; text-align: left; border-bottom: 3px solid #10b981;">
                            <div style="display: inline-block; background-color: #10b981; color: #ffffff; font-weight: 800; font-size: 13px; letter-spacing: 1px; padding: 4px 10px; border-radius: 6px; margin-bottom: 12px;">TMS EDUCATION</div>
                            <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 700; line-height: 1.3;">Hệ Thống Quản Lý Đào Tạo TMS</h1>
                            <p style="margin: 6px 0 0 0; color: #94a3b8; font-size: 13px;">${SMTP_CONFIG.fromName} &bull; Cấp quyền truy cập nhân sự mới</p>
                        </td>
                    </tr>

                    <!-- Body -->
                    <tr>
                        <td style="padding: 36px 36px 28px 36px;">
                            <p style="margin: 0 0 16px 0; font-size: 15px; color: #334155;">
                                Kính gửi <strong>${name}</strong>,
                            </p>
                            <p style="margin: 0 0 24px 0; font-size: 14px; color: #475569; line-height: 1.6;">
                                Chào mừng bạn gia nhập đội ngũ nhân sự của <strong>Hệ thống Quản lý Đào tạo TMS</strong>! Tài khoản của bạn đã được Quản trị viên khởi tạo thành công để bạn bắt đầu công tác trong ngày đầu đi làm.
                            </p>

                            <!-- Credentials Box -->
                            <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 10px; padding: 20px 24px; margin-bottom: 24px;">
                                <div style="font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 14px; border-bottom: 1px dashed #cbd5e1; padding-bottom: 8px;">
                                    THÔNG TIN ĐĂNG NHẬP HỆ THỐNG
                                </div>
                                <table width="100%" cellspacing="0" cellpadding="0" style="font-size: 14px;">
                                    <tr>
                                        <td style="padding: 6px 0; color: #64748b; width: 140px;">Họ và tên:</td>
                                        <td style="padding: 6px 0; color: #0f172a; font-weight: 600;">${name}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 6px 0; color: #64748b;">Tên đăng nhập (Email):</td>
                                        <td style="padding: 6px 0; color: #0284c7; font-weight: 600;">${email}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 6px 0; color: #64748b;">Vai trò đảm nhiệm:</td>
                                        <td style="padding: 6px 0; color: #0f172a; font-weight: 600;">
                                            <span style="display: inline-block; background-color: #ecfdf5; color: #047857; padding: 2px 8px; border-radius: 4px; font-size: 13px; border: 1px solid #a7f3d0;">
                                                ${roleTitle}
                                            </span>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 8px 0 6px 0; color: #64748b; vertical-align: middle;">Mật khẩu tạm thời:</td>
                                        <td style="padding: 8px 0 6px 0; vertical-align: middle;">
                                            <code style="background-color: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; padding: 4px 10px; border-radius: 6px; font-family: 'JetBrains Mono', Consolas, Monaco, monospace; font-size: 15px; font-weight: 700; letter-spacing: 1px;">
                                                ${temporaryPassword}
                                            </code>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 6px 0; color: #64748b;">Trạng thái:</td>
                                        <td style="padding: 6px 0; color: #16a34a; font-weight: 600;">Đã kích hoạt &bull; Sẵn sàng đăng nhập</td>
                                    </tr>
                                </table>
                            </div>

                            <!-- Security Notice -->
                            <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 4px; margin-bottom: 28px; font-size: 13px; color: #92400e;">
                                <strong>Lưu ý bảo mật quan trọng:</strong> Mật khẩu trên là mật khẩu tạm thời được hệ thống cấp tự động. Vì lý do an toàn, vui lòng đăng nhập và thực hiện <strong>đổi mật khẩu mới</strong> ngay trong lần đầu tiên truy cập.
                            </div>

                            <!-- Button CTA -->
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 28px;">
                                <tr>
                                    <td align="center">
                                        <a href="${loginUrl}" target="_blank" style="display: inline-block; background-color: #10b981; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; padding: 14px 32px; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(16, 185, 129, 0.4);">
                                            Đăng Nhập Vào Hệ Thống TMS &rarr;
                                        </a>
                                    </td>
                                </tr>
                            </table>

                            <p style="margin: 0; font-size: 13px; color: #64748b; text-align: center;">
                                Hoặc truy cập đường dẫn trực tiếp: <br>
                                <a href="${loginUrl}" style="color: #0284c7; word-break: break-all;">${loginUrl}</a>
                            </p>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 24px 36px; text-align: center; font-size: 12px; color: #64748b;">
                            <p style="margin: 0 0 6px 0;">Email này được gửi tự động từ <strong>${SMTP_CONFIG.fromName}</strong> (${SMTP_CONFIG.fromEmail}).</p>
                            <p style="margin: 0 0 6px 0;">Nếu bạn cần hỗ trợ kỹ thuật hoặc cấp lại quyền truy cập, vui lòng liên hệ quản trị viên.</p>
                            <p style="margin: 10px 0 0 0; color: #94a3b8;">&copy; ${currentYear} TMS Education Platform. Mọi quyền được bảo lưu.</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    `.trim();
}

/**
 * KN-11 & KN-86: Gửi email kích hoạt tài khoản kèm mật khẩu tạm cho nhân sự mới
 * @param {Object} options
 * @param {string} options.to - Email người nhận
 * @param {string} options.name - Họ tên nhân sự mới
 * @param {string} options.temporaryPassword - Mật khẩu tạm thời
 * @param {string} [options.role] - Mã vai trò hệ thống
 * @param {string} [options.loginUrl] - Đường dẫn đăng nhập
 * @returns {Object} Bản ghi email kích hoạt
 */
function sendActivationEmail({ to, name, temporaryPassword, role = "instructor", loginUrl = "" }) {
    const frontendUrl = loginUrl || process.env.FRONTEND_URL || "http://localhost:3000";
    const fullLoginUrl = frontendUrl.endsWith("/") ? `${frontendUrl}Login.html` : `${frontendUrl}/Login.html`;

    const subject = `[TMS] Thông tin tài khoản nhân sự mới và mật khẩu tạm thời - ${name}`;

    const emailRecord = {
        id: "mail_" + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
        to,
        subject,
        name,
        temporaryPassword,
        role,
        sentAt: new Date().toISOString(),
        status: "SENT",
        provider: "BKNS_SMTP"
    };

    // Đẩy vào hàng đợi theo dõi
    sentEmails.push(emailRecord);

    // Kích hoạt gửi mail thực tế qua SMTP (background async)
    if (transporter) {
        const mailOptions = {
            from: `"${SMTP_CONFIG.fromName}" <${SMTP_CONFIG.fromEmail}>`,
            to,
            subject,
            text: `Kính gửi ${name},\n\nChào mừng bạn đến với Hệ thống Quản lý Đào tạo TMS!\n\nThông tin tài khoản công tác:\n- Họ và tên: ${name}\n- Tên đăng nhập / Email: ${to}\n- Vai trò: ${ROLE_NAMES[role] || role}\n- Mật khẩu tạm thời: ${temporaryPassword}\n- Địa chỉ đăng nhập: ${fullLoginUrl}\n\nVui lòng đăng nhập và đổi mật khẩu mới trong lần đầu tiên sử dụng.\n\nTrân trọng,\n${SMTP_CONFIG.fromName}`,
            html: buildActivationEmailHtml({
                name,
                email: to,
                temporaryPassword,
                role,
                loginUrl: fullLoginUrl
            })
        };

        transporter.sendMail(mailOptions)
            .then(info => {
                emailRecord.status = "DELIVERED";
                emailRecord.messageId = info.messageId;
                emailRecord.response = info.response;
                console.log(`[EmailService] ✔ Đã gửi email kích hoạt tài khoản thành công tới: ${to} (MessageID: ${info.messageId})`);
            })
            .catch(err => {
                emailRecord.deliveryError = err.message;
                console.warn(`[EmailService] ⚠ Gửi email SMTP tới ${to} gặp sự cố:`, err.message);
            });
    }

    return emailRecord;
}

/**
 * Kiểm tra kết nối SMTP
 */
async function verifySmtp() {
    if (!transporter) {
        return { success: false, message: "Transporter chưa được khởi tạo." };
    }
    return new Promise((resolve) => {
        transporter.verify((err, success) => {
            if (err) {
                resolve({ success: false, error: err.message, host: SMTP_CONFIG.host, port: SMTP_CONFIG.port });
            } else {
                resolve({ success: true, host: SMTP_CONFIG.host, port: SMTP_CONFIG.port, user: SMTP_CONFIG.user });
            }
        });
    });
}

module.exports = {
    SMTP_CONFIG,
    ROLE_NAMES,
    sendActivationEmail,
    sentEmails,
    verifySmtp,
    buildActivationEmailHtml
};
