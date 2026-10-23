const path = require("path");
const fs = require("fs");
require("dotenv").config({
    path: [path.join(__dirname, ".env"), path.join(__dirname, "../.env")]
});
const express = require("express");
const cors = require("cors");
const classroomService = require("./classroomService");
const {
    verifySmtp,
    updateSmtpConfig,
    getSmtpConfigSummary,
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
    passwordResetTokens,
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
    hydrateUserRoleAssignments,
    getAllUserRolesAssignments,
    userHasRole
} = require("./roleService");

const supabaseService = require("./supabaseService");
const {
    getStudentProfiles,
    getStudentProfile,
    updateStudentProfile
} = require("./studentService");

const {
    getAllClasses,
    getClassMetrics,
    getClassFilterOptions,
    getClassDetail,
    getEnrollmentsList,
    batchEnrollStudents,
    unenrollStudent,
    resetEnrollmentData
} = require("./enrollmentService");

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
    updateLead,
    updateLeadStatus,
    findDuplicateLeadPhones,
    addConsultation,
    addCareLog,
    getCareLogs,
    completeCallback,
    getReminderStats,
    deleteLead,
    getLeadStats,
    getLeadSources,
    getCounselors,
    generateAntiSpamChallenge,
    verifyAntiSpamChallenge,
    checkSpam
} = require("./leadService");

const {
    initSubjectData,
    getAllPrograms,
    getProgramById,
    getSubjects,
    getSubjectById,
    createSubject,
    updateSubject,
    deleteSubject,
    addSubjectToProgram,
    removeSubjectFromProgram,
    setPrerequisiteSubject,
    reorderProgramSubjects,
    hasPrerequisiteCycle,
    getClassesBySubjectId,
    addClassForSubject
} = require("./subjectService");
// KN-128: Phân công giảng viên và trợ giảng
const {
    getEligibleStaff,
    saveTeachingAssignment,
    getTeachingAssignment,
    getInstructorClasses,
    hydrateTeachingAssignments
} = require("./teachingAssignmentService");

const {
    DEFAULT_HOLIDAYS,
    STANDARD_SHIFTS,
    SUBJECT_SYLLABI,
    initScheduleData,
    generateSchedulePreview,
    saveClassSchedule,
    getClassSchedule,
    getSchedules,
    updateSession,
    deleteSession,
    clearClassSchedule,
    getClassesWithScheduleStatus,
    createClass,
    getHolidays,
    addHoliday,
    deleteHoliday
} = require("./scheduleService");

const app = express();
const PORT = process.env.PORT || 3000;

app.disable('x-powered-by');
app.use((req,res,next)=>{res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Frame-Options','DENY');next();});
app.use(cors({origin:process.env.FRONTEND_URL||false}));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(require('./localDatabase').middleware);
// Do not expose source files, local schedule inboxes, or dependency folders via static hosting.
app.use(["/backend", "/BE", "/node_modules", "/data", "/.git", "/docs", "/.mvn", "/kn72", "/src"], (req, res) => res.sendStatus(403));
app.use((req,res,next)=>{let pathname;try{pathname=decodeURIComponent(req.path)}catch{return res.sendStatus(400)}pathname=path.posix.normalize(pathname.replace(/\\/g,'/'));if(/^\/(?:backend|BE|node_modules|data|\.git|docs|\.mvn|kn72|src)(?:\/|$)/i.test(pathname)||/\.(?:json|md|sql|java|ts|yml|yaml|properties|zip|patch|log|cjs|mjs|map|xml|jar|cmd|sh|env)$/i.test(pathname)||['/server.js','/mvnw','/api/index.js'].includes(pathname))return res.sendStatus(403);next();});
app.use(express.static(path.join(__dirname, "..")));
app.get(["/leads", "/lead-management"], (req, res) => {
    res.sendFile(path.join(__dirname, "../LeadManagement.html"));
});
app.get(["/schedules", "/schedule-management", "/ScheduleManagement.html"], (req, res) => {
    res.sendFile(path.join(__dirname, "../ScheduleManagement.html"));
});
app.get(["/curriculum", "/curriculum-management", "/CurriculumManagement.html"], (req, res) => {
    res.sendFile(path.join(__dirname, "../CurriculumManagement.html"));
});
app.get(["/subjects", "/subject-management", "/SubjectManagement.html"], (req, res) => {
    res.sendFile(path.join(__dirname, "../SubjectManagement.html"));
});

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

require('./businessRoutes')(app, { authenticateToken, requireRole });

// KN-31: API đăng nhập bằng email và mật khẩu
// Cập nhật trả về danh sách vai trò N-N (hỗ trợ cả /api/auth/login và /auth/login)
app.post(["/api/auth/login", "/auth/login"], async (req, res) => {
    try {
        await hydrateUsersForVercel();
    } catch {}
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

app.post(['/api/auth/logout', '/auth/logout'], authenticateToken, (req, res) => {
    require('./authService').revokeToken(req.headers.authorization.replace(/^Bearer\s+/i, ''));
    res.json({ success: true, message: 'Đã đăng xuất.' });
});
app.post(['/api/auth/change-password', '/auth/change-password'], authenticateToken, (req, res) => {
    try {
        res.json(require('./authService').changePassword(req.user.id, req.body.currentPassword, req.body.newPassword));
    } catch (e) {
        res.status(e.status || 400).json({ success: false, message: e.message });
    }
});

// KN-60: API lấy thông tin người dùng hiện tại
// Đồng bộ tức thì trên Frontend (hỗ trợ cả /api/auth/me và /auth/me)
app.get(["/api/auth/me", "/auth/me"], authenticateToken, (req, res) => {
    return res.status(200).json({
        success: true,
        user: req.user
    });
});
// KN-67: Lấy hồ sơ cá nhân của người đang đăng nhập
app.get(["/api/auth/me/profile", "/auth/me/profile"], authenticateToken, (req, res) => {
    const user = users.find(u => u.id === req.user.id);

    if (!user) {
        return res.status(404).json({
            success: false,
            message: "Không tìm thấy hồ sơ người dùng."
        });
    }

    return res.json({
        success: true,
        user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: req.user.role,
            phone: user.phone || "",
            birthDate: user.birthDate || "",
            address: user.address || ""
        }
    });
});

// KN-67: Cập nhật hồ sơ cá nhân
app.put(["/api/auth/me/profile", "/auth/me/profile"], authenticateToken, async (req, res) => {
    try {
        const user = users.find(u => u.id === req.user.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy hồ sơ người dùng."
            });
        }

        const data = req.body || {};
        const allowedFields = ["name", "phone", "birthDate", "address"];

        if (Object.keys(data).some(key => !allowedFields.includes(key))) {
            return res.status(400).json({
                success: false,
                message: "Bạn chỉ được cập nhật họ tên, số điện thoại, ngày sinh và địa chỉ."
            });
        }

        const updated = {};

        if (data.name !== undefined) {
            if (typeof data.name !== "string" ||
                data.name.trim().length < 2 ||
                data.name.trim().length > 255) {
                return res.status(400).json({
                    success: false,
                    message: "Họ tên phải có từ 2 đến 255 ký tự."
                });
            }
            updated.name = data.name.trim();
        }

        if (data.phone !== undefined) {
            if (typeof data.phone !== "string") {
                return res.status(400).json({
                    success: false,
                    message: "Số điện thoại không hợp lệ."
                });
            }

            const phone = data.phone.trim();
            const phoneRegex = /^(?:0[35789]\d{8}|\+84[35789]\d{8})$/;

            if (phone && !phoneRegex.test(phone)) {
                return res.status(400).json({
                    success: false,
                    message: "Số điện thoại Việt Nam không hợp lệ."
                });
            }

            updated.phone = phone;
        }

        if (data.birthDate !== undefined) {
            const birthDate = data.birthDate;

            if (birthDate !== "" && (
                typeof birthDate !== "string" ||
                !/^\d{4}-\d{2}-\d{2}$/.test(birthDate) ||
                !Number.isFinite(Date.parse(birthDate)) ||
                new Date(birthDate).toISOString().slice(0, 10) !== birthDate ||
                birthDate > new Date().toISOString().slice(0, 10)
            )) {
                return res.status(400).json({
                    success: false,
                    message: "Ngày sinh không hợp lệ."
                });
            }

            updated.birthDate = birthDate;
        }

        if (data.address !== undefined) {
            if (typeof data.address !== "string" ||
                data.address.trim().length > 500) {
                return res.status(400).json({
                    success: false,
                    message: "Địa chỉ không được vượt quá 500 ký tự."
                });
            }

            updated.address = data.address.trim();
        }
    // KN-67: Chuẩn bị hồ sơ mới
        const nextUser = {
            ...user,
            ...updated,
            updatedAt: new Date().toISOString()
    };

    // Lưu lên Supabase trước
            if(process.env.TMS_OFFLINE !== "true" && process.env.SUPABASE_URL) await supabaseService.saveUserProfile(nextUser);

    // Chỉ cập nhật RAM khi Supabase lưu thành công
        Object.assign(user, updated);
            user.updatedAt = nextUser.updatedAt;

        return res.json({
            success: true,
            message: "Cập nhật hồ sơ cá nhân thành công.",
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: req.user.role,
                phone: user.phone || "",
                birthDate: user.birthDate || "",
                address: user.address || ""
            }
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Không thể cập nhật hồ sơ cá nhân."
        });
    }
});

// =========================================================================
// KN-39, KN-40, KN-42, KN-43: BỘ API QUÊN VÀ ĐẶT LẠI MẬT KHẨU
// Hỗ trợ cả tiền tố /api/auth/* và /auth/*
// =========================================================================

