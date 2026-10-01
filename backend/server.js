const express = require("express");
const cors = require("cors");
const {
    findUserByEmail,
    hashPassword,
    verifyPassword,
    generateToken,
    verifyToken,
    getLockoutStatus,
    recordFailedAttempt,
    recordSuccessfulLogin
} = require("./authService");

const {
    getAllRoles,
    getUserWithRoles,
    assignRoleToUser,
    revokeRoleFromUser,
    getUsersWithRolesList,
    getAuditLogs
} = require("./roleService");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// KN-60: Middleware xác thực Token (Bearer Token)
// Luôn lấy thông tin người dùng và vai trò mới nhất trực tiếp từ DB/Store (đảm bảo tính tức thời)
function authenticateToken(req, res, next) {
    const authHeader = req.headers["authorization"] || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : authHeader.trim();

    if (!token) {
        return res.status(401).json({
            success: false,
            message: "Yêu cầu cung cấp token xác thực hợp lệ."
        });
    }

    const payload = verifyToken(token);
    if (!payload || !payload.userId) {
        return res.status(401).json({
            success: false,
            message: "Phiên đăng nhập không hợp lệ hoặc đã hết hạn."
        });
    }

    // Tra cứu thông tin người dùng kèm vai trò mới nhất từ Store (KN-60)
    const userWithRoles = getUserWithRoles(payload.userId);
    if (!userWithRoles) {
        return res.status(401).json({
            success: false,
            message: "Tài khoản người dùng không tồn tại trong hệ thống."
        });
    }

    req.user = userWithRoles;
    req.tokenPayload = payload;
    next();
}

// Middleware kiểm tra quyền truy cập (Role-Based Access Control)
function requireRole(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user || !Array.isArray(req.user.roles)) {
            return res.status(401).json({
                success: false,
                message: "Chưa xác thực người dùng."
            });
        }

        const userRoleCodes = req.user.roles.map(r => r.code || r.id);
        const hasPermission = allowedRoles.some(role => userRoleCodes.includes(role));

        if (!hasPermission) {
            return res.status(403).json({
                success: false,
                message: "Bạn không có quyền thực hiện thao tác này."
            });
        }

        next();
    };
}

