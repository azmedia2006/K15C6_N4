const express = require("express");
const path = require("path");
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
app.use(express.static(path.join(__dirname, "../frontend")));

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

// Middleware xác thực token đăng nhập
function authenticateToken(req, res, next) {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
        return res.status(401).json({
            success: false,
            message: "Không tìm thấy token xác thực. Vui lòng đăng nhập."
        });
    }

    try {
        const payloadStr = Buffer.from(token, "base64").toString("utf-8");
        const decoded = JSON.parse(payloadStr);

        if (decoded.expiresAt && decoded.expiresAt < Date.now()) {
            return res.status(401).json({
                success: false,
                message: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."
            });
        }

        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({
            success: false,
            message: "Token xác thực không hợp lệ."
        });
    }
}

// Middleware kiểm tra quyền Quản trị viên (Administrator)
function requireAdmin(req, res, next) {
    if (!req.user || req.user.role !== "administrator") {
        return res.status(403).json({
            success: false,
            message: "Truy cập bị từ chối: Chỉ Quản trị viên (Administrator) mới có quyền thực hiện thao tác này."
        });
    }
    next();
}

// Import dịch vụ quản lý người dùng KN-11
const {
    VALID_ROLES,
    getUsers,
    getUserById,
    createUser,
    updateUser,
    deleteUser
} = require("./userService");

// KN-11: Lấy danh mục các vai trò trong hệ thống
app.get("/api/admin/roles", authenticateToken, requireAdmin, (req, res) => {
    res.json({
        success: true,
        roles: VALID_ROLES
    });
});

// KN-11: API Tìm kiếm & lấy danh sách người dùng (hỗ trợ search, filter vai trò, trạng thái, phân trang)
app.get("/api/admin/users", authenticateToken, requireAdmin, (req, res) => {
    try {
        const result = getUsers(req.query);
        res.json({
            success: true,
            ...result
        });
    } catch (err) {
        res.status(err.status || 500).json({
            success: false,
            message: err.message || "Đã xảy ra lỗi khi lấy danh sách người dùng."
        });
    }
});

// KN-11: API Lấy chi tiết một người dùng
app.get("/api/admin/users/:id", authenticateToken, requireAdmin, (req, res) => {
    try {
        const user = getUserById(req.params.id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy người dùng."
            });
        }
        res.json({
            success: true,
            user
        });
    } catch (err) {
        res.status(err.status || 500).json({
            success: false,
            message: err.message || "Đã xảy ra lỗi."
        });
    }
});

// KN-11: API Tạo mới tài khoản người dùng (cấp quyền truy cập cho nhân sự mới, gửi email kích hoạt kèm mật khẩu tạm)
app.post("/api/admin/users", authenticateToken, requireAdmin, (req, res) => {
    try {
        const result = createUser(req.body || {});
        res.status(201).json({
            success: true,
            message: `Tạo tài khoản người dùng '${result.user.name}' thành công. Đã gửi email kích hoạt kèm mật khẩu tạm.`,
            user: result.user,
            temporaryPassword: result.temporaryPassword,
            emailSent: result.emailSent,
            activationEmail: result.activationEmail
        });
    } catch (err) {
        res.status(err.status || 500).json({
            success: false,
            message: err.message || "Đã xảy ra lỗi khi tạo người dùng."
        });
    }
});

// KN-11: API Cập nhật / sửa thông tin tài khoản người dùng
app.put("/api/admin/users/:id", authenticateToken, requireAdmin, (req, res) => {
    try {
        const updated = updateUser(req.params.id, req.body || {});
        res.json({
            success: true,
            message: `Cập nhật thông tin tài khoản '${updated.name}' thành công.`,
            user: updated
        });
    } catch (err) {
        res.status(err.status || 500).json({
            success: false,
            message: err.message || "Đã xảy ra lỗi khi cập nhật tài khoản."
        });
    }
});

// KN-11: API Xóa / Vô hiệu hóa người dùng
app.delete("/api/admin/users/:id", authenticateToken, requireAdmin, (req, res) => {
    try {
        const result = deleteUser(req.params.id, req.user ? req.user.userId : null);
        res.json(result);
    } catch (err) {
        res.status(err.status || 500).json({
            success: false,
            message: err.message || "Đã xảy ra lỗi khi xóa người dùng."
        });
    }
});

app.use((req, res) => {
    if (req.path.startsWith("/api/") || !String(req.get("accept") || "").includes("text/html")) {
        return res.status(404).json({
            success: false,
            code: "NOT_FOUND",
            message: "Không tìm thấy tài nguyên được yêu cầu."
        });
    }

    return res.redirect(302, "/Error.html?code=404");
});

app.use((err, req, res, next) => {
    const status = Number.isInteger(err.status) && err.status >= 400 && err.status < 500 ? err.status : 500;
    const code = status === 400 ? "INVALID_REQUEST" : "INTERNAL_ERROR";
    const message = status === 400
        ? "Yêu cầu không hợp lệ. Vui lòng kiểm tra dữ liệu và thử lại."
        : "Đã xảy ra lỗi khi xử lý yêu cầu. Vui lòng thử lại sau.";

    res.status(status).json({ success: false, code, message });
});

// Chỉ listen khi chạy trực tiếp file server.js (hỗ trợ kiểm thử require module)
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`TMS Auth Server running at http://localhost:${PORT}`);
    });
}

module.exports = app;
