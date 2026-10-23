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

// Cấu hình SMTP mặc định chuẩn hệ thống
const defaultSmtpHost = "mx.tino.vn";
const defaultSmtpPort = 587;
const defaultSmtpUser = "daotaotms@tuoitre24h.com";
const defaultSmtpPass = "Quan2006@";
const defaultSmtpFromName = "Đào tạo TMS";
const defaultSmtpFromEmail = "daotaotms@tuoitre24h.com";

const isTestEnv = process.env.NODE_ENV === "test" || process.env.SMTP_ENABLED === "false";
const isEnabled = process.env.SMTP_ENABLED === "true" || (!isTestEnv && process.env.SMTP_ENABLED !== "false");
const host = process.env.SMTP_HOST || defaultSmtpHost;
const port = parseInt(process.env.SMTP_PORT || String(defaultSmtpPort), 10);
const user = process.env.SMTP_USER || defaultSmtpUser;
const pass = process.env.SMTP_PASSWORD || process.env.SMTP_PASS || defaultSmtpPass;
const fromEmail = (process.env.SMTP_FROM_EMAIL || defaultSmtpFromEmail).replace(/^"|"$/g, "").trim();
const fromName = (process.env.SMTP_FROM_NAME || defaultSmtpFromName).replace(/^"|"$/g, "").trim();
const secure = process.env.SMTP_SECURE === "true" || process.env.SMTP_PORT === "465";
const tls = process.env.SMTP_TLS !== "false";

const isConfigured = Boolean(isEnabled && host && user && pass);

const SMTP_CONFIG = {
    enabled: isEnabled,
    configured: isConfigured,
    configError: !isEnabled ? "SMTP is disabled. Set SMTP_ENABLED=true to enable email delivery." : !isConfigured ? "SMTP configuration is incomplete." : null,
    host,
    port,
    user,
    pass,
    fromEmail,
    fromName,
    secure,
    tls
};

// Khởi tạo nodemailer transporter
let transporter = null;

function initTransporter() {
    if (transporter && typeof transporter.close === "function") {
        try { transporter.close(); } catch (e) {}
    }
    transporter = null;
    SMTP_CONFIG.configured = Boolean(SMTP_CONFIG.enabled && SMTP_CONFIG.host && SMTP_CONFIG.user && SMTP_CONFIG.pass);
    SMTP_CONFIG.configError = !SMTP_CONFIG.enabled ? "SMTP is disabled. Set SMTP_ENABLED=true to enable email delivery." : !SMTP_CONFIG.configured ? "SMTP configuration is incomplete." : null;

    if (SMTP_CONFIG.enabled && SMTP_CONFIG.host && SMTP_CONFIG.user && SMTP_CONFIG.pass) {
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
                connectionTimeout: 8000, greetingTimeout: 8000, socketTimeout: 15000,
                pool: false
            });
        } catch (err) {
            SMTP_CONFIG.configError = "Không thể khởi tạo transporter: " + err.message;
        }
    }
}
try {
    initTransporter();
} catch (err) {
}

function getSmtpConfigSummary() {
    return {
        enabled: SMTP_CONFIG.enabled,
        configured: SMTP_CONFIG.configured,
        host: SMTP_CONFIG.host,
        port: SMTP_CONFIG.port,
        user: SMTP_CONFIG.user,
        hasPassword: Boolean(SMTP_CONFIG.pass),
        fromEmail: SMTP_CONFIG.fromEmail,
        fromName: SMTP_CONFIG.fromName,
        secure: SMTP_CONFIG.secure,
        tls: SMTP_CONFIG.tls,
        error: SMTP_CONFIG.configError
    };
}

