const express = require("express");
const cors = require("cors");
const {
    findUserByEmail,
    hashPassword,
    verifyPassword,
    generateToken,
    getLockoutStatus,
    recordFailedAttempt,
    recordSuccessfulLogin
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

    // KN-34 & KN-36: Kiểm tra trạng thái khóa tài khoản trước khi xử lý
    const lockout = getLockoutStatus(normalizedEmail);
    if (lockout.isLocked) {
        return res.status(423).json({
            success: false,
            message: "Tài khoản tạm khóa do đăng nhập sai 5 lần liên tiếp. Vui lòng thử lại sau.",
            retryAfterSeconds: lockout.remainingSeconds
        });
    }

    const user = findUserByEmail(normalizedEmail);

    // KN-37 & KN-35: Xác thực và bảo vệ mật khẩu an toàn với constant-time comparison
    let isPasswordValid = false;
    if (user) {
        isPasswordValid = verifyPassword(password, user.salt, user.passwordHash);
    } else {
        // KN-35 & KN-37: Chống tấn công phân tích thời gian (timing attack) khi người dùng không tồn tại
        hashPassword(password, "dummy_constant_salt_for_timing_safety_321");
    }

    // KN-36: Xử lý và lưu trạng thái đăng nhập sai
    if (!user || !isPasswordValid) {
        const failedResult = recordFailedAttempt(normalizedEmail);
        if (failedResult.isLocked) {
            return res.status(423).json({
                success: false,
                message: "Tài khoản tạm khóa 15 phút do đăng nhập sai 5 lần liên tiếp.",
                retryAfterSeconds: failedResult.remainingSeconds
            });
        }

        // KN-35: Không tiết lộ email có tồn tại hay không
        return res.status(401).json({
            success: false,
            message: "Email hoặc mật khẩu không đúng",
            attemptsLeft: failedResult.remainingAttempts
        });
    }

    // KN-36: Đăng nhập thành công -> Reset toàn bộ trạng thái sai
    recordSuccessfulLogin(normalizedEmail);

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
