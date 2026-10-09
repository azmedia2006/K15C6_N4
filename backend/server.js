const path = require("path");
require("dotenv").config({
    path: [path.join(__dirname, ".env"), path.join(__dirname, "../.env")]
});
const express = require("express");
const cors = require("cors");
const {
    verifySmtp,
    SMTP_CONFIG,
    sentEmails,
    sendActivationEmail,
    sendPasswordResetEmail
} = require("./emailService");
const {
    findUserByEmail,
    hashPassword,
    verifyPassword,
    generateToken,
    verifyToken,
    getLockoutStatus,
    recordFailedAttempt,
    recordSuccessfulLogin,
    users,
    createPasswordResetToken,
    verifyPasswordResetToken,
    resetPasswordWithToken
} = require("./authService");

const {
    getAllRoles,
    getUserWithRoles,
    assignRoleToUser,
    revokeRoleFromUser,
    getUsersWithRolesList,
    getAuditLogs,
    recordAuditLog,
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
    unlockUser,
    validateImportRow,
    previewImportUsers,
    importUsersBatch,
    parseExcelBuffer,
    generateUsersTemplate,
    updateUserAvatar,
    deleteUserAvatar,
    validateAndProcessAvatar,
    MAX_AVATAR_SIZE_BYTES,
    ALLOWED_MIME_TYPES
} = require("./userService");

const {
    leads,
    createLead,
    getLeads,
    getLeadById,
    updateLeadStatus,
    deleteLead,
    getLeadStats,
    generateAntiSpamChallenge,
    verifyAntiSpamChallenge,
    checkSpam
} = require("./leadService");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

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

// =========================================================================
// KN-39, KN-40, KN-42, KN-43: BỘ API QUÊN VÀ ĐẶT LẠI MẬT KHẨU
// Hỗ trợ cả tiền tố /api/auth/* và /auth/*
// =========================================================================

// KN-39 & KN-42: API Yêu cầu quên mật khẩu và phát hành liên kết gửi qua Email
app.post(["/api/auth/forgot-password", "/auth/forgot-password"], async (req, res) => {
    const { email } = req.body || {};

    if (!email || !String(email).trim()) {
        return res.status(400).json({
            success: false,
            code: 400,
            message: "Vui lòng nhập địa chỉ email liên kết với tài khoản."
        });
    }

    const clientIp = req.ip || req.headers["x-forwarded-for"] || (req.socket && req.socket.remoteAddress) || "127.0.0.1";
    const result = createPasswordResetToken(email, clientIp);

    // Rate Limit: Quá 5 lần / giờ (KN-39)
    if (result.rateLimited) {
        return res.status(429).json({
            success: false,
            code: 429,
            message: "Bạn đã yêu cầu đặt lại mật khẩu quá nhiều lần (tối đa 5 lần/giờ). Vui lòng thử lại sau.",
            retryAfterSeconds: result.retryAfterSeconds
        });
    }

    // Nếu tài khoản tồn tại: Gửi email bất đồng bộ qua SMTP (Fire and forget, không làm chậm response)
    if (result.userFound && result.token) {
        const hostHeader = req.get("host") || "localhost:3000";
        const protocol = req.protocol || "http";
        const defaultBaseUrl = `${protocol}://${hostHeader}`;
        const frontendUrl = process.env.FRONTEND_URL || defaultBaseUrl;
        const resetUrl = `${frontendUrl.replace(/\/$/, "")}/ResetPassword.html?token=${result.token}`;

        try {
            sendPasswordResetEmail({
                to: result.user.email,
                name: result.user.name,
                resetToken: result.token,
                resetUrl
            });
        } catch (mailErr) {
            console.warn("[Server] Gửi email đặt lại mật khẩu thất bại:", mailErr.message);
        }
    }

    // KN-39: Luôn trả về 200 kèm thông báo bảo mật chung (chống rò rỉ sự tồn tại của email)
    return res.status(200).json({
        success: true,
        code: 200,
        message: "Nếu email thuộc tài khoản hợp lệ, hướng dẫn khôi phục sẽ được gửi đến hộp thư của bạn."
    });
});

