// Mô-đun Quản lý Vai trò và Phân quyền N-N cho Hệ thống TMS
// Hỗ trợ Ticket Jira KN-12 (KN-57, KN-58, KN-59, KN-56, KN-60, KN-63)
const { users } = require("./authService");

// 1. KN-57: Danh mục vai trò chuẩn của hệ thống TMS (8 vai trò)
const ROLES = [
    { id: "administrator", code: "administrator", name: "Quản trị hệ thống", description: "Toàn quyền quản trị hệ thống, tài khoản và phân quyền" },
    { id: "training_manager", code: "training_manager", name: "Quản lý đào tạo", description: "Quản lý chương trình, môn học, lớp học và tiến độ đào tạo" },
    { id: "instructor", code: "instructor", name: "Giảng viên", description: "Quản lý lớp học phụ trách, điểm danh và chấm bài tập" },
    { id: "teaching_assistant", code: "teaching_assistant", name: "Trợ giảng", description: "Hỗ trợ giảng viên hướng dẫn học viên và điểm danh" },
    { id: "student", code: "student", name: "Học viên", description: "Học tập, nộp bài tập và xem kết quả học tập" },
    { id: "admissions", code: "admissions", name: "Tư vấn tuyển sinh", description: "Tiếp nhận lead, tư vấn khóa học và ghi danh" },
    { id: "accountant", code: "accountant", name: "Kế toán đào tạo", description: "Quản lý học phí, biên lai thu và đối soát công nợ" },
    { id: "visitor", code: "visitor", name: "Khách truy cập", description: "Xem thông tin khóa học công khai và biểu phí tham khảo" }
];

// 2. KN-57: Bảng nối quan hệ Nhiều - Nhiều (user_roles)
// Mỗi phần tử có cấu trúc: { userId, roleId, assignedBy, assignedAt }
// Ràng buộc UNIQUE(userId, roleId) được duy trì qua Set composite key `userId:roleId`
let userRoles = [];
const userRoleIndex = new Set(); // chứa chuỗi "userId:roleId"

// KN-63: Kho lưu trữ nhật ký thao tác (Audit Logs)
let auditLogs = [];

// KN-60: Bộ đếm phiên bản vai trò của người dùng (roles_version)
// Giúp theo dõi và đảm bảo tính tức thời khi vai trò thay đổi
const userRolesVersion = new Map();

function bumpUserRolesVersion(userId) {
    const current = userRolesVersion.get(userId) || 1;
    userRolesVersion.set(userId, current + 1);
}

function getUserRolesVersion(userId) {
    return userRolesVersion.get(userId) || 1;
}

// Khởi tạo và chạy Migration dữ liệu (KN-57)
function initRoleData() {
    userRoles = [];
    userRoleIndex.clear();
    auditLogs = [];
    userRolesVersion.clear();

    const timestamp = new Date().toISOString();

    // Di chuyển dữ liệu role đơn lẻ hiện có của mỗi user sang user_roles
    users.forEach(u => {
        if (u.role) {
            const key = `${u.id}:${u.role}`;
            if (!userRoleIndex.has(key)) {
                userRoleIndex.add(key);
                userRoles.push({
                    userId: u.id,
                    roleId: u.role,
                    assignedBy: "system_migration",
                    assignedAt: timestamp
                });
            }
        }
        // Khởi tạo phiên bản ban đầu
        userRolesVersion.set(u.id, 1);
    });
}

// Chạy khởi tạo ngay khi nạp module
initRoleData();

// Lấy danh mục tất cả vai trò
function getAllRoles() {
    return [...ROLES];
}

// Tìm vai trò theo id hoặc code
function findRoleById(roleId) {
    if (!roleId) return null;
    const normalized = String(roleId).trim().toLowerCase();
    return ROLES.find(r => r.id.toLowerCase() === normalized || r.code.toLowerCase() === normalized) || null;
}

// Lấy danh sách đầy đủ vai trò của một người dùng
function getUserRoles(userId) {
    const records = userRoles.filter(ur => ur.userId === userId);
    return records.map(record => {
        const roleInfo = findRoleById(record.roleId);
        return {
            id: record.roleId,
            code: roleInfo ? roleInfo.code : record.roleId,
            name: roleInfo ? roleInfo.name : record.roleId,
            description: roleInfo ? roleInfo.description : "",
            assignedBy: record.assignedBy,
            assignedAt: record.assignedAt
        };
    });
}

// Kiểm tra người dùng có một vai trò cụ thể không
function userHasRole(userId, roleCode) {
    const roles = getUserRoles(userId);
    return roles.some(r => r.id === roleCode || r.code === roleCode);
}

