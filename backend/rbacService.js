/**
 * KN-8: Quản trị Phân quyền theo Vai trò Toàn Hệ thống (Role-Based Access Control - RBAC)
 * Sprint 1 - Epic KN-14
 * Thực hiện: DOAN MINH QUAN (azmedia247 - dtc245200761@ictu.edu.vn)
 * 
 * Tiêu chí nghiệm thu (Acceptance Criteria):
 * 1. Khai báo được quyền cho từng vai trò trong 8 vai trò nghiệp vụ hệ thống TMS.
 * 2. Mọi chức năng đều kiểm quyền ở tầng server, mặc định là từ chối (Default Deny).
 *    - Đảm bảo giảng viên (instructor) KHÔNG sửa được học phí.
 *    - Đảm bảo kế toán (accountant) KHÔNG sửa được điểm.
 * 3. Truy cập thiếu quyền hiển thị thông báo tiếng Việt rõ ràng thay vì lỗi kỹ thuật.
 * 4. Có kiểm thử tự động toàn diện cho ít nhất 3 vai trò (Giảng viên, Kế toán, Quản trị viên,...).
 */

// Danh mục 8 vai trò nghiệp vụ chuẩn trong TMS
const BUSINESS_ROLES = {
    ADMINISTRATOR: "administrator",       // 1. Quản trị hệ thống
    TRAINING_MANAGER: "training_manager", // 2. Quản lý đào tạo
    INSTRUCTOR: "instructor",             // 3. Giảng viên
    TEACHING_ASSISTANT: "teaching_assistant", // 4. Trợ giảng
    STUDENT: "student",                   // 5. Học viên
    ADMISSIONS: "admissions",             // 6. Tư vấn tuyển sinh
    ACCOUNTANT: "accountant",             // 7. Kế toán
    VISITOR: "visitor"                    // 8. Khách tham quan
};

// Danh mục các mã quyền (Permissions) trong hệ thống TMS
const PERMISSIONS = {
    // Quyền điểm số
    GRADES_VIEW: "grades:view",
    GRADES_UPDATE: "grades:update",

    // Quyền học phí
    TUITION_VIEW: "tuition:view",
    TUITION_UPDATE: "tuition:update",

    // Quyền đào tạo & lớp học
    COURSES_VIEW: "courses:view",
    COURSES_MANAGE: "courses:manage",
    ATTENDANCE_MANAGE: "attendance:manage",

    // Quyền người dùng & hệ thống
    USERS_VIEW: "users:view",
    USERS_MANAGE: "users:manage",
    REPORTS_VIEW: "reports:view",
    RBAC_MANAGE: "rbac:manage"
};

// Khai báo ma trận quyền cho 8 vai trò nghiệp vụ (Mặc định là từ chối - Default Deny)
const defaultRolePermissions = {
    // 1. Quản trị hệ thống: Toàn quyền
    [BUSINESS_ROLES.ADMINISTRATOR]: [
        "*" // Đại diện cho tất cả quyền
    ],

    // 2. Quản lý đào tạo: Xem/sửa điểm, lớp học, điểm danh, báo cáo, không sửa học phí
    [BUSINESS_ROLES.TRAINING_MANAGER]: [
        PERMISSIONS.GRADES_VIEW,
        PERMISSIONS.GRADES_UPDATE,
        PERMISSIONS.COURSES_VIEW,
        PERMISSIONS.COURSES_MANAGE,
        PERMISSIONS.ATTENDANCE_MANAGE,
        PERMISSIONS.REPORTS_VIEW,
        PERMISSIONS.USERS_VIEW
    ],

    // 3. Giảng viên: Nhập/sửa điểm, điểm danh lớp phụ trách. TUYỆT ĐỐI KHÔNG CÓ QUYỀN SỬA HỌC PHÍ
    [BUSINESS_ROLES.INSTRUCTOR]: [
        PERMISSIONS.GRADES_VIEW,
        PERMISSIONS.GRADES_UPDATE,
        PERMISSIONS.COURSES_VIEW,
        PERMISSIONS.ATTENDANCE_MANAGE
    ],

    // 4. Trợ giảng: Điểm danh, xem lớp, xem điểm, không sửa học phí
    [BUSINESS_ROLES.TEACHING_ASSISTANT]: [
        PERMISSIONS.GRADES_VIEW,
        PERMISSIONS.COURSES_VIEW,
        PERMISSIONS.ATTENDANCE_MANAGE
    ],

    // 5. Học viên: Xem thông tin khóa học (chỉ xem điểm/học phí của cá nhân qua API riêng)
    [BUSINESS_ROLES.STUDENT]: [
        PERMISSIONS.COURSES_VIEW
    ],

    // 6. Tuyển sinh: Xem khóa học, xem báo cáo tuyển sinh
    [BUSINESS_ROLES.ADMISSIONS]: [
        PERMISSIONS.COURSES_VIEW,
        PERMISSIONS.REPORTS_VIEW
    ],

    // 7. Kế toán: Quản lý và cập nhật học phí, xem báo cáo tài chính. TUYỆT ĐỐI KHÔNG CÓ QUYỀN SỬA ĐIỂM
    [BUSINESS_ROLES.ACCOUNTANT]: [
        PERMISSIONS.TUITION_VIEW,
        PERMISSIONS.TUITION_UPDATE,
        PERMISSIONS.REPORTS_VIEW
    ],

    // 8. Khách tham quan: Chỉ xem thông tin các khóa học công khai
    [BUSINESS_ROLES.VISITOR]: [
        PERMISSIONS.COURSES_VIEW
    ]
};