const isVercelRuntime = Boolean(process.env.VERCEL || process.env.VERCEL_URL || process.env.NOW_REGION);
const os = require("os");
const tmpUsersFile = path.join(os.tmpdir(), "tms_registered_users.json");

async function hydrateUsersForVercel() {
    // 1. Phục hồi từ file lưu trữ người dùng serverless cục bộ (/tmp)
    try {
        if (fs.existsSync(tmpUsersFile)) {
            const raw = fs.readFileSync(tmpUsersFile, "utf8");
            const fileUsers = JSON.parse(raw);
            if (Array.isArray(fileUsers)) {
                fileUsers.forEach(fu => {
                    const existingIdx = users.findIndex(u => (u.email && fu.email && u.email.toLowerCase() === fu.email.toLowerCase()) || (u.id && fu.id && u.id === fu.id));
                    if (existingIdx === -1) {
                        users.push(fu);
                    }
                });
            }
        }
    } catch (e) {}

    // 2. Phục hồi từ localDatabase
    try {
        const snap = require("./localDatabase").snapshot();
        if (snap && snap.auth && Array.isArray(snap.auth.users)) {
            snap.auth.users.forEach(su => {
                const existingIdx = users.findIndex(u => (u.email && su.email && u.email.toLowerCase() === su.email.toLowerCase()) || (u.id && su.id && u.id === su.id));
                if (existingIdx === -1) {
                    users.push(su);
                }
            });
        }
    } catch (e) {}

    // 3. Phục hồi từ Supabase Storage nếu có cấu hình
    if (!supabaseService.SUPABASE_URL) return;
    try {
        const [storedUsers, roleAssignments] = await Promise.all([
            supabaseService.loadPasswordRecoveryUsersSnapshot().catch(() => null),
            supabaseService.loadUserRoleAssignmentsSnapshot().catch(() => null)
        ]);
        if (Array.isArray(storedUsers) && storedUsers.length > 0) {
            storedUsers.forEach(su => {
                const existingIdx = users.findIndex(u => (u.email && su.email && u.email.toLowerCase() === su.email.toLowerCase()) || (u.id && su.id && u.id === su.id));
                if (existingIdx === -1) {
                    users.push(su);
                }
            });
        }
        if (roleAssignments) {
            hydrateUserRoleAssignments(roleAssignments);
        }
    } catch (err) {
        console.warn("[Server] Không thể đồng bộ người dùng từ Supabase:", err.message);
    }
}

async function hydratePasswordRecoveryState() {
    try {
        if (supabaseService.SUPABASE_URL) {
            await hydrateUsersForVercel();
            const storedTokens = await supabaseService.loadPasswordResetTokensSnapshot().catch(() => []);
            if (Array.isArray(storedTokens)) {
                for (const entry of storedTokens) {
                    if (entry && entry.expiresAt > Date.now()) {
                        passwordResetTokens.set(entry.token, entry);
                    }
                }
            }
        }
    } catch (e) {
        console.warn("[Server] Không thể đồng bộ trạng thái phục hồi từ Supabase:", e.message);
    }
}

async function persistPasswordResetTokens() {
    try {
        if (supabaseService.SUPABASE_URL) {
            await supabaseService.savePasswordResetTokensSnapshot(
                [...passwordResetTokens.values()]
            );
        }
    } catch (e) {
        console.warn("[Server] Không thể lưu snapshot token khôi phục:", e.message);
    }
}

// Xác định URL công khai cho Frontend, tuyệt đối không dùng localhost khi đang chạy trên Vercel
function resolveFrontendUrl(req) {
    const isVercel = Boolean(process.env.VERCEL || process.env.VERCEL_URL);

    const origin = req && req.headers ? (req.headers["origin"] || "") : "";
    if (origin && typeof origin === "string") {
        const cleanOrigin = origin.trim().replace(/\/$/, "");
        if (!cleanOrigin.includes("localhost") && !cleanOrigin.includes("127.0.0.1")) {
            return cleanOrigin;
        }
        if (!isVercel) {
            return cleanOrigin;
        }
    }
    const referer = req && req.headers ? (req.headers["referer"] || "") : "";
    if (referer && typeof referer === "string") {
        try {
            const parsed = new URL(referer);
            const refBase = `${parsed.protocol}//${parsed.host}`;
            if (!refBase.includes("localhost") && !refBase.includes("127.0.0.1")) {
                return refBase;
            }
            if (!isVercel) {
                return refBase;
            }
        } catch (_) {}
    }

    const forwardedHost = req && req.get ? (req.get("x-forwarded-host") || "") : "";
    const forwardedProto = req && req.get ? (req.get("x-forwarded-proto") || "https") : "https";
    if (forwardedHost && !forwardedHost.includes("localhost")) {
        return `${forwardedProto}://${forwardedHost}`.replace(/\/$/, "");
    }

    if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
        return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`.replace(/\/$/, "");
    }
    if (process.env.VERCEL_URL) {
        return `https://${process.env.VERCEL_URL}`.replace(/\/$/, "");
    }

    const envFrontend = (process.env.FRONTEND_URL || "").trim().replace(/\/$/, "");
    if (envFrontend && (!isVercel || (!envFrontend.includes("localhost") && !envFrontend.includes("127.0.0.1")))) {
        return envFrontend;
    }

    if (isVercel) {
        return "https://k15c6n4.vercel.app";
    }

    const host = (req && req.get ? req.get("host") : "") || "localhost:3000";
    const proto = (req && req.protocol) || "http";
    return `${proto}://${host}`.replace(/\/$/, "");
}

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

    const normalizedInputEmail = String(email).trim().toLowerCase();

    try {
        await hydratePasswordRecoveryState();

        let result = createPasswordResetToken(normalizedInputEmail);

        // Nếu email chưa có nhưng đúng định dạng email và khớp admin/smtp hoặc hồ sơ cần tạo
        if (!result.userFound && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedInputEmail)) {
            const user = findUserByEmail(normalizedInputEmail);
            if (user) {
                result = createPasswordResetToken(normalizedInputEmail);
            }
        }

        if (result.userFound && result.token) {
            await persistPasswordResetTokens();

            const frontendUrl = resolveFrontendUrl(req);
            const resetUrl = `${frontendUrl.replace(/\/$/, "")}/ResetPassword.html?token=${result.token}`;

            try {
                await sendPasswordResetEmail({
                    to: result.user.email,
                    name: result.user.name,
                    resetToken: result.token,
                    resetUrl
                });
                console.log(`[Server] ✔ Đã gửi email khôi phục mật khẩu tới: ${result.user.email}`);
            } catch (mailErr) {
                console.error("[Server] ⚠ Gửi email đặt lại mật khẩu thất bại:", mailErr.message);
            }
        } else {
            console.warn(`[Server] Yêu cầu quên mật khẩu cho email không tồn tại trong hệ thống: ${normalizedInputEmail}`);
        }
    } catch (error) {
        console.error("[Server] Không thể xử lý yêu cầu khôi phục mật khẩu:", error.message);
        return res.status(503).json({
            success: false,
            code: 429,
            message: "Bạn đã yêu cầu đặt lại mật khẩu quá nhiều lần (tối đa 5 lần/giờ). Vui lòng thử lại sau.",
            retryAfterSeconds: error.retryAfterSeconds || 3600
        });
    }

    // KN-39: Luôn trả về 200 kèm thông báo bảo mật chung (chống rò rỉ sự tồn tại của email)
    return res.status(200).json({
        success: true,
        code: 200,
        message: require("./emailService").isConfigured() ? "Nếu email thuộc tài khoản hợp lệ, yêu cầu khôi phục đã được tiếp nhận. Vui lòng kiểm tra hộp thư." : "Chưa cấu hình gửi email. Vui lòng liên hệ quản trị viên để khôi phục mật khẩu.",
        mailConfigured: require("./emailService").isConfigured()
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

        await persistPasswordResetTokens();
        try {
            if (isVercelRuntime) {
                await supabaseService.savePasswordRecoveryUsersSnapshot(users);
            } else {
                await supabaseService.syncUsersDatabase(users);
            }
        } catch (storageErr) {
            console.warn("[Server] Không thể đồng bộ snapshot mật khẩu lên Supabase:", storageErr.message);
        }

        return res.status(200).json({
            success: true,
            code: 200,
            message: resetResult.message || "Đặt lại mật khẩu thành công! Bạn có thể sử dụng mật khẩu mới để đăng nhập."
        });
    } catch (err) {
        const status = err.status || 400;
        return res.status(status).json({
            success: false,
            code: status,
            message: err.message || "Không thể đặt lại mật khẩu."
        });
    }
});