// Lấy thông tin user kèm tương thích ngược (KN-57)
function getUserWithRoles(userId) {
    const user = users.find(u => u.id === userId);
    if (!user) return null;

    const roles = getUserRoles(userId);
    // Tương thích ngược: user.role vẫn trả về vai trò đầu tiên hoặc vai trò ban đầu
    const primaryRole = roles.length > 0 ? roles[0].code : (user.role || null);

    return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: primaryRole, // Tương thích ngược với các module cũ
        roles: roles,      // Danh sách đầy đủ vai trò mới (N-N)
        rolesVersion: getUserRolesVersion(user.id)
    };
}

// Ghi nhận Audit Log (KN-63)
function recordAuditLog({ adminId, targetUserId, action, roleId, ip = "127.0.0.1", status = "SUCCESS", reason = "" }) {
    const logEntry = {
        id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        timestamp: new Date().toISOString(),
        adminId: adminId || "system",
        targetUserId: targetUserId || "",
        action: action, // "ASSIGN_ROLE" | "REVOKE_ROLE"
        roleId: roleId,
        ip: ip,
        status: status, // "SUCCESS" | "FORBIDDEN" | "BAD_REQUEST" | "FAILED"
        reason: reason
    };
    auditLogs.push(logEntry);
    return logEntry;
}

function getAuditLogs() {
    return [...auditLogs].reverse();
}

// Đếm số lượng quản trị viên còn hoạt động trong hệ thống (KN-56)
function countActiveAdmins() {
    const adminRoleRecords = userRoles.filter(ur => ur.roleId === "administrator");
    // Lấy tập hợp user_id duy nhất có role administrator
    const uniqueAdminIds = new Set(adminRoleRecords.map(ur => ur.userId));
    return uniqueAdminIds.size;
}

// KN-58: Xây dựng hàm gán vai trò cho người dùng (tầng Service)
function assignRoleToUser({ userId, roleId, assignedBy, ip }) {
    // 1. Kiểm tra người dùng có tồn tại không
    const user = users.find(u => u.id === userId);
    if (!user) {
        recordAuditLog({
            adminId: assignedBy,
            targetUserId: userId,
            action: "ASSIGN_ROLE",
            roleId,
            ip,
            status: "BAD_REQUEST",
            reason: "Người dùng không tồn tại trong hệ thống."
        });
        const err = new Error("Người dùng không tồn tại trong hệ thống.");
        err.statusCode = 404;
        throw err;
    }

    // 2. Kiểm tra vai trò có tồn tại và hợp lệ không
    const role = findRoleById(roleId);
    if (!role) {
        recordAuditLog({
            adminId: assignedBy,
            targetUserId: userId,
            action: "ASSIGN_ROLE",
            roleId,
            ip,
            status: "BAD_REQUEST",
            reason: `Vai trò '${roleId}' không tồn tại hoặc không hợp lệ.`
        });
        const err = new Error(`Vai trò '${roleId}' không tồn tại trong hệ thống.`);
        err.statusCode = 400;
        throw err;
    }

    // 3. Xử lý Lũy đẳng (Idempotent): Nếu đã có vai trò này thì không tạo bản ghi trùng
    const key = `${userId}:${role.id}`;
    if (userRoleIndex.has(key)) {
        recordAuditLog({
            adminId: assignedBy,
            targetUserId: userId,
            action: "ASSIGN_ROLE",
            roleId: role.id,
            ip,
            status: "SUCCESS",
            reason: "Người dùng đã có vai trò này từ trước (Thao tác lũy đẳng)."
        });
        return {
            isNew: false,
            message: `Người dùng đã có vai trò ${role.name}.`,
            roles: getUserRoles(userId)
        };
    }

    // 4. Thêm bản ghi vào user_roles
    userRoleIndex.add(key);
    userRoles.push({
        userId: userId,
        roleId: role.id,
        assignedBy: assignedBy || "system",
        assignedAt: new Date().toISOString()
    });

    // Tăng version vai trò của user để áp dụng ngay lập tức (KN-60)
    bumpUserRolesVersion(userId);

    // Ghi nhận Audit Log thành công
    recordAuditLog({
        adminId: assignedBy,
        targetUserId: userId,
        action: "ASSIGN_ROLE",
        roleId: role.id,
        ip,
        status: "SUCCESS",
        reason: `Gán thành công vai trò ${role.name}`
    });

    return {
        isNew: true,
        message: `Gán vai trò ${role.name} thành công.`,
        roles: getUserRoles(userId)
    };
}

