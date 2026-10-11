// Cấu sở dữ liệu mô phỏng trong bộ nhớ cho 8 vai trò người dùng hệ thống TMS
const crypto = require("crypto");

// Hàm hash bảo vệ mật khẩu bằng PBKDF2 (chuẩn an toàn NIST SP 800-132)
function hashPassword(password, salt) {
    return crypto.pbkdf2Sync(String(password), String(salt), 10000, 64, "sha512").toString("hex");
}

// KN-37: Xác thực mật khẩu với hàm so sánh constant-time chống tấn công side-channel
function verifyPassword(password, salt, storedHash) {
    if (!password || !salt || !storedHash) return false;
    const computedHash = hashPassword(password, salt);
    const bufComputed = Buffer.from(computedHash, "hex");
    const bufStored = Buffer.from(storedHash, "hex");
    if (bufComputed.length !== bufStored.length) return false;
    return crypto.timingSafeEqual(bufComputed, bufStored);
}

function generateSalt() {
    return crypto.randomBytes(16).toString("hex");
}

// Khởi tạo danh sách người dùng mẫu với mật khẩu đã băm (hashed)
const users = [
    { id: "usr_admin", email: "admin@tms.edu.vn", name: "Nguyễn Văn Anh", role: "administrator", salt: "s1", passwordHash: "" },
    { id: "usr_manager", email: "manager@tms.edu.vn", name: "Đỗ Quốc Bảo", role: "training_manager", salt: "s2", passwordHash: "" },
    { id: "usr_teacher", email: "teacher@tms.edu.vn", name: "ThS. Trần Minh", role: "instructor", salt: "s3", passwordHash: "" },
    { id: "usr_ta", email: "ta@tms.edu.vn", name: "Nguyễn Thu Hà", role: "teaching_assistant", salt: "s4", passwordHash: "" },
    { id: "usr_student", email: "student@tms.edu.vn", name: "Lê Minh Tuấn", role: "student", salt: "s5", passwordHash: "" },
    { id: "usr_student2", email: "sv001", name: "Lê Minh Tuấn", role: "student", salt: "s6", passwordHash: "" },
    { id: "usr_admissions", email: "admissions@tms.edu.vn", name: "Vũ Hải Yến", role: "admissions", salt: "s7", passwordHash: "" },
    { id: "usr_accountant", email: "accountant@tms.edu.vn", name: "Phạm Thanh Mai", role: "accountant", salt: "s8", passwordHash: "" },
    { id: "usr_visitor", email: "visitor@tms.edu.vn", name: "Khách tham quan", role: "visitor", salt: "s9", passwordHash: "" }
];

const passwords = {
    "admin@tms.edu.vn": "admin123",
    "manager@tms.edu.vn": "manager123",
    "teacher@tms.edu.vn": "teacher123",
    "ta@tms.edu.vn": "ta123456",
    "student@tms.edu.vn": "student123",
    "sv001": "student123",
    "admissions@tms.edu.vn": "admissions123",
    "accountant@tms.edu.vn": "accountant123",
    "visitor@tms.edu.vn": "visitor123"
};

// Khởi tạo hash mật khẩu
users.forEach(u => {
    u.salt = generateSalt();
    u.passwordHash = hashPassword(passwords[u.email] || "123456", u.salt);
});

// Quản lý trạng thái khóa tài khoản và số lần sai liên tiếp
const loginAttempts = new Map(); // key: email, value: { count: number, lockoutUntil: number }

const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 phút (900 giây)
const MAX_FAILED_ATTEMPTS = 5;

// Tìm kiếm người dùng theo email hoặc mã định danh
function findUserByEmail(email) {
    const normalized = String(email || "").trim().toLowerCase();
    return users.find(u => u.email.toLowerCase() === normalized);
}

// Tạo session token an toàn
function generateToken(user) {
    const payload = {
        userId: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        issuedAt: Date.now(),
        expiresAt: Date.now() + (24 * 60 * 60 * 1000)
    };
    return Buffer.from(JSON.stringify(payload)).toString("base64");
}

// Xác thực và giải mã session token
function verifyToken(tokenString) {
    if (!tokenString) return null;
    try {
        const decoded = Buffer.from(tokenString, "base64").toString("utf-8");
        const payload = JSON.parse(decoded);
        if (!payload.userId || !payload.expiresAt) return null;
        if (Date.now() > payload.expiresAt) return null;
        return payload;
    } catch {
        return null;
    }
}

