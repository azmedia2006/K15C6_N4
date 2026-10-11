const assert = require("assert");
const http = require("http");
const app = require("../server");
const supabaseService = require("../supabaseService");
const { users } = require("../authService");
const { getAllRoles, getAllUserRolesAssignments, getAuditLogs } = require("../roleService");

let server;
let baseUrl;

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

function logPass(title) {
    console.log(`  \x1b[32m✔ PASS:\x1b[0m ${title}`);
}

function logGroup(title) {
    console.log(`\n\x1b[1m\x1b[36m=== ${title} ===\x1b[0m`);
}

async function runTests() {
    console.log("\n=======================================================");
    console.log("   TMS SUPABASE SUITE - KIỂM THỬ TỰ ĐỘNG TÍCH HỢP      ");
    console.log("=======================================================");

    await startServer();

    try {
        logGroup("1. KIỂM THỬ KẾT NỐI & SỨC KHỎE SUPABASE (HEALTH CHECK)");
        const health = await supabaseService.checkSupabaseHealth();
        assert.strictEqual(health.configured, true, "Supabase phải được cấu hình URL và Secret Key");
        assert.strictEqual(health.authStatus, "connected", "Supabase Auth Admin API phải kết nối thành công");
        assert.strictEqual(health.storageStatus, "connected", "Supabase Storage bucket tms-database phải sẵn sàng");
        assert.strictEqual(health.jwksStatus, "valid", "Supabase JWKS URL phải phản hồi hợp lệ");
        logPass("Supabase Auth, Storage bucket tms-database và JWKS endpoint hoạt động 100%");

        logGroup("2. KIỂM THỬ ĐỒNG BỘ DỮ LIỆU LÊN SUPABASE (SNAPSHOT SYNC)");
        await supabaseService.syncUsersDatabase(users);
        const storedUsers = await supabaseService.loadFromStorage("users.json");
        assert.ok(Array.isArray(storedUsers), "File users.json trên Supabase Storage phải là mảng");
        assert.strictEqual(storedUsers.length, users.length, "Số lượng users trên Supabase Storage phải khớp");
        logPass(`Đồng bộ ${storedUsers.length} tài khoản người dùng lên Supabase Storage thành công`);

        const roles = getAllRoles();
        const ur = getAllUserRolesAssignments();
        const logs = getAuditLogs();
        await supabaseService.syncRolesDatabase(roles, ur, logs);
        const storedRoles = await supabaseService.loadFromStorage("roles.json");
        assert.strictEqual(storedRoles.length, 8, "8 vai trò chuẩn phải được lưu trên Supabase");
        logPass("Đồng bộ danh mục 8 vai trò và quan hệ phân quyền N-N lên Supabase thành công");

        logGroup("3. KIỂM THỬ CÁC ENDPOINT API SUPABASE TRÊN SERVER");
        const statusRes = await fetch(`${baseUrl}/api/supabase/status`);
        assert.strictEqual(statusRes.status, 200);
        const statusData = await statusRes.json();
        assert.strictEqual(statusData.success, true);
        assert.strictEqual(statusData.authStatus, "connected");
        logPass("GET /api/supabase/status trả về HTTP 200 kèm thông tin kết nối trực tiếp");

        const syncRes = await fetch(`${baseUrl}/api/supabase/sync`, { method: "POST" });
        assert.strictEqual(syncRes.status, 200);
        const syncData = await syncRes.json();
        assert.strictEqual(syncData.success, true);
        logPass("POST /api/supabase/sync kích hoạt đồng bộ toàn bộ dữ liệu thành công");

        console.log("\n\x1b[32m✔ TẤT CẢ CÁC TIÊU CHÍ SUPABASE ĐÃ VƯỢT QUA 100% THÀNH CÔNG!\x1b[0m\n");
    } finally {
        await stopServer();
    }
}

runTests().catch(err => {
    console.error("Test failed:", err);
    process.exit(1);
});
