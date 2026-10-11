const assert = require("assert");
const http = require("http");
const app = require("../server");
const { loginAttempts, users } = require("../authService");

// Bộ kiểm thử tự động toàn diện cho KN-38:
// "Kiểm thử các luồng đăng nhập thành công, thất bại và khoá tạm"

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

async function postLogin(body) {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });
    const data = await res.json();
    return { status: res.status, data };
}

// Hàm hỗ trợ in kết quả test màu mè, dễ đọc
function logPass(title) {
    console.log(`  \x1b[32m✔ PASS:\x1b[0m ${title}`);
}

function logGroup(title) {
    console.log(`\n\x1b[1m\x1b[36m=== ${title} ===\x1b[0m`);
}

async function runAllTests() {
    console.log("\n=======================================================");
    console.log("   TMS AUTH SUITE - KIỂM THỬ TỰ ĐỘNG (KN-38)          ");
    console.log("=======================================================");

    await startServer();

    try {
        // ----------------------------------------------------
        logGroup("1. KIỂM THỬ CÁC LUỒNG ĐĂNG NHẬP THÀNH CÔNG (SUCCESS)");
        // ----------------------------------------------------
        {
            // Case 1.1: Quản trị viên
            const res = await postLogin({ email: "admin@tms.edu.vn", password: "admin123" });
            assert.strictEqual(res.status, 200, "Admin login phải trả về HTTP 200");
            assert.strictEqual(res.data.success, true);
            assert.strictEqual(res.data.role, "administrator");
            assert.ok(res.data.token, "Token phải được tạo");
            assert.strictEqual(res.data.user.email, "admin@tms.edu.vn");
            logPass("Đăng nhập thành công với vai trò Administrator");
        }

        {
            // Case 1.2: Học viên
            const res = await postLogin({ email: "student@tms.edu.vn", password: "student123" });
            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.data.role, "student");
            logPass("Đăng nhập thành công với vai trò Học viên (student)");
        }

        {
            // Case 1.3: Mã học viên sv001
            const res = await postLogin({ email: "sv001", password: "student123" });
            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.data.role, "student");
            logPass("Đăng nhập thành công bằng Mã học viên (sv001)");
        }

        {
            // Case 1.4: Giảng viên & Trợ giảng
            const resTeacher = await postLogin({ email: "teacher@tms.edu.vn", password: "teacher123" });
            assert.strictEqual(resTeacher.status, 200);
            assert.strictEqual(resTeacher.data.role, "instructor");

            const resTA = await postLogin({ email: "ta@tms.edu.vn", password: "ta123456" });
            assert.strictEqual(resTA.status, 200);
            assert.strictEqual(resTA.data.role, "teaching_assistant");
            logPass("Đăng nhập thành công Giảng viên (instructor) và Trợ giảng (teaching_assistant)");
        }

        // ----------------------------------------------------
        logGroup("2. KIỂM THỬ THẤT BẠI & BẢO MẬT (FAIL & SECURITY - KN-35, KN-37)");
        // ----------------------------------------------------
        {
            // Case 2.1: Sai mật khẩu người dùng tồn tại
            const res = await postLogin({ email: "teacher@tms.edu.vn", password: "mat_khau_sai_hoan_toan" });
            assert.strictEqual(res.status, 401);
            assert.strictEqual(res.data.success, false);
            assert.strictEqual(res.data.message, "Email hoặc mật khẩu không đúng");
            assert.strictEqual(res.data.attemptsLeft, 4);
            logPass("Sai mật khẩu trả về 401 với thông báo bảo mật đồng nhất");
        }

        {
            // Case 2.2: Email không tồn tại trong hệ thống (KN-35)
            const res = await postLogin({ email: "hacker_unknown@attacker.xyz", password: "anypassword" });
            assert.strictEqual(res.status, 401);
            assert.strictEqual(res.data.success, false);
            assert.strictEqual(res.data.message, "Email hoặc mật khẩu không đúng");
            logPass("Email không tồn tại trả về thông báo giống hệt email tồn tại (Ẩn thông tin email)");
        }

        {
            // Case 2.3: Thiếu email hoặc mật khẩu
            const resNoEmail = await postLogin({ password: "123" });
            assert.strictEqual(resNoEmail.status, 400);

            const resNoPass = await postLogin({ email: "admin@tms.edu.vn" });
            assert.strictEqual(resNoPass.status, 400);
            logPass("Thiếu email hoặc mật khẩu bị từ chối với HTTP 400");
        }

        // ----------------------------------------------------
        logGroup("3. KIỂM THỬ CƠ CHẾ KHÓA TẠM SAU 5 LẦN SAI (LOCKOUT - KN-34, KN-36)");
        // ----------------------------------------------------
        {
            const testTargetEmail = "lockout_test@tms.edu.vn";
            // Dọn sạch trạng thái cũ nếu có
            loginAttempts.delete(testTargetEmail);

            // Gửi 4 lần sai
            for (let i = 1; i <= 4; i++) {
                const res = await postLogin({ email: testTargetEmail, password: "wrong_password" });
                assert.strictEqual(res.status, 401);
                assert.strictEqual(res.data.attemptsLeft, 5 - i, `Lần sai ${i} phải còn ${5 - i} lượt`);
            }
            logPass("Đã ghi nhận 4 lần đăng nhập sai liên tiếp với số lượt giảm dần");

            // Lần thứ 5 sai -> Phải kích hoạt khóa tạm
            const res5 = await postLogin({ email: testTargetEmail, password: "wrong_password_5" });
            assert.strictEqual(res5.status, 423, "Lần thứ 5 sai phải trả về HTTP 423 (Locked)");
            assert.strictEqual(res5.data.success, false);
            assert.ok(res5.data.retryAfterSeconds > 800, "Phải trả về thời gian chờ khoảng 15 phút (900s)");
            assert.ok(res5.data.message.includes("khóa"), "Phải có thông báo khóa tạm");
            logPass("Lần thứ 5 sai: Tài khoản bị khóa tạm 15 phút (HTTP 423)");

            // Thử đăng nhập tiếp trong khi đang bị khóa
            const resLocked = await postLogin({ email: testTargetEmail, password: "any" });
            assert.strictEqual(resLocked.status, 423, "Khi đang bị khóa, mọi yêu cầu tiếp theo phải bị chặn 423");
            assert.ok(resLocked.data.retryAfterSeconds > 0);
            logPass("Yêu cầu đăng nhập tiếp theo khi đang khóa vẫn bị chặn 423");
        }

        // ----------------------------------------------------
        logGroup("4. KIỂM THỬ RESET BỘ ĐẾM KHI ĐĂNG NHẬP THÀNH CÔNG (RESET - KN-36)");
        // ----------------------------------------------------
        {
            const resetUserEmail = "accountant@tms.edu.vn";
            loginAttempts.delete(resetUserEmail);

            // Cố tình gõ sai 2 lần
            await postLogin({ email: resetUserEmail, password: "wrong1" });
            await postLogin({ email: resetUserEmail, password: "wrong2" });
            assert.strictEqual(loginAttempts.get(resetUserEmail).count, 2);

            // Lần thứ 3 gõ đúng mật khẩu accountant123
            const resSuccess = await postLogin({ email: resetUserEmail, password: "accountant123" });
            assert.strictEqual(resSuccess.status, 200);
            assert.strictEqual(loginAttempts.has(resetUserEmail), false, "Bộ đếm sai phải được xóa bỏ hoàn toàn");
            logPass("Đăng nhập đúng sau các lần sai giúp reset sạch bộ đếm thất bại");
        }

        console.log("\n\x1b[32m✔ TẤT CẢ CÁC CA KIỂM THỬ ĐÃ VƯỢT QUA THÀNH CÔNG 100%!\x1b[0m\n");
    } finally {
        await stopServer();
    }
}

runAllTests().catch((err) => {
    console.error("\n\x1b[31m✖ KIỂM THỬ THẤT BẠI:\x1b[0m", err);
    process.exit(1);
});