// API Đăng ký tài khoản người dùng công khai (Học viên)
app.post(["/api/auth/register", "/auth/register"], async (req, res) => {
    try {
        await hydrateUsersForVercel();
        const { name, email, phone, password } = req.body || {};
        require("./authService").validatePassword(password);

        const result = createUser({
            name,
            email,
            phone,
            password,
            role: "student",
            sendActivation: false
        });

        // Lưu ngay vào file tạm serverless (/tmp) và localDatabase để không bao giờ mất tài khoản
        try {
            let tmpList = [];
            if (fs.existsSync(tmpUsersFile)) {
                try { tmpList = JSON.parse(fs.readFileSync(tmpUsersFile, "utf8")); } catch {}
            }
            if (!Array.isArray(tmpList)) tmpList = [];
            const savedU = users.find(u => u.id === result.user.id) || result.user;
            const existingIdx = tmpList.findIndex(u => (u.email && savedU.email && u.email.toLowerCase() === savedU.email.toLowerCase()) || (u.id && savedU.id && u.id === savedU.id));
            if (existingIdx !== -1) tmpList[existingIdx] = savedU;
            else tmpList.push(savedU);
            fs.writeFileSync(tmpUsersFile, JSON.stringify(tmpList, null, 2), "utf8");
        } catch (e) {}

        try {
            require("./localDatabase").commit();
        } catch (e) {}

        if (isVercelRuntime) {
            try {
                await supabaseService.savePasswordRecoveryUsersSnapshot(users);
            } catch (error) {
                console.warn("[Server] Supabase Storage chưa sẵn sàng hoặc timeout, duy trì tài khoản trong bộ nhớ & localDatabase:", error.message);
            }
        } else {
            await supabaseService.syncSingleUser(result.user, password, users).catch(() => {});
        }

        try {
            syncUserRole(result.user.id, "student");
        } catch (error) {
            console.warn("[Server] Không thể đồng bộ vai trò tài khoản mới:", error.message);
        }
        if (isVercelRuntime) {
            try {
                await supabaseService.saveUserRoleAssignmentsSnapshot(
                    getAllUserRolesAssignments()
                );
            } catch (error) {
                console.warn("[Server] Không thể lưu vai trò tài khoản mới:", error.message);
            }
        }

        return res.status(201).json({
            success: true,
            message: "Đăng ký tài khoản thành công.",
            user: result.user
        });
    } catch (err) {
        if (err && (err.statusCode === 503 || err.message?.includes("Supabase Storage"))) {
            console.error("[Server] Không thể lưu tài khoản đăng ký:", err.message);
            return res.status(503).json({
                success: false,
                message: "Chưa thể lưu tài khoản. Vui lòng thử lại sau."
            });
        }
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
    async (req, res) => {
        try {
            await hydrateUsersForVercel();
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
        } catch (err) {
            return res.status(err.status || err.statusCode || 503).json({
                success: false,
                message: err.message || "Không thể tải danh sách tài khoản."
            });
        }
    }
);

// KN-11: API Tạo mới tài khoản người dùng
app.post(
    "/api/admin/users",
    authenticateToken,
    requireRole("administrator"),
    async (req, res) => {
        try {
            await hydrateUsersForVercel();
            const result = createUser({
                ...(req.body || {}),
                sendActivation: false
            });

            // Lưu ngay vào file tạm serverless (/tmp) và localDatabase
            try {
                let tmpList = [];
                if (fs.existsSync(tmpUsersFile)) {
                    try { tmpList = JSON.parse(fs.readFileSync(tmpUsersFile, "utf8")); } catch {}
                }
                if (!Array.isArray(tmpList)) tmpList = [];
                const savedU = users.find(u => u.id === result.user.id) || result.user;
                const existingIdx = tmpList.findIndex(u => (u.email && savedU.email && u.email.toLowerCase() === savedU.email.toLowerCase()) || (u.id && savedU.id && u.id === savedU.id));
                if (existingIdx !== -1) tmpList[existingIdx] = savedU;
                else tmpList.push(savedU);
                fs.writeFileSync(tmpUsersFile, JSON.stringify(tmpList, null, 2), "utf8");
            } catch (e) {}

            try {
                require("./localDatabase").commit();
            } catch (e) {}

            if (isVercelRuntime) {
                try {
                    await supabaseService.savePasswordRecoveryUsersSnapshot(users);
                } catch (error) {
                    console.warn("[Server] Supabase Storage chưa sẵn sàng hoặc timeout, duy trì tài khoản trong bộ nhớ:", error.message);
                }
            } else {
                await supabaseService.syncSingleUser(
                    result.user,
                    result.temporaryPassword,
                    users
                ).catch(() => {});
            }

            if (result.user && result.user.role) {
                try {
                    syncUserRole(result.user.id, result.user.role);
                } catch (e) {
                    // ignore
                }
            }
            if (isVercelRuntime) {
                try {
                    await supabaseService.saveUserRoleAssignmentsSnapshot(
                        getAllUserRolesAssignments()
                    );
                } catch (error) {
                    console.warn("[Server] Không thể lưu vai trò tài khoản mới:", error.message);
                }
            }

            const activationEmail = sendActivationEmail({
                to: result.user.email,
                name: result.user.name,
                temporaryPassword: result.temporaryPassword,
                role: result.user.role
            });
            await activationEmail.completion;
            const emailSent = activationEmail?.status === "ACCEPTED";

            return res.status(201).json({
                success: true,
                message: `Đã tạo tài khoản '${result.user.name}'. Trạng thái email: ${activationEmail.status}. Chỉ coi đã gửi khi SMTP chấp nhận.`,
                user: result.user,
                temporaryPassword: result.temporaryPassword,
                emailSent,
                activationEmail
            });
        } catch (err) {
            if (err && (err.statusCode === 503 || err.message?.includes("Supabase Storage"))) {
                console.error("[Server] Không thể lưu tài khoản người dùng:", err.message);
                return res.status(503).json({
                    success: false,
                    message: "Chưa thể lưu tài khoản. Vui lòng thử lại sau."
                });
            }
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
            await hydrateUsersForVercel();
            const updated = updateUser(req.params.id, req.body || {});
            if (req.body && req.body.role) {
                syncUserRole(req.params.id, req.body.role);
            }

            // Đồng bộ cập nhật sang Supabase
            await supabaseService.syncSingleUser(updated, req.body ? req.body.password : null, users);
            if (isVercelRuntime) {
                await Promise.all([
                    supabaseService.savePasswordRecoveryUsersSnapshot(users),
                    supabaseService.saveUserRoleAssignmentsSnapshot(
                        getAllUserRolesAssignments()
                    )
                ]);
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
    async (req, res) => {
        try {
            await hydrateUsersForVercel();
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
            }
            removeAllUserRoles(targetId);

            // Đồng bộ xóa sang Supabase (PostgreSQL tables, Auth, Storage)
            await supabaseService.deleteSingleUser(targetId, userToDelete ? userToDelete.email : null, users);
            if (isVercelRuntime) {
                await Promise.all([
                    supabaseService.savePasswordRecoveryUsersSnapshot(users),
                    supabaseService.saveUserRoleAssignmentsSnapshot(
                        getAllUserRolesAssignments()
                    )
                ]);
            }

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

function avatarOwner(req,res,next){req.body=req.body||{};const target=req.params.id||req.body.userId||req.user.id;const admin=req.user.role==='administrator'||(req.user.roles||[]).some(r=>r.code==='administrator');if(target!==req.user.id&&!admin)return res.status(403).json({success:false,message:'Chỉ được thay ảnh của chính bạn.'});req.body.userId=target;next();}
// Cập nhật ảnh đại diện của người dùng (hỗ trợ cả /api/users/:id/avatar và /api/user/avatar)
app.post(
    ["/api/users/:id/avatar", "/api/user/avatar"],
    authenticateToken,
    avatarOwner,
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
    authenticateToken,
    avatarOwner,
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
app.get(
    "/api/students",
    authenticateToken,
    requireRole("training_manager", "administrator", "admissions", "accountant"),
    (req, res) => {
        const data = getStudentProfiles(req.query.search);
        return res.status(200).json({
            success: true,
            total: data.length,
            data
        });
    }
);

app.get(
    "/api/students/:id",
    authenticateToken,
    requireRole("training_manager", "administrator", "admissions", "accountant"),
    (req, res) => {
        const student = getStudentProfile(req.params.id);
        if (!student) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy hồ sơ học viên."
            });
        }
        return res.status(200).json({ success: true, data: student });
    }
);

app.put(
    "/api/students/:id",
    authenticateToken,
    requireRole("training_manager", "administrator"),
    async (req, res) => {
        try {
            const profile = updateStudentProfile(req.params.id, req.body || {});
            const studentUser = users.find(user => user.id === profile.id);
            await supabaseService.syncSingleUser(studentUser, null, users);
            return res.status(200).json({
                success: true,
                message: "Đã cập nhật hồ sơ học viên.",
                data: profile
            });
        } catch (err) {
            return res.status(err.status || 500).json({
                success: false,
                message: err.message || "Không thể cập nhật hồ sơ học viên."
            });
        }
    }
);

// ========================================================
// QUẢN LÝ LỚP HỌC & GHI DANH HÀNG LOẠT (BATCH ENROLLMENT)
// 1. Chọn nhiều học viên để ghi danh cùng lúc
// 2. Chặn ghi danh khi lớp đã đủ sĩ số hoặc học viên đã ở trong lớp
// 3. Ghi nhận ngày ghi danh và người thực hiện
// ========================================================

// API Lấy danh sách toàn bộ lớp học kèm sĩ số động, tiến độ buổi học và bộ lọc (KN-127)
app.get(
    "/api/classes",
    authenticateToken,
    (req, res) => {
        const raw = getAllClasses(req.query);
        const filtered = raw.filter(cls => require("./businessRoutes").canSeeClass(req.user, cls.id));
        return res.status(200).json({
            success: true,
            total: filtered.length,
            totalRecords: raw.totalRecords || filtered.length,
            page: raw.page || 1,
            limit: raw.limit || filtered.length,
            totalPages: raw.totalPages || 1,
            data: filtered,
            classes: filtered,
            metrics: raw.metrics || getClassMetrics()
        });
    }
);

// API Lấy các chỉ số thống kê nhanh toàn hệ thống (Quick Metrics - KN-224)
app.get(
    "/api/classes/metrics",
    authenticateToken,
    (req, res) => {
        return res.status(200).json({
            success: true,
            metrics: getClassMetrics()
        });
    }
);

// API Lấy danh mục dữ liệu cho các bộ lọc (KN-220)
app.get(
    "/api/classes/filter-options",
    authenticateToken,
    (req, res) => {
        return res.status(200).json({
            success: true,
            data: getClassFilterOptions()
        });
    }
);

// API Lấy chi tiết lớp học và danh sách học viên trong lớp
app.get(
    "/api/classes/:id",
    authenticateToken,
    (req, res) => {
        if(!require('./businessRoutes').canSeeClass(req.user,req.params.id))return res.status(403).json({success:false,message:'Bạn không thuộc lớp này.'});
        const cls = getClassDetail(req.params.id);
        if (!cls) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy thông tin lớp học."
            });
        }
        return res.status(200).json({
            success: true,
            data: cls
        });
    }
);


/* ========================================================
   KN-128: PHAN CONG GIANG VIEN VA TRO GIANG
   ======================================================== */

// Chi Quan ly dao tao hoac Quan tri vien duoc phan cong
function requireTeachingAssignmentManager(req, res, next) {
    const userId = req.user?.id;

    if (
        !userId ||
        (
            !userHasRole(userId, "training_manager") &&
            !userHasRole(userId, "administrator")
        )
    ) {
        return res.status(403).json({
            success: false,
            message: "Ban khong co quyen phan cong giang vien."
        });
    }

    next();
}

// Lay danh sach giang vien hoac tro giang theo vai tro
app.get(
    "/api/teaching-assignments/eligible-staff",
    authenticateToken,
    requireTeachingAssignmentManager,
    (req, res) => {
        try {
            const staff = getEligibleStaff(req.query.role);

            return res.status(200).json({
                success: true,
                total: staff.length,
                data: staff
            });
        } catch (error) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }
);

// Giang vien xem danh sach lop minh duoc phan cong
app.get(
    "/api/teaching-assignments/my-classes",
    authenticateToken,
    (req, res) => {
        if (!userHasRole(req.user.id, "instructor")) {
            return res.status(403).json({
                success: false,
                message: "Chi giang vien duoc xem danh sach nay."
            });
        }

        const classes = getInstructorClasses(req.user.id);

        return res.status(200).json({
            success: true,
            total: classes.length,
            data: classes
        });
    }
);

// Xem phan cong cua mot mon trong mot lop
app.get(
    "/api/teaching-assignments/:classId/:subjectId",
    authenticateToken,
    requireTeachingAssignmentManager,
    async (req, res) => {
        const { classId, subjectId } = req.params;
        const assignment = getTeachingAssignment(classId, subjectId);

        if (!assignment) {
            return res.status(404).json({
                success: false,
                message: "Chua co phan cong cho lop va mon nay."
            });
        }

        return res.status(200).json({
            success: true,
            data: assignment
        });
    }
);

// Tao hoac cap nhat phan cong giang day
app.put(
    "/api/teaching-assignments/:classId/:subjectId",
    authenticateToken,
    requireTeachingAssignmentManager,
    async (req, res) => {
        try {
            const { classId, subjectId } = req.params;
            const { instructorId, assistantIds } = req.body || {};

            const assignment = await saveTeachingAssignment({
                classId,
                subjectId,
                instructorId,
                assistantIds
            });

            return res.status(200).json({
                success: true,
                message: "Phan cong giang day thanh cong.",
                data: assignment
            });
        } catch (error) {
            return res.status(error.statusCode || 400).json({
                success: false,
                message: error.message
            });
        }
    }
);


// Handler xử lý ghi danh (đơn lẻ hoặc hàng loạt)
const handleEnrollment = async (req, res) => {
    try {
        const classId = req.params.classId || req.body.classId;
        const studentIds = req.body.studentIds || (req.body.studentId ? [req.body.studentId] : []);
        const { notes } = req.body || {};

        const result = batchEnrollStudents({
            classId,
            studentIds,
            performer: req.user,
            notes
        });

        // Đồng bộ dữ liệu sang Supabase nếu có
        try {
            await supabaseService.syncUsersDatabase(users);
        } catch (_) {}

        return res.status(201).json(result);
    } catch (err) {
        return res.status(err.statusCode || 400).json({
            success: false,
            code: err.code || "ENROLLMENT_ERROR",
            message: err.message || "Không thể thực hiện ghi danh.",
            details: err.details || null
        });
    }
};

// API Ghi danh học viên (hỗ trợ nhiều học viên cùng lúc)
app.post(
    "/api/enrollments",
    authenticateToken,
    requireRole("administrator", "training_manager", "admissions"),
    handleEnrollment
);

// Alias: POST /api/classes/:classId/enrollments
app.post(
    "/api/classes/:classId/enrollments",
    authenticateToken,
    requireRole("administrator", "training_manager", "admissions"),
    handleEnrollment
);

// API Lấy lịch sử và danh sách bản ghi ghi danh
app.get(
    "/api/enrollments",
    authenticateToken,
    requireRole("administrator", "training_manager", "admissions", "accountant"),
    (req, res) => {
        const { classId, studentId, search } = req.query;
        const list = getEnrollmentsList({ classId, studentId, search });
        return res.status(200).json({
            success: true,
            total: list.length,
            data: list
        });
    }
);

// API Hủy ghi danh / Xóa học viên khỏi lớp học (giải phóng sĩ số)
app.delete(
    "/api/classes/:classId/students/:studentId",
    authenticateToken,
    requireRole("administrator", "training_manager"),
    (req, res) => {
        try {
            const result = unenrollStudent({
                classId: req.params.classId,
                studentId: req.params.studentId,
                performer: req.user
            });
            return res.status(200).json(result);
        } catch (err) {
            return res.status(err.statusCode || 400).json({
                success: false,
                message: err.message || "Không thể hủy ghi danh học viên."
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

// API Tạo Lead thủ công từ giao diện nội bộ
app.post("/api/leads/manage",
    authenticateToken,
    requireRole("admissions", "training_manager", "administrator"),
    (req, res) => {
        const leadData = req.body || {};
        if (typeof leadData.source !== "string" || !leadData.source.trim() || leadData.source.trim().length > 100) {
            return res.status(400).json({
                success: false,
                code: "INVALID_SOURCE",
                message: "Nguồn lead là bắt buộc và không được vượt quá 100 ký tự."
            });
        }

        const result = createLead({ ...leadData, bypassSpamCheck: true }, {
            ip: req.headers["x-forwarded-for"] || req.socket.remoteAddress || "127.0.0.1"
        });
        if (!result.success) return res.status(400).json(result);

        supabaseService.syncLeadsDatabase(leads).catch(() => {});
        return res.status(201).json(result);
    }
);

// API Cảnh báo lead trùng số điện thoại trước khi tạo hoặc cập nhật
app.get("/api/leads/check-phone",
    authenticateToken,
    requireRole("admissions", "training_manager", "administrator"),
    (req, res) => {
        const phone = typeof req.query.phone === "string" ? req.query.phone.trim() : "";
        if (!phone) {
            return res.status(400).json({
                success: false,
                code: "MISSING_PHONE",
                message: "Vui lòng cung cấp số điện thoại cần kiểm tra."
            });
        }

        const duplicates = findDuplicateLeadPhones(phone, String(req.query.excludeId || ""));
        return res.status(200).json({
            success: true,
            duplicate: duplicates.length > 0,
            duplicates: duplicates.map(lead => ({
                id: lead.id,
                code: lead.code,
                fullName: lead.fullName || lead.name,
                phone: lead.phone
            }))
        });
    }
);

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

// API Lấy danh mục các nguồn Lead (Quyền: Tư vấn tuyển sinh, Quản lý đào tạo hoặc Quản trị viên)
app.get("/api/leads/sources",
    authenticateToken,
    requireRole("admissions", "training_manager", "administrator"),
    (req, res) => {
        const sources = getLeadSources();
        return res.status(200).json({
            success: true,
            data: sources
        });
    }
);

// API Lấy danh sách Tư vấn viên phụ trách Lead (Quyền: Tư vấn tuyển sinh, Quản lý đào tạo hoặc Quản trị viên)
app.get("/api/leads/counselors",
    authenticateToken,
    requireRole("admissions", "training_manager", "administrator"),
    (req, res) => {
        const counselors = getCounselors();
        return res.status(200).json({
            success: true,
            data: counselors
        });
    }
);

// KN-122: API Thống kê lịch nhắc gọi lại (Quá hạn, hôm nay, tuần sau)
app.get("/api/leads/reminders/summary",
    authenticateToken,
    requireRole("admissions", "training_manager", "administrator"),
    (req, res) => {
        const counselorId = req.query.counselorId || (req.user && req.user.role === "admissions" ? req.user.id : null);
        const stats = getReminderStats(counselorId);
        return res.status(200).json(stats);
    }
);

// KN-76 & KN-122: API Lấy danh sách Lead có phân trang, lọc đa điều kiện và tìm nhanh
app.get("/api/leads",
    authenticateToken,
    requireRole("admissions", "training_manager", "administrator"),
    (req, res) => {
        const {
            page,
            limit,
            status,
            course,
            source,
            assignedTo,
            search,
            startDate,
            endDate,
            timePreset,
            sortBy,
            sortOrder,
            callbackFilter,
            interactionType
        } = req.query;

        const result = getLeads({
            page,
            limit,
            status,
            course,
            source,
            assignedTo,
            search,
            startDate,
            endDate,
            timePreset,
            sortBy,
            sortOrder,
            callbackFilter,
            interactionType
        });
        return res.status(200).json(result);
    }
);

// KN-76: API Lấy chi tiết lịch sử các cuộc trao đổi của Lead
app.get("/api/leads/:id/consultations",
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
            lead: {
                id: lead.id,
                code: lead.code,
                fullName: lead.fullName || lead.name,
                phone: lead.phone,
                email: lead.email,
                course: lead.course,
                status: lead.status,
                source: lead.source,
                assignedTo: lead.assignedTo,
                assignedToName: lead.assignedToName,
                createdAt: lead.createdAt,
                lastContactedAt: lead.lastContactedAt,
                counselorNotes: lead.counselorNotes
            },
            data: lead.consultationHistory || []
        });
    }
);

// KN-76: API Ghi nhận cuộc trao đổi mới cho Lead khi khách gọi lại
app.post("/api/leads/:id/consultations",
    authenticateToken,
    requireRole("admissions", "training_manager", "administrator"),
    (req, res) => {
        const { channel, result: callResult, notes, nextFollowUp, newStatus } = req.body || {};
        const result = addConsultation(req.params.id, {
            channel,
            result: callResult,
            notes,
            nextFollowUp,
            newStatus
        }, req.user || {});

        if (!result.success) {
            return res.status(400).json(result);
        }

        supabaseService.syncLeadsDatabase(leads).catch(() => {});
        return res.status(201).json(result);
    }
);

// KN-122: API Ghi nhận nhật ký chăm sóc (gọi điện, nhắn tin, gặp trực tiếp) và đặt lịch nhắc gọi lại
app.post(["/api/leads/:id/care-logs", "/api/leads/:id/interactions"],
    authenticateToken,
    requireRole("admissions", "training_manager", "administrator"),
    (req, res) => {
        const result = addCareLog(req.params.id, req.body || {}, req.user || {});
        if (!result.success) {
            return res.status(400).json(result);
        }

        supabaseService.syncLeadsDatabase(leads).catch(() => {});
        return res.status(201).json(result);
    }
);

// KN-122: API Lấy danh sách nhật ký chăm sóc của Lead
app.get("/api/leads/:id/care-logs",
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
        const logs = getCareLogs(req.params.id);
        return res.status(200).json({
            success: true,
            lead: {
                id: lead.id,
                code: lead.code,
                fullName: lead.fullName || lead.name,
                phone: lead.phone,
                email: lead.email,
                course: lead.course,
                status: lead.status,
                nextCallbackDate: lead.nextCallbackDate,
                callbackNote: lead.callbackNote,
                callbackStatus: lead.callbackStatus,
                isOverdue: lead.isOverdue,
                overdueDays: lead.overdueDays,
                callbackUrgency: lead.callbackUrgency
            },
            data: logs
        });
    }
);

// KN-122: API Hoàn thành lịch nhắc gọi lại cho Lead
app.all(["/api/leads/:id/callbacks/complete"],
    authenticateToken,
    requireRole("admissions", "training_manager", "administrator"),
    (req, res) => {
        const result = completeCallback(req.params.id, req.body || {}, req.user || {});
        if (!result.success) {
            return res.status(400).json(result);
        }

        supabaseService.syncLeadsDatabase(leads).catch(() => {});
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

// API Cập nhật thông tin liên hệ và chương trình quan tâm của Lead
app.put("/api/leads/:id",
    authenticateToken,
    requireRole("admissions", "training_manager", "administrator"),
    (req, res) => {
        const result = updateLead(req.params.id, req.body || {});
        if (!result.success) {
            const status = result.code === "LEAD_NOT_FOUND" ? 404 : 400;
            return res.status(status).json(result);
        }

        supabaseService.syncLeadsDatabase(leads).catch(() => {});
        return res.status(200).json(result);
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

// API Xóa Lead (Chỉ Quản lý đào tạo)
app.delete("/api/leads/:id",
    authenticateToken,
    requireRole("training_manager"),
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
app.post('/api/supabase/sync',authenticateToken,requireRole('administrator', 'technical_manager'),async(req,res)=>{
    if(process.env.TMS_OFFLINE==='true'||!process.env.SUPABASE_URL||!process.env.SUPABASE_SECRET_KEY)return res.status(503).json({success:false,message:'Chưa cấu hình chế độ tích hợp Supabase. Dữ liệu cục bộ vẫn được lưu.'});
    const state=require('./localDatabase').snapshot();const ok=await supabaseService.saveToStorage('tms-canonical-backup.json',state);
    return res.status(ok?200:502).json({success:!!ok,message:ok?'Đã sao lưu snapshot lên Supabase Storage. Đây không phải đồng bộ các bảng quan hệ.':'Supabase không xác nhận lưu bản sao; không báo đồng bộ thành công.'});
});

// Health check endpoint
app.get("/api/health", async (req, res) => {
    const smtpCheck = await verifySmtp();
    res.json({
        status: "ok",
        supabase: {
            configured: Boolean(supabaseService.SUPABASE_URL && supabaseService.SUPABASE_SECRET_KEY),
            url: supabaseService.SUPABASE_URL
        },
        smtp: {
            enabled: SMTP_CONFIG.enabled,
            configured: SMTP_CONFIG.configured,
            host: SMTP_CONFIG.host,
            port: SMTP_CONFIG.port,
            user: SMTP_CONFIG.user,
            from: SMTP_CONFIG.fromEmail,
            fromName: SMTP_CONFIG.fromName,
            connected: smtpCheck.success,
            error: smtpCheck.error || null
        },
        timestamp: new Date().toISOString()
    });
});

// KN-11 & KN-86: API Kiểm tra trạng thái SMTP và cấu hình máy chủ (Quản trị viên & Kỹ thuật Mail)
app.get("/api/admin/smtp/status",
    authenticateToken,
    requireRole("administrator", "technical_manager"),
    async (req, res) => {
        const smtpStatus = await verifySmtp();
        const summary = typeof getSmtpConfigSummary === "function" ? getSmtpConfigSummary() : {
            enabled: SMTP_CONFIG.enabled,
            configured: SMTP_CONFIG.configured,
            host: SMTP_CONFIG.host,
            port: SMTP_CONFIG.port,
            user: SMTP_CONFIG.user,
            hasPassword: Boolean(SMTP_CONFIG.pass),
            fromEmail: SMTP_CONFIG.fromEmail,
            fromName: SMTP_CONFIG.fromName,
            secure: SMTP_CONFIG.secure,
            tls: SMTP_CONFIG.tls
        };
        return res.status(200).json({
            success: true,
            smtp: {
                ...summary,
                connected: smtpStatus.success,
                error: smtpStatus.error || SMTP_CONFIG.configError || null,
                totalSentEmails: sentEmails.length
            }
        });
    }
);

app.post("/api/admin/smtp/config",
    authenticateToken,
    requireRole("administrator", "technical_manager"),
    async (req, res) => {
        try {
            const body = req.body || {};
            const updated = updateSmtpConfig(body);
            const smtpStatus = await verifySmtp();
            return res.status(200).json({
                success: true,
                message: "Đã lưu và áp dụng cấu hình máy chủ SMTP thành công.",
                smtp: {
                    ...updated,
                    connected: smtpStatus.success,
                    error: smtpStatus.error || null
                }
            });
        } catch (err) {
            return res.status(500).json({
                success: false,
                message: "Lỗi lưu cấu hình SMTP: " + err.message
            });
        }
    }
);

app.post("/api/admin/smtp/test",
    authenticateToken,
    requireRole("administrator", "technical_manager"),
    async (req, res) => {
        const targetEmail = (req.body && req.body.to) ? req.body.to : (req.user ? req.user.email : SMTP_CONFIG.user);
        try {
            const emailResult = sendActivationEmail({
                to: targetEmail,
                name: req.body?.name || "Quản trị viên Thử nghiệm",
                temporaryPassword: "TMS@" + Math.random().toString(36).substring(2, 8),
                role: "administrator"
            });
            await emailResult.completion;
            const accepted=emailResult.status==='ACCEPTED';
            return res.status(accepted?200:503).json({success:accepted,message:accepted?'Máy chủ SMTP đã chấp nhận thư. Cần kiểm tra inbox để xác nhận nhận thư.':'Chưa gửi được email. Kiểm tra cấu hình SMTP.',emailRecord:emailResult});
        } catch (err) {
            return res.status(500).json({
                success: false,
                message: "Gửi email thử nghiệm thất bại: " + err.message
            });
        }
    }
);

// -------------------------------------------------------------
// KN-70: QUẢN LÝ DANH MỤC MÔN HỌC & CHƯƠNG TRÌNH ĐÀO TẠO
// Quyền: Quản lý đào tạo (training_manager) & Quản trị hệ thống (administrator)
// Tiêu chí:
// - Khai báo mã, tên, số buổi, trọng số, chuẩn đầu ra
// - Một môn dùng lại cho nhiều chương trình (N-N)
// - Môn đã có lớp học thì không xóa được (classCount > 0)
// -------------------------------------------------------------

// API Lấy danh mục chương trình đào tạo
app.get("/api/programs", (req, res) => {
    try {
        const programList = getAllPrograms();
        return res.status(200).json({
            success: true,
            total: programList.length,
            programs: programList
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Lỗi khi lấy danh mục chương trình: " + err.message
        });
    }
});

// API Lấy chi tiết chương trình đào tạo kèm danh sách môn học
app.get("/api/programs/:id", (req, res) => {
    try {
        const program = getProgramById(req.params.id);
        if (!program) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy chương trình đào tạo yêu cầu."
            });
        }
        return res.status(200).json({
            success: true,
            program
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Lỗi khi lấy chi tiết chương trình: " + err.message
        });
    }
});

// API Tra cứu danh sách môn học (hỗ trợ search, filter programId, pagination)
app.get("/api/subjects", (req, res) => {
    try {
        const { search, programId, page, limit } = req.query;
        const result = getSubjects({ search, programId, page, limit });
        return res.status(200).json({
            success: true,
            ...result
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Lỗi khi tra cứu danh mục môn học: " + err.message
        });
    }
});

// API Lấy chi tiết môn học theo ID
app.get("/api/subjects/:id", (req, res) => {
    try {
        const subject = getSubjectById(req.params.id);
        if (!subject) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy thông tin môn học."
            });
        }
        return res.status(200).json({
            success: true,
            subject
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Lỗi khi lấy chi tiết môn học: " + err.message
        });
    }
});

// API Lấy danh sách lớp học của môn học
app.get("/api/subjects/:id/classes", (req, res) => {
    try {
        const classList = getClassesBySubjectId(req.params.id);
        return res.status(200).json({
            success: true,
            total: classList.length,
            classes: classList
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Lỗi khi lấy danh sách lớp học: " + err.message
        });
    }
});

// API Tạo môn học mới (Chỉ Quản lý đào tạo & Admin)
app.post("/api/subjects",
    authenticateToken,
    requireRole("training_manager", "administrator"),
    (req, res) => {
        try {
            const { code, name, sessions, weight, outcomes, programIds } = req.body || {};
            const newSubject = createSubject(
                { code, name, sessions, weight, outcomes, programIds },
                req.user ? req.user.id : "training_manager"
            );

            // Ghi Audit Log cho hành động thêm môn học
            recordAuditLog({
                adminId: req.user ? req.user.id : "system",
                targetUserId: null,
                action: "CREATE_SUBJECT",
                roleId: null,
                status: "SUCCESS",
                reason: `Tạo mới môn học ${newSubject.name} [${newSubject.code}] thành công.`
            });

            return res.status(201).json({
                success: true,
                message: `Tạo mới môn học "${newSubject.name}" [${newSubject.code}] thành công!`,
                subject: newSubject
            });
        } catch (err) {
            return res.status(err.statusCode || 400).json({
                success: false,
                code: err.code || "CREATE_SUBJECT_FAILED",
                field: err.field,
                message: err.message
            });
        }
    }
);

// API Cập nhật môn học (Chỉ Quản lý đào tạo & Admin)
app.put("/api/subjects/:id",
    authenticateToken,
    requireRole("training_manager", "administrator"),
    (req, res) => {
        try {
            const { code, name, sessions, weight, outcomes, programIds } = req.body || {};
            const updatedSubject = updateSubject(
                req.params.id,
                { code, name, sessions, weight, outcomes, programIds },
                req.user ? req.user.id : "training_manager"
            );

            recordAuditLog({
                adminId: req.user ? req.user.id : "system",
                targetUserId: null,
                action: "UPDATE_SUBJECT",
                roleId: null,
                status: "SUCCESS",
                reason: `Cập nhật thông tin môn học ${updatedSubject.name} [${updatedSubject.code}].`
            });

            return res.status(200).json({
                success: true,
                message: `Cập nhật môn học "${updatedSubject.name}" thành công!`,
                subject: updatedSubject
            });
        } catch (err) {
            return res.status(err.statusCode || 400).json({
                success: false,
                code: err.code || "UPDATE_SUBJECT_FAILED",
                field: err.field,
                message: err.message
            });
        }
    }
);

// API Xóa môn học (Chỉ Quản lý đào tạo & Admin - Ràng buộc: Môn đã có lớp học thì KHÔNG xoá được)
app.delete("/api/subjects/:id",
    authenticateToken,
    requireRole("training_manager", "administrator"),
    (req, res) => {
        try {
            const result = deleteSubject(req.params.id);

            recordAuditLog({
                adminId: req.user ? req.user.id : "system",
                targetUserId: null,
                action: "DELETE_SUBJECT",
                roleId: null,
                status: "SUCCESS",
                reason: `Đã xóa môn học ${result.deletedSubject.name} [${result.deletedSubject.code}].`
            });

            return res.status(200).json(result);
        } catch (err) {
            // Trường hợp bị chặn do đã có lớp học
            if (err.code === "CANNOT_DELETE_SUBJECT_HAS_CLASSES") {
                recordAuditLog({
                    adminId: req.user ? req.user.id : "system",
                    targetUserId: null,
                    action: "DELETE_SUBJECT",
                    roleId: null,
                    status: "FORBIDDEN",
                    reason: `Bị chặn xóa môn học do có ${err.classes ? err.classes.length : 0} lớp học đang liên kết.`
                });
            }

            return res.status(err.statusCode || 400).json({
                success: false,
                code: err.code || "DELETE_SUBJECT_FAILED",
                message: err.message,
                classes: err.classes || []
            });
        }
    }
);

// =============================================================
// KN-71: GẮN MÔN VÀO CHƯƠNG TRÌNH, SẮP THỨ TỰ LỘ TRÌNH & MÔN TIÊN QUYẾT
// "Là Quản lý đào tạo, tôi muốn gắn môn học vào chương trình và
// sắp thứ tự học, để học viên học đúng lộ trình, không học môn
// nâng cao trước môn nền tảng."
// =============================================================

// API Lấy danh sách môn học của chương trình theo thứ tự lộ trình kèm môn tiên quyết
app.get("/api/programs/:programId/subjects", (req, res) => {
    try {
        const program = getProgramById(req.params.programId);
        if (!program) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy chương trình đào tạo yêu cầu."
            });
        }
        return res.status(200).json({
            success: true,
            programId: program.id,
            programName: program.name,
            totalSubjects: program.subjects.length,
            subjects: program.subjects
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Lỗi khi lấy danh sách môn học trong lộ trình: " + err.message
        });
    }
});

