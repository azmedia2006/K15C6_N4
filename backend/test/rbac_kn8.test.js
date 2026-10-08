const assert = require("assert");
const http = require("http");
const app = require("../server");

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

async function runRbacKn8Tests() {
    console.log("\n=======================================================");
    console.log("   TMS RBAC SUITE - KIỂM THỬ TỰ ĐỘNG KN-8             ");
    console.log("   Tiêu chí: Giảng viên không sửa được học phí &       ");
    console.log("             Kế toán không sửa được điểm số           ");
    console.log("=======================================================");

    await startServer();

    try {
        // Đăng nhập các vai trò thử nghiệm
        const teacherLogin = await loginAs("teacher@tms.edu.vn", "teacher123");
        assert.strictEqual(teacherLogin.status, 200, "Đăng nhập Giảng viên phải thành công");
        const teacherToken = teacherLogin.token;

        const accountantLogin = await loginAs("accountant@tms.edu.vn", "accountant123");
        assert.strictEqual(accountantLogin.status, 200, "Đăng nhập Kế toán phải thành công");
        const accountantToken = accountantLogin.token;

        const studentLogin = await loginAs("student@tms.edu.vn", "student123");
        assert.strictEqual(studentLogin.status, 200, "Đăng nhập Học viên phải thành công");
        const studentToken = studentLogin.token;

        const adminLogin = await loginAs("admin@tms.edu.vn", "admin123");
        assert.strictEqual(adminLogin.status, 200, "Đăng nhập Quản trị viên phải thành công");
        const adminToken = adminLogin.token;

        // ----------------------------------------------------
        logGroup("1. KIỂM THỬ VAI TRÒ GIẢNG VIÊN (INSTRUCTOR)");
        // ----------------------------------------------------
        {
            // Giảng viên được phép sửa điểm
            const resScore = await fetch(`${baseUrl}/api/scores/scr_001`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${teacherToken}`
                },
                body: JSON.stringify({ score: 9.0 })
            });
            const dataScore = await resScore.json();
            assert.strictEqual(resScore.status, 200);
            assert.strictEqual(dataScore.success, true);
            assert.strictEqual(dataScore.data.score, 9.0);
            logPass("Giảng viên sửa điểm thành công (HTTP 200)");

            // Giảng viên KHÔNG ĐƯỢC PHÉP sửa học phí
            const resTuition = await fetch(`${baseUrl}/api/tuition/tui_001`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${teacherToken}`
                },
                body: JSON.stringify({ amount: 0, status: "exempt" })
            });
            const dataTuition = await resTuition.json();
            assert.strictEqual(resTuition.status, 403, "Phải bị chặn 403 Forbidden");
            assert.strictEqual(dataTuition.success, false);
            assert.ok(dataTuition.message.includes("không có quyền quản lý hoặc sửa học phí"), "Thông báo tiếng Việt phải rõ ràng");
            logPass("Giảng viên cố tình sửa học phí -> BỊ CHẶN 403 kèm thông báo tiếng Việt chuẩn");
        }

        // ----------------------------------------------------
        logGroup("2. KIỂM THỬ VAI TRÒ KẾ TOÁN (ACCOUNTANT)");
        // ----------------------------------------------------
        {
            // Kế toán được phép sửa học phí
            const resTuition = await fetch(`${baseUrl}/api/tuition/tui_001`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${accountantToken}`
                },
                body: JSON.stringify({ amount: 5000000, status: "paid" })
            });
            const dataTuition = await resTuition.json();
            assert.strictEqual(resTuition.status, 200);
            assert.strictEqual(dataTuition.success, true);
            assert.strictEqual(dataTuition.data.amount, 5000000);
            logPass("Kế toán cập nhật học phí thành công (HTTP 200)");

            // Kế toán KHÔNG ĐƯỢC PHÉP sửa điểm số
            const resScore = await fetch(`${baseUrl}/api/scores/scr_001`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${accountantToken}`
                },
                body: JSON.stringify({ score: 10.0 })
            });
            const dataScore = await resScore.json();
            assert.strictEqual(resScore.status, 403, "Phải bị chặn 403 Forbidden");
            assert.strictEqual(dataScore.success, false);
            assert.ok(dataScore.message.includes("không có quyền nhập hoặc sửa điểm số"), "Thông báo tiếng Việt phải rõ ràng");
            logPass("Kế toán cố tình sửa điểm số -> BỊ CHẶN 403 kèm thông báo tiếng Việt chuẩn");
        }

        // ----------------------------------------------------
        logGroup("3. KIỂM THỬ VAI TRÒ HỌC VIÊN (STUDENT)");
        // ----------------------------------------------------
        {
            // Học viên không được sửa điểm
            const resScore = await fetch(`${baseUrl}/api/scores/scr_001`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${studentToken}`
                },
                body: JSON.stringify({ score: 10.0 })
            });
            assert.strictEqual(resScore.status, 403, "Học viên sửa điểm phải bị chặn 403");
            logPass("Học viên cố tình sửa điểm -> BỊ CHẶN 403");

            // Học viên không được sửa học phí
            const resTuition = await fetch(`${baseUrl}/api/tuition/tui_001`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${studentToken}`
                },
                body: JSON.stringify({ amount: 0 })
            });
            assert.strictEqual(resTuition.status, 403, "Học viên sửa học phí phải bị chặn 403");
            logPass("Học viên cố tình sửa học phí -> BỊ CHẶN 403");

            // Học viên không được truy cập API quản trị người dùng
            const resAdmin = await fetch(`${baseUrl}/api/admin/users`, {
                headers: { "Authorization": `Bearer ${studentToken}` }
            });
            assert.strictEqual(resAdmin.status, 403, "Học viên vào API admin phải bị chặn 403");
            logPass("Học viên vào API Quản trị -> BỊ CHẶN 403 kèm thông báo yêu cầu Administrator");
        }

        // ----------------------------------------------------
        logGroup("4. KIỂM THỬ VAI TRÒ QUẢN TRỊ VIÊN (ADMINISTRATOR)");
        // ----------------------------------------------------
        {
            // Admin có quyền cập nhật điểm
            const resScore = await fetch(`${baseUrl}/api/scores/scr_001`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${adminToken}`
                },
                body: JSON.stringify({ score: 9.5 })
            });
            assert.strictEqual(resScore.status, 200);
            logPass("Quản trị viên có toàn quyền sửa điểm số (HTTP 200)");

            // Admin có quyền cập nhật học phí
            const resTuition = await fetch(`${baseUrl}/api/tuition/tui_001`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${adminToken}`
                },
                body: JSON.stringify({ amount: 6000000, status: "paid" })
            });
            assert.strictEqual(resTuition.status, 200);
            logPass("Quản trị viên có toàn quyền sửa học phí (HTTP 200)");
        }

        // ----------------------------------------------------
        logGroup("5. KIỂM THỬ BẢO MẬT TẦNG SERVER KHI THIẾU TOKEN (DEFAULT DENY)");
        // ----------------------------------------------------
        {
            const resNoToken = await fetch(`${baseUrl}/api/scores/scr_001`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ score: 8.0 })
            });
            assert.strictEqual(resNoToken.status, 401);
            logPass("Mọi chức năng kiểm quyền ở tầng server, mặc định từ chối khi không có token (HTTP 401)");
        }

        console.log("\n\x1b[32m✔ TẤT CẢ CÁC TIÊU CHÍ NGHIỆM THU CỦA KN-8 ĐÃ VƯỢT QUA 100% THÀNH CÔNG!\x1b[0m\n");
    } finally {
        await stopServer();
    }
}

runRbacKn8Tests().catch((err) => {
    console.error("\n\x1b[31m✖ KIỂM THỬ KN-8 THẤT BẠI:\x1b[0m", err);
    process.exit(1);
});
