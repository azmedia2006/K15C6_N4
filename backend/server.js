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

const path = require("path");

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

// ============================================================================
// KN-8: HỆ THỐNG PHÂN QUYỀN THEO VAI TRÒ (RBAC) - DOAN MINH QUAN (azmedia247)
// ============================================================================
const {
    BUSINESS_ROLES,
    PERMISSIONS,
    getAllRolePermissions,
    getPermissionsByRole,
    updateRolePermissions,
    updateAllRolePermissions,
    resetRolePermissions,
    mockGrades,
    mockTuitions,
    updateStudentGrade,
    updateStudentTuition,
    authorizePermission
} = require("./rbacService");

// KN-8: Lấy toàn bộ ma trận phân quyền của 8 vai trò
app.get("/api/rbac/matrix", (req, res) => {
    res.json({
        success: true,
        roles: Object.values(BUSINESS_ROLES),
        permissions: Object.values(PERMISSIONS),
        matrix: getAllRolePermissions()
    });
});

// KN-8: Lấy quyền của người dùng hiện tại (Current User Permissions)
app.get("/api/rbac/my-permissions", authenticateToken, (req, res) => {
    const userRole = req.user.role;
    res.json({
        success: true,
        role: userRole,
        permissions: getPermissionsByRole(userRole)
    });
});

// KN-8: Cấp token mô phỏng vai trò để hỗ trợ kiểm thử thực thi trực tiếp trên giao diện
app.get("/api/rbac/demo-token/:role", (req, res) => {
    const { role } = req.params;
    const roleUsers = {
        administrator: { id: "usr_admin", email: "admin@tms.edu.vn", name: "Nguyễn Văn Anh", role: "administrator" },
        training_manager: { id: "usr_manager", email: "manager@tms.edu.vn", name: "Đỗ Quốc Bảo", role: "training_manager" },
        instructor: { id: "usr_teacher", email: "teacher@tms.edu.vn", name: "ThS. Trần Minh", role: "instructor" },
        teaching_assistant: { id: "usr_ta", email: "ta@tms.edu.vn", name: "Nguyễn Thu Hà", role: "teaching_assistant" },
        student: { id: "usr_student", email: "student@tms.edu.vn", name: "Lê Minh Tuấn", role: "student" },
        admissions: { id: "usr_admissions", email: "admissions@tms.edu.vn", name: "Vũ Hải Yến", role: "admissions" },
        accountant: { id: "usr_accountant", email: "accountant@tms.edu.vn", name: "Phạm Thanh Mai", role: "accountant" },
        visitor: { id: "usr_visitor", email: "visitor@tms.edu.vn", name: "Khách tham quan", role: "visitor" }
    };
    const user = roleUsers[role] || { id: "usr_demo", email: `${role}@tms.edu.vn`, name: `Người dùng ${role}`, role };
    const token = generateToken(user);
    res.json({ success: true, role, user, token });
});

// KN-8: Cập nhật toàn bộ ma trận phân quyền
app.put("/api/rbac/matrix", (req, res) => {
    try {
        const { matrix } = req.body || {};
        const updatedMatrix = updateAllRolePermissions(matrix);
        res.json({
            success: true,
            message: "Cập nhật toàn bộ ma trận phân quyền thành công.",
            matrix: updatedMatrix
        });
    } catch (err) {
        res.status(err.status || 500).json({
            success: false,
            message: err.message || "Đã xảy ra lỗi khi cập nhật ma trận phân quyền."
        });
    }
});

// KN-8: Cập nhật quyền cho một vai trò
app.put("/api/rbac/matrix/:role", (req, res) => {
    try {
        const { role } = req.params;
        const { permissions } = req.body || {};
        const result = updateRolePermissions(role, permissions);
        res.json({
            success: true,
            message: `Cập nhật phân quyền cho vai trò '${role}' thành công.`,
            ...result
        });
    } catch (err) {
        res.status(err.status || 500).json({
            success: false,
            message: err.message || "Đã xảy ra lỗi khi cập nhật phân quyền."
        });
    }
});