// API Gán môn học vào chương trình đào tạo (KN-70 & KN-71)
app.post("/api/programs/:programId/subjects",
    authenticateToken,
    requireRole("training_manager", "administrator"),
    (req, res) => {
        try {
            const { subjectId, orderIndex, prerequisiteSubjectId } = req.body || {};
            if (!subjectId) {
                return res.status(400).json({
                    success: false,
                    message: "Vui lòng cung cấp mã định danh môn học (subjectId)."
                });
            }
            const updatedSubject = addSubjectToProgram(req.params.programId, subjectId, {
                orderIndex: orderIndex ? parseInt(orderIndex, 10) : undefined,
                prerequisiteSubjectId
            });

            const program = getProgramById(req.params.programId);

            recordAuditLog({
                adminId: req.user ? req.user.id : "system",
                targetUserId: null,
                action: "ASSIGN_SUBJECT_TO_PROGRAM",
                roleId: null,
                status: "SUCCESS",
                reason: `Gán môn học ${updatedSubject.name} vào chương trình ${program ? program.name : req.params.programId}.`
            });

            return res.status(200).json({
                success: true,
                message: "Đã gán môn học vào chương trình đào tạo thành công!",
                subject: updatedSubject,
                program
            });
        } catch (err) {
            return res.status(err.statusCode || 400).json({
                success: false,
                code: err.code || "ASSIGN_SUBJECT_FAILED",
                message: err.message
            });
        }
    }
);

