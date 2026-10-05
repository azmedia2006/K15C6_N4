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
    recordSuccessfulLogin,
    users
} = require("./authService");

const {
    getAllRoles,
    getUserWithRoles,
    assignRoleToUser,
    revokeRoleFromUser,
    getUsersWithRolesList,
    getAuditLogs,
    removeAllUserRoles,
    syncUserRole,
    getAllUserRolesAssignments
} = require("./roleService");

const supabaseService = require("./supabaseService");

const {
    VALID_ROLES,
    createUser,
    updateUser,
    deleteUser,
    getUserById,
    lockUser,
    unlockUser
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

// KN-8 & KN-14: Middleware kiểm tra quyền truy cập (Role-Based Access Control)
// Mọi chức năng đều kiểm quyền ở tầng server, mặc định là từ chối (403)
function requireRole(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user || !Array.isArray(req.user.roles)) {
            return res.status(401).json({
                success: false,
                message: "Chưa xác thực người dùng. Vui lòng đăng nhập lại."
            });
        }

        const userRoleCodes = req.user.roles.map(r => r.code || r.id);
        const hasPermission = allowedRoles.some(role =>
            userRoleCodes.includes(role) || req.user.role === role
        );

        if (!hasPermission) {
            // KN-8: Truy cập thiếu quyền hiển thị thông báo tiếng Việt rõ ràng thay vì lỗi kỹ thuật
            let roleMsg = "Bạn không có quyền thực hiện thao tác này.";
            if (allowedRoles.includes("accountant") && !allowedRoles.includes("instructor")) {
                roleMsg = "Từ chối truy cập: Bạn không có quyền quản lý hoặc sửa học phí. Chức năng này chỉ dành cho Kế toán và Quản trị viên.";
            } else if (allowedRoles.includes("instructor") && !allowedRoles.includes("accountant")) {
                roleMsg = "Từ chối truy cập: Bạn không có quyền nhập hoặc sửa điểm số. Chức năng này chỉ dành cho Giảng viên và Quản trị viên.";
            } else if (allowedRoles.includes("administrator")) {
                roleMsg = "Từ chối truy cập: Thao tác này yêu cầu quyền Quản trị hệ thống (Administrator).";
            }

            return res.status(403).json({
                success: false,
                message: roleMsg,
                requiredRoles: allowedRoles
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

    // KN-13: Chặn tài khoản bị quản trị viên khóa
if (user && (user.status || "active") === "locked") {
    return res.status(423).json({
        success: false,
        code: "ACCOUNT_LOCKED",
        message: "Tài khoản đã bị khóa bởi Quản trị viên. Vui lòng liên hệ quản trị viên."
    });
}

// Tài khoản chưa kích hoạt / ngừng hoạt động
if (user && (user.status || "active") === "inactive") {
    return res.status(403).json({
        success: false,
        code: "ACCOUNT_INACTIVE",
        message: "Tài khoản hiện không hoạt động."
    });
}

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

// API Đăng ký tài khoản người dùng công khai (Học viên)
app.post("/api/auth/register", async (req, res) => {
    try {
        const { name, email, phone, password } = req.body || {};
        const result = createUser({ name, email, phone, password, role: "student" });
        try {
            syncUserRole(result.user.id, "student");
        } catch (e) {
            // ignore
        }
        await supabaseService.syncSingleUser(result.user, password, users);

        return res.status(201).json({
            success: true,
            message: "Đăng ký tài khoản thành công.",
            user: result.user
        });
    } catch (err) {
        return res.status(err.status || 400).json({
            success: false,
            message: err.message || "Đăng ký không thành công."
        });
    }
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
    ["/api/admin/users", "/api/users"],
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
    async (req, res) => {
        try {
            const result = createUser(req.body || {});
            if (result.user && result.user.role) {
                try {
                    syncUserRole(result.user.id, result.user.role);
                } catch (e) {
                    // ignore
                }
            }

            // Đồng bộ sang tất cả các tầng Supabase (PostgreSQL tables, Auth, Storage)
            await supabaseService.syncSingleUser(result.user, result.temporaryPassword, users);

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
    async (req, res) => {
        try {
            const updated = updateUser(req.params.id, req.body || {});
            if (req.body && req.body.role) {
                try {
                    syncUserRole(req.params.id, req.body.role);
                } catch (e) {
                    // ignore
                }
            }

            // Đồng bộ cập nhật sang Supabase
            await supabaseService.syncSingleUser(updated, req.body ? req.body.password : null, users);

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
    async (req, res) => {
        try {
            const targetId = req.params.id;
            if (targetId === "usr_admin" || targetId === req.user?.id) {
                return res.status(403).json({
                    success: false,
                    message: "Không thể tự xóa tài khoản Quản trị viên của chính mình."
                });
            }

            const userToDelete = users.find(u => u.id === targetId);
            let result = { success: true, message: "Xóa người dùng thành công." };

            if (userToDelete) {
                result = deleteUser(targetId, req.user ? req.user.id : null);
                removeAllUserRoles(targetId);
            }

            // Đồng bộ xóa sang Supabase (PostgreSQL tables, Auth, Storage)
            await supabaseService.deleteSingleUser(targetId, userToDelete ? userToDelete.email : null, users);

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
const handleAssignRole = async (req, res) => {
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

        // Đồng bộ vai trò sang Supabase
        await supabaseService.syncRolesDatabase(getAllRoles(), getAllUserRolesAssignments(), getAuditLogs());

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
const handleRevokeRole = async (req, res) => {
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

        // Đồng bộ vai trò sang Supabase
        await supabaseService.syncRolesDatabase(getAllRoles(), getAllUserRolesAssignments(), getAuditLogs());

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
const handleGetAuditLogs = (req, res) => {
    return res.status(200).json({
        success: true,
        auditLogs: getAuditLogs()
    });
};

app.get(
    "/api/admin/audit-logs",
    authenticateToken,
    requireRole("administrator"),
    handleGetAuditLogs
);

app.get(
    "/admin/audit-logs",
    authenticateToken,
    requireRole("administrator"),
    handleGetAuditLogs
);

// ==========================================
// KN-8: PHÂN QUYỀN VAI TRÒ HỌC PHÍ & ĐIỂM SỐ
// Đảm bảo: Giảng viên không sửa được học phí và Kế toán không sửa được điểm
// ==========================================

const mockScores = {
    "scr_001": { id: "scr_001", studentId: "usr_student", courseId: "crs_react", score: 8.5, updatedBy: "usr_teacher" }
};

const mockTuition = {
    "tui_001": { id: "tui_001", studentId: "usr_student", amount: 4500000, status: "paid", updatedBy: "usr_accountant" }
};

// 1. Nghiệp vụ Điểm số: Giảng viên và Admin được cập nhật; Kế toán & Học viên bị từ chối
app.put(
    "/api/scores/:scoreId",
    authenticateToken,
    requireRole("instructor", "administrator"),
    (req, res) => {
        const { scoreId } = req.params;
        const { score } = req.body || {};
        if (score === undefined || isNaN(score) || score < 0 || score > 10) {
            return res.status(400).json({
                success: false,
                message: "Điểm số không hợp lệ (Phải là số từ 0 đến 10)."
            });
        }
        mockScores[scoreId] = {
            id: scoreId,
            score: Number(score),
            updatedBy: req.user.id,
            updatedAt: new Date().toISOString()
        };
        return res.status(200).json({
            success: true,
            message: "Cập nhật điểm số thành công.",
            data: mockScores[scoreId]
        });
    }
);

app.get(
    "/api/scores/:scoreId",
    authenticateToken,
    requireRole("instructor", "student", "training_manager", "administrator"),
    (req, res) => {
        const { scoreId } = req.params;
        return res.status(200).json({
            success: true,
            data: mockScores[scoreId] || { id: scoreId, score: 8.5 }
        });
    }
);

// 2. Nghiệp vụ Học phí: Kế toán và Admin được cập nhật; Giảng viên & Học viên bị từ chối
app.put(
    "/api/tuition/:tuitionId",
    authenticateToken,
    requireRole("accountant", "administrator"),
    (req, res) => {
        const { tuitionId } = req.params;
        const { amount, status } = req.body || {};
        if (amount !== undefined && (isNaN(amount) || amount < 0)) {
            return res.status(400).json({
                success: false,
                message: "Số tiền học phí không hợp lệ."
            });
        }
        mockTuition[tuitionId] = {
            id: tuitionId,
            amount: amount !== undefined ? Number(amount) : 4500000,
            status: status || "paid",
            updatedBy: req.user.id,
            updatedAt: new Date().toISOString()
        };
        return res.status(200).json({
            success: true,
            message: "Cập nhật học phí thành công.",
            data: mockTuition[tuitionId]
        });
    }
);

app.get(
    "/api/tuition/:tuitionId",
    authenticateToken,
    requireRole("accountant", "student", "administrator"),
    (req, res) => {
        const { tuitionId } = req.params;
        return res.status(200).json({
            success: true,
            data: mockTuition[tuitionId] || { id: tuitionId, amount: 4500000, status: "paid" }
        });
    }
);

// -------------------------------------------------------------
// SUPABASE DATABASE & AUTH STATUS / SYNC ENDPOINTS
// -------------------------------------------------------------

// API Kiểm tra trạng thái kết nối Supabase Database & Auth
app.get("/api/supabase/status", async (req, res) => {
    const health = await supabaseService.checkSupabaseHealth();
    return res.status(200).json({
        success: true,
        ...health
    });
});

// API Kích hoạt đồng bộ thủ công toàn bộ dữ liệu TMS lên Supabase
app.post("/api/supabase/sync", async (req, res) => {
    try {
        await supabaseService.syncUsersDatabase(users);
        await supabaseService.syncRolesDatabase(getAllRoles(), getAllUserRolesAssignments(), getAuditLogs());
        await supabaseService.syncBusinessDatabase(mockScores, mockTuition);
        return res.status(200).json({
            success: true,
            message: "Đã đồng bộ toàn bộ cơ sở dữ liệu TMS lên Supabase thành công.",
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Lỗi đồng bộ Supabase: " + err.message
        });
    }
});

// Health check endpoint
app.get("/api/health", (req, res) => {
    res.json({
        status: "ok",
        supabase: {
            configured: Boolean(supabaseService.SUPABASE_URL),
            url: supabaseService.SUPABASE_URL
        },
        timestamp: new Date().toISOString()
    });
});

// Phục vụ giao diện Frontend tĩnh & Clean URLs
const frontendDir = path.join(__dirname, "../frontend");
const rootDir = path.join(__dirname, "..");
app.use(express.static(rootDir));
app.use(express.static(frontendDir));
app.use("/frontend", express.static(frontendDir));

app.get("/", (req, res) => {
    res.sendFile(path.join(rootDir, "index.html"));
});

// Chuyển hướng sạch nếu người dùng gõ /frontend/Login.html
app.get("/frontend/Login.html", (req, res) => {
    res.redirect(301, "/");
});
app.get("/frontend/:page", (req, res) => {
    res.redirect(301, `/${req.params.page}`);
});

// KN-49 & KN-50: Các định tuyến mã lỗi chuẩn (Clean Error Routing)
app.get(["/403", "/error-403"], (req, res) => {
    res.sendFile(path.join(rootDir, "Error.html"));
});
app.get(["/404", "/error-404"], (req, res) => {
    res.sendFile(path.join(rootDir, "Error.html"));
});
app.get(["/500", "/error-500"], (req, res) => {
    res.sendFile(path.join(rootDir, "Error.html"));
});
app.get("/error", (req, res) => {
    res.sendFile(path.join(rootDir, "Error.html"));
});

// KN-54: Fallback và chuẩn hóa lỗi cho các API request không tồn tại
app.use("/api", (req, res) => {
    res.status(404).json({
        success: false,
        code: 404,
        error: "Endpoint API không tồn tại hoặc đã thay đổi địa chỉ",
        path: req.originalUrl,
        timestamp: new Date().toISOString()
    });
});

// Fallback cho các đường dẫn trang không tồn tại -> Trả về giao diện 404
app.use((req, res, next) => {
    if (req.method === "GET" && !req.originalUrl.startsWith("/api/")) {
        return res.status(404).sendFile(path.join(rootDir, "Error.html"));
    }
    next();
});

// KN-53 & KN-54: Middleware xử lý lỗi toàn cục, chuẩn hóa tiếng Việt an toàn, không để lộ stack trace
app.use((err, req, res, next) => {
    const statusCode = err.status || err.statusCode || 500;
    const safeMessage = statusCode >= 500
        ? "Đã xảy ra sự cố trong quá trình xử lý yêu cầu. Dữ liệu của bạn vẫn an toàn."
        : (err.message || "Yêu cầu không hợp lệ.");

    if (req.originalUrl && req.originalUrl.startsWith("/api/")) {
        return res.status(statusCode).json({
            success: false,
            code: statusCode,
            error: safeMessage,
            timestamp: new Date().toISOString()
        });
    }

    res.status(statusCode).sendFile(path.join(rootDir, "Error.html"));
});

// Tự động tải và đồng bộ các tài khoản người dùng từ Supabase vào bộ nhớ
async function hydrateUsersFromSupabase() {
    try {
        const remoteUsers = await supabaseService.loadFromStorage("users.json");
        if (Array.isArray(remoteUsers) && remoteUsers.length > 0) {
            remoteUsers.forEach(ru => {
                const idx = users.findIndex(u => u.id === ru.id || u.email.toLowerCase() === ru.email.toLowerCase());
                if (idx === -1) {
                    users.push(ru);
                } else {
                    users[idx] = { ...users[idx], ...ru };
                }
            });
        }
    } catch {}
}
hydrateUsersFromSupabase().catch(() => {});

// Khởi chạy server và đồng bộ dữ liệu ban đầu
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`TMS Server running at http://localhost:${PORT}`);
        // Chạy đồng bộ ban đầu lên Supabase trong background
        supabaseService.syncUsersDatabase(users).catch(() => {});
        supabaseService.syncRolesDatabase(getAllRoles(), getAllUserRolesAssignments(), getAuditLogs()).catch(() => {});
    });
}

module.exports = app;