// KN-59 & KN-56: Xây dựng hàm thu hồi vai trò của người dùng (tầng Service)
function revokeRoleFromUser({ userId, roleId, targetRoleId: inputTargetRoleId, revokedBy, ip }) {
    const rawRoleId = roleId || inputTargetRoleId;
    // 1. Kiểm tra người dùng có tồn tại không
    const user = users.find(u => u.id === userId);
    if (!user) {
        recordAuditLog({
            adminId: revokedBy,
            targetUserId: userId,
            action: "REVOKE_ROLE",
            roleId: rawRoleId,
            ip,
            status: "BAD_REQUEST",
            reason: "Người dùng không tồn tại trong hệ thống."
        });
        const err = new Error("Người dùng không tồn tại trong hệ thống.");
        err.statusCode = 404;
        throw err;
    }

    // 2. Chuẩn hóa vai trò
    const role = findRoleById(rawRoleId);
    const targetRoleId = role ? role.id : rawRoleId;

    // 3. KN-56: Kiểm tra không cho tự thu hồi vai trò quản trị của chính mình
    if (userId === revokedBy && targetRoleId === "administrator") {
        recordAuditLog({
            adminId: revokedBy,
            targetUserId: userId,
            action: "REVOKE_ROLE",
            roleId: targetRoleId,
            ip,
            status: "FORBIDDEN",
            reason: "Cố gắng tự thu hồi vai trò Quản trị hệ thống của chính mình."
        });
        const err = new Error("Bạn không thể tự thu hồi vai trò Quản trị hệ thống của chính mình.");
        err.statusCode = 403;
        throw err;
    }

    // 4. KN-56: Không cho thu hồi vai trò quản trị của người quản trị cuối cùng trong hệ thống
    if (targetRoleId === "administrator") {
        const totalAdmins = countActiveAdmins();
        const userIsAdmin = userRoleIndex.has(`${userId}:administrator`);
        if (userIsAdmin && totalAdmins <= 1) {
            recordAuditLog({
                adminId: revokedBy,
                targetUserId: userId,
                action: "REVOKE_ROLE",
                roleId: targetRoleId,
                ip,
                status: "FORBIDDEN",
                reason: "Không thể thu hồi vai trò Quản trị viên cuối cùng của hệ thống."
            });
            const err = new Error("Không thể thu hồi vai trò Quản trị viên cuối cùng trong hệ thống.");
            err.statusCode = 403;
            throw err;
        }
    }

    // 5. Kiểm tra người dùng có đang giữ vai trò này hay không (Idempotent xử lý)
    const key = `${userId}:${targetRoleId}`;
    if (!userRoleIndex.has(key)) {
        recordAuditLog({
            adminId: revokedBy,
            targetUserId: userId,
            action: "REVOKE_ROLE",
            roleId: targetRoleId,
            ip,
            status: "SUCCESS",
            reason: "Người dùng hiện không có vai trò này (Thao tác lũy đẳng)."
        });
        return {
            isRemoved: false,
            message: "Người dùng không có vai trò này.",
            roles: getUserRoles(userId)
        };
    }

    // 6. KN-59: Không cho phép user bị rỗng toàn bộ vai trò (mỗi user phải có ít nhất 1 vai trò)
    const currentRoles = getUserRoles(userId);
    if (currentRoles.length <= 1) {
        recordAuditLog({
            adminId: revokedBy,
            targetUserId: userId,
            action: "REVOKE_ROLE",
            roleId: targetRoleId,
            ip,
            status: "BAD_REQUEST",
            reason: "Người dùng phải có ít nhất một vai trò hợp lệ trong hệ thống."
        });
        const err = new Error("Không thể thu hồi: Người dùng phải có ít nhất một vai trò trong hệ thống.");
        err.statusCode = 400;
        throw err;
    }

    // 7. Thực hiện thu hồi
    userRoleIndex.delete(key);
    userRoles = userRoles.filter(ur => !(ur.userId === userId && ur.roleId === targetRoleId));

    // Cập nhật version để có hiệu lực tức thì ở request kế tiếp (KN-60)
    bumpUserRolesVersion(userId);

    // Ghi nhận Audit Log thành công
    recordAuditLog({
        adminId: revokedBy,
        targetUserId: userId,
        action: "REVOKE_ROLE",
        roleId: targetRoleId,
        ip,
        status: "SUCCESS",
        reason: `Thu hồi thành công vai trò ${role ? role.name : targetRoleId}`
    });

    return {
        isRemoved: true,
        message: `Thu hồi vai trò ${role ? role.name : targetRoleId} thành công.`,
        roles: getUserRoles(userId)
    };
}