// KN-31: API đăng nhập bằng email và mật khẩu (Cập nhật trả về danh sách vai trò N-N)
app.post("/api/auth/login", (req, res) => {
    const { email, password } = req.body || {};

    if (!email || !password) {
        return res.status(400).json({
            success: false,
            message: "Vui lòng nhập đầy đủ email và mật khẩu."
        });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    // KN-34 & KN-36: Kiểm tra trạng thái khóa tài khoản
    const lockout = getLockoutStatus(normalizedEmail);
    if (lockout.isLocked) {
        return res.status(423).json({
            success: false,
            message: "Tài khoản tạm khóa do đăng nhập sai 5 lần liên tiếp. Vui lòng thử lại sau.",
            retryAfterSeconds: lockout.remainingSeconds
        });
    }

    const user = findUserByEmail(normalizedEmail);

    // KN-37 & KN-35: Xác thực và bảo vệ mật khẩu an toàn
    let isPasswordValid = false;
    if (user) {
        isPasswordValid = verifyPassword(password, user.salt, user.passwordHash);
    } else {
        hashPassword(password, "dummy_constant_salt_for_timing_safety_321");
    }

    if (!user || !isPasswordValid) {
        const failedResult = recordFailedAttempt(normalizedEmail);
        if (failedResult.isLocked) {
            return res.status(423).json({
                success: false,
                message: "Tài khoản tạm khóa 15 phút do đăng nhập sai 5 lần liên tiếp.",
                retryAfterSeconds: failedResult.remainingSeconds
            });
        }

        return res.status(401).json({
            success: false,
            message: "Email hoặc mật khẩu không đúng",
            attemptsLeft: failedResult.remainingAttempts
        });
    }

    recordSuccessfulLogin(normalizedEmail);

    // Lấy thông tin người dùng kèm danh sách vai trò N-N (KN-57, KN-60)
    const userWithRoles = getUserWithRoles(user.id);
    const token = generateToken(user);

    return res.status(200).json({
        success: true,
        message: "Đăng nhập thành công",
        token: token,
        role: userWithRoles.role, // Tương thích ngược
        roles: userWithRoles.roles, // Danh sách vai trò N-N
        user: {
            id: userWithRoles.id,
            email: userWithRoles.email,
            name: userWithRoles.name,
            role: userWithRoles.role,
            roles: userWithRoles.roles
        }
    });
});

// KN-60: API lấy thông tin người dùng hiện tại (Đồng bộ tức thì trên Frontend)
app.get("/api/auth/me", authenticateToken, (req, res) => {
    return res.status(200).json({
        success: true,
        user: req.user
    });
});

// ==========================================
// CÁC ENDPOINT QUẢN TRỊ VAI TRÒ (ADMIN ONLY)
// ==========================================

// Lấy danh mục tất cả 8 vai trò của hệ thống TMS
app.get("/api/admin/roles", authenticateToken, requireRole("administrator"), (req, res) => {
    return res.status(200).json({
        success: true,
        roles: getAllRoles()
    });
});

// KN-62: Lấy danh sách người dùng kèm vai trò (Hỗ trợ phân trang, lọc theo vai trò, tìm kiếm)
app.get("/api/admin/users", authenticateToken, requireRole("administrator"), (req, res) => {
    const { page, limit, roleId, search } = req.query;
    const result = getUsersWithRolesList({ page, limit, roleId, search });
    return res.status(200).json({
        success: true,
        ...result
    });
});

// Lấy chi tiết một người dùng kèm danh sách vai trò
app.get("/api/admin/users/:userId", authenticateToken, requireRole("administrator"), (req, res) => {
    const user = getUserWithRoles(req.params.userId);
    if (!user) {
        return res.status(404).json({
            success: false,
            message: "Không tìm thấy người dùng."
        });
    }
    return res.status(200).json({
        success: true,
        user: user
    });
});

// KN-58: Xây dựng API gán vai trò cho người dùng
// POST /api/admin/users/:userId/roles hoặc /admin/users/:userId/roles
const handleAssignRole = (req, res) => {
    const { userId } = req.params;
    const { roleId, roleIds } = req.body || {};
    const ip = req.ip || req.connection.remoteAddress || "127.0.0.1";
    const assignedBy = req.user.id;

    // Cho phép truyền roleId đơn hoặc mảng roleIds
    const targetRoleIds = roleIds && Array.isArray(roleIds) ? roleIds : (roleId ? [roleId] : []);

    if (targetRoleIds.length === 0) {
        return res.status(400).json({
            success: false,
            message: "Vui lòng cung cấp vai trò cần gán (roleId hoặc roleIds)."
        });
    }

    try {
        let lastResult = null;
        for (const rId of targetRoleIds) {
            lastResult = assignRoleToUser({
                userId,
                roleId: rId,
                assignedBy,
                ip
            });
        }

        return res.status(200).json({
            success: true,
            message: lastResult ? lastResult.message : "Gán vai trò thành công.",
            roles: lastResult ? lastResult.roles : []
        });
    } catch (err) {
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Lỗi khi gán vai trò."
        });
    }
};

app.post("/api/admin/users/:userId/roles", authenticateToken, requireRole("administrator"), handleAssignRole);
app.post("/admin/users/:userId/roles", authenticateToken, requireRole("administrator"), handleAssignRole);

// KN-59 & KN-56: Xây dựng API thu hồi vai trò của người dùng
// DELETE /api/admin/users/:userId/roles/:roleId hoặc /admin/users/:userId/roles/:roleId
const handleRevokeRole = (req, res) => {
    const { userId, roleId } = req.params;
    const ip = req.ip || req.connection.remoteAddress || "127.0.0.1";
    const revokedBy = req.user.id;

    try {
        const result = revokeRoleFromUser({
            userId,
            roleId,
            revokedBy,
            ip
        });

        return res.status(200).json({
            success: true,
            message: result.message,
            roles: result.roles
        });
    } catch (err) {
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Lỗi khi thu hồi vai trò."
        });
    }
};

app.delete("/api/admin/users/:userId/roles/:roleId", authenticateToken, requireRole("administrator"), handleRevokeRole);
app.delete("/admin/users/:userId/roles/:roleId", authenticateToken, requireRole("administrator"), handleRevokeRole);

// KN-63: API xem nhật ký thao tác (Audit Logs)
app.get("/api/admin/audit-logs", authenticateToken, requireRole("administrator"), (req, res) => {
    return res.status(200).json({
        success: true,
        auditLogs: getAuditLogs()
    });
});

// Health check endpoint
app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Chỉ listen khi chạy trực tiếp file server.js
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`TMS Auth Server running at http://localhost:${PORT}`);
    });
}

module.exports = app;