// API Gỡ môn học khỏi chương trình đào tạo (KN-70 & KN-71)
// Chặn nếu có môn khác đang nhận môn này làm tiên quyết
app.delete("/api/programs/:programId/subjects/:subjectId",
    authenticateToken,
    requireRole("training_manager", "administrator"),
    (req, res) => {
        try {
            const updatedSubject = removeSubjectFromProgram(req.params.programId, req.params.subjectId);
            const program = getProgramById(req.params.programId);

            recordAuditLog({
                adminId: req.user ? req.user.id : "system",
                targetUserId: null,
                action: "REMOVE_SUBJECT_FROM_PROGRAM",
                roleId: null,
                status: "SUCCESS",
                reason: `Đã gỡ môn học ${updatedSubject.name} khỏi chương trình ${program ? program.name : req.params.programId}.`
            });

            return res.status(200).json({
                success: true,
                message: "Đã gỡ môn học khỏi chương trình đào tạo.",
                subject: updatedSubject,
                program
            });
        } catch (err) {
            return res.status(err.statusCode || 400).json({
                success: false,
                code: err.code || "REMOVE_SUBJECT_FAILED",
                message: err.message,
                dependentSubjects: err.dependentSubjects || []
            });
        }
    }
);

// API Khai báo / Cập nhật môn tiên quyết cho môn học trong chương trình (KN-71)
app.put("/api/programs/:programId/subjects/:subjectId/prerequisite",
    authenticateToken,
    requireRole("training_manager", "administrator"),
    (req, res) => {
        try {
            const { prerequisiteSubjectId } = req.body || {};
            const updatedProgram = setPrerequisiteSubject(
                req.params.programId,
                req.params.subjectId,
                prerequisiteSubjectId
            );

            recordAuditLog({
                adminId: req.user ? req.user.id : "system",
                targetUserId: null,
                action: "UPDATE_PREREQUISITE_SUBJECT",
                roleId: null,
                status: "SUCCESS",
                reason: `Cập nhật môn tiên quyết cho môn ${req.params.subjectId} trong chương trình ${req.params.programId}.`
            });

            return res.status(200).json({
                success: true,
                message: prerequisiteSubjectId
                    ? "Cập nhật môn tiên quyết thành công!"
                    : "Đã gỡ bỏ ràng buộc môn tiên quyết thành công!",
                program: updatedProgram
            });
        } catch (err) {
            return res.status(err.statusCode || 400).json({
                success: false,
                code: err.code || "UPDATE_PREREQUISITE_FAILED",
                message: err.message
            });
        }
    }
);

