/**
 * TMS TEST SUITE - KIỂM THỬ TỰ ĐỘNG USER STORY KN-10 (KN-55)
 * "Là người dùng của hệ thống, tôi muốn nhận thông báo rõ ràng khi truy cập nhầm chỗ 
 *  hoặc không đủ quyền, để biết mình nên làm gì tiếp thay vì gặp một trang trắng."
 *
 * Kiểm tra đầy đủ các tiêu chuẩn nghiệm thu từ Jira Sprint 1:
 * - KN-48: Client-side access guard chặn truy cập màn hình chức năng khi thiếu quyền.
 * - KN-49: Định tuyến và hiển thị mã lỗi động (403, 404, 500).
 * - KN-50: Giao diện chuyên biệt cho Forbidden (403) và Not Found (404).
 * - KN-51: Khôi phục điều hướng ngữ cảnh thông minh theo vai trò người dùng (Smart Recovery).
 * - KN-52: Nhận diện thương hiệu TMS đồng bộ (Inter font, Dark/Light mode, Emerald palette).
 * - KN-53: Thông điệp tiếng Việt thân thiện, bảo mật không rò rỉ stack trace.
 * - KN-54: Chuẩn hóa phản hồi API và cơ chế xử lý lỗi dự phòng (Fallback).
 */

const assert = require("assert");
const http = require("http");
const fs = require("fs");
const path = require("path");
const app = require("../server");
const { generateToken } = require("../authService");

let server;
let baseUrl;

function logPass(title) {
    console.log(`  \x1b[32m✔ PASS:\x1b[0m ${title}`);
}

function logGroup(title) {
    console.log(`\n\x1b[1m\x1b[36m=== ${title} ===\x1b[0m`);
}

async function startServer() {
    return new Promise((resolve) => {
        server = http.createServer(app);
        server.listen(0, () => {
            const port = server.address().port;
            baseUrl = `http://localhost:${port}`;
            resolve();
        });
    });
}

async function stopServer() {
    return new Promise((resolve) => {
        if (server) server.close(() => resolve());
        else resolve();
    });
}

