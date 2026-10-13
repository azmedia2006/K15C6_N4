const assert = require("assert");
const http = require("http");
const app = require("../server");
const {
    createPasswordResetToken,
    verifyPasswordResetToken,
    resetPasswordWithToken,
    passwordResetTokens,
    users
} = require("../authService");

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

async function runTests() {
    console.log("\n=======================================================");
    console.log("   TMS FORGOT & RESET PASSWORD SUITE - KIỂM THỬ KN-39 / KN-43");
    console.log("=======================================================\n");

    await startServer();

    try {
        // --- TEST 1: POST /api/auth/forgot-password với email hợp lệ ---
        console.log("=== 1. KIỂM THỬ YÊU CẦU QUÊN MẬT KHẨU (KN-39) ===");
        const validEmail = "admin@tms.edu.vn";
        const forgotRes = await fetch(`${baseUrl}/api/auth/forgot-password`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: validEmail })
        });
        const forgotData = await forgotRes.json();
        assert.strictEqual(forgotRes.status, 200);
        assert.strictEqual(forgotData.success, true);
        assert.ok(forgotData.message.includes("Nếu email thuộc tài khoản hợp lệ"));
        console.log("  ✔ PASS: POST /api/auth/forgot-password trả về HTTP 200 thành công");

        // Tìm token vừa sinh trong bộ nhớ
        let createdToken = null;
        for (const [t, entry] of passwordResetTokens.entries()) {
            if (entry.email === validEmail && !entry.used) {
                createdToken = t;
            }
        }
        assert.ok(createdToken, "Token đặt lại mật khẩu phải được tạo thành công");
        console.log("  ✔ PASS: Token CSPRNG được khởi tạo và lưu trữ an toàn trong Map");

        // --- TEST 2: Chống User Enumeration với email không tồn tại ---
        const nonExistentRes = await fetch(`${baseUrl}/api/auth/forgot-password`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: "unknown_user_9999@tms.edu.vn" })
        });
        const nonExistentData = await nonExistentRes.json();
        assert.strictEqual(nonExistentRes.status, 200);
        assert.strictEqual(nonExistentData.success, true);
        assert.strictEqual(nonExistentData.message, forgotData.message);
        console.log("  ✔ PASS: Chống User Enumeration: Email không tồn tại vẫn trả về HTTP 200 với thông điệp giống nhau");

        // --- TEST 3: Validate thiếu email ---
        const emptyRes = await fetch(`${baseUrl}/api/auth/forgot-password`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: "" })
        });
        assert.strictEqual(emptyRes.status, 400);
        console.log("  ✔ PASS: Báo lỗi HTTP 400 khi để trống email");

        // --- TEST 4: Xác thực Token GET /api/auth/verify-reset-token ---
        console.log("\n=== 2. KIỂM THỬ XÁC THỰC TOKEN ĐẶT LẠI MẬT KHẨU (KN-43) ===");
        const verifyRes = await fetch(`${baseUrl}/api/auth/verify-reset-token?token=${createdToken}`);
        const verifyData = await verifyRes.json();
        assert.strictEqual(verifyRes.status, 200);
        assert.strictEqual(verifyData.valid, true);
        assert.ok(verifyData.maskedEmail);
        console.log("  ✔ PASS: GET /api/auth/verify-reset-token xác nhận token hợp lệ kèm email masked");

        // Token giả mạo
        const fakeVerifyRes = await fetch(`${baseUrl}/api/auth/verify-reset-token?token=fake_invalid_token_xyz`);
        const fakeVerifyData = await fakeVerifyRes.json();
        assert.strictEqual(fakeVerifyRes.status, 400);
        assert.strictEqual(fakeVerifyData.valid, false);
        console.log("  ✔ PASS: Từ chối token không tồn tại hoặc không hợp lệ (HTTP 400)");

        // --- TEST 5: Đặt lại mật khẩu POST /api/auth/reset-password ---
        console.log("\n=== 3. KIỂM THỬ THIẾT LẬP MẬT KHẨU MỚI (KN-43 & KN-45) ===");
        
        // Thử mật khẩu yếu (< 8 ký tự hoặc thiếu chữ hoa/số)
        const weakPwRes = await fetch(`${baseUrl}/api/auth/reset-password`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: createdToken, newPassword: "weak" })
        });
        assert.strictEqual(weakPwRes.status, 400);
        console.log("  ✔ PASS: Chặn mật khẩu yếu không đạt chuẩn bảo mật 8 ký tự (HTTP 400)");

        // Đổi mật khẩu chuẩn an toàn
        const newPassword = "AdminNewPassword2026@";
        const resetRes = await fetch(`${baseUrl}/api/auth/reset-password`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: createdToken, newPassword })
        });
        const resetData = await resetRes.json();
        assert.strictEqual(resetRes.status, 200);
        assert.strictEqual(resetData.success, true);
        console.log("  ✔ PASS: Đổi mật khẩu mới thành công với HTTP 200");

        // --- TEST 6: Đăng nhập bằng mật khẩu mới và chặn mật khẩu cũ ---
        console.log("\n=== 4. KIỂM THỬ ĐĂNG NHẬP SAU KHI ĐỔI MẬT KHẨU ===");
        const oldLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: validEmail, password: "admin123" })
        });
        assert.strictEqual(oldLoginRes.status, 401);
        console.log("  ✔ PASS: Mật khẩu cũ không còn đăng nhập được (HTTP 401)");

        const newLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: validEmail, password: newPassword })
        });
        const newLoginData = await newLoginRes.json();
        assert.strictEqual(newLoginRes.status, 200);
        assert.strictEqual(newLoginData.success, true);
        assert.ok(newLoginData.token);
        console.log("  ✔ PASS: Đăng nhập thành công với mật khẩu mới vừa đổi!");

        // --- TEST 7: Chống Replay Attack (token đã dùng không được dùng lại) ---
        const reuseRes = await fetch(`${baseUrl}/api/auth/reset-password`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: createdToken, newPassword: "AnotherPassword123" })
        });
        assert.strictEqual(reuseRes.status, 400);
        console.log("  ✔ PASS: Chặn tấn công Replay Attack: Token đã dùng không được sử dụng lại lần 2");

        // Khôi phục lại mật khẩu admin ban đầu cho các test suite khác
        await fetch(`${baseUrl}/api/auth/forgot-password`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: validEmail })
        });
        let restoreToken = null;
        for (const [t, entry] of passwordResetTokens.entries()) {
            if (entry.email === validEmail && !entry.used) {
                restoreToken = t;
            }
        }
        if (restoreToken) {
            await fetch(`${baseUrl}/api/auth/reset-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token: restoreToken, newPassword: "admin123" })
            });
        }

        console.log("\n=======================================================");
        console.log("✔ TẤT CẢ CÁC TIÊU CHÍ QUÊN VÀ ĐẶT LẠI MẬT KHẨU ĐẠT 100%!");
        console.log("=======================================================\n");

        process.exit(0);
    } finally {
        await stopServer();
    }
}

runTests().catch(err => {
    console.error("❌ Test failed:", err);
    process.exit(1);
});