// KN-43: API Xác thực tính hợp lệ của token đặt lại mật khẩu
app.get(["/api/auth/verify-reset-token", "/auth/verify-reset-token"], (req, res) => {
    const token = req.query.token;

    if (!token) {
        return res.status(400).json({
            success: false,
            valid: false,
            code: 400,
            message: "Yêu cầu cung cấp mã xác thực token."
        });
    }

    const check = verifyPasswordResetToken(token);
    if (!check.valid) {
        return res.status(400).json({
            success: false,
            valid: false,
            code: 400,
            message: check.error || "Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn."
        });
    }

    return res.status(200).json({
        success: true,
        valid: true,
        maskedEmail: check.maskedEmail
    });
});

// KN-43 & KN-45: API Thiết lập mật khẩu mới bằng token đã xác nhận
app.post(["/api/auth/reset-password", "/auth/reset-password"], async (req, res) => {
    const { token, newPassword } = req.body || {};

    if (!token || !newPassword) {
        return res.status(400).json({
            success: false,
            code: 400,
            message: "Vui lòng cung cấp mã token và mật khẩu mới."
        });
    }

    try {
        const resetResult = resetPasswordWithToken(token, newPassword);

        // Đồng bộ dữ liệu người dùng sang Supabase
        try {
            await supabaseService.syncUsersDatabase(users);
        } catch (syncErr) {
            // Không chặn tiến trình nếu offline
        }

        return res.status(200).json({
            success: true,
            code: 200,
            message: resetResult.message || "Đặt lại mật khẩu thành công! Bạn có thể sử dụng mật khẩu mới để đăng nhập."
        });
    } catch (err) {
        return res.status(err.status || 400).json({
            success: false,
            code: err.status || 400,
            message: err.message || "Không thể đặt lại mật khẩu."
        });
    }
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

// =========================================================================
// KN-66: API NHẬP DANH SÁCH NGƯỜI DÙNG HÀNG LOẠT TỪ EXCEL / CSV
// =========================================================================

// 1. Tải tệp mẫu Excel / CSV (Accepts ?format=xlsx hoặc ?format=csv)
app.get(
    ["/api/admin/users/import/template", "/api/admin/users/template"],
    (req, res) => {
        try {
            const format = String(req.query.format || "xlsx").toLowerCase();
            const template = generateUsersTemplate(format);
            res.setHeader("Content-Type", template.contentType);
            res.setHeader("Content-Disposition", `attachment; filename="${template.filename}"`);
            return res.status(200).send(template.data);
        } catch (err) {
            return res.status(500).json({
                success: false,
                message: "Không thể tạo file mẫu: " + err.message
            });
        }
    }
);

// 2. Xem trước và báo lỗi theo từng dòng trước khi nhập (Preview & Row Validation)
app.post(
    ["/api/admin/users/import/preview", "/api/admin/users/preview-import"],
    authenticateToken,
    requireRole("administrator"),
    (req, res) => {
        try {
            let rows = req.body?.rows;
            if (!rows && req.body?.fileBase64) {
                const buffer = Buffer.from(req.body.fileBase64, "base64");
                rows = parseExcelBuffer(buffer);
            }
            if (!rows || !Array.isArray(rows)) {
                return res.status(400).json({
                    success: false,
                    message: "Dữ liệu không hợp lệ. Vui lòng cung cấp mảng danh sách 'rows' hoặc 'fileBase64'."
                });
            }

            const preview = previewImportUsers(rows);
            return res.status(200).json({
                success: true,
                message: `Phân tích hoàn tất: ${preview.validCount}/${preview.totalRows} dòng hợp lệ.`,
                preview
            });
        } catch (err) {
            return res.status(err.status || 500).json({
                success: false,
                message: err.message || "Lỗi khi kiểm tra dữ liệu file."
            });
        }
    }
);

// 3. Nhập người dùng hàng loạt (Dòng lỗi bỏ qua, dòng hợp lệ được nhập, báo cáo tổng kết)
app.post(
    ["/api/admin/users/import", "/api/admin/users/batch-import"],
    authenticateToken,
    requireRole("administrator"),
    async (req, res) => {
        try {
            let rows = req.body?.rows;
            if (!rows && req.body?.fileBase64) {
                const buffer = Buffer.from(req.body.fileBase64, "base64");
                rows = parseExcelBuffer(buffer);
            }
            if (!rows || !Array.isArray(rows)) {
                return res.status(400).json({
                    success: false,
                    message: "Vui lòng cung cấp mảng danh sách 'rows' để tiến hành nhập."
                });
            }

            const result = importUsersBatch(rows, {
                currentAdminId: req.user?.id || "usr_admin",
                skipInvalid: true
            });

            // Đồng bộ sang user_roles & Supabase
            for (const u of result.summary.importedUsers) {
                try {
                    syncUserRole(u.id, u.role);
                } catch (e) {}

                try {
                    const fullUser = users.find(existing => existing.id === u.id);
                    if (fullUser) {
                        await supabaseService.syncSingleUser(fullUser, u.temporaryPassword, users);
                    }
                } catch (e) {}
            }

            // Ghi nhận Audit Log (KN-63)
            try {
                recordAuditLog({
                    adminId: req.user?.id || "usr_admin",
                    targetUserId: `batch_${result.summary.importedCount}_users`,
                    action: "IMPORT_USERS_BATCH",
                    roleId: "various",
                    ip: req.ip || "127.0.0.1",
                    status: "SUCCESS",
                    reason: `Nhập thành công ${result.summary.importedCount} tài khoản, bỏ qua ${result.summary.skippedCount} dòng lỗi.`
                });
            } catch (e) {}

            return res.status(200).json({
                success: true,
                message: `Đã nhập thành công ${result.summary.importedCount} tài khoản. Bỏ qua ${result.summary.skippedCount} dòng lỗi.`,
                summary: result.summary
            });
        } catch (err) {
            return res.status(err.status || 500).json({
                success: false,
                message: err.message || "Đã xảy ra lỗi khi nhập danh sách người dùng."
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

// =========================================================================
// KN-68: API TẢI LÊN ẢNH ĐẠI DIỆN & TẠO BẢN THU NHỎ PHỤC VỤ ĐIỂM DANH
// Tiêu chí chấp nhận:
// 1. Chấp nhận JPG/PNG tối đa 2MB (2,097,152 bytes)
// 2. Cắt vuông và tạo bản thu nhỏ (thumbnail) phục vụ điểm danh nhận diện khuôn mặt
// =========================================================================

// Cập nhật ảnh đại diện của người dùng (hỗ trợ cả /api/users/:id/avatar và /api/user/avatar)
app.post(
    ["/api/users/:id/avatar", "/api/user/avatar"],
    async (req, res) => {
        try {
            // Xác định ID người dùng từ params hoặc body hoặc token
            let targetUserId = req.params.id;
            if (!targetUserId && req.body && req.body.userId) {
                targetUserId = req.body.userId;
            }

            // Nếu có token xác thực, cho phép người dùng tự đổi ảnh của mình hoặc Admin đổi hộ
            const authHeader = req.headers["authorization"] || "";
            if (authHeader) {
                const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : authHeader.trim();
                const payload = verifyToken(token);
                if (payload && payload.userId && !targetUserId) {
                    targetUserId = payload.userId;
                }
            }

            if (!targetUserId) {
                targetUserId = "usr_student"; // Fallback tài khoản học viên mẫu cho demo
            }

            const { avatarData, thumbnailData, mimeType, sizeBytes } = req.body || {};

            if (!avatarData) {
                return res.status(400).json({
                    success: false,
                    code: 400,
                    error: "Vui lòng cung cấp dữ liệu ảnh đại diện."
                });
            }

            const updatedUser = updateUserAvatar(targetUserId, {
                avatarData,
                thumbnailData,
                mimeType,
                sizeBytes
            });

            // Đồng bộ sang Supabase nếu có cấu hình
            try {
                await supabaseService.syncSingleUser(updatedUser, null, users);
            } catch (e) {
                // Ignore sync error in offline mode
            }

            return res.status(200).json({
                success: true,
                message: "Tải lên ảnh đại diện thành công. Đã tạo bản thu nhỏ phục vụ nhận diện điểm danh lớp đông.",
                user: updatedUser,
                data: updatedUser
            });
        } catch (err) {
            return res.status(err.status || err.statusCode || 400).json({
                success: false,
                code: err.status || err.statusCode || 400,
                error: err.message || "Không thể tải lên ảnh đại diện."
            });
        }
    }
);

// Lấy ảnh đại diện và thumbnail của người dùng
app.get(
    ["/api/users/:id/avatar", "/api/user/avatar"],
    (req, res) => {
        const targetUserId = req.params.id || "usr_student";
        const user = getUserById(targetUserId) || users.find(u => u.id === targetUserId || u.email.toLowerCase() === targetUserId.toLowerCase());

        if (!user) {
            return res.status(404).json({
                success: false,
                code: 404,
                error: "Không tìm thấy người dùng."
            });
        }

        return res.status(200).json({
            success: true,
            userId: user.id,
            name: user.name,
            avatar: user.avatar || "",
            thumbnail: user.thumbnail || ""
        });
    }
);

// Xóa ảnh đại diện (khôi phục về chữ cái mặc định)
app.delete(
    ["/api/users/:id/avatar", "/api/user/avatar"],
    (req, res) => {
        try {
            const targetUserId = req.params.id || "usr_student";
            const result = deleteUserAvatar(targetUserId);
            return res.status(200).json({
                success: true,
                message: "Đã xóa ảnh đại diện thành công.",
                data: result
            });
        } catch (err) {
            return res.status(err.status || err.statusCode || 400).json({
                success: false,
                code: err.status || err.statusCode || 400,
                error: err.message || "Không thể xóa ảnh đại diện."
            });
        }
    }
);

// API Danh sách học viên lớp học kèm ảnh nhận diện phục vụ điểm danh lớp đông (KN-68)
app.get("/api/attendance/students", (req, res) => {
    const studentUsers = users.filter(u => u.role === "student");
    const sv001 = studentUsers.find(u => u.id === "usr_student" || u.email === "student@tms.edu.vn") || {};

    const attendanceStudents = [
        {
            id: sv001.id || "usr_student",
            studentCode: "SV001",
            name: sv001.name || "Lê Minh Tuấn",
            email: sv001.email || "student@tms.edu.vn",
            className: "K15-PM01",
            attendanceRate: 92,
            status: "present",
            avatar: sv001.avatar || "",
            thumbnail: sv001.thumbnail || ""
        },
        {
            id: "usr_sv002",
            studentCode: "SV002",
            name: "Hoàng Thùy Linh",
            email: "linh.ht@tms.edu.vn",
            className: "K15-PM01",
            attendanceRate: 88,
            status: "present",
            avatar: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='50' fill='%236366f1'/><circle cx='50' cy='38' r='20' fill='%23ffffff'/><path d='M20 85 C20 62 35 56 50 56 C65 56 80 62 80 85 Z' fill='%23ffffff'/></svg>",
            thumbnail: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='50' fill='%236366f1'/><circle cx='50' cy='38' r='20' fill='%23ffffff'/><path d='M20 85 C20 62 35 56 50 56 C65 56 80 62 80 85 Z' fill='%23ffffff'/></svg>"
        },
        {
            id: "usr_sv003",
            studentCode: "SV003",
            name: "Trần Đình Trọng",
            email: "trong.td@tms.edu.vn",
            className: "K15-PM01",
            attendanceRate: 74,
            status: "absent",
            avatar: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='50' fill='%23f59e0b'/><circle cx='50' cy='38' r='20' fill='%23ffffff'/><path d='M20 85 C20 62 35 56 50 56 C65 56 80 62 80 85 Z' fill='%23ffffff'/></svg>",
            thumbnail: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='50' fill='%23f59e0b'/><circle cx='50' cy='38' r='20' fill='%23ffffff'/><path d='M20 85 C20 62 35 56 50 56 C65 56 80 62 80 85 Z' fill='%23ffffff'/></svg>"
        }
    ];

    return res.status(200).json({
        success: true,
        data: attendanceStudents
    });
});

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
// PHÂN HỆ TUYỂN SINH - TIẾP NHẬN LEAD TƯ VẤN (PUBLIC FORM & ADMISSIONS)
// 1. Biểu mẫu không yêu cầu đăng nhập, có chống spam đa lớp
// 2. Gửi thành công tạo một lead ở trạng thái Mới
// 3. Hiển thị lời cảm ơn và cam kết thời gian liên hệ lại
// -------------------------------------------------------------

// API Sinh câu hỏi / token chống spam (Public - Không yêu cầu đăng nhập)
app.get(["/api/leads/challenge", "/api/leads/anti-spam-challenge"], (req, res) => {
    const challenge = generateAntiSpamChallenge();
    return res.status(200).json({
        success: true,
        data: challenge
    });
});

// API Tiếp nhận Đăng ký Tư vấn Khóa học (Public - Không yêu cầu đăng nhập, có chống spam)
app.post(["/api/leads", "/api/admissions/leads", "/api/public/leads"], (req, res) => {
    const clientIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "127.0.0.1";
    const leadData = req.body || {};

    const result = createLead(leadData, { ip: clientIp });

    if (!result.success) {
        const statusCode = (result.code && result.code.includes("RATE_LIMIT")) ? 429
            : (result.code && result.code.includes("SPAM") ? 400 : 400);

        return res.status(statusCode).json({
            success: false,
            code: result.code,
            message: result.message
        });
    }

    // Tự động đồng bộ nhanh vào Supabase storage nếu có cấu hình
    supabaseService.syncLeadsDatabase(leads).catch(() => {});

    return res.status(201).json({
        success: true,
        message: result.message,
        thankYouMessage: result.thankYouMessage,
        contactCommitment: result.contactCommitment,
        commitment: result.commitment,
        data: result.lead,
        lead: result.lead
    });
});

// API Thống kê số lượng Lead (Quyền: Tư vấn tuyển sinh, Quản lý đào tạo hoặc Quản trị viên)
app.get("/api/leads/stats",
    authenticateToken,
    requireRole("admissions", "training_manager", "administrator"),
    (req, res) => {
        const stats = getLeadStats();
        return res.status(200).json({
            success: true,
            data: stats
        });
    }
);

// API Lấy danh sách Lead có phân trang và lọc (Quyền: Tư vấn tuyển sinh, Quản lý đào tạo hoặc Quản trị viên)
app.get("/api/leads",
    authenticateToken,
    requireRole("admissions", "training_manager", "administrator"),
    (req, res) => {
        const { page, limit, status, course, search } = req.query;
        const result = getLeads({ page, limit, status, course, search });
        return res.status(200).json(result);
    }
);

// API Lấy chi tiết Lead theo ID (Quyền: Tư vấn tuyển sinh, Quản lý đào tạo hoặc Quản trị viên)
app.get("/api/leads/:id",
    authenticateToken,
    requireRole("admissions", "training_manager", "administrator"),
    (req, res) => {
        const lead = getLeadById(req.params.id);
        if (!lead) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy thông tin hồ sơ Lead."
            });
        }
        return res.status(200).json({
            success: true,
            data: lead
        });
    }
);

// API Cập nhật trạng thái Lead (vd: chuyển từ "Mới" sang "Đang tư vấn", "Đã ghi danh", "Hủy")
app.put("/api/leads/:id/status",
    authenticateToken,
    requireRole("admissions", "administrator"),
    (req, res) => {
        const { status, counselorNotes, assignedTo } = req.body || {};
        if (!status) {
            return res.status(400).json({
                success: false,
                message: "Vui lòng cung cấp trạng thái cần cập nhật cho Lead."
            });
        }

        const result = updateLeadStatus(req.params.id, status, {
            counselorNotes,
            assignedTo: assignedTo || (req.user ? req.user.id : null)
        });

        if (!result.success) {
            return res.status(400).json(result);
        }

        supabaseService.syncLeadsDatabase(leads).catch(() => {});
        return res.status(200).json(result);
    }
);

// API Xóa Lead (Chỉ Quản trị viên)
app.delete("/api/leads/:id",
    authenticateToken,
    requireRole("administrator"),
    (req, res) => {
        const result = deleteLead(req.params.id);
        if (!result.success) {
            return res.status(404).json(result);
        }
        supabaseService.syncLeadsDatabase(leads).catch(() => {});
        return res.status(200).json(result);
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
        await supabaseService.syncLeadsDatabase(leads);
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
app.get("/api/health", async (req, res) => {
    const smtpCheck = await verifySmtp();
    res.json({
        status: "ok",
        supabase: {
            configured: Boolean(supabaseService.SUPABASE_URL),
            url: supabaseService.SUPABASE_URL
        },
        smtp: {
            configured: Boolean(SMTP_CONFIG.host),
            host: SMTP_CONFIG.host,
            port: SMTP_CONFIG.port,
            user: SMTP_CONFIG.user,
            from: SMTP_CONFIG.fromEmail,
            connected: smtpCheck.success
        },
        timestamp: new Date().toISOString()
    });
});

// KN-11 & KN-86: API Kiểm tra trạng thái SMTP và gửi email thử nghiệm (Chỉ Quản trị viên)
app.get("/api/admin/smtp/status",
    authenticateToken,
    requireRole("administrator"),
    async (req, res) => {
        const smtpStatus = await verifySmtp();
        return res.status(200).json({
            success: true,
            smtp: {
                host: SMTP_CONFIG.host,
                port: SMTP_CONFIG.port,
                user: SMTP_CONFIG.user,
                fromEmail: SMTP_CONFIG.fromEmail,
                fromName: SMTP_CONFIG.fromName,
                secure: SMTP_CONFIG.secure,
                connected: smtpStatus.success,
                error: smtpStatus.error || null,
                totalSentEmails: sentEmails.length
            }
        });
    }
);

app.post("/api/admin/smtp/test",
    authenticateToken,
    requireRole("administrator"),
    async (req, res) => {
        const targetEmail = (req.body && req.body.to) ? req.body.to : (req.user ? req.user.email : SMTP_CONFIG.user);
        try {
            const emailResult = sendActivationEmail({
                to: targetEmail,
                name: req.body?.name || "Quản trị viên Thử nghiệm",
                temporaryPassword: "TMS@" + Math.random().toString(36).substring(2, 8),
                role: "administrator"
            });
            return res.status(200).json({
                success: true,
                message: `Đã gửi email kích hoạt thử nghiệm tới ${targetEmail} thành công!`,
                emailRecord: emailResult
            });
        } catch (err) {
            return res.status(500).json({
                success: false,
                message: "Gửi email thử nghiệm thất bại: " + err.message
            });
        }
    }
);

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
                    // Giữ lại các thay đổi cục bộ hiện thời nếu có (mật khẩu mới, avatar mới, ...)
                    users[idx] = { ...ru, ...users[idx] };
                }
            });
        }
    } catch {}
}
if (process.env.NODE_ENV !== "test") {
    hydrateUsersFromSupabase().catch(() => {});
}

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