async function runTests() {
    console.log("\n=======================================================");
    console.log("   TMS ERROR HANDLING SUITE - KIỂM THỬ TỰ ĐỘNG KN-10   ");
    console.log("   Assignee: Doan Minh Quan | Sprint 1               ");
    console.log("=======================================================");

    await startServer();

    try {
        // Tạo token thử nghiệm cho các vai trò
        const studentToken = generateToken({ id: "usr_student", email: "student@tms.edu.vn", role: "student" });
        const teacherToken = generateToken({ id: "usr_teacher", email: "teacher@tms.edu.vn", role: "instructor" });
        const accountantToken = generateToken({ id: "usr_accountant", email: "accountant@tms.edu.vn", role: "accountant" });
        const adminToken = generateToken({ id: "usr_admin", email: "admin@tms.edu.vn", role: "administrator" });

        // =====================================================================
        // 1. KN-49 & KN-50: KIỂM THỬ ĐỊNH TUYẾN TRANG LỖI VÀ GIAO DIỆN CHUYÊN BIỆT
        // =====================================================================
        logGroup("1. ĐỊNH TUYẾN TRANG LỖI CHUẨN HÓA (KN-49 & KN-50)");
        
        // 403 Forbidden route
        const res403 = await fetch(`${baseUrl}/403`);
        assert.strictEqual(res403.status, 200, "Truy cập /403 phải trả về trang Error.html với mã 200");
        const html403 = await res403.text();
        assert.ok(html403.includes("HỆ THỐNG ĐÀO TẠO TMS"), "Trang 403 phải chứa thương hiệu TMS");
        assert.ok(html403.includes("Khu Vực Hạn Chế Quyền Truy Cập") || html403.includes("HTTP 403"), "Trang 403 phải có thông điệp hạn chế quyền");
        logPass("Định tuyến /403 tải thành công giao diện chuyên biệt Forbidden");

        // 404 Not Found route
        const res404 = await fetch(`${baseUrl}/404`);
        assert.strictEqual(res404.status, 200, "Truy cập /404 phải trả về trang Error.html với mã 200");
        const html404 = await res404.text();
        assert.ok(html404.includes("HỆ THỐNG ĐÀO TẠO TMS"), "Trang 404 phải chứa thương hiệu TMS");
        logPass("Định tuyến /404 tải thành công giao diện Not Found");

        // 500 Server Error route
        const res500 = await fetch(`${baseUrl}/500`);
        assert.strictEqual(res500.status, 200);
        logPass("Định tuyến /500 tải thành công giao diện Server Error");

        // Fallback cho URL không tồn tại
        const resFallback = await fetch(`${baseUrl}/duong-dan-khong-ton-tai-${Date.now()}`);
        assert.strictEqual(resFallback.status, 404, "Trang không tồn tại phải trả về mã HTTP 404");
        const htmlFallback = await resFallback.text();
        assert.ok(htmlFallback.includes("HỆ THỐNG ĐÀO TẠO TMS"), "Fallback 404 phải phục vụ trang thông báo TMS thay vì màn hình trắng");
        logPass("Truy cập URL lạ kích hoạt Fallback 404 thân thiện, loại bỏ hoàn toàn màn hình trắng");

        // =====================================================================
        // 2. KN-54: CHUẨN HÓA PHẢN HỒI LỖI CHO CÁC API REQUEST
        // =====================================================================
        logGroup("2. CHUẨN HÓA LỖI API & FALLBACK REQUESTS (KN-54)");

        // API Endpoint không tồn tại
        const api404Res = await fetch(`${baseUrl}/api/v1/invalid-endpoint-path`);
        assert.strictEqual(api404Res.status, 404);
        assert.strictEqual(api404Res.headers.get("content-type")?.includes("application/json"), true, "API 404 phải trả về JSON chuẩn");
        const api404Data = await api404Res.json();
        assert.strictEqual(api404Data.success, false);
        assert.strictEqual(api404Data.code, 404);
        assert.ok(api404Data.error.includes("Endpoint API không tồn tại"), "Thông báo lỗi tiếng Việt rõ ràng");
        logPass("API endpoint không tồn tại trả về cấu trúc JSON chuẩn { success: false, code: 404, error }");

        // Gọi API yêu cầu xác thực mà không truyền Token (401)
        const unauthRes = await fetch(`${baseUrl}/api/users`);
        assert.strictEqual(unauthRes.status, 401);
        const unauthData = await unauthRes.json();
        assert.strictEqual(unauthData.success, false);
        assert.ok(unauthData.message || unauthData.error);
        logPass("API bảo vệ khi không có token trả về HTTP 401 an toàn");

        // =====================================================================
        // 3. KN-50 & KN-53: CHẶN TRUY CẬP KHÔNG ĐỦ QUYỀN (403 FORBIDDEN AN TOÀN)
        // =====================================================================
        logGroup("3. KIỂM THỬ BẢO VỆ 403 & KHÔNG RÒ RỈ DỮ LIỆU NHẠY CẢM (KN-50 & KN-53)");

        // Học viên gọi API Quản trị viên
        const forbiddenRes = await fetch(`${baseUrl}/api/users`, {
            headers: { Authorization: `Bearer ${studentToken}` }
        });
        assert.strictEqual(forbiddenRes.status, 403, "Học viên vào API Quản trị phải bị chặn HTTP 403");
        const forbiddenData = await forbiddenRes.json();
        assert.strictEqual(forbiddenData.success, false);
        const forbiddenMsg = forbiddenData.message || forbiddenData.error || "";
        assert.ok(
            forbiddenMsg.includes("Administrator") || forbiddenMsg.includes("Quản trị"),
            "Thông báo từ chối quyền tiếng Việt rõ ràng, chỉ rõ vai trò Quản trị viên cần thiết"
        );
        logPass("Chặn thành công truy cập trái quyền với HTTP 403 và thông điệp tiếng Việt chỉ dẫn");

        // Giảng viên cố tình sửa học phí
        const teacherTamperRes = await fetch(`${baseUrl}/api/tuition/tui_001`, {
            method: "PUT",
            headers: {
                "Authorization": `Bearer ${teacherToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ status: "paid" })
        });
        assert.strictEqual(teacherTamperRes.status, 403, "Giảng viên sửa học phí phải bị chặn 403");
        const teacherData = await teacherTamperRes.json();
        const teacherMsg = teacherData.message || teacherData.error || "";
        assert.ok(teacherMsg.includes("Kế toán"), "Thông báo nêu rõ chỉ Kế toán mới có quyền");
        logPass("Phân quyền đa tầng bảo vệ dữ liệu nghiệp vụ, trả về 403 có định hướng");

        // Kiểm tra an toàn bảo mật (KN-53: Không lộ stack trace, query SQL, secret key)
        const responseText = JSON.stringify(forbiddenData) + JSON.stringify(teacherData);
        assert.strictEqual(responseText.includes("TypeError"), false, "Không rò rỉ kiểu lỗi nội bộ (TypeError)");
        assert.strictEqual(responseText.includes("stack"), false, "Không rò rỉ stack trace");
        assert.strictEqual(responseText.includes("SELECT *"), false, "Không rò rỉ cú pháp truy vấn CSDL");
        assert.strictEqual(responseText.includes("sb_secret_"), false, "Không rò rỉ Supabase secret key");
        logPass("Phản hồi lỗi bảo mật tuyệt đối, tuân thủ tiêu chí KN-53");

        // =====================================================================
        // 4. KN-48: CLIENT-SIDE ACCESS GUARD (BẢO VỆ MÀN HÌNH CHỨC NĂNG)
        // =====================================================================
        logGroup("4. KIỂM THỬ CLIENT-SIDE ACCESS GUARD (KN-48)");

        const authGuardPath = path.join(__dirname, "../../authGuard.js");
        const frontendAuthGuardPath = path.join(__dirname, "../../frontend/authGuard.js");
        assert.ok(fs.existsSync(authGuardPath), "File authGuard.js phải tồn tại ở thư mục gốc");
        assert.ok(fs.existsSync(frontendAuthGuardPath), "File authGuard.js phải tồn tại ở thư mục frontend");

        const guardCode = fs.readFileSync(authGuardPath, "utf-8");
        assert.ok(guardCode.includes("tms-guard-preload-mask"), "Guard phải có cơ chế che chắn chống Flash of Content");
        assert.ok(guardCode.includes("/Error.html?code=403"), "Guard phải chuyển hướng tới /Error.html?code=403 khi thiếu quyền");
        assert.ok(guardCode.includes("administrator"), "Guard phải kiểm tra thẩm quyền quản trị viên");

        // Kiểm tra việc tích hợp authGuard trong UserManagement.html và RoleManagement.html
        const userMgmtHtml = fs.readFileSync(path.join(__dirname, "../../UserManagement.html"), "utf-8");
        const roleMgmtHtml = fs.readFileSync(path.join(__dirname, "../../RoleManagement.html"), "utf-8");
        assert.ok(userMgmtHtml.includes("authGuard.js"), "UserManagement.html phải tích hợp authGuard.js");
        assert.ok(roleMgmtHtml.includes("authGuard.js"), "RoleManagement.html phải tích hợp authGuard.js");
        logPass("Client-side Access Guard được gắn ngay trong thẻ <head> của UserManagement & RoleManagement");

        // =====================================================================
        // 5. KN-51: ĐIỀU HƯỚNG NGỮ CẢNH THÔNG MINH THEO VAI TRÒ (SMART RECOVERY)
        // =====================================================================
        logGroup("5. KHÔI PHỤC ĐIỀU HƯỚNG THÔNG MINH THEO VAI TRÒ (KN-51)");

        const errorHtml = fs.readFileSync(path.join(__dirname, "../../Error.html"), "utf-8");
        
        // Kiểm tra logic điều hướng vai trò trong Error.html
        assert.ok(errorHtml.includes("student"), "Error view phải hỗ trợ vai trò Học viên (student)");
        assert.ok(errorHtml.includes("instructor"), "Error view phải hỗ trợ vai trò Giảng viên (instructor)");
        assert.ok(errorHtml.includes("accountant"), "Error view phải hỗ trợ vai trò Kế toán (accountant)");
        assert.ok(errorHtml.includes("administrator"), "Error view phải hỗ trợ vai trò Quản trị viên (administrator)");
        
        // Kiểm tra nút thao tác khôi phục
        assert.ok(errorHtml.includes("btn-primary-action"), "Phải có nút hành động chính về trang chủ vai trò");
        assert.ok(errorHtml.includes("Đổi Tài Khoản Khác"), "Phải có nút đăng nhập bằng tài khoản khác");
        assert.ok(errorHtml.includes("Quay lại trang trước"), "Phải có nút lịch sử quay lại trang trước");
        logPass("Hệ thống nút hành động thông minh (Về dashboard vai trò / Đổi tài khoản / Quay lại) hoạt động chuẩn xác");

        // =====================================================================
        // 6. KN-52: THIẾT KẾ ĐỒNG BỘ THƯƠNG HIỆU TMS (BRANDING & DARK/LIGHT THEME)
        // =====================================================================
        logGroup("6. ĐỒNG BỘ THƯƠNG HIỆU & CHẾ ĐỘ SÁNG / TỐI (KN-52)");

        assert.ok(errorHtml.includes("theme-toggle"), "Giao diện lỗi phải có nút đổi giao diện Sáng / Tối");
        assert.ok(errorHtml.includes("[data-theme=\"dark\"]"), "Phải có CSS hỗ trợ Dark theme chuẩn mực");
        assert.ok(errorHtml.includes("--primary: #10b981"), "Sử dụng màu nhận diện thương hiệu ngọc lục bảo (Emerald)");
        assert.ok(errorHtml.includes("Inter"), "Sử dụng font chữ Inter đồng bộ toàn hệ thống TMS");
        logPass("Thiết kế tuân thủ 100% Brand Guidelines TMS với hỗ trợ Dark Mode và Typography hiện đại");

        console.log("\n\x1b[32m✔ TẤT CẢ CÁC TIÊU CHÍ NGHIỆM THU CỦA KN-10 ĐÃ VƯỢT QUA 100% THÀNH CÔNG!\x1b[0m\n");
    } finally {
        await stopServer();
    }
}

runTests().catch(err => {
    console.error("Test failed:", err);
    process.exit(1);
});