// Bộ nhớ động lưu trữ quyền hiện tại (cho phép Admin cập nhật ma trận phân quyền)
let currentRolePermissions = JSON.parse(JSON.stringify(defaultRolePermissions));

/**
 * Kiểm tra xem một vai trò có quyền thực hiện hành động hay không.
 * Nguyên tắc: DEFAULT DENY (Mặc định là từ chối)
 * 
 * @param {string} role - Mã vai trò người dùng
 * @param {string} permission - Mã quyền cần kiểm tra
 * @returns {boolean}
 */
function hasPermission(role, permission) {
    if (!role || typeof role !== "string" || !permission || typeof permission !== "string") {
        return false; // Mặc định từ chối khi thiếu tham số
    }

    const assignedPermissions = currentRolePermissions[role];
    if (!Array.isArray(assignedPermissions)) {
        return false; // Mặc định từ chối nếu vai trò không có trong bảng quyền
    }

    // Nếu có quyền wildcard '*' -> Cho phép toàn bộ
    if (assignedPermissions.includes("*")) {
        return true;
    }

    // Kiểm tra xem quyền có trong danh sách được cấp phép không
    return assignedPermissions.includes(permission);
}

/**
 * Lấy toàn bộ ma trận phân quyền hiện tại
 */
function getAllRolePermissions() {
    return JSON.parse(JSON.stringify(currentRolePermissions));
}

/**
 * Lấy danh sách quyền của một vai trò cụ thể
 */
function getPermissionsByRole(role) {
    if (!currentRolePermissions[role]) {
        return [];
    }
    if (currentRolePermissions[role].includes("*")) {
        return Object.values(PERMISSIONS);
    }
    return [...currentRolePermissions[role]];
}

/**
 * Cập nhật ma trận quyền cho một vai trò (Dành cho Quản trị viên)
 */
function updateRolePermissions(role, permissions) {
    if (!Object.values(BUSINESS_ROLES).includes(role)) {
        throw { status: 400, message: `Vai trò '${role}' không hợp lệ trong hệ thống.` };
    }
    if (!Array.isArray(permissions)) {
        throw { status: 400, message: "Danh sách quyền phải là một mảng." };
    }

    // Lọc các quyền hợp lệ
    const validPermissions = Object.values(PERMISSIONS);
    const sanitized = permissions.filter(p => p === "*" || validPermissions.includes(p));

    currentRolePermissions[role] = sanitized;
    return {
        role,
        permissions: currentRolePermissions[role]
    };
}

/**
 * Cập nhật toàn bộ ma trận phân quyền (Dành cho Quản trị viên)
 */
function updateAllRolePermissions(matrix) {
    if (!matrix || typeof matrix !== "object") {
        throw { status: 400, message: "Dữ liệu ma trận phân quyền không hợp lệ." };
    }
    for (const [role, perms] of Object.entries(matrix)) {
        if (Object.values(BUSINESS_ROLES).includes(role) && role !== BUSINESS_ROLES.ADMINISTRATOR) {
            updateRolePermissions(role, perms);
        }
    }
    return getAllRolePermissions();
}

/**
 * Khôi phục ma trận phân quyền về mặc định
 */
function resetRolePermissions() {
    currentRolePermissions = JSON.parse(JSON.stringify(defaultRolePermissions));
    return getAllRolePermissions();
}

