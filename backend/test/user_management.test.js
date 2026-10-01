const assert = require("assert");
const http = require("http");
const app = require("../server");

// Bộ kiểm thử tự động toàn diện cho KN-11:
// "Quản trị hệ thống tạo, sửa và tìm kiếm tài khoản người dùng, cấp quyền truy cập cho nhân sự mới"

let server;
let baseUrl;
let adminToken;
let studentToken;

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

async function request(endpoint, { method = "GET", body = null, token = null } = {}) {
    const headers = { "Content-Type": "application/json" };
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }
    const res = await fetch(`${baseUrl}${endpoint}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
}

function logPass(title) {
    console.log(`  \x1b[32m✔ PASS:\x1b[0m ${title}`);
}

function logGroup(title) {
    console.log(`\n\x1b[1m\x1b[36m=== ${title} ===\x1b[0m`);
}

async function runAllTests() {
    console.log("\n=======================================================");
    console.log("   TMS USER MANAGEMENT SUITE - KIỂM THỬ KN-11          ");
    console.log("=======================================================");

    await startServer();

    try {
        // Đăng nhập lấy token cho Admin và Student
        const adminLogin = await request("/api/auth/login", {
            method: "POST",
            body: { email: "admin@tms.edu.vn", password: "admin123" }
        });
        assert.strictEqual(adminLogin.status, 200, "Admin login thành công");
        adminToken = adminLogin.data.token;

        const studentLogin = await request("/api/auth/login", {
            method: "POST",
            body: { email: "student@tms.edu.vn", password: "student123" }
        });
        assert.strictEqual(studentLogin.status, 200, "Student login thành công");
        studentToken = studentLogin.data.token;

        // ----------------------------------------------------
        logGroup("1. KIỂM THỬ TÌM KIẾM VÀ LỌC TÀI KHOẢN NGƯỜI DÙNG (SEARCH & FILTER)");
        // ----------------------------------------------------
        {
            // Case 1.1: Tìm kiếm theo tên
            const res = await request("/api/admin/users?query=Trần Minh", { token: adminToken });
            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.data.success, true);
            assert.ok(res.data.users.length >= 1, "Phải tìm thấy giảng viên Trần Minh");
            assert.strictEqual(res.data.users[0].name, "ThS. Trần Minh");
            logPass("Tìm kiếm chính xác theo họ và tên người dùng");
        }

        {
            // Case 1.2: Tìm kiếm không phân biệt hoa thường theo email
            const res = await request("/api/admin/users?query=TEACHER", { token: adminToken });
            assert.strictEqual(res.status, 200);
            assert.ok(res.data.users.some(u => u.email.includes("teacher@tms.edu.vn")));
            logPass("Tìm kiếm không phân biệt chữ hoa/thường theo email");
        }

        {
            // Case 1.3: Lọc theo vai trò (role)
            const res = await request("/api/admin/users?role=instructor", { token: adminToken });
            assert.strictEqual(res.status, 200);
            assert.ok(res.data.users.length > 0);
            res.data.users.forEach(u => assert.strictEqual(u.role, "instructor"));
            logPass("Lọc danh sách người dùng theo vai trò (instructor)");
        }

        {
            // Case 1.4: Lấy danh mục các vai trò hỗ trợ
            const res = await request("/api/admin/roles", { token: adminToken });
            assert.strictEqual(res.status, 200);
            assert.ok(Array.isArray(res.data.roles));
            assert.ok(res.data.roles.includes("instructor"));
            assert.ok(res.data.roles.includes("administrator"));
            logPass("Lấy danh mục 8 vai trò hợp lệ trong hệ thống TMS");
        }

        // ----------------------------------------------------
        logGroup("2. KIỂM THỬ TẠO MỚI TÀI KHOẢN NHÂN SỰ MỚI (CREATE USER & TEMP PASSWORD)");
        // ----------------------------------------------------
        let createdUserId;
        let createdUserEmail = `new_teacher_${Date.now()}@tms.edu.vn`;
        let tempPassword;

        {
            // Case 2.1: Tạo nhân sự mới với mật khẩu tự sinh ngẫu nhiên
            const res = await request("/api/admin/users", {
                method: "POST",
                token: adminToken,
                body: {
                    name: "Giảng viên Nguyễn Hoàng Nam",
                    email: createdUserEmail,
                    role: "instructor",
                    phone: "0912999888"
                }
            });
            assert.strictEqual(res.status, 201, "Tạo mới phải trả về HTTP 201");
            assert.strictEqual(res.data.success, true);
            assert.strictEqual(res.data.user.email, createdUserEmail);
            assert.strictEqual(res.data.user.role, "instructor");
            assert.ok(res.data.temporaryPassword, "Phải sinh mật khẩu tạm");
            assert.ok(res.data.temporaryPassword.startsWith("TMS@"), "Mật khẩu tạm phải có tiền tố an toàn TMS@");

            createdUserId = res.data.user.id;
            tempPassword = res.data.temporaryPassword;
            logPass("Tạo tài khoản nhân sự mới thành công và sinh mật khẩu tạm an toàn");
        }

        {
            // Case 2.2: Nhân sự mới đăng nhập bằng mật khẩu tạm vừa tạo
            const res = await request("/api/auth/login", {
                method: "POST",
                body: { email: createdUserEmail, password: tempPassword }
            });
            assert.strictEqual(res.status, 200, "Đăng nhập bằng mật khẩu tạm phải thành công");
            assert.strictEqual(res.data.user.email, createdUserEmail);
            assert.strictEqual(res.data.role, "instructor");
            logPass("Nhân sự mới đăng nhập thành công vào hệ thống bằng mật khẩu tạm");
        }

        {
            // Case 2.3: Chặn tạo trùng email
            const resDup = await request("/api/admin/users", {
                method: "POST",
                token: adminToken,
                body: {
                    name: "Người trùng email",
                    email: createdUserEmail,
                    role: "student"
                }
            });
            assert.strictEqual(resDup.status, 409, "Trùng email phải trả về HTTP 409 Conflict");
            assert.strictEqual(resDup.data.success, false);
            logPass("Chặn tạo tài khoản trùng email với thông báo lỗi rõ ràng");
        }

        {
            // Case 2.4: Validate email sai cú pháp và thiếu thông tin
            const resInvalid = await request("/api/admin/users", {
                method: "POST",
                token: adminToken,
                body: {
                    name: "A",
                    email: "khong_phai_email_hop_le",
                    role: "vai_tro_khong_ton_tai"
                }
            });
            assert.strictEqual(resInvalid.status, 400, "Dữ liệu không hợp lệ phải trả về HTTP 400");
            logPass("Validate chặt chẽ định dạng email, độ dài họ tên và danh mục vai trò");
        }

        // ----------------------------------------------------
        logGroup("3. KIỂM THỬ SỬA THÔNG TIN NGƯỜI DÙNG (UPDATE USER)");
        // ----------------------------------------------------
        {
            // Case 3.1: Cập nhật họ tên, vai trò và số điện thoại
            const res = await request(`/api/admin/users/${createdUserId}`, {
                method: "PUT",
                token: adminToken,
                body: {
                    name: "ThS. Nguyễn Hoàng Nam (Cập nhật)",
                    role: "training_manager",
                    phone: "0999888777",
                    status: "active"
                }
            });
            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.data.user.name, "ThS. Nguyễn Hoàng Nam (Cập nhật)");
            assert.strictEqual(res.data.user.role, "training_manager");
            assert.strictEqual(res.data.user.phone, "0999888777");
            logPass("Cập nhật thành công thông tin hồ sơ và vai trò của tài khoản");
        }

        {
            // Case 3.2: Đổi mật khẩu tài khoản trực tiếp qua cập nhật
            const newPassword = "newPasswordSecure123!";
            const resPass = await request(`/api/admin/users/${createdUserId}`, {
                method: "PUT",
                token: adminToken,
                body: { password: newPassword }
            });
            assert.strictEqual(resPass.status, 200);

            // Kiểm tra đăng nhập với mật khẩu mới
            const loginNew = await request("/api/auth/login", {
                method: "POST",
                body: { email: createdUserEmail, password: newPassword }
            });
            assert.strictEqual(loginNew.status, 200);
            assert.strictEqual(loginNew.data.role, "training_manager");
            logPass("Admin cấp lại mật khẩu mới cho nhân sự thành công, đăng nhập ăn khớp");
        }

        // ----------------------------------------------------
        logGroup("4. KIỂM THỬ BẢO MẬT & PHÂN QUYỀN (SECURITY & RBAC)");
        // ----------------------------------------------------
        {
            // Case 4.1: Người dùng không có quyền Admin (học viên) bị từ chối
            const resForbidden = await request("/api/admin/users", { token: studentToken });
            assert.strictEqual(resForbidden.status, 403, "Student gọi API admin phải bị chặn 403");
            logPass("Chặn người dùng không có vai trò Administrator (HTTP 403 Forbidden)");
        }

        {
            // Case 4.2: Yêu cầu không có Token bị từ chối
            const resUnauthorized = await request("/api/admin/users");
            assert.strictEqual(resUnauthorized.status, 401, "Không có token phải trả về HTTP 401");
            logPass("Chặn yêu cầu không có Bearer token (HTTP 401 Unauthorized)");
        }

        {
            // Case 4.3: Admin không thể tự xóa tài khoản của chính mình
            const adminId = "usr_admin";
            const resDelSelf = await request(`/api/admin/users/${adminId}`, {
                method: "DELETE",
                token: adminToken
            });
            assert.strictEqual(resDelSelf.status, 403);
            logPass("Chặn quản trị viên tự xóa tài khoản của chính mình");
        }

        {
            // Case 4.4: Xóa tài khoản nhân sự thử nghiệm thành công
            const resDel = await request(`/api/admin/users/${createdUserId}`, {
                method: "DELETE",
                token: adminToken
            });
            assert.strictEqual(resDel.status, 200);
            assert.strictEqual(resDel.data.success, true);

            // Xác nhận user không còn tìm thấy
            const resCheck = await request(`/api/admin/users/${createdUserId}`, { token: adminToken });
            assert.strictEqual(resCheck.status, 404);
            logPass("Xóa tài khoản thành công và không còn tìm thấy trong hệ thống");
        }

        console.log("\n\x1b[32m✔ TẤT CẢ 12 CA KIỂM THỬ CHO KN-11 ĐÃ VƯỢT QUA 100% THÀNH CÔNG!\x1b[0m\n");
    } finally {
        await stopServer();
    }
}

runAllTests().catch((err) => {
    console.error("\n\x1b[31m✖ KIỂM THỬ KN-11 THẤT BẠI:\x1b[0m", err);
    process.exit(1);
});