// API Sắp xếp lại thứ tự học các môn (Kéo thả reorder - KN-71)
// Bắt buộc kiểm tra: Môn nâng cao không được học trước môn nền tảng (môn tiên quyết)
app.put("/api/programs/:programId/subjects/reorder",
    authenticateToken,
    requireRole("training_manager", "administrator"),
    (req, res) => {
        try {
            const { orders, subjectIds } = req.body || {};
            const orderList = orders || subjectIds;
            if (!orderList || !Array.isArray(orderList)) {
                return res.status(400).json({
                    success: false,
                    message: "Vui lòng cung cấp danh sách thứ tự môn học hợp lệ (orders hoặc subjectIds)."
                });
            }

            const updatedProgram = reorderProgramSubjects(req.params.programId, orderList);

            recordAuditLog({
                adminId: req.user ? req.user.id : "system",
                targetUserId: null,
                action: "REORDER_PROGRAM_SUBJECTS",
                roleId: null,
                status: "SUCCESS",
                reason: `Sắp xếp lại thứ tự lộ trình môn học cho chương trình ${req.params.programId}.`
            });

            return res.status(200).json({
                success: true,
                message: "Cập nhật và lưu thứ tự lộ trình học tập thành công!",
                program: updatedProgram
            });
        } catch (err) {
            return res.status(err.statusCode || 400).json({
                success: false,
                code: err.code || "REORDER_SUBJECTS_FAILED",
                violatingSubjectId: err.violatingSubjectId,
                prerequisiteSubjectId: err.prerequisiteSubjectId,
                message: err.message
            });
        }
    }
);