// -------------------------------------------------------------
// DỮ LIỆU MẪU NGHIỆP VỤ ĐIỂM SỐ & HỌC PHÍ (Dùng để kiểm thử phân quyền)
// -------------------------------------------------------------
const mockGrades = [
    { studentId: "sv_01", studentName: "Lê Minh Tuấn", subject: "Lập trình Web Node.js", score: 8.5, updatedBy: "teacher@tms.edu.vn", updatedAt: new Date().toISOString() },
    { studentId: "sv_02", studentName: "Nguyễn Thị Hoa", subject: "Cơ sở dữ liệu MySQL", score: 9.0, updatedBy: "teacher@tms.edu.vn", updatedAt: new Date().toISOString() }
];

const mockTuitions = [
    { studentId: "sv_01", studentName: "Lê Minh Tuấn", courseName: "Khóa K15 - Fullstack", totalAmount: 15000000, paidAmount: 15000000, status: "completed", updatedBy: "accountant@tms.edu.vn", updatedAt: new Date().toISOString() },
    { studentId: "sv_02", studentName: "Nguyễn Thị Hoa", courseName: "Khóa K15 - Fullstack", totalAmount: 15000000, paidAmount: 7500000, status: "partial", updatedBy: "accountant@tms.edu.vn", updatedAt: new Date().toISOString() }
];

/**
 * Cập nhật điểm cho sinh viên (Yêu cầu quyền grades:update)
 */
function updateStudentGrade(studentId, subject, score, updatedBy) {
    const numScore = Number(score);
    if (isNaN(numScore) || numScore < 0 || numScore > 10) {
        throw { status: 400, message: "Điểm số phải là số từ 0 đến 10." };
    }

    let record = mockGrades.find(g => g.studentId === studentId && g.subject === subject);
    if (record) {
        record.score = numScore;
        record.updatedBy = updatedBy;
        record.updatedAt = new Date().toISOString();
    } else {
        record = {
            studentId,
            studentName: `Sinh viên ${studentId}`,
            subject,
            score: numScore,
            updatedBy,
            updatedAt: new Date().toISOString()
        };
        mockGrades.push(record);
    }
    return record;
}

/**
 * Cập nhật học phí cho sinh viên (Yêu cầu quyền tuition:update)
 */
function updateStudentTuition(studentId, paidAmount, status, updatedBy) {
    const numPaid = Number(paidAmount);
    if (isNaN(numPaid) || numPaid < 0) {
        throw { status: 400, message: "Số tiền học phí đóng phải là số dương hợp lệ." };
    }

    let record = mockTuitions.find(t => t.studentId === studentId);
    if (!record) {
        throw { status: 404, message: `Không tìm thấy hồ sơ học phí của sinh viên mã '${studentId}'.` };
    }

    record.paidAmount = numPaid;
    if (status) record.status = status;
    else {
        record.status = (record.paidAmount >= record.totalAmount) ? "completed" : "partial";
    }
    record.updatedBy = updatedBy;
    record.updatedAt = new Date().toISOString();

    return record;
}

/**
 * Middleware kiểm tra quyền truy cập ở tầng Server (Server-Side Authorization Middleware)
 * Tiêu chí nghiệm thu 2: Mọi chức năng đều kiểm quyền ở tầng server, mặc định là từ chối (Default Deny).
 * Tiêu chí nghiệm thu 3: Truy cập thiếu quyền hiển thị thông báo tiếng Việt rõ ràng thay vì lỗi kỹ thuật.
 * 
 * @param {string} requiredPermission - Mã quyền nghiệp vụ bắt buộc
 */
function authorizePermission(requiredPermission) {
    return (req, res, next) => {
        // 1. Kiểm tra xác thực (Đã đăng nhập và có token giải mã chưa)
        if (!req.user || !req.user.role) {
            return res.status(401).json({
                success: false,
                errorCode: "UNAUTHORIZED_NO_USER",
                message: "Bạn chưa đăng nhập hoặc phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."
            });
        }

        const userRole = req.user.role;

        // 2. Kiểm quyền bằng nguyên tắc Default Deny
        if (!hasPermission(userRole, requiredPermission)) {
            // Thông báo tiếng Việt rõ ràng, thân thiện, không lộ stack trace kỹ thuật
            return res.status(403).json({
                success: false,
                errorCode: "FORBIDDEN_PERMISSION_DENIED",
                message: `Truy cập bị từ chối: Vai trò của bạn không có quyền thực hiện thao tác này. Vui lòng liên hệ Quản trị hệ thống để được cấp quyền.`,
                detail: {
                    userRole: userRole,
                    requiredPermission: requiredPermission
                }
            });
        }

        // Đủ quyền -> cho phép tiếp tục
        next();
    };
}

module.exports = {
    BUSINESS_ROLES,
    PERMISSIONS,
    hasPermission,
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
};
