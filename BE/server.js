const express = require("express");
const cors = require("cors");
const {
    findUserByEmail,
    hashPassword,
    generateToken,
    loginAttempts,
    LOCK_DURATION_MS,
    MAX_FAILED_ATTEMPTS
} = require("./authService");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// KN-31: Xây dựng API đăng nhập bằng email và mật khẩu
app.post("/api/auth/login", (req, res) => {
    const { email, password } = req.body || {};

    if (!email || !password) {
        return res.status(400).json({
            success: false,
            message: "Vui lòng nhập đầy đủ email và mật khẩu."
        });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const now = Date.now();

    // KN-34 & KN-36: Kiểm tra trạng thái khóa tài khoản
    const attempt = loginAttempts.get(normalizedEmail) || { count: 0, lockoutUntil: 0 };
    if (attempt.lockoutUntil > now) {
        const remainingSeconds = Math.ceil((attempt.lockoutUntil - now) / 1000);
        return res.status(423).json({
            success: false,
            message: `Tài khoản tạm khóa do đăng nhập sai 5 lần liên tiếp. Vui lòng thử lại sau.`,
            retryAfterSeconds: remainingSeconds
        });
    }

    // Nếu thời gian khóa đã qua, reset trạng thái
    if (attempt.lockoutUntil > 0 && attempt.lockoutUntil <= now) {
        attempt.count = 0;
        attempt.lockoutUntil = 0;
        loginAttempts.set(normalizedEmail, attempt);
    }

    const user = findUserByEmail(normalizedEmail);

    // KN-37 & KN-35: Xác thực mật khẩu và ẩn thông tin tồn tại email
    let isPasswordValid = false;
    if (user) {
        const computedHash = hashPassword(password, user.salt);
        isPasswordValid = (computedHash === user.passwordHash);
    }

    // Xử lý đăng nhập sai
    if (!user || !isPasswordValid) {
        attempt.count += 1;
        if (attempt.count >= MAX_FAILED_ATTEMPTS) {
            attempt.lockoutUntil = now + LOCK_DURATION_MS;
            loginAttempts.set(normalizedEmail, attempt);
            return res.status(423).json({
                success: false,
                message: "Tài khoản tạm khóa 15 phút do đăng nhập sai 5 lần liên tiếp.",
                retryAfterSeconds: Math.ceil(LOCK_DURATION_MS / 1000)
            });
        }

        loginAttempts.set(normalizedEmail, attempt);

        // KN-35: Không tiết lộ email có tồn tại hay không
        return res.status(401).json({
            success: false,
            message: "Email hoặc mật khẩu không đúng",
            attemptsLeft: MAX_FAILED_ATTEMPTS - attempt.count
        });
    }

    // Đăng nhập thành công -> Reset số lần đăng nhập sai
    loginAttempts.delete(normalizedEmail);

    // KN-31 & KN-32: Trả về token và vai trò người dùng
    const token = generateToken(user);
    return res.status(200).json({
        success: true,
        message: "Đăng nhập thành công",
        token: token,
        role: user.role,
        user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role
        }
    });
});

// Health check endpoint
app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Chỉ listen khi chạy trực tiếp file server.js (hỗ trợ kiểm thử require module)
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`TMS Auth Server running at http://localhost:${PORT}`);
    });
}

module.exports = app;