// -------------------------------------------------------------
// KN-154: SINH THỜI KHÓA BIỂU TỰ ĐỘNG THEO MẪU LẶP
// Quyền: Quản lý đào tạo (training_manager) & Quản trị hệ thống (administrator)
// Người thực hiện: Minh Quân (Sprint 4)
// Subtasks: KN-159 -> KN-167
// -------------------------------------------------------------

require("./sessionRoutes")(app, { authenticateToken, requireRole });
require("./businessRoutes")(app, { authenticateToken, requireRole });

// API Lấy danh sách lớp học kèm trạng thái thời khóa biểu
app.get("/api/schedules/classes", authenticateToken, (req, res) => {
    try {
        const list = getClassesWithScheduleStatus().filter(cls=>require("./businessRoutes").canSeeClass(req.user,cls.id));
        return res.status(200).json({
            success: true,
            total: list.length,
            classes: list
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Lỗi khi lấy danh sách lớp học: " + err.message
        });
    }
});

// API Thêm lớp học mới để chuẩn bị xếp thời khóa biểu
app.post("/api/schedules/classes",
    authenticateToken,
    requireRole("training_manager", "administrator"),
    (req, res) => {
        try {
            const newClass = createClass(req.body || {});
            return res.status(201).json({
                success: true,
                message: "Tạo lớp học mới thành công!",
                class: newClass
            });
        } catch (err) {
            return res.status(400).json({
                success: false,
                message: err.message
            });
        }
    }
);

// KN-161 & KN-160 & KN-167: API Sinh thời khóa biểu tự động (Preview)
app.post("/api/schedules/generate",
    authenticateToken,
    requireRole("training_manager", "administrator"),
    (req, res) => {
        try {
            const result = generateSchedulePreview(req.body || {});
            return res.status(200).json(result);
        } catch (err) {
            return res.status(400).json({
                success: false,
                code: "GENERATE_SCHEDULE_FAILED",
                message: err.message
            });
        }
    }
);

// KN-165: API Lưu chính thức thời khóa biểu đã sinh
app.post("/api/schedules/save",
    authenticateToken,
    requireRole("training_manager", "administrator"),
    (req, res) => {
        try {
            const { classId, sessions, overrideConflicts } = req.body || {};
            const result = saveClassSchedule(classId, sessions, req.user, { overrideConflicts: overrideConflicts === true });
            return res.status(200).json(result);
        } catch (err) {
            return res.status(err.status || 400).json({
                success: false,
                code: err.code || "SCHEDULE_ERROR",
                message: err.status >= 500 ? "Không thể lưu dữ liệu. Thao tác chưa được áp dụng." : err.message,
                details: err.details
            });
        }
    }
);

// API Lấy danh sách lịch học hệ thống theo bộ lọc
app.get("/api/schedules", authenticateToken, (req, res) => {
    try {
        const sessions = getSchedules(req.query || {}).filter(item=>require("./businessRoutes").canSeeSession(req.user,item));
        return res.status(200).json({
            success: true,
            total: sessions.length,
            sessions: sessions
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Lỗi khi tra cứu thời khóa biểu: " + err.message
        });
    }
});

/**
 * KN-254: API lấy buổi học sắp diễn ra gần nhất.
 * Chỉ trả về buổi học mà tài khoản được phép xem.
 */
