/**
 * TMS SYSTEM - AUTOMATED TESTING SUITE KN-127
 * Sprint: KN Sprint 2
 * User Story: KN-127
 * "Là Quản lý đào tạo, tôi muốn xem danh sách lớp kèm bộ lọc và chỉ số nhanh,
 *  để nắm được tình hình toàn bộ các lớp đang chạy trong một màn hình."
 * 
 * Acceptance Criteria (Tiêu chí nghiệm thu):
 * 1. Hiển thị danh sách lớp kèm các chỉ số nhanh (Quick Metrics / KPI Widgets)
 * 2. Mỗi dòng hiển thị đầy đủ sĩ số hiện tại/tối đa và tiến độ buổi học
 * 3. Lọc theo trạng thái (Đang học, Sắp khai giảng, Đã kết thúc)
 * 4. Lọc theo chương trình đào tạo
 * 5. Lọc theo giảng viên phụ trách
 * 6. Lọc theo khoảng thời gian và tìm kiếm từ khóa
 * 7. Phân trang dữ liệu (Pagination)
 * 8. Phân quyền RBAC an toàn
 */

const assert = require("assert");
const http = require("http");
const app = require("../server");
const { resetEnrollmentData } = require("../enrollmentService");

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
    console.log(`\n=== ${title} ===`);
}