function getLockoutStatus(email) {
    const normalized = String(email || "").trim().toLowerCase();
    const now = Date.now();
    const attempt = loginAttempts.get(normalized) || { count: 0, lockoutUntil: 0 };

    if (attempt.lockoutUntil > now) {
        return {
            isLocked: true,
            remainingSeconds: Math.ceil((attempt.lockoutUntil - now) / 1000)
        };
    }

    if (attempt.lockoutUntil > 0 && attempt.lockoutUntil <= now) {
        attempt.count = 0;
        attempt.lockoutUntil = 0;
        loginAttempts.set(normalized, attempt);
    }

    return {
        isLocked: false,
        count: attempt.count,
        remainingAttempts: Math.max(0, MAX_FAILED_ATTEMPTS - attempt.count)
    };
}

function recordFailedAttempt(email) {
    const normalized = String(email || "").trim().toLowerCase();
    const now = Date.now();
    const attempt = loginAttempts.get(normalized) || { count: 0, lockoutUntil: 0 };

    attempt.count += 1;
    if (attempt.count >= MAX_FAILED_ATTEMPTS) {
        attempt.lockoutUntil = now + LOCK_DURATION_MS;
        loginAttempts.set(normalized, attempt);
        return {
            isLocked: true,
            count: attempt.count,
            lockoutUntil: attempt.lockoutUntil,
            remainingSeconds: Math.ceil(LOCK_DURATION_MS / 1000)
        };
    }

    loginAttempts.set(normalized, attempt);
    return {
        isLocked: false,
        count: attempt.count,
        remainingAttempts: MAX_FAILED_ATTEMPTS - attempt.count
    };
}

function recordSuccessfulLogin(email) {
    const normalized = String(email || "").trim().toLowerCase();
    loginAttempts.delete(normalized);
}

// =========================================================================
// KN-39, KN-40, KN-42, KN-43, KN-45: XỬ LÝ QUÊN VÀ ĐẶT LẠI MẬT KHẨU
// =========================================================================

// Lưu trữ token đặt lại mật khẩu trong bộ nhớ: token -> { email, userId, expiresAt, used, createdAt }
const passwordResetTokens = new Map();

// Quản lý tần suất yêu cầu đặt lại mật khẩu (Rate limit: tối đa 5 lần / giờ)
const forgotRateLimits = new Map(); // key: ip hoặc email, value: Array<timestamp>
const FORGOT_RATE_LIMIT_MAX = 5;
const FORGOT_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 giờ
const TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 60 phút

/**
 * Kiểm tra giới hạn tần suất yêu cầu quên mật khẩu (Rate limit 5 lần/giờ)
 */
function checkForgotRateLimit(key) {
    const now = Date.now();
    const timestamps = (forgotRateLimits.get(key) || []).filter(ts => now - ts < FORGOT_RATE_LIMIT_WINDOW_MS);
    if (timestamps.length >= FORGOT_RATE_LIMIT_MAX) {
        const oldest = timestamps[0];
        const retryAfterSeconds = Math.ceil((oldest + FORGOT_RATE_LIMIT_WINDOW_MS - now) / 1000);
        return { limited: true, retryAfterSeconds };
    }
    timestamps.push(now);
    forgotRateLimits.set(key, timestamps);
    return { limited: false };
}

/**
 * Tạo token đặt lại mật khẩu CSPRNG an toàn
 */
function createPasswordResetToken(email, clientIp = "") {
    const normalized = String(email || "").trim().toLowerCase();

    // Kiểm tra rate limit theo email và theo IP
    const emailLimit = checkForgotRateLimit(`email:${normalized}`);
    if (emailLimit.limited) {
        return { rateLimited: true, retryAfterSeconds: emailLimit.retryAfterSeconds };
    }
    if (clientIp) {
        const ipLimit = checkForgotRateLimit(`ip:${clientIp}`);
        if (ipLimit.limited) {
            return { rateLimited: true, retryAfterSeconds: ipLimit.retryAfterSeconds };
        }
    }

    const user = findUserByEmail(normalized);
    if (!user) {
        // KN-39: Không tìm thấy người dùng vẫn trả về kết quả giả lập an toàn để chống User Enumeration
        return {
            rateLimited: false,
            userFound: false
        };
    }

    // Sinh token an toàn 32 bytes URL-safe base64
    const token = crypto.randomBytes(32).toString("base64url");
    const expiresAt = Date.now() + TOKEN_EXPIRY_MS;

    passwordResetTokens.set(token, {
        token,
        userId: user.id,
        email: user.email,
        name: user.name,
        expiresAt,
        used: false,
        createdAt: Date.now()
    });

    return {
        rateLimited: false,
        userFound: true,
        token,
        expiresAt,
        user
    };
}

