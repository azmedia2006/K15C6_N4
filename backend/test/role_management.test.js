const assert = require("assert");
const http = require("http");
const app = require("../server");
const { initRoleData, getUserRoles, getAuditLogs, ROLES } = require("../roleService");
const { runMigration } = require("../migrations/migrate_roles_n_n");

let server;
let baseUrl;

async function startServer() {
    return new Promise((resolve) => {
        server = http.createServer(app);
        server.listen(0, "127.0.0.1", () => {
            const port = server.address().port;
            baseUrl = `http://127.0.0.1:${port}`;
            resolve();
        });
    });
}

async function stopServer() {
    return new Promise((resolve) => {
        if (server) {
            server.close(() => resolve());
        } else {
            resolve();
        }
    });
}

// Helper đăng nhập lấy token
async function loginAs(email, password) {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    return { status: res.status, token: data.token, user: data.user, data };
}

function logPass(title) {
    console.log(`  \x1b[32m✔ PASS:\x1b[0m ${title}`);
}

function logGroup(title) {
    console.log(`\n\x1b[1m\x1b[36m=== ${title} ===\x1b[0m`);
}

async function runAllRoleTests() {
    console.log("\n=======================================================");
    console.log("   TMS ROLE SUITE - KIỂM THỬ TỰ ĐỘNG KN-12 (KN-64)   ");
    console.log("=======================================================");

    await startServer();

    try {
        // Reset dữ liệu trước khi test
        initRoleData();

        // Đăng nhập tài khoản Quản trị hệ thống
        const adminLogin = await loginAs("admin@tms.edu.vn", "admin123");
        assert.strictEqual(adminLogin.status, 200);
        const adminToken = adminLogin.token;

        // Đăng nhập tài khoản Giảng viên (người dùng thông thường để test)
        const teacherLogin = await loginAs("teacher@tms.edu.vn", "teacher123");
        assert.strictEqual(teacherLogin.status, 200);
        const teacherToken = teacherLogin.token;
        const teacherId = teacherLogin.user.id;

        // ----------------------------------------------------
        logGroup("1. KIỂM THỬ MIGRATION DỮ LIỆU CŨ (KN-57)");
        // ----------------------------------------------------
        {
            const migrationResult = runMigration();
            assert.strictEqual(migrationResult.success, true);
            assert.strictEqual(migrationResult.totalUsers, 9);
            assert.strictEqual(migrationResult.migratedCount, 9);

            // Kiểm tra user usr_teacher giữ nguyên role instructor
            const teacherRoles = getUserRoles(teacherId);
            assert.strictEqual(teacherRoles.length, 1);
            assert.strictEqual(teacherRoles[0].code, "instructor");
            logPass("Migration giữ nguyên vai trò người dùng cũ đầy đủ");
        }

        // ----------------------------------------------------
        logGroup("2. KIỂM THỬ GÁN NHIỀU VAI TRÒ (GIẢNG VIÊN VÀ QUẢN LÝ ĐÀO TẠO) (KN-58)");
        // ----------------------------------------------------
        {
            // Gán thêm vai trò Quản lý đào tạo (training_manager) cho Giảng viên (usr_teacher)
            const res = await fetch(`${baseUrl}/api/admin/users/${teacherId}/roles`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${adminToken}`
                },
                body: JSON.stringify({ roleId: "training_manager" })
            });

            const data = await res.json();
            assert.strictEqual(res.status, 200);
            assert.strictEqual(data.success, true);

            // Kiểm tra danh sách vai trò hiện tại của usr_teacher
            const roleCodes = data.roles.map(r => r.code);
            assert.ok(roleCodes.includes("instructor"), "Phải còn vai trò Giảng viên");
            assert.ok(roleCodes.includes("training_manager"), "Phải có thêm vai trò Quản lý đào tạo");
            assert.strictEqual(data.roles.length, 2, "Người dùng phải giữ đồng thời 2 vai trò");
            logPass("Gán thành công nhiều vai trò: người dùng vừa là Giảng viên vừa là Quản lý đào tạo");
        }

        // ----------------------------------------------------
        logGroup("3. KIỂM THỬ TÍNH LŨY ĐẲNG KHI GÁN TRÙNG VAI TRÒ (IDEMPOTENCY - KN-58)");
        // ----------------------------------------------------
        {
            // Gán lại vai trò training_manager lần nữa cho cùng user
            const res = await fetch(`${baseUrl}/api/admin/users/${teacherId}/roles`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${adminToken}`
                },
                body: JSON.stringify({ roleId: "training_manager" })
            });

            const data = await res.json();
            assert.strictEqual(res.status, 200);
            assert.strictEqual(data.success, true);
            assert.strictEqual(data.roles.length, 2, "Không được tạo bản ghi trùng lặp (vẫn là 2 vai trò)");
            logPass("Gán trùng vai trò không tạo bản ghi trùng lặp (Idempotent xử lý)");
        }

        // ----------------------------------------------------
        logGroup("4. HIỆU LỰC TỨC THỜI Ở REQUEST TIẾP THEO MÀ KHÔNG CẦN ĐĂNG NHẬP LẠI (KN-60)");
        // ----------------------------------------------------
        {
            // Tài khoản Giảng viên dùng lại token cũ (được cấp từ trước khi gán thêm vai trò)
            // Gửi request lấy thông tin /api/auth/me
            const resMe = await fetch(`${baseUrl}/api/auth/me`, {
                method: "GET",
                headers: { "Authorization": `Bearer ${teacherToken}` }
            });

            const dataMe = await resMe.json();
            assert.strictEqual(resMe.status, 200);
            const myRoles = dataMe.user.roles.map(r => r.code);
            assert.ok(myRoles.includes("training_manager"), "Request tiếp theo với token cũ phải nhận ngay vai trò mới");
            assert.strictEqual(myRoles.length, 2);
            logPass("Thay đổi vai trò có hiệu lực ngay ở request kế tiếp, không cần đăng nhập lại");
        }

        // ----------------------------------------------------
        logGroup("5. KIỂM THỬ THU HỒI VAI TRÒ THÀNH CÔNG (KN-59)");
        // ----------------------------------------------------
        {
            // Thu hồi vai trò training_manager khỏi Giảng viên
            const res = await fetch(`${baseUrl}/api/admin/users/${teacherId}/roles/training_manager`, {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${adminToken}` }
            });

            const data = await res.json();
            assert.strictEqual(res.status, 200);
            assert.strictEqual(data.success, true);
            assert.strictEqual(data.roles.length, 1);
            assert.strictEqual(data.roles[0].code, "instructor");
            logPass("Thu hồi vai trò thành công, danh sách vai trò còn lại chính xác");
        }

        // ----------------------------------------------------
        logGroup("6. CHẶN THU HỒI VAI TRÒ CUỐI CÙNG (KHÔNG ĐỂ RỖNG VAI TRÒ - KN-59)");
        // ----------------------------------------------------
        {
            // Thử thu hồi vai trò duy nhất còn lại (instructor) của usr_teacher
            const res = await fetch(`${baseUrl}/api/admin/users/${teacherId}/roles/instructor`, {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${adminToken}` }
            });

            const data = await res.json();
            assert.strictEqual(res.status, 400);
            assert.strictEqual(data.success, false);
            assert.ok(data.message.includes("ít nhất một vai trò"));
            logPass("Chặn thành công không cho người dùng bị rỗng toàn bộ vai trò (HTTP 400)");
        }

        // ----------------------------------------------------
        logGroup("7. CHẶN TỰ THU HỒI VAI TRÒ QUẢN TRỊ CỦA CHÍNH MÌNH (KN-56)");
        // ----------------------------------------------------
        {
            const adminId = adminLogin.user.id;
            // Admin tự gọi API thu hồi vai trò administrator của chính mình
            const res = await fetch(`${baseUrl}/api/admin/users/${adminId}/roles/administrator`, {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${adminToken}` }
            });

            const data = await res.json();
            assert.strictEqual(res.status, 403, "Phải trả về HTTP 403 Forbidden");
            assert.strictEqual(data.success, false);
            assert.strictEqual(data.message, "Bạn không thể tự thu hồi vai trò Quản trị hệ thống của chính mình.");
            logPass("Admin tự thu hồi vai trò quản trị của chính mình bị từ chối 403 với thông báo tiếng Việt");
        }

        // ----------------------------------------------------
        logGroup("8. CHẶN THU HỒI QUẢN TRỊ VIÊN CUỐI CÙNG TRONG HỆ THỐNG (KN-56)");
        // ----------------------------------------------------
        {
            // Tạo 1 admin tạm thời rồi thử xóa admin duy nhất
            // Hệ thống chỉ có 1 admin duy nhất hiện tại: usr_admin
            // Giả sử có một tài khoản admin khác thử thu hồi usr_admin (hoặc gọi qua service)
            // Thử thu hồi usr_admin với role administrator từ một caller giả lập khác
            const { revokeRoleFromUser } = require("../roleService");
            let blockedError = null;
            try {
                revokeRoleFromUser({
                    userId: "usr_admin",
                    roleId: "administrator",
                    revokedBy: "other_admin_id",
                    ip: "127.0.0.1"
                });
            } catch (err) {
                blockedError = err;
            }

            assert.ok(blockedError, "Phải ném ngoại lệ khi thu hồi admin cuối cùng");
            assert.strictEqual(blockedError.statusCode, 403);
            assert.strictEqual(blockedError.message, "Không thể thu hồi vai trò Quản trị viên cuối cùng trong hệ thống.");
            logPass("Chặn thành công không cho thu hồi vai trò của Quản trị viên cuối cùng (HTTP 403)");
        }

        // ----------------------------------------------------
        logGroup("9. CHẶN NGƯỜI DÙNG KHÔNG PHẢI ADMIN TRUY CẬP API QUẢN TRỊ (KN-58, KN-59)");
        // ----------------------------------------------------
        {
            // Giảng viên gọi API gán vai trò
            const resAssign = await fetch(`${baseUrl}/api/admin/users/${teacherId}/roles`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${teacherToken}`
                },
                body: JSON.stringify({ roleId: "administrator" })
            });
            assert.strictEqual(resAssign.status, 403, "Non-admin gọi gán vai trò phải bị từ chối 403");

            // Giảng viên gọi API thu hồi vai trò
            const resRevoke = await fetch(`${baseUrl}/api/admin/users/${teacherId}/roles/student`, {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${teacherToken}` }
            });
            assert.strictEqual(resRevoke.status, 403, "Non-admin gọi thu hồi vai trò phải bị từ chối 403");
            logPass("Người không phải Quản trị viên gọi API bị từ chối với HTTP 403");
        }

        // ----------------------------------------------------
        logGroup("10. KIỂM THỬ NHẬT KÝ THAO TÁC AUDIT LOG (KN-63)");
        // ----------------------------------------------------
        {
            const resLogs = await fetch(`${baseUrl}/api/admin/audit-logs`, {
                method: "GET",
                headers: { "Authorization": `Bearer ${adminToken}` }
            });

            const dataLogs = await resLogs.json();
            assert.strictEqual(resLogs.status, 200);
            assert.ok(Array.isArray(dataLogs.auditLogs));
            assert.ok(dataLogs.auditLogs.length > 0);

            // Kiểm tra có log thành công
            const hasSuccess = dataLogs.auditLogs.some(l => l.status === "SUCCESS" && l.action === "ASSIGN_ROLE");
            assert.ok(hasSuccess, "Phải có audit log cho thao tác gán vai trò thành công");

            // Kiểm tra có log trường hợp bị từ chối (tự thu hồi admin)
            const hasForbidden = dataLogs.auditLogs.some(l => l.status === "FORBIDDEN" && l.action === "REVOKE_ROLE");
            assert.ok(hasForbidden, "Phải có audit log cho trường hợp tự thu hồi admin bị chặn");

            logPass("Nhật ký thao tác (Audit Log) ghi nhận đầy đủ cho cả trường hợp thành công và bị chặn");
        }

        // ----------------------------------------------------
        logGroup("11. KIỂM THỬ API DANH SÁCH NGƯỜI DÙNG KÈM VAI TRÒ (KN-62)");
        // ----------------------------------------------------
        {
            // Lấy danh sách phân trang
            const resUsers = await fetch(`${baseUrl}/api/admin/users?page=1&limit=5`, {
                method: "GET",
                headers: { "Authorization": `Bearer ${adminToken}` }
            });

            const dataUsers = await resUsers.json();
            assert.strictEqual(resUsers.status, 200);
            assert.strictEqual(dataUsers.users.length, 5);
            assert.ok(Array.isArray(dataUsers.users[0].roles));
            assert.ok(dataUsers.pagination.total >= 9);

            // Lọc theo vai trò administrator
            const resFilter = await fetch(`${baseUrl}/api/admin/users?roleId=administrator`, {
                method: "GET",
                headers: { "Authorization": `Bearer ${adminToken}` }
            });
            const dataFilter = await resFilter.json();
            assert.strictEqual(resFilter.status, 200);
            assert.ok(dataFilter.users.every(u => u.roles.some(r => r.code === "administrator")));
            logPass("API danh sách người dùng kèm vai trò hỗ trợ phân trang và lọc vai trò chính xác");
        }

        console.log("\n\x1b[32m✔ TẤT CẢ 11 NHÓM KIỂM THỬ VAI TRÒ KN-12 ĐÃ ĐẠT 100%!\x1b[0m\n");
    } finally {
        await stopServer();
    }
}

runAllRoleTests().catch((err) => {
    console.error("\n\x1b[31m✖ KIỂM THỬ VAI TRÒ THẤT BẠI:\x1b[0m", err);
    process.exit(1);
});