// KN-62: Lấy danh sách người dùng kèm vai trò (Tránh N+1 query, hỗ trợ phân trang & lọc)
function getUsersWithRolesList({ page = 1, limit = 20, roleId = "", role = "", search = "", query = "", status = "" } = {}) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
    const normalizedSearch = String(search || query || "").trim().toLowerCase();
    const normalizedRole = String(roleId || role || "").trim().toLowerCase();
    const normalizedStatus = String(status || "").trim().toLowerCase();

    // Gom nhóm danh sách vai trò theo userId trước (tối ưu O(N), tránh N+1 query)
    const rolesByUserMap = new Map();
    userRoles.forEach(ur => {
        if (!rolesByUserMap.has(ur.userId)) {
            rolesByUserMap.set(ur.userId, []);
        }
        const roleInfo = findRoleById(ur.roleId);
        rolesByUserMap.get(ur.userId).push({
            id: ur.roleId,
            code: roleInfo ? roleInfo.code : ur.roleId,
            name: roleInfo ? roleInfo.name : ur.roleId,
            assignedBy: ur.assignedBy,
            assignedAt: ur.assignedAt
        });
    });

    // Lọc theo điều kiện tìm kiếm và vai trò
    let filteredUsers = users.map(u => {
        const uRoles = rolesByUserMap.get(u.id) || [];
        let displayRoles = uRoles;
        if (displayRoles.length === 0 && u.role) {
            const roleInfo = findRoleById(u.role);
            displayRoles = [{
                id: u.role,
                code: roleInfo ? roleInfo.code : u.role,
                name: roleInfo ? roleInfo.name : u.role,
                assignedBy: "system",
                assignedAt: u.createdAt || new Date().toISOString()
            }];
        }
        return {
            id: u.id,
            email: u.email,
            name: u.name,
            role: displayRoles.length > 0 ? displayRoles[0].code : (u.role || null),
            roles: displayRoles,
            phone: u.phone || "",
            status: u.status || "active",
            createdAt: u.createdAt,
            updatedAt: u.updatedAt
        };
    });

    if (normalizedSearch) {
        filteredUsers = filteredUsers.filter(u =>
            (u.name && u.name.toLowerCase().includes(normalizedSearch)) ||
            (u.email && u.email.toLowerCase().includes(normalizedSearch)) ||
            (u.id && u.id.toLowerCase().includes(normalizedSearch)) ||
            (u.phone && u.phone.includes(normalizedSearch))
        );
    }

    if (normalizedRole && normalizedRole !== "all") {
        filteredUsers = filteredUsers.filter(u =>
            (u.role && u.role.toLowerCase() === normalizedRole) ||
            u.roles.some(r => r.id.toLowerCase() === normalizedRole || r.code.toLowerCase() === normalizedRole)
        );
    }

    if (normalizedStatus && normalizedStatus !== "all") {
        filteredUsers = filteredUsers.filter(u => u.status && u.status.toLowerCase() === normalizedStatus);
    }

    const total = filteredUsers.length;
    const totalPages = Math.ceil(total / limitNum) || 1;
    const startIndex = (pageNum - 1) * limitNum;
    const paginatedUsers = filteredUsers.slice(startIndex, startIndex + limitNum);

    return {
        users: paginatedUsers,
        total: total,
        page: pageNum,
        limit: limitNum,
        totalPages: totalPages,
        pagination: {
            page: pageNum,
            limit: limitNum,
            total: total,
            totalPages: totalPages
        }
    };
}

function removeAllUserRoles(userId) {
    userRoles = userRoles.filter(ur => {
        if (ur.userId === userId) {
            userRoleIndex.delete(`${ur.userId}:${ur.roleId}`);
            return false;
        }
        return true;
    });
}

function syncUserRole(userId, roleId) {
    removeAllUserRoles(userId);
    userRoleIndex.add(`${userId}:${roleId}`);
    userRoles.push({
        userId,
        roleId,
        assignedBy: "admin_update",
        assignedAt: new Date().toISOString()
    });
    bumpUserRolesVersion(userId);
}

module.exports = {
    ROLES,
    getAllRoles,
    findRoleById,
    getUserRoles,
    userHasRole,
    getUserWithRoles,
    assignRoleToUser,
    revokeRoleFromUser,
    getUsersWithRolesList,
    recordAuditLog,
    getAuditLogs,
    countActiveAdmins,
    initRoleData,
    bumpUserRolesVersion,
    getUserRolesVersion,
    removeAllUserRoles,
    syncUserRole
};