/**
 * Xác thực token đặt lại mật khẩu có hợp lệ và còn hạn hay không
 */
function verifyPasswordResetToken(token) {
    if (!token || typeof token !== "string") {
        return { valid: false, error: "Mã xác thực token không hợp lệ." };
    }

    const entry = passwordResetTokens.get(token);
    if (!entry) {
        return { valid: false, error: "Liên kết đặt lại mật khẩu không tồn tại hoặc đã hết hạn." };
    }

    if (entry.used) {
        return { valid: false, error: "Liên kết này đã được sử dụng trước đó. Vui lòng yêu cầu liên kết mới." };
    }

    if (Date.now() > entry.expiresAt) {
        return { valid: false, error: "Liên kết đặt lại mật khẩu đã hết hạn sau 60 phút. Vui lòng gửi lại yêu cầu." };
    }

    // Che bớt email hiển thị an toàn (VD: a***n@tms.edu.vn)
    const [local, domain] = entry.email.split("@");
    const maskedEmail = local.length > 2
        ? `${local[0]}***${local[local.length - 1]}@${domain}`
        : `${local}***@${domain}`;

    return {
        valid: true,
        userId: entry.userId,
        email: entry.email,
        maskedEmail
    };
}

/**
 * Đặt lại mật khẩu mới cho tài khoản bằng token
 */
function resetPasswordWithToken(token, newPassword) {
    const verification = verifyPasswordResetToken(token);
    if (!verification.valid) {
        throw { status: 400, message: verification.error };
    }

    // Kiểm tra độ mạnh mật khẩu (KN-45)
    // Tối thiểu 8 ký tự, gồm ít nhất chữ hoa, chữ thường và chữ số
    if (!newPassword || typeof newPassword !== "string" || newPassword.length < 8) {
        throw { status: 400, message: "Mật khẩu mới phải có tối thiểu 8 ký tự." };
    }
    if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
        throw { status: 400, message: "Mật khẩu phải chứa ít nhất 1 chữ hoa, 1 chữ thường và 1 số." };
    }

    const user = users.find(u => u.id === verification.userId || u.email.toLowerCase() === verification.email.toLowerCase());
    if (!user) {
        throw { status: 404, message: "Không tìm thấy thông tin tài khoản người dùng tương ứng." };
    }

    // Sinh salt mới và băm mật khẩu
    const newSalt = generateSalt();
    const newPasswordHash = hashPassword(newPassword, newSalt);

    user.salt = newSalt;
    user.passwordHash = newPasswordHash;
    user.updatedAt = new Date().toISOString();

    // Đánh dấu token đã được sử dụng (ngăn chặn replay attack)
    const entry = passwordResetTokens.get(token);
    if (entry) {
        entry.used = true;
    }

    // Xóa trạng thái khóa và số lần đăng nhập sai nếu có
    recordSuccessfulLogin(user.email);

    return {
        success: true,
        message: "Đặt lại mật khẩu thành công! Bạn có thể sử dụng mật khẩu mới để đăng nhập.",
        user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role
        }
    };
}

module.exports = {
    findUserByEmail,
    hashPassword,
    verifyPassword,
    generateSalt,
    generateToken,
    verifyToken,
    getLockoutStatus,
    recordFailedAttempt,
    recordSuccessfulLogin,
    loginAttempts,
    LOCK_DURATION_MS,
    MAX_FAILED_ATTEMPTS,
    users,
    // KN-39 / KN-43:
    passwordResetTokens,
    createPasswordResetToken,
    verifyPasswordResetToken,
    resetPasswordWithToken
};

