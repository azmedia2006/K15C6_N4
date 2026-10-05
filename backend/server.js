const path = require("path");
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
    getAuditLogs,
    removeAllUserRoles,
    syncUserRole
} = require("./roleService");

const {
    VALID_ROLES,
    createUser,
    updateUser,
    deleteUser,
    getUserById
} = require("./userService");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// KN-60: Middleware xác thực Token (Bearer Token)
// Luôn lấy thông tin người dùng và vai trò mới nhất trực tiếp từ DB/Store (đảm bảo tính tức thời)
function authenticateToken(req, res, next) {
    const authHeader = req.headers["authorization"] || "";
    const token = authHeader.startsWith("Bearer ")
        ? authHeader.slice(7).trim()
        : authHeader.trim();

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
        const hasPermission = allowedRoles.some(role =>
            userRoleCodes.includes(role) || req.user.role === role
        );

        if (!hasPermission) {
            return res.status(403).json({
                success: false,
                message: "Bạn không có quyền thực hiện thao tác này."
            });
        }

        next();
    };
}

// KN-31: API đăng nhập bằng email và mật khẩu
// Cập nhật trả về danh sách vai trò N-N
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
            message:
                "Tài khoản tạm khóa do đăng nhập sai 5 lần liên tiếp. Vui lòng thử lại sau.",
            retryAfterSeconds: lockout.remainingSeconds
        });
    }

    const user = findUserByEmail(normalizedEmail);

    // KN-37 & KN-35: Xác thực và bảo vệ mật khẩu an toàn
    let isPasswordValid = false;

    if (user) {
        isPasswordValid = verifyPassword(
            password,
            user.salt,
            user.passwordHash
        );
    } else {
        hashPassword(
            password,
            "dummy_constant_salt_for_timing_safety_321"
        );
    }

    if (!user || !isPasswordValid) {
        const failedResult = recordFailedAttempt(normalizedEmail);

        if (failedResult.isLocked) {
            return res.status(423).json({
                success: false,
                message:
                    "Tài khoản tạm khóa 15 phút do đăng nhập sai 5 lần liên tiếp.",
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

    // Lấy thông tin người dùng kèm danh sách vai trò N-N
    const userWithRoles = getUserWithRoles(user.id);
    const token = generateToken(user);

    return res.status(200).json({
        success: true,
        message: "Đăng nhập thành công",
        token: token,
        role: userWithRoles.role,
        roles: userWithRoles.roles,
        user: {
            id: userWithRoles.id,
            email: userWithRoles.email,
            name: userWithRoles.name,
            role: userWithRoles.role,
            roles: userWithRoles.roles
        }
    });
});

// KN-60: API lấy thông tin người dùng hiện tại
// Đồng bộ tức thì trên Frontend
app.get("/api/auth/me", authenticateToken, (req, res) => {
    return res.status(200).json({
        success: true,
        user: req.user
    });
});

// ==========================================
// CÁC ENDPOINT QUẢN TRỊ VAI TRÒ & NGƯỜI DÙNG (ADMIN ONLY)
// ==========================================

// Lấy danh mục tất cả vai trò của hệ thống TMS
app.get(
    "/api/admin/roles",
    authenticateToken,
    requireRole("administrator"),
    (req, res) => {
        return res.status(200).json({
            success: true,
            roles: VALID_ROLES,
            roleDetails: getAllRoles()
        });
    }
);

// KN-62 & KN-11: Lấy danh sách người dùng kèm vai trò
// Hỗ trợ phân trang, lọc theo vai trò, tìm kiếm
app.get(
    "/api/admin/users",
    authenticateToken,
    requireRole("administrator"),
    (req, res) => {
        const { page, limit, roleId, role, search, query, status } = req.query;

        const result = getUsersWithRolesList({
            page,
            limit,
            roleId,
            role,
            search,
            query,
            status
        });

        return res.status(200).json({
            success: true,
            ...result
        });
    }
);

// KN-11: API Tạo mới tài khoản người dùng
app.post(
    "/api/admin/users",
    authenticateToken,
    requireRole("administrator"),
    (req, res) => {
        try {
            const result = createUser(req.body || {});
            if (result.user && result.user.role) {
                try {
                    syncUserRole(result.user.id, result.user.role);
                } catch (e) {
                    // ignore
                }
            }
            return res.status(201).json({
                success: true,
                message: `Tạo tài khoản người dùng '${result.user.name}' thành công. Đã gửi email kích hoạt kèm mật khẩu tạm.`,
                user: result.user,
                temporaryPassword: result.temporaryPassword,
                emailSent: result.emailSent,
                activationEmail: result.activationEmail
            });
        } catch (err) {
            return res.status(err.status || err.statusCode || 500).json({
                success: false,
                message: err.message || "Đã xảy ra lỗi khi tạo người dùng."
            });
        }
    }
);

// Lấy chi tiết một người dùng kèm danh sách vai trò
app.get(
    "/api/admin/users/:userId",
    authenticateToken,
    requireRole("administrator"),
    (req, res) => {
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
    }
);

// KN-11: API Cập nhật / sửa thông tin tài khoản người dùng
app.put(
    "/api/admin/users/:id",
    authenticateToken,
    requireRole("administrator"),
    (req, res) => {
        try {
            const updated = updateUser(req.params.id, req.body || {});
            if (req.body && req.body.role) {
                try {
                    syncUserRole(req.params.id, req.body.role);
                } catch (e) {
                    // ignore
                }
            }
            return res.status(200).json({
                success: true,
                message: `Cập nhật thông tin tài khoản '${updated.name}' thành công.`,
                user: updated
            });
        } catch (err) {
            return res.status(err.status || err.statusCode || 500).json({
                success: false,
                message: err.message || "Đã xảy ra lỗi khi cập nhật tài khoản."
            });
        }
    }
);

// KN-11: API Xóa tài khoản người dùng
app.delete(
    "/api/admin/users/:id",
    authenticateToken,
    requireRole("administrator"),
    (req, res) => {
        try {
            const result = deleteUser(req.params.id, req.user ? req.user.id : null);
            removeAllUserRoles(req.params.id);
            return res.status(200).json(result);
        } catch (err) {
            return res.status(err.status || err.statusCode || 500).json({
                success: false,
                message: err.message || "Đã xảy ra lỗi khi xóa người dùng."
            });
        }
    }
);

// KN-58: Xây dựng API gán vai trò cho người dùng
// POST /api/admin/users/:userId/roles
// hoặc /admin/users/:userId/roles
const handleAssignRole = (req, res) => {
    const { userId } = req.params;
    const { roleId, roleIds } = req.body || {};

    const ip =
        req.ip ||
        req.connection.remoteAddress ||
        "127.0.0.1";
    const assignedBy = req.user ? req.user.id : "system_admin";

    const targetRoles = Array.isArray(roleIds)
        ? roleIds
        : roleId
        ? [roleId]
        : [];

    if (targetRoles.length === 0) {
        return res.status(400).json({
            success: false,
            message:
                "Vui lòng cung cấp mã vai trò (roleId hoặc roleIds) cần gán."
        });
    }

    try {
        let lastResult = null;
        for (const rId of targetRoles) {
            lastResult = assignRoleToUser({
                userId,
                roleId: rId,
                assignedBy,
                ip
            });
        }

        return res.status(200).json({
            success: true,
            message: "Gán vai trò thành công.",
            ...lastResult
        });
    } catch (err) {
        return res.status(err.statusCode || 500).json({
            success: false,
            message:
                err.message ||
                "Lỗi khi gán vai trò cho người dùng."
        });
    }
};

app.post(
    "/api/admin/users/:userId/roles",
    authenticateToken,
    requireRole("administrator"),
    handleAssignRole
);

app.post(
    "/admin/users/:userId/roles",
    authenticateToken,
    requireRole("administrator"),
    handleAssignRole
);

// KN-59 & KN-56: Xây dựng API thu hồi vai trò của người dùng
// DELETE /api/admin/users/:userId/roles/:roleId
// hoặc /admin/users/:userId/roles/:roleId
const handleRevokeRole = (req, res) => {
    const { userId, roleId } = req.params;
    const ip =
        req.ip ||
        req.connection.remoteAddress ||
        "127.0.0.1";
    const revokedBy = req.user ? req.user.id : "system_admin";

    try {
        const result = revokeRoleFromUser({
            userId,
            roleId,
            targetRoleId: roleId,
            revokedBy,
            ip
        });

        return res.status(200).json({
            success: true,
            ...result
        });
    } catch (err) {
        return res.status(err.statusCode || 500).json({
            success: false,
            message:
                err.message ||
                "Lỗi khi thu hồi vai trò."
        });
    }
};

app.delete(
    "/api/admin/users/:userId/roles/:roleId",
    authenticateToken,
    requireRole("administrator"),
    handleRevokeRole
);

app.delete(
    "/admin/users/:userId/roles/:roleId",
    authenticateToken,
    requireRole("administrator"),
    handleRevokeRole
);

// KN-63: API xem nhật ký thao tác (Audit Logs)
app.get(
    "/api/admin/audit-logs",
    authenticateToken,
    requireRole("administrator"),
    (req, res) => {
        return res.status(200).json({
            success: true,
            auditLogs: getAuditLogs()
        });
    }
);

// Health check endpoint
app.get("/api/health", (req, res) => {
    res.json({
        status: "ok",
        timestamp: new Date().toISOString()
    });
});

// Phục vụ giao diện Frontend tĩnh
const frontendDir = path.join(__dirname, "../frontend");
app.use(express.static(frontendDir));
app.use("/frontend", express.static(frontendDir));
app.get("/", (req, res) => {
    res.redirect("/Login.html");
});

// Chỉ listen khi chạy trực tiếp file server.js
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(
            `TMS Server running at http://localhost:${PORT}`
        );
    });
}

module.exports = app;