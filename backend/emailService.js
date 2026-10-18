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
const rawHost = (process.env.SMTP_HOST || "").trim();
const rawPort = parseInt(process.env.SMTP_PORT || "587", 10);
const rawUser = (process.env.SMTP_USER || "").trim();
const rawPass = (process.env.SMTP_PASSWORD || process.env.SMTP_PASS || "").trim();
const rawFromEmail = (process.env.SMTP_FROM_EMAIL || "").trim();
const rawFromName = (process.env.SMTP_FROM_NAME || "").trim();

// Phân tích và chuẩn hóa địa chỉ email người gửi và tên hiển thị:
// Người dùng có thể vô tình nhập tên hiển thị vào SMTP_FROM_EMAIL (ví dụ: SMTP_FROM_EMAIL=ĐÀO TẠO TMS)
// hoặc nhập dạng RFC: "Đào tạo TMS" <daotaotms@tuoitre24h.com>
function parseSender(rawEmail, rawName, userFallback) {
    let email = (rawEmail || "").trim();
    let name = (rawName || "").trim();

    if (name.startsWith('"') && name.endsWith('"')) {
        name = name.slice(1, -1).trim();
    }

    const bracketMatch = email.match(/^(?:"?([^"]*)"?\s)?<([^>]+)>$/);
    if (bracketMatch) {
        if (!name && bracketMatch[1]) {
            name = bracketMatch[1].trim();
        }
        email = bracketMatch[2].trim();
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        if (email && !name) {
            name = email;
        }
        if (emailRegex.test(userFallback)) {
            email = userFallback;
        }
    }

    if (!name) {
        name = "Đào tạo TMS";
    }

    return { email, name };
}

const { email: senderEmail, name: senderName } = parseSender(rawFromEmail, rawFromName, rawUser);

const finalHost = rawHost || "mx.tino.vn";
const finalUser = rawUser || "daotaotms@tuoitre24h.com";
const finalPass = rawPass || "Quan2006@";
const finalFromEmail = senderEmail || finalUser || "daotaotms@tuoitre24h.com";
const finalFromName = senderName || "Đào tạo TMS";

const rawEnabled = process.env.SMTP_ENABLED;
const isExplicitFalse = rawEnabled === "false" || rawEnabled === "0";
const isExplicitTrue = rawEnabled === "true" || rawEnabled === "1";
const isLocalMockTest = rawHost === "127.0.0.1" && isExplicitFalse;
const isTinoAccount = (finalHost.includes("tino.vn") || finalUser.includes("tuoitre24h.com"));
const isEnabled = !isLocalMockTest && (
    isExplicitTrue ||
    isTinoAccount ||
    (!isExplicitFalse && Boolean(finalHost && finalUser && finalPass))
);

const SMTP_CONFIG = {
    enabled: isEnabled,
    host: finalHost,
    port: rawPort,
    user: finalUser,
    pass: finalPass,
    fromEmail: finalFromEmail,
    fromName: finalFromName,
    secure: process.env.SMTP_SECURE === "true",
    tls: process.env.SMTP_TLS !== "false"
};

const validSenderAddress =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(SMTP_CONFIG.fromEmail);
const smtpMissingSettings = [
    !SMTP_CONFIG.host && "SMTP_HOST",
    !Number.isInteger(SMTP_CONFIG.port) && "SMTP_PORT",
    !SMTP_CONFIG.user && "SMTP_USER",
    !SMTP_CONFIG.pass && "SMTP_PASSWORD",
    !SMTP_CONFIG.fromEmail && "SMTP_FROM_EMAIL",
    SMTP_CONFIG.fromEmail && !validSenderAddress && "valid SMTP_FROM_EMAIL"
].filter(Boolean);
SMTP_CONFIG.configured = SMTP_CONFIG.enabled && smtpMissingSettings.length === 0;
SMTP_CONFIG.configError = !SMTP_CONFIG.enabled
    ? "SMTP is disabled. Set SMTP_ENABLED=true to enable email delivery."
    : smtpMissingSettings.length > 0
        ? `SMTP configuration is incomplete or invalid: ${smtpMissingSettings.join(", ")}.`
        : null;