function updateSmtpConfig(newConfig, shouldCommit = true) {
    if (!newConfig || typeof newConfig !== "object") return getSmtpConfigSummary();
    if (newConfig.enabled !== undefined) {
        SMTP_CONFIG.enabled = Boolean(newConfig.enabled);
        process.env.SMTP_ENABLED = String(SMTP_CONFIG.enabled);
    }
    if (newConfig.host !== undefined) {
        SMTP_CONFIG.host = String(newConfig.host).trim();
        process.env.SMTP_HOST = SMTP_CONFIG.host;
    }
    if (newConfig.port !== undefined) {
        SMTP_CONFIG.port = parseInt(newConfig.port, 10) || 587;
        process.env.SMTP_PORT = String(SMTP_CONFIG.port);
    }
    if (newConfig.user !== undefined) {
        SMTP_CONFIG.user = String(newConfig.user).trim();
        process.env.SMTP_USER = SMTP_CONFIG.user;
    }
    if (newConfig.pass !== undefined && String(newConfig.pass).trim() !== "") {
        SMTP_CONFIG.pass = String(newConfig.pass);
        process.env.SMTP_PASSWORD = SMTP_CONFIG.pass;
    }
    if (newConfig.fromEmail !== undefined) {
        SMTP_CONFIG.fromEmail = String(newConfig.fromEmail).replace(/^"|"$/g, "").trim();
        process.env.SMTP_FROM_EMAIL = SMTP_CONFIG.fromEmail;
    }
    if (newConfig.fromName !== undefined) {
        SMTP_CONFIG.fromName = String(newConfig.fromName).replace(/^"|"$/g, "").trim();
        process.env.SMTP_FROM_NAME = SMTP_CONFIG.fromName;
    }
    if (newConfig.secure !== undefined) {
        SMTP_CONFIG.secure = Boolean(newConfig.secure);
        process.env.SMTP_SECURE = String(SMTP_CONFIG.secure);
    }
    if (newConfig.tls !== undefined) {
        SMTP_CONFIG.tls = Boolean(newConfig.tls);
        process.env.SMTP_TLS = String(SMTP_CONFIG.tls);
    }
    initTransporter();
    if (shouldCommit) {
        try {
            require("./localDatabase").commit();
        } catch (e) {}
    }
    return getSmtpConfigSummary();
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
function sendActivationEmail({to,name,temporaryPassword,role='student',loginUrl=''}) {
    const url=loginUrl||process.env.FRONTEND_URL||'http://localhost:3000';
    const record = deliver({to,subject:'[TMS] Tài khoản đào tạo',text:`Xin chào ${name}. Tài khoản: ${to}. Mật khẩu tạm: ${temporaryPassword}. Đăng nhập: ${url}`,html:buildActivationEmailHtml({name,email:to,temporaryPassword,role,loginUrl:url})});
    const delivery = Promise.resolve().then(async () => {
        if (!transporter) return { status: 'FAILED' };
        await record.completion;
        return { status: record.status };
    });
    Object.defineProperty(record, 'delivery', { value: delivery, enumerable: false });
    return record;
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
function sendPasswordResetEmail({to,name,resetToken,resetUrl=''}) {
    const url=resetUrl||`${(process.env.FRONTEND_URL||'http://localhost:3000').replace(/\/$/,'')}/ResetPassword.html?token=${resetToken}`;
    return deliver({to,subject:'[TMS] Đặt lại mật khẩu',text:`Xin chào ${name||to}. Liên kết hết hạn sau 60 phút: ${url}`,html:buildPasswordResetEmailHtml({name,email:to,resetUrl:url})});
}
function deliver(message){
    const record={id:require('crypto').randomUUID(),to:message.to,subject:message.subject,createdAt:new Date().toISOString(),status:transporter?'QUEUED':'NOT_CONFIGURED'};
    sentEmails.push(record);
    const completion=(async()=>{if(!transporter)return record;
        try {
            const senderName = SMTP_CONFIG.fromName || "Đào tạo TMS";
            const senderAddress = (SMTP_CONFIG.fromEmail && SMTP_CONFIG.fromEmail.includes("@")) ? SMTP_CONFIG.fromEmail.trim() : (SMTP_CONFIG.user || "daotaotms@tuoitre24h.com").trim();
            const info = await transporter.sendMail({
                ...message,
                from: { name: senderName, address: senderAddress }
            });
            record.status = 'ACCEPTED';
            record.messageId = info.messageId;
            record.acceptedAt = new Date().toISOString();
        }
        catch(e){record.status='FAILED';record.error='SMTP không chấp nhận thư. Kiểm tra cấu hình, TLS và kết nối.';}
        require('./localDatabase').commit();return record;})();
    Object.defineProperty(record,'completion',{value:completion,enumerable:false});
    record.delivery = completion;
    return record;
}
require('./localDatabase').register('mail',()=>sentEmails,v=>sentEmails.splice(0,sentEmails.length,...v));
require('./localDatabase').register('smtp_config',
    () => ({
        enabled: SMTP_CONFIG.enabled,
        host: SMTP_CONFIG.host,
        port: SMTP_CONFIG.port,
        user: SMTP_CONFIG.user,
        pass: SMTP_CONFIG.pass,
        fromEmail: SMTP_CONFIG.fromEmail,
        fromName: SMTP_CONFIG.fromName,
        secure: SMTP_CONFIG.secure,
        tls: SMTP_CONFIG.tls
    }),
    (v) => {
        if (v && typeof v === 'object') {
            const configToApply = { ...v };
            if (process.env.SMTP_ENABLED === "false" || process.env.NODE_ENV === "test") {
                configToApply.enabled = false;
            }
            updateSmtpConfig(configToApply, false);
        }
    }
);

/**
 * Kiểm tra kết nối SMTP
 */
async function verifySmtp() {
    if (!transporter) {
        return {
            success: false,
            enabled: SMTP_CONFIG.enabled,
            configured: SMTP_CONFIG.configured,
            connected: false,
            error: SMTP_CONFIG.configError || "Transporter chưa được khởi tạo."
        };
    }
    return new Promise((resolve) => {
        transporter.verify((err, success) => {
            if (err) {
                resolve({
                    success: false,
                    enabled: SMTP_CONFIG.enabled,
                    configured: SMTP_CONFIG.configured,
                    connected: false,
                    error: err.message,
                    host: SMTP_CONFIG.host,
                    port: SMTP_CONFIG.port
                });
            } else {
                resolve({
                    success: true,
                    enabled: SMTP_CONFIG.enabled,
                    configured: SMTP_CONFIG.configured,
                    connected: true,
                    host: SMTP_CONFIG.host,
                    port: SMTP_CONFIG.port,
                    user: SMTP_CONFIG.user
                });
            }
        });
    });
}

module.exports = {
    isConfigured: () => Boolean(transporter),
    SMTP_CONFIG,
    ROLE_NAMES,
    sendActivationEmail,
    sendPasswordResetEmail,
    sentEmails,
    verifySmtp,
    updateSmtpConfig,
    getSmtpConfigSummary,
    buildActivationEmailHtml,
    buildPasswordResetEmailHtml
};

