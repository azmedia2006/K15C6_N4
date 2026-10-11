/**
 * Migration Script: KN-57 - Chuyển đổi mô hình dữ liệu vai trò sang Nhiều - Nhiều (N-N)
 * Thực hiện:
 * 1. Khởi tạo cấu trúc bảng/tập hợp `roles` và `user_roles` (user_id, role_id, assigned_by, assigned_at).
 * 2. Ràng buộc UNIQUE (user_id, role_id).
 * 3. Chuyển đổi dữ liệu role hiện tại của từng người dùng trong `users` sang `user_roles`.
 * 4. Đảm bảo toàn vẹn dữ liệu, không làm mất vai trò của bất kỳ tài khoản nào.
 */

const { users } = require("../authService");
const { initRoleData, getUserRoles, ROLES } = require("../roleService");

function runMigration() {
    console.log("=======================================================");
    console.log("  MIGRATION: KN-57 - Chuyển đổi vai trò sang N-N      ");
    console.log("=======================================================");

    console.log(`[INFO] Khởi tạo ${ROLES.length} vai trò danh mục chuẩn:`);
    ROLES.forEach(r => console.log(`  - [${r.code}] ${r.name}: ${r.description}`));

    console.log("\n[INFO] Bắt đầu quét và chuyển đổi dữ liệu người dùng...");
    initRoleData();

    let migratedCount = 0;
    users.forEach(u => {
        const roles = getUserRoles(u.id);
        migratedCount += roles.length;
        console.log(`  ✔ User [${u.id}] (${u.email}) -> Vai trò: [${roles.map(r => r.code).join(", ")}]`);
    });

    console.log(`\n[SUCCESS] Migration hoàn tất thành công! Tổng cộng ${migratedCount} bản ghi vai trò đã được tạo.`);
    console.log("=======================================================\n");

    return {
        success: true,
        migratedCount,
        totalUsers: users.length
    };
}

if (require.main === module) {
    runMigration();
}

module.exports = { runMigration };