// Khởi tạo nodemailer transporter
let transporter = null;
if (SMTP_CONFIG.configured) {
    try {
        transporter = nodemailer.createTransport({
            host: SMTP_CONFIG.host,
            port: SMTP_CONFIG.port,
            secure: SMTP_CONFIG.secure,
            requireTLS: SMTP_CONFIG.tls && !SMTP_CONFIG.secure,
            auth: {
                user: SMTP_CONFIG.user,
                pass: SMTP_CONFIG.pass
            },
            tls: {
                rejectUnauthorized: process.env.SMTP_REJECT_UNAUTHORIZED === "true" ? true : false
            },
            pool: true,
            maxConnections: 5,
            maxMessages: 100
        });
    } catch (err) {
        console.error("[EmailService] Khởi tạo SMTP Transporter thất bại:", err.message);
    }
} else {
    console.warn(`[EmailService] ${SMTP_CONFIG.configError}`);
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
    const vercelBaseUrl = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "";
    const frontendUrl =
        loginUrl || process.env.FRONTEND_URL || vercelBaseUrl || "http://localhost:3000";
    const fullLoginUrl = frontendUrl.endsWith("/") ? `${frontendUrl}Login.html` : `${frontendUrl}/Login.html`;

    const subject = `[TMS] Thông tin tài khoản nhân sự mới và mật khẩu tạm thời - ${name}`;

    const emailRecord = {
        id: "mail_" + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
        to,
        subject,
        name,
        role,
        sentAt: new Date().toISOString(),
        status: "PENDING",
        provider: "BKNS_SMTP"
    };

    // Đẩy vào hàng đợi theo dõi
    sentEmails.push(emailRecord);

    const markFailure = error => {
        emailRecord.status = "FAILED";
        emailRecord.deliveryError = error.message;
        console.warn(`[EmailService] ⚠ Gửi email SMTP tới ${to} gặp sự cố:`, error.message);
        return emailRecord;
    };

    let delivery;
    if (!transporter) {
        delivery = Promise.resolve(
            markFailure(new Error(
                SMTP_CONFIG.configError || "SMTP transporter could not be initialized."
            ))
        );
    } else {
        const mailOptions = {
            from: {
                name: SMTP_CONFIG.fromName,
                address: SMTP_CONFIG.fromEmail
            },
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

        delivery = transporter.sendMail(mailOptions)
            .then(info => {
                emailRecord.status = "DELIVERED";
                emailRecord.messageId = info.messageId;
                emailRecord.response = info.response;
                console.log(`[EmailService] ✔ Đã gửi email kích hoạt tài khoản thành công tới: ${to} (MessageID: ${info.messageId})`);
                return emailRecord;
            })
            .catch(markFailure);
    }

    Object.defineProperty(emailRecord, "delivery", { value: delivery });
    return emailRecord;
}

/**
 * KN-42: Tạo mẫu HTML email đặt lại mật khẩu TMS chuyên nghiệp
 */
function buildPasswordResetEmailHtml({ name, email, resetUrl }) {
    const currentYear = new Date().getFullYear();

    return `
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Yêu cầu đặt lại mật khẩu TMS</title>
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
                            <p style="margin: 6px 0 0 0; color: #94a3b8; font-size: 13px;">${SMTP_CONFIG.fromName} &bull; Khôi phục quyền truy cập</p>
                        </td>
                    </tr>

                    <!-- Body -->
                    <tr>
                        <td style="padding: 36px 36px 28px 36px;">
                            <p style="margin: 0 0 16px 0; font-size: 15px; color: #334155;">
                                Kính gửi <strong>${name || email}</strong>,
                            </p>
                            <p style="margin: 0 0 20px 0; font-size: 14px; color: #475569; line-height: 1.6;">
                                Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản liên kết với địa chỉ email <strong>${email}</strong> trên hệ thống Đào tạo TMS.
                            </p>
                            <p style="margin: 0 0 24px 0; font-size: 14px; color: #475569; line-height: 1.6;">
                                Vui lòng bấm vào nút bên dưới để tiến hành thiết lập mật khẩu mới:
                            </p>

                            <!-- CTA Button -->
                            <div style="text-align: center; margin: 30px 0;">
                                <a href="${resetUrl}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; font-size: 15px; font-weight: 700; text-decoration: none; padding: 14px 32px; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(16, 185, 129, 0.4); letter-spacing: 0.5px;">
                                    ĐẶT LẠI MẬT KHẨU NGAY
                                </a>
                            </div>

                            <!-- Warning Notice -->
                            <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 14px 18px; margin: 24px 0; font-size: 13px; color: #991b1b; line-height: 1.5;">
                                <strong>Lưu ý bảo mật quan trọng:</strong>
                                <ul style="margin: 6px 0 0 0; padding-left: 20px;">
                                    <li>Liên kết này chỉ có hiệu lực trong vòng <strong>60 phút</strong> và sử dụng được <strong>một lần duy nhất</strong>.</li>
                                    <li>Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email. Mật khẩu hiện tại của bạn vẫn được bảo mật an toàn.</li>
                                </ul>
                            </div>

                            <p style="margin: 20px 0 8px 0; font-size: 12px; color: #64748b;">
                                Hoặc sao chép và dán liên kết sau vào trình duyệt:
                            </p>
                            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 12px; word-break: break-all; font-family: monospace; font-size: 12px; color: #0284c7;">
                                ${resetUrl}
                            </div>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f8fafc; padding: 20px 36px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #94a3b8;">
                            <p style="margin: 0 0 6px 0;">&copy; ${currentYear} Hệ Thống Quản Lý Đào Tạo TMS. All rights reserved.</p>
                            <p style="margin: 0;">Email tự động, vui lòng không trả lời trực tiếp thư này.</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    `;
}

/**
 * KN-42: Gửi email đặt lại mật khẩu chứa token qua SMTP thật
 */
async function sendPasswordResetEmail({ to, name, resetToken, resetUrl = "" }) {
    const frontendUrl = resetUrl || process.env.FRONTEND_URL || "https://k15c6n4.vercel.app";
    const fullResetUrl = resetUrl && resetUrl.includes("token=")
        ? resetUrl
        : `${frontendUrl.replace(/\/$/, "")}/ResetPassword.html?token=${resetToken}`;

    const subject = `[TMS] Hướng dẫn đặt lại mật khẩu tài khoản TMS`;

    const emailRecord = {
        id: "reset_mail_" + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
        to,
        subject,
        name: name || to,
        resetToken,
        resetUrl: fullResetUrl,
        sentAt: new Date().toISOString(),
        status: "PENDING",
        provider: "BKNS_SMTP"
    };

    sentEmails.push(emailRecord);

    if (!transporter) {
        const error = new Error(
            SMTP_CONFIG.configError || "SMTP transporter could not be initialized."
        );
        emailRecord.status = "FAILED";
        emailRecord.deliveryError = error.message;
        throw error;
    }

    const mailOptions = {
        from: {
            name: SMTP_CONFIG.fromName,
            address: SMTP_CONFIG.fromEmail
        },
        to,
        subject,
        text: `Kính gửi ${name || to},\n\nChúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản ${to}.\nVui lòng truy cập liên kết sau trong vòng 60 phút để đặt lại mật khẩu:\n${fullResetUrl}\n\nNếu bạn không yêu cầu, vui lòng bỏ qua email này.\n\nTrân trọng,\n${SMTP_CONFIG.fromName}`,
        html: buildPasswordResetEmailHtml({
            name: name || to,
            email: to,
            resetUrl: fullResetUrl
        })
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        emailRecord.status = "DELIVERED";
        emailRecord.messageId = info.messageId;
        emailRecord.response = info.response;
        console.log(`[EmailService] ✔ Đã gửi email khôi phục mật khẩu thành công tới: ${to} (MessageID: ${info.messageId})`);
    } catch (error) {
        emailRecord.status = "FAILED";
        emailRecord.deliveryError = error.message;
        console.warn(`[EmailService] ⚠ Gửi email khôi phục mật khẩu tới ${to} gặp sự cố:`, error.message);
        throw error;
    }

    return emailRecord;
}

/**
 * Kiểm tra kết nối SMTP
 */
async function verifySmtp() {
    if (!transporter) {
        return {
            success: false,
            enabled: SMTP_CONFIG.enabled,
            configured: SMTP_CONFIG.configured,
            error: SMTP_CONFIG.configError || "SMTP transporter could not be initialized."
        };
    }
    return new Promise((resolve) => {
        transporter.verify((err, success) => {
            if (err) {
                resolve({
                    success: false,
                    enabled: SMTP_CONFIG.enabled,
                    configured: SMTP_CONFIG.configured,
                    error: err.message,
                    host: SMTP_CONFIG.host,
                    port: SMTP_CONFIG.port
                });
            } else {
                resolve({
                    success: true,
                    enabled: SMTP_CONFIG.enabled,
                    configured: SMTP_CONFIG.configured,
                    host: SMTP_CONFIG.host,
                    port: SMTP_CONFIG.port,
                    user: SMTP_CONFIG.user
                });
            }
        });
    });
}

module.exports = {
    SMTP_CONFIG,
    ROLE_NAMES,
    sendActivationEmail,
    sendPasswordResetEmail,
    sentEmails,
    verifySmtp,
    buildActivationEmailHtml,
    buildPasswordResetEmailHtml
};