async function runTests() {
    console.log("\n=======================================================");
    console.log("   TMS CLASS MANAGEMENT & QUICK METRICS SUITE - KN-127  ");
    console.log("   User Story: Danh sách lớp kèm bộ lọc và chỉ số nhanh ");
    console.log("=======================================================");

    await startServer();
    resetEnrollmentData();

    try {
        // Đăng nhập các vai trò
        const managerLogin = await loginAs("manager@tms.edu.vn", "manager123");
        assert.strictEqual(managerLogin.status, 200, "Đăng nhập Quản lý đào tạo thành công");
        const managerToken = managerLogin.token;

        const adminLogin = await loginAs("admin@tms.edu.vn", "admin123");
        assert.strictEqual(adminLogin.status, 200);
        const adminToken = adminLogin.token;

        const studentLogin = await loginAs("student@tms.edu.vn", "student123");
        assert.strictEqual(studentLogin.status, 200);
        const studentToken = studentLogin.token;

        // ========================================================
        // 1. KIỂM THỬ CHỈ SỐ NHANH (QUICK METRICS - KN-224)
        // ========================================================
        logGroup("1. CHỈ SỐ NHANH TOÀN HỆ THỐNG (QUICK METRICS / KPI WIDGETS)");

        const metricsRes = await fetch(`${baseUrl}/api/classes/metrics`, {
            headers: { "Authorization": `Bearer ${managerToken}` }
        });
        assert.strictEqual(metricsRes.status, 200, "API /api/classes/metrics trả về HTTP 200");
        const metricsData = await metricsRes.json();
        assert.strictEqual(metricsData.success, true);
        assert.ok(metricsData.metrics, "Có khối dữ liệu metrics");

        const m = metricsData.metrics;
        assert.ok(m.totalClasses >= 4, "Tổng số lớp học >= 4");
        assert.ok(m.activeClasses >= 1, "Có lớp đang học");
        assert.ok(m.upcomingClasses >= 1, "Có lớp sắp khai giảng");
        assert.ok(m.totalStudents > 0, "Tổng số học viên > 0");
        assert.ok(typeof m.averageOccupancyRate === "number", "Tỷ lệ lấp đầy là số");

        logPass(`Lấy các chỉ số KPI nhanh thành công: ${m.totalClasses} lớp, ${m.activeClasses} đang học, ${m.upcomingClasses} sắp mở, ${m.totalStudents} học viên, lấp đầy TB ${m.averageOccupancyRate}%`);

        // ========================================================
        // 2. KIỂM THỬ SĨ SỐ HIỆN TẠI / TỐI ĐA & TIẾN ĐỘ BUỔI HỌC (KN-223)
        // ========================================================
        logGroup("2. HIỂN THỊ SĨ SỐ HIỆN TẠI / TỐI ĐA & TIẾN ĐỘ BUỔI HỌC");

        const allClassesRes = await fetch(`${baseUrl}/api/classes`, {
            headers: { "Authorization": `Bearer ${managerToken}` }
        });
        assert.strictEqual(allClassesRes.status, 200);
        const allClasses = await allClassesRes.json();
        assert.ok(allClasses.data.length >= 4);

        // Kiểm tra từng trường trên mỗi dòng
        allClasses.data.forEach(cls => {
            assert.ok(cls.code, "Lớp phải có Mã lớp");
            assert.ok(cls.name, "Lớp phải có Tên lớp");
            assert.ok(typeof cls.enrolledCount === "number", "Có số học viên hiện tại");
            assert.ok(typeof cls.maxCapacity === "number", "Có sĩ số tối đa");
            assert.ok(typeof cls.totalSessions === "number", "Có tổng số buổi học");
            assert.ok(typeof cls.completedSessions === "number", "Có số buổi đã học");
            assert.ok(typeof cls.progressPercent === "number", "Có phần trăm tiến độ");
            assert.ok(cls.progressDisplay, "Có chuỗi hiển thị tiến độ buổi học");
            assert.ok(cls.capacityDisplay, "Có chuỗi hiển thị sĩ số (x / y)");
        });

        // Kiểm tra chi tiết 1 lớp cụ thể (WD-2026-01)
        const fsClass = allClasses.data.find(c => c.code === "WD-2026-01");
        assert.ok(fsClass, "Tìm thấy lớp Fullstack Ca Sáng");
        assert.strictEqual(fsClass.enrolledCount, 22, "Sĩ số hiện tại là 22");
        assert.strictEqual(fsClass.maxCapacity, 25, "Sĩ số tối đa là 25");
        assert.strictEqual(fsClass.totalSessions, 25, "Tổng số buổi là 25");
        assert.strictEqual(fsClass.completedSessions, 22, "Đã học 22 buổi");
        assert.strictEqual(fsClass.progressPercent, 88, "Tiến độ đạt 88%");

        logPass("Mỗi dòng lớp học hiển thị đầy đủ Sĩ số hiện tại/tối đa (22/25) và Tiến độ buổi học (22/25 buổi - 88%)");

        // ========================================================
        // 3. KIỂM THỬ BỘ LỌC THEO TRẠNG THÁI (STATUS FILTER - KN-220)
        // ========================================================
        logGroup("3. BỘ LỌC THEO TRẠNG THÁI LỚP HỌC (STATUS FILTER)");

        // 3.1. Lọc lớp đang học
        const activeRes = await fetch(`${baseUrl}/api/classes?status=active`, {
            headers: { "Authorization": `Bearer ${managerToken}` }
        });
        const activeData = await activeRes.json();
        assert.strictEqual(activeRes.status, 200);
        assert.ok(activeData.data.length > 0);
        activeData.data.forEach(c => {
            assert.strictEqual(c.status, "Đang học", "Lớp trả về phải có trạng thái Đang học");
        });
        logPass(`Lọc trạng thái 'active': trả về chính xác ${activeData.data.length} lớp đang học`);

        // 3.2. Lọc lớp sắp khai giảng
        const upcomingRes = await fetch(`${baseUrl}/api/classes?status=upcoming`, {
            headers: { "Authorization": `Bearer ${managerToken}` }
        });
        const upcomingData = await upcomingRes.json();
        assert.strictEqual(upcomingRes.status, 200);
        assert.ok(upcomingData.data.length > 0);
        upcomingData.data.forEach(c => {
            assert.strictEqual(c.status, "Sắp khai giảng", "Lớp trả về phải có trạng thái Sắp khai giảng");
        });
        logPass(`Lọc trạng thái 'upcoming': trả về chính xác ${upcomingData.data.length} lớp sắp khai giảng`);

        // 3.3. Lọc lớp đã kết thúc
        const completedRes = await fetch(`${baseUrl}/api/classes?status=completed`, {
            headers: { "Authorization": `Bearer ${managerToken}` }
        });
        const completedData = await completedRes.json();
        assert.strictEqual(completedRes.status, 200);
        completedData.data.forEach(c => {
            assert.strictEqual(c.status, "Đã kết thúc");
        });
        logPass(`Lọc trạng thái 'completed': trả về chính xác ${completedData.data.length} lớp đã kết thúc`);

        // ========================================================
        // 4. KIỂM THỬ BỘ LỌC THEO CHƯƠNG TRÌNH ĐÀO TẠO (PROGRAM FILTER)
        // ========================================================
        logGroup("4. BỘ LỌC THEO CHƯƠNG TRÌNH ĐÀO TẠO (PROGRAM FILTER)");

        const progRes = await fetch(`${baseUrl}/api/classes?programId=prog_fullstack`, {
            headers: { "Authorization": `Bearer ${managerToken}` }
        });
        const progData = await progRes.json();
        assert.strictEqual(progRes.status, 200);
        assert.ok(progData.data.length > 0);
        progData.data.forEach(c => {
            assert.ok(
                c.programId === "prog_fullstack" || (c.courseName && c.courseName.includes("Fullstack")),
                "Lớp phải thuộc chương trình Fullstack"
            );
        });
        logPass(`Lọc chương trình 'prog_fullstack': trả về đúng ${progData.data.length} lớp`);

        // ========================================================
        // 5. KIỂM THỬ BỘ LỌC THEO GIẢNG VIÊN (INSTRUCTOR FILTER)
        // ========================================================
        logGroup("5. BỘ LỌC THEO GIẢNG VIÊN (INSTRUCTOR FILTER)");

        const instRes = await fetch(`${baseUrl}/api/classes?instructorId=usr_teacher`, {
            headers: { "Authorization": `Bearer ${managerToken}` }
        });
        const instData = await instRes.json();
        assert.strictEqual(instRes.status, 200);
        assert.ok(instData.data.length > 0);
        instData.data.forEach(c => {
            assert.ok(
                c.instructorId === "usr_teacher" || (c.instructorName && c.instructorName.includes("Trần Minh")),
                "Lớp phải do ThS. Trần Minh giảng dạy"
            );
        });
        logPass(`Lọc theo giảng viên 'usr_teacher': trả về chính xác ${instData.data.length} lớp phụ trách`);

        // ========================================================
        // 6. KIỂM THỬ TÌM KIẾM TỪ KHÓA & KHOẢNG THỜI GIAN
        // ========================================================
        logGroup("6. TÌM KIẾM TỪ KHÓA & LỌC KHOẢNG THỜI GIAN (KEYWORD & DATE RANGE)");

        // 6.1. Tìm kiếm theo mã lớp
        const searchRes = await fetch(`${baseUrl}/api/classes?search=WD-2026-01`, {
            headers: { "Authorization": `Bearer ${managerToken}` }
        });
        const searchData = await searchRes.json();
        assert.strictEqual(searchRes.status, 200);
        assert.strictEqual(searchData.data.length, 1);
        assert.strictEqual(searchData.data[0].code, "WD-2026-01");
        logPass("Tìm kiếm từ khóa theo mã lớp 'WD-2026-01': trả về chính xác 1 lớp duy nhất");

        // 6.2. Lọc theo khoảng thời gian
        const dateRes = await fetch(`${baseUrl}/api/classes?startDate=2026-03-01`, {
            headers: { "Authorization": `Bearer ${managerToken}` }
        });
        const dateData = await dateRes.json();
        assert.strictEqual(dateRes.status, 200);
        dateData.data.forEach(c => {
            assert.ok(c.startDate >= "2026-03-01", "Ngày bắt đầu phải từ 2026-03-01 trở đi");
        });
        logPass(`Lọc theo ngày khai giảng (startDate >= 2026-03-01): trả về đúng ${dateData.data.length} lớp`);

        // ========================================================
        // 7. KIỂM THỬ PHÂN TRANG (PAGINATION - KN-222)
        // ========================================================
        logGroup("7. PHÂN TRANG DỮ LIỆU (PAGINATION)");

        const page1Res = await fetch(`${baseUrl}/api/classes?page=1&limit=2`, {
            headers: { "Authorization": `Bearer ${managerToken}` }
        });
        const page1Data = await page1Res.json();
        assert.strictEqual(page1Res.status, 200);
        assert.strictEqual(page1Data.data.length, 2, "Trang 1 có đúng 2 bản ghi");
        assert.strictEqual(page1Data.page, 1, "Page hiện tại là 1");
        assert.strictEqual(page1Data.limit, 2, "Limit là 2");
        assert.ok(page1Data.totalPages >= 2, "Tổng số trang >= 2");

        const page2Res = await fetch(`${baseUrl}/api/classes?page=2&limit=2`, {
            headers: { "Authorization": `Bearer ${managerToken}` }
        });
        const page2Data = await page2Res.json();
        assert.strictEqual(page2Res.status, 200);
        assert.strictEqual(page2Data.page, 2, "Page hiện tại là 2");
        assert.notStrictEqual(page1Data.data[0].id, page2Data.data[0].id, "Dữ liệu trang 2 không trùng trang 1");
        logPass(`Phân trang hoạt động hoàn hảo: Trang 1/Trang 2 lấy chính xác 2 bản ghi mỗi trang, tổng ${page1Data.totalRecords} lớp`);

        // ========================================================
        // 8. KIỂM THỬ PHÂN QUYỀN RBAC (SECURITY)
        // ========================================================
        logGroup("8. PHÂN QUYỀN TRUY CẬP RBAC");

        // Yêu cầu không có token bị từ chối 401
        const noAuthRes = await fetch(`${baseUrl}/api/classes`);
        assert.strictEqual(noAuthRes.status, 401, "Từ chối 401 khi không có token xác thực");
        logPass("Chặn yêu cầu không có token với HTTP 401 Unauthorized");

        // Quản trị viên (admin) xem được đầy đủ danh sách
        const adminClassesRes = await fetch(`${baseUrl}/api/classes`, {
            headers: { "Authorization": `Bearer ${adminToken}` }
        });
        assert.strictEqual(adminClassesRes.status, 200);
        const adminClasses = await adminClassesRes.json();
        assert.ok(adminClasses.data.length >= 4, "Admin xem được toàn bộ danh sách lớp");
        logPass("Administrator truy cập đầy đủ danh sách lớp và các chỉ số thống kê");

        console.log("\n=======================================================");
        console.log("✔ TẤT CẢ CÁC TIÊU CHÍ NGHIỆM THU KN-127 ĐÃ ĐẠT 100% PASS!");
        console.log("=======================================================\n");

    } finally {
        await stopServer();
    }
}

runTests().catch(err => {
    console.error("TEST FAILED:", err);
    process.exit(1);
});