app.get("/api/schedules/next", authenticateToken, (req, res) => {
    try {
        // Lấy ngày, giờ hiện tại theo múi giờ Việt Nam.
        const parts = Object.fromEntries(
            new Intl.DateTimeFormat("en-GB", {
                timeZone: "Asia/Ho_Chi_Minh",
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
                hourCycle: "h23"
            })
                .formatToParts(new Date())
                .filter(part => part.type !== "literal")
                .map(part => [part.type, part.value])
        );

        const now = `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;

        const sessions = getSchedules({})
            .filter(session =>
                require("./businessRoutes").canSeeSession(req.user, session)
            )
            .filter(session =>
                typeof session.date === "string" &&
                typeof session.startTime === "string" &&
                `${session.date}T${session.startTime}` > now
            )
            .sort((a, b) =>
                `${a.date}T${a.startTime}`.localeCompare(
                    `${b.date}T${b.startTime}`
                )
            );

        return res.status(200).json({
            success: true,
            session: sessions[0] || null
        });
    } catch (err) {
        console.error("KN-254 next schedule error:", err);

        return res.status(500).json({
            success: false,
            message: "Không thể lấy buổi học kế tiếp."
        });
    }
});

/**
 * KN-253: API xem lich hoc ca nhan trong tuan hien tai.
 * Tuan tinh tu Thu Hai den Chu Nhat, theo gio Viet Nam.
 */
app.get(
    "/api/schedules/my-week",
    authenticateToken,
    requireRole("student"),
    (req, res) => {
        try {
            const parts = Object.fromEntries(
                new Intl.DateTimeFormat("en-GB", {
                    timeZone: "Asia/Ho_Chi_Minh",
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit"
                })
                    .formatToParts(new Date())
                    .filter(part => part.type !== "literal")
                    .map(part => [part.type, part.value])
            );

            const today = new Date(Date.UTC(
                Number(parts.year),
                Number(parts.month) - 1,
                Number(parts.day)
            ));

            const dayOffset = (today.getUTCDay() + 6) % 7;

            const monday = new Date(today);
            monday.setUTCDate(today.getUTCDate() - dayOffset);

            const sunday = new Date(monday);
            sunday.setUTCDate(monday.getUTCDate() + 6);

            const startDate = monday.toISOString().slice(0, 10);
            const endDate = sunday.toISOString().slice(0, 10);

            const { canSeeSession } = require("./businessRoutes");

            const sessions = getSchedules({ startDate, endDate })
                .filter(session => canSeeSession(req.user, session));

            return res.status(200).json({
                success: true,
                startDate,
                endDate,
                total: sessions.length,
                sessions
            });
        } catch (err) {
            console.error("KN-253 weekly schedule error:", err);

            return res.status(500).json({
                success: false,
                message: "Không thể lấy lịch học tuần hiện tại."
            });
        }
    }
);

// API Lấy thời khóa biểu chi tiết của một lớp học
app.get("/api/schedules/:classId", authenticateToken, (req, res) => {
    try {
        const sessions = getClassSchedule(req.params.classId).filter(item=>require("./businessRoutes").canSeeSession(req.user,item));
        return res.status(200).json({
            success: true,
            classId: req.params.classId,
            total: sessions.length,
            sessions: sessions
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Lỗi khi lấy lịch học của lớp: " + err.message
        });
    }
});

// KN-163: API Cập nhật một buổi học cụ thể trong thời khóa biểu
app.put("/api/schedules/session/:sessionId",
    authenticateToken,
    requireRole("training_manager", "administrator"),
    (req, res) => {
        try {
            const result = updateSession(req.params.sessionId, req.body || {}, req.user);
            return res.status(200).json(result);
        } catch (err) {
            return res.status(err.status || 400).json({
                success: false,
                code: err.code || "SCHEDULE_ERROR",
                message: err.status >= 500 ? "Không thể lưu dữ liệu. Thao tác chưa được áp dụng." : err.message,
                details: err.details
            });
        }
    }
);

// KN-163: API Xóa một buổi học khỏi thời khóa biểu
app.delete("/api/schedules/session/:sessionId",
    authenticateToken,
    requireRole("training_manager", "administrator"),
    (req, res) => {
        try {
            const result = deleteSession(req.params.sessionId, req.user, req.body || {});
            return res.status(200).json(result);
        } catch (err) {
            return res.status(err.status || 400).json({
                success: false,
                code: err.code || "SCHEDULE_ERROR",
                message: err.status >= 500 ? "Không thể lưu dữ liệu. Thao tác chưa được áp dụng." : err.message,
                details: err.details
            });
        }
    }
);

// API Xóa toàn bộ thời khóa biểu của một lớp
app.delete("/api/schedules/class/:classId",
    authenticateToken,
    requireRole("training_manager", "administrator"),
    (req, res) => {
        try {
            const result = clearClassSchedule(req.params.classId, req.user);
            return res.status(200).json(result);
        } catch (err) {
            return res.status(err.status || 400).json({
                success: false,
                code: err.code || "SCHEDULE_ERROR",
                message: err.status >= 500 ? "Không thể lưu dữ liệu. Thao tác chưa được áp dụng." : err.message,
                details: err.details
            });
        }
    }
);

// KN-160: API Quản lý danh sách ngày nghỉ lễ
app.get("/api/holidays", authenticateToken, (req, res) => {
    try {
        const list = getHolidays();
        return res.status(200).json({
            success: true,
            total: list.length,
            holidays: list
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Lỗi khi lấy danh sách ngày lễ: " + err.message
        });
    }
});

app.post("/api/holidays",
    authenticateToken,
    requireRole("training_manager", "administrator"),
    (req, res) => {
        try {
            const newHoliday = addHoliday(req.body || {});
            return res.status(201).json({
                success: true,
                message: "Thêm ngày nghỉ lễ thành công!",
                holiday: newHoliday
            });
        } catch (err) {
            return res.status(400).json({
                success: false,
                message: err.message
            });
        }
    }
);

app.delete("/api/holidays/:id",
    authenticateToken,
    requireRole("training_manager", "administrator"),
    (req, res) => {
        try {
            const deleted = deleteHoliday(req.params.id);
            return res.status(200).json({
                success: true,
                message: `Đã xóa ngày nghỉ lễ "${deleted.name}".`,
                deleted: deleted
            });
        } catch (err) {
            return res.status(400).json({
                success: false,
                message: err.message
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
    res.redirect(301, "/Login.html");
});
app.get("/frontend/:page", (req, res) => {
    res.redirect(301, `/${req.params.page}`);
});

// Không gian làm việc (Workspace) phục vụ trực tiếp Workspace.html mà không redirect
app.get(["/workspace", "/Workspace", "/Workspace.html", "/workspace.html"], (req, res) => {
    res.sendFile(path.join(rootDir, "Workspace.html"));
});

// KN-75: Phân công lead cho tư vấn viên (module độc lập, chỉ thêm route /api/kn75/*)
require("./kn75").mountKn75(app, { authenticateToken, requireRole });

// KN-49 & KN-50: Các định tuyến mã lỗi chuẩn (Clean Error Routing)
app.get(["/403", "/error-403"], (req, res) => {
    const errorHtmlPath = path.join(rootDir, "Error.html");
    if (fs.existsSync(errorHtmlPath)) {
        return res.sendFile(errorHtmlPath);
    }
    res.status(403).send("403 Forbidden");
});
app.get(["/404", "/error-404"], (req, res) => {
    const errorHtmlPath = path.join(rootDir, "Error.html");
    if (fs.existsSync(errorHtmlPath)) {
        return res.sendFile(errorHtmlPath);
    }
    res.status(404).send("404 Not Found");
});
app.get(["/500", "/error-500"], (req, res) => {
    const errorHtmlPath = path.join(rootDir, "Error.html");
    if (fs.existsSync(errorHtmlPath)) {
        return res.sendFile(errorHtmlPath);
    }
    res.status(500).send("500 Server Error");
});
app.get("/error", (req, res) => {
    const errorHtmlPath = path.join(rootDir, "Error.html");
    if (fs.existsSync(errorHtmlPath)) {
        return res.sendFile(errorHtmlPath);
    }
    res.status(500).send("An error occurred");
});
// KN-129: Lấy danh sách phòng học
app.get("/api/classrooms", async (req, res) => {
    try {
        const rooms = await classroomService.getClassrooms();
        res.json({
            success: true,
            data: rooms
        });
    } catch (error) {
        handleClassroomError(res, error);
    }
});

// KN-129: Thêm phòng học
app.post("/api/classrooms", (req, res) => {
    try {
        const room = classroomService.createClassroom(req.body);
        res.status(201).json({
            success: true,
            data: room
        });
    } catch (error) {
        handleClassroomError(res, error);
    }
});
// KN-129: API kiểm tra sức chứa phòng học
app.post("/api/classrooms/validate-capacity", (req, res) => {
    try {
        const { classroomId, studentCount } = req.body;
        const result = classroomService.validateRoomCapacity(classroomId, studentCount);
        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        handleClassroomError(res, error);
    }
});
// KN-54: Fallback và chuẩn hóa lỗi cho các API request không tồn tại
app.use(["/api", "/auth"], (req, res) => {
    res.status(404).json({
        success: false,
        code: 404,
        error: "Endpoint API không tồn tại hoặc đã thay đổi địa chỉ",
        path: req.originalUrl,
        timestamp: new Date().toISOString()
    });
});

// Fallback cho các đường dẫn trang không tồn tại -> Trả về giao diện 404 an toàn
app.use((req, res, next) => {
    const isApiOrAuth = req.originalUrl && (req.originalUrl.startsWith("/api") || req.originalUrl.startsWith("/auth"));
    if (isApiOrAuth) {
        return res.status(404).json({
            success: false,
            code: 404,
            error: "Không tìm thấy tài nguyên yêu cầu.",
            path: req.originalUrl,
            timestamp: new Date().toISOString()
        });
    }

    if (req.method === "GET") {
        const errorHtmlPath = path.join(rootDir, "Error.html");
        if (fs.existsSync(errorHtmlPath)) {
            return res.status(404).sendFile(errorHtmlPath);
        }
        return res.status(404).send("404 Not Found");
    }
    next();
});

// KN-53 & KN-54: Middleware xử lý lỗi toàn cục, chuẩn hóa tiếng Việt an toàn, không để lộ stack trace
app.use((err, req, res, next) => {
    const statusCode = err.status || err.statusCode || 500;
    const safeMessage = statusCode >= 500
        ? "Đã xảy ra sự cố trong quá trình xử lý yêu cầu. Dữ liệu của bạn vẫn an toàn."
        : (err.message || "Yêu cầu không hợp lệ.");

    const isApiOrAuth = !req.originalUrl || req.originalUrl.startsWith("/api") || req.originalUrl.startsWith("/auth") || (req.headers && req.headers.accept && req.headers.accept.includes("application/json"));
    if (isApiOrAuth) {
        return res.status(statusCode).json({
            success: false,
            code: statusCode,
            error: safeMessage,
            timestamp: new Date().toISOString()
        });
    }

    const errorHtmlPath = path.join(rootDir, "Error.html");
    if (fs.existsSync(errorHtmlPath)) {
        return res.status(statusCode).sendFile(errorHtmlPath);
    }
    res.status(statusCode).send(`Error ${statusCode}: ${safeMessage}`);
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
        // KN-67: Khôi phục hồ sơ mới nhất từ Supabase PostgreSQL
        const profiles = await supabaseService.loadUserProfiles();

        profiles.forEach(profile => {
            const user = users.find(u => u.id === profile.id);
            if (!user) return;

            if (typeof profile.name === "string") {
                user.name = profile.name;
            }

            user.phone = profile.phone ?? "";
            user.birthDate = profile.birth_date ?? "";
            user.address = profile.address ?? "";
        });
        } catch (error) {
        console.warn(
            "[KN-67] Không thể khôi phục hồ sơ từ Supabase:",
            error.message
        );
    }
}
// KN-67: Tải dữ liệu đã lưu trước khi khởi động server
if (require.main === module) {
    Promise.resolve()

        .then(() => {

function handleClassroomError(res, error) {
    return res.status(400).json({
        success: false,
        message: error.message
    });
}

// KN-129: Lấy danh sách phòng học

app.get("/api/classrooms/:id", (req, res) => {
    try {
        const room = classroomService.getClassroomById(req.params.id);

        if (!room) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy phòng học."
            });
        }

        res.json({
            success: true,
            data: room
        });
    } catch (error) {
        handleClassroomError(res, error);
    }
});

// KN-129: Sửa phòng học
app.put("/api/classrooms/:id", (req, res) => {
    try {
        const room = classroomService.updateClassroom(
            req.params.id,
            req.body
        );

        res.json({
            success: true,
            data: room
        });
    } catch (error) {
        handleClassroomError(res, error);
    }
});

// KN-129: Xóa phòng học
app.delete("/api/classrooms/:id", (req, res) => {
    try {
        const result = classroomService.deleteClassroom(req.params.id);

        res.json({
            success: true,
            ...result
        });
    } catch (error) {
        handleClassroomError(res, error);
    }
});

// KN-129: Kiểm tra sức chứa phòng
app.post("/api/classrooms/:id/check-capacity", (req, res) => {
    try {
        const result = classroomService.checkCapacity(
            req.params.id,
            req.body.studentCount
        );

        res.status(result.allowed ? 200 : 409).json({
            success: result.allowed,
            ...result
        });
    } catch (error) {
        handleClassroomError(res, error);
    }
});

            app.listen(PORT, () => {
                console.log(
                    `TMS Server running at http://localhost:${PORT}`
                );

                // Không ghi đè dữ liệu người dùng khi vừa khởi động.
                // Hồ sơ được đồng bộ khi người dùng cập nhật.
                supabaseService.syncRolesDatabase(
                    getAllRoles(),
                    getAllUserRolesAssignments(),
                    getAuditLogs()
                ).catch(err => {
                    console.error("Role sync error:", err.message);
                });
            });
        })
        .catch(err => {
            console.error("Không thể tải dữ liệu Supabase:", err);
            process.exitCode = 1;
        });
}
module.exports = app;