// KN-8: Khôi phục phân quyền mặc định
app.post("/api/rbac/matrix/reset", (req, res) => {
    const matrix = resetRolePermissions();
    res.json({
        success: true,
        message: "Đã khôi phục ma trận phân quyền về mặc định.",
        matrix
    });
});

// ----------------------------------------------------------------------------
// KN-8 NGHIỆP VỤ ĐIỂM SỐ: Kiểm quyền ở tầng Server (Giảng viên được sửa, Kế toán bị chặn)
// ----------------------------------------------------------------------------

// Xem danh sách điểm (Yêu cầu quyền grades:view)
app.get("/api/grades", authenticateToken, authorizePermission(PERMISSIONS.GRADES_VIEW), (req, res) => {
    res.json({
        success: true,
        grades: mockGrades
    });
});

// Nhập / sửa điểm cho sinh viên (Yêu cầu quyền grades:update)
// -> Giảng viên (instructor): CHO PHÉP (HTTP 200)
// -> Kế toán (accountant): TỪ CHỐI (HTTP 403)
app.put("/api/grades/:studentId", authenticateToken, authorizePermission(PERMISSIONS.GRADES_UPDATE), (req, res) => {
    try {
        const { studentId } = req.params;
        const { subject, score } = req.body || {};
        if (!subject || score === undefined) {
            return res.status(400).json({
                success: false,
                message: "Vui lòng cung cấp môn học (subject) và điểm số (score)."
            });
        }
        const updatedGrade = updateStudentGrade(studentId, subject, score, req.user.email);
        res.json({
            success: true,
            message: `Cập nhật điểm môn '${subject}' cho sinh viên ${studentId} thành ${score} thành công.`,
            grade: updatedGrade
        });
    } catch (err) {
        res.status(err.status || 500).json({
            success: false,
            message: err.message || "Lỗi cập nhật điểm."
        });
    }
});

// ----------------------------------------------------------------------------
// KN-8 NGHIỆP VỤ HỌC PHÍ: Kiểm quyền ở tầng Server (Kế toán được sửa, Giảng viên bị chặn)
// ----------------------------------------------------------------------------

// Xem danh sách học phí (Yêu cầu quyền tuition:view)
app.get("/api/tuitions", authenticateToken, authorizePermission(PERMISSIONS.TUITION_VIEW), (req, res) => {
    res.json({
        success: true,
        tuitions: mockTuitions
    });
});

// Cập nhật học phí cho sinh viên (Yêu cầu quyền tuition:update)
// -> Kế toán (accountant): CHO PHÉP (HTTP 200)
// -> Giảng viên (instructor): TỪ CHỐI (HTTP 403)
app.put("/api/tuitions/:studentId", authenticateToken, authorizePermission(PERMISSIONS.TUITION_UPDATE), (req, res) => {
    try {
        const { studentId } = req.params;
        const { paidAmount, status } = req.body || {};
        if (paidAmount === undefined) {
            return res.status(400).json({
                success: false,
                message: "Vui lòng cung cấp số tiền học phí (paidAmount)."
            });
        }
        const updatedTuition = updateStudentTuition(studentId, paidAmount, status, req.user.email);
        res.json({
            success: true,
            message: `Cập nhật học phí sinh viên ${studentId} thành công. Đã đóng: ${Number(paidAmount).toLocaleString("vi-VN")} VNĐ.`,
            tuition: updatedTuition
        });
    } catch (err) {
        res.status(err.status || 500).json({
            success: false,
            message: err.message || "Lỗi cập nhật học phí."
        });
    }
});

// Chỉ listen khi chạy trực tiếp file server.js (hỗ trợ kiểm thử require module)
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`TMS Auth Server running at http://localhost:${PORT}`);
    });
}

module.exports = app;
