const assert = require("assert");
const http = require("http");
const app = require("../server");
const { resetLeadsForTesting } = require("../leadService");

// =========================================================================
// BỘ KIỂM THỬ TỰ ĐỘNG CHỨC NĂNG KN-122 (JIRA SPRINT 3)
// User Story: Là Tư vấn tuyển sinh, tôi muốn ghi nhật ký chăm sóc và đặt
// lịch nhắc gọi lại, để không quên lời hứa gọi lại cho khách vào tuần sau.
// Tiêu chí chấp nhận (Acceptance Criteria):
// 1. Mỗi lần tương tác ghi loại (gọi, nhắn, gặp), nội dung, thời điểm
// 2. Đặt được ngày nhắc gọi lại
// 3. Lead quá hạn gọi lại được đánh dấu nổi bật
// =========================================================================

let server;
let baseUrl;
let admissionsToken;
let studentToken;
let adminToken;
let managerToken;

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

async function request(endpoint, { method = "GET", body = null, token = null, headers = {} } = {}) {
    const reqHeaders = { "Content-Type": "application/json", ...headers };
    if (token) {
        reqHeaders["Authorization"] = `Bearer ${token}`;
    }
    const res = await fetch(`${baseUrl}${endpoint}`, {
        method,
        headers: reqHeaders,
        body: body ? JSON.stringify(body) : undefined
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
}

function logPass(title) {
    console.log(`  \x1b[32m✔ PASS:\x1b[0m ${title}`);
}

async function runTests() {
    console.log("=======================================================");
    console.log("   TMS LEAD CARE LOG & REMINDER SUITE - KN-122         ");
    console.log("   Sprint 3: Nhật ký chăm sóc & Đặt lịch nhắc gọi lại  ");
    console.log("   Tiêu chí:                                           ");
    console.log("   • Ghi loại (gọi, nhắn, gặp), nội dung, thời điểm    ");
    console.log("   • Đặt được ngày nhắc gọi lại (lời hứa gọi tuần sau) ");
    console.log("   • Đánh dấu nổi bật Lead quá hạn gọi lại             ");
    console.log("=======================================================\n");

    await startServer();
    resetLeadsForTesting();

    try {
        // Đăng nhập lấy Bearer token cho các vai trò
        const loginAdmissions = await request("/api/auth/login", {
            method: "POST",
            body: { email: "admissions@tms.edu.vn", password: "admissions123" }
        });
        admissionsToken = loginAdmissions.data.token;

        const loginAdmin = await request("/api/auth/login", {
            method: "POST",
            body: { email: "admin@tms.edu.vn", password: "admin123" }
        });
        adminToken = loginAdmin.data.token;

        const loginManager = await request("/api/auth/login", {
            method: "POST",
            body: { email: "manager@tms.edu.vn", password: "manager123" }
        });
        managerToken = loginManager.data.token;

        const loginStudent = await request("/api/auth/login", {
            method: "POST",
            body: { email: "student@tms.edu.vn", password: "student123" }
        });
        studentToken = loginStudent.data.token;

        // =========================================================================
        // TIÊU CHÍ 1: GHI NHẬN ĐẦY ĐỦ LOẠI HÌNH (GỌI, NHẮN, GẶP), NỘI DUNG, THỜI ĐIỂM
        // =========================================================================
        console.log("=== 1. GHI NHẬT KÝ CHĂM SÓC: LOẠI (GỌI, NHẮN, GẶP), NỘI DUNG, THỜI ĐIỂM ===");

        // 1.1 Ghi nhận tương tác loại "Gọi điện" (call)
        const callLogRes = await request("/api/leads/lead_init_001/care-logs", {
            method: "POST",
            token: admissionsToken,
            body: {
                type: "gọi",
                content: "Gọi điện tư vấn chi tiết học phí và lộ trình đào tạo Fullstack Developer",
                interactedAt: new Date().toISOString(),
                result: "Quan tâm cao"
            }
        });
        assert.strictEqual(callLogRes.status, 201);
        assert.strictEqual(callLogRes.data.success, true);
        assert.strictEqual(callLogRes.data.log.type, "call");
        assert.strictEqual(callLogRes.data.log.typeLabel, "Gọi điện");
        assert.ok(callLogRes.data.log.content.includes("học phí"));
        assert.ok(callLogRes.data.log.interactedAt);
        logPass('Ghi nhận tương tác loại "Gọi điện" (call) thành công với đầy đủ nội dung và thời điểm');

        // 1.2 Ghi nhận tương tác loại "Nhắn tin" (message / zalo / sms)
        const msgLogRes = await request("/api/leads/lead_init_001/care-logs", {
            method: "POST",
            token: admissionsToken,
            body: {
                type: "nhắn",
                content: "Gửi tài liệu PDF syllabus môn Node.js qua Zalo cho học viên tham khảo trước",
                interactedAt: new Date().toISOString(),
                result: "Đã gửi tài liệu"
            }
        });
        assert.strictEqual(msgLogRes.status, 201);
        assert.strictEqual(msgLogRes.data.log.type, "message");
        assert.strictEqual(msgLogRes.data.log.typeLabel, "Nhắn tin");
        logPass('Ghi nhận tương tác loại "Nhắn tin" (message/zalo) thành công với đầy đủ nội dung và thời điểm');

        // 1.3 Ghi nhận tương tác loại "Gặp trực tiếp" (meeting)
        const meetLogRes = await request("/api/leads/lead_init_002/care-logs", {
            method: "POST",
            token: admissionsToken,
            body: {
                type: "gặp",
                content: "Học viên cùng phụ huynh đến trực tiếp văn phòng xem cơ sở vật chất phòng Lab máy lạnh",
                interactedAt: new Date().toISOString(),
                result: "Sắp đăng ký"
            }
        });
        assert.strictEqual(meetLogRes.status, 201);
        assert.strictEqual(meetLogRes.data.log.type, "meeting");
        assert.strictEqual(meetLogRes.data.log.typeLabel, "Gặp trực tiếp");
        logPass('Ghi nhận tương tác loại "Gặp trực tiếp" (meeting) thành công với đầy đủ nội dung và thời điểm');

        // 1.4 Bắt lỗi nếu thiếu loại hình tương tác
        const missingTypeRes = await request("/api/leads/lead_init_001/care-logs", {
            method: "POST",
            token: admissionsToken,
            body: {
                type: "",
                content: "Thiếu loại hình tương tác"
            }
        });
        assert.strictEqual(missingTypeRes.status, 400);
        assert.strictEqual(missingTypeRes.data.code, "MISSING_INTERACTION_TYPE");
        logPass("Validate chặt chẽ: Bắt lỗi khi người dùng bỏ trống loại hình tương tác");

        // 1.5 Bắt lỗi nếu thiếu nội dung tương tác
        const missingContentRes = await request("/api/leads/lead_init_001/care-logs", {
            method: "POST",
            token: admissionsToken,
            body: {
                type: "gọi",
                content: "   "
            }
        });
        assert.strictEqual(missingContentRes.status, 400);
        assert.strictEqual(missingContentRes.data.code, "MISSING_CONTENT");
        logPass("Validate chặt chẽ: Bắt lỗi khi người dùng không nhập nội dung chi tiết tương tác");

        // =========================================================================
        // TIÊU CHÍ 2: ĐẶT ĐƯỢC NGÀY NHẮC GỌI LẠI (LỜI HỨA GỌI LẠI VÀO TUẦN SAU)
        // =========================================================================
        console.log("\n=== 2. ĐẶT LỊCH NHẮC GỌI LẠI (HẸN TUẦN SAU THEO LỜI HỨA VỚI KHÁCH) ===");

        // Tính ngày tuần sau (+7 ngày)
        const nextWeekDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        const callbackNoteText = "Khách dặn tuần sau gọi lại sau khi thi học kỳ xong để chốt lịch khai giảng";

        const scheduleRes = await request("/api/leads/lead_init_001/care-logs", {
            method: "POST",
            token: admissionsToken,
            body: {
                type: "gọi",
                content: "Khách đang trong tuần thi kết thúc học phần, hứa gọi lại vào tuần sau",
                callbackDate: nextWeekDate,
                callbackNote: callbackNoteText
            }
        });

        assert.strictEqual(scheduleRes.status, 201);
        assert.ok(scheduleRes.data.lead.nextCallbackDate);
        assert.strictEqual(scheduleRes.data.lead.callbackStatus, "pending");
        assert.strictEqual(scheduleRes.data.lead.callbackNote, callbackNoteText);
        assert.strictEqual(scheduleRes.data.lead.callbackUrgency, "next_week");
        logPass("Đặt lịch hẹn gọi lại tuần sau thành công: nextCallbackDate, callbackNote, callbackStatus='pending'");

        // Kiểm tra tra cứu chi tiết Lead trả về thông tin lịch hẹn đầy đủ
        const leadDetailRes = await request("/api/leads/lead_init_001", {
            token: admissionsToken
        });
        assert.strictEqual(leadDetailRes.status, 200);
        assert.strictEqual(leadDetailRes.data.data.nextCallbackDate, nextWeekDate);
        assert.strictEqual(leadDetailRes.data.data.callbackStatus, "pending");
        assert.strictEqual(leadDetailRes.data.data.callbackNote, callbackNoteText);
        logPass("Tra cứu chi tiết Lead phản hồi chuẩn xác dữ liệu lịch hẹn gọi lại vừa tạo");

        // Kiểm tra danh sách Care Logs của Lead
        const careLogsListRes = await request("/api/leads/lead_init_001/care-logs", {
            token: admissionsToken
        });
        assert.strictEqual(careLogsListRes.status, 200);
        assert.ok(Array.isArray(careLogsListRes.data.data));
        assert.ok(careLogsListRes.data.data.length >= 3);
        assert.strictEqual(careLogsListRes.data.data[0].callbackDate, nextWeekDate);
        logPass("API /api/leads/:id/care-logs trả về lịch sử tương tác chăm sóc sắp xếp mới nhất lên đầu");

        // =========================================================================
        // TIÊU CHÍ 3: ĐÁNH DẤU NỔI BẬT LEAD QUÁ HẠN GỌI LẠI & TÍNH SỐ NGÀY QUÁ HẠN
        // =========================================================================
        console.log("\n=== 3. ĐÁNH DẤU NỔI BẬT LEAD QUÁ HẠN GỌI LẠI (OVERDUE DETECTION) ===");

        // Hồ sơ mẫu lead_kn122_001 (LD-202610-020 Phan Đình Trọng) có lịch hẹn từ 2 ngày trước và chưa liên hệ lại
        const overdueLeadRes = await request("/api/leads/lead_kn122_001", {
            token: admissionsToken
        });
        assert.strictEqual(overdueLeadRes.status, 200);
        const overdueLead = overdueLeadRes.data.data;
        assert.strictEqual(overdueLead.isOverdue, true, "Hồ sơ trễ hạn phải có cờ isOverdue = true");
        assert.ok(overdueLead.overdueDays >= 1, "Số ngày quá hạn phải >= 1");
        assert.strictEqual(overdueLead.callbackUrgency, "overdue");
        assert.strictEqual(overdueLead.callbackStatus, "pending");
        logPass(`Phát hiện Lead quá hạn chuẩn xác: isOverdue=true, quá hạn ${overdueLead.overdueDays} ngày (urgency: 'overdue')`);

        // Hồ sơ mẫu lead_kn122_003 (LD-202610-022 Trần Tuấn Kiệt) có lịch hẹn trong ngày hôm nay
        const todayLeadRes = await request("/api/leads/lead_kn122_003", {
            token: admissionsToken
        });
        assert.strictEqual(todayLeadRes.status, 200);
        const todayLead = todayLeadRes.data.data;
        assert.strictEqual(todayLead.callbackUrgency, "today");
        assert.strictEqual(todayLead.isOverdue, false);
        logPass("Nhận diện lịch hẹn gọi lại trong ngày hôm nay: urgency: 'today', isOverdue=false");

        // Lọc danh sách Lead: callbackFilter=overdue
        const filterOverdueRes = await request("/api/leads?callbackFilter=overdue", {
            token: admissionsToken
        });
        assert.strictEqual(filterOverdueRes.status, 200);
        assert.ok(filterOverdueRes.data.data.length >= 1);
        filterOverdueRes.data.data.forEach(l => {
            assert.strictEqual(l.isOverdue, true, "Tất cả kết quả lọc overdue phải có isOverdue=true");
        });
        logPass(`Lọc thành công danh sách Lead quá hạn: callbackFilter=overdue (${filterOverdueRes.data.data.length} hồ sơ)`);

        // Lọc danh sách Lead: callbackFilter=today
        const filterTodayRes = await request("/api/leads?callbackFilter=today", {
            token: admissionsToken
        });
        assert.strictEqual(filterTodayRes.status, 200);
        assert.ok(filterTodayRes.data.data.length >= 1);
        filterTodayRes.data.data.forEach(l => {
            assert.strictEqual(l.callbackUrgency, "today");
            assert.strictEqual(l.callbackStatus, "pending");
        });
        logPass(`Lọc thành công danh sách Lead cần gọi hôm nay: callbackFilter=today (${filterTodayRes.data.data.length} hồ sơ)`);

        // Lọc danh sách Lead: callbackFilter=next_week
        const filterNextWeekRes = await request("/api/leads?callbackFilter=next_week", {
            token: admissionsToken
        });
        assert.strictEqual(filterNextWeekRes.status, 200);
        assert.ok(filterNextWeekRes.data.data.length >= 1);
        logPass(`Lọc thành công danh sách Lead hẹn tuần sau: callbackFilter=next_week (${filterNextWeekRes.data.data.length} hồ sơ)`);

        // Lọc theo hình thức tương tác: interactionType=call / message / meeting
        const filterCallRes = await request("/api/leads?interactionType=call", {
            token: admissionsToken
        });
        assert.strictEqual(filterCallRes.status, 200);
        assert.ok(filterCallRes.data.data.length >= 1);
        logPass(`Lọc thành công hồ sơ theo hình thức tương tác Gọi điện: interactionType=call (${filterCallRes.data.data.length} hồ sơ)`);

        // =========================================================================
        // TIÊU CHÍ 4: HOÀN THÀNH CUỘC GỌI HẸN LẠI (COMPLETE CALLBACK)
        // =========================================================================
        console.log("\n=== 4. HOÀN THÀNH LỊCH NHẮC GỌI LẠI (CLEAR OVERDUE BADGE) ===");

        const completeRes = await request("/api/leads/lead_kn122_001/callbacks/complete", {
            method: "POST",
            token: admissionsToken,
            body: {
                note: "Đã liên hệ lại lúc 14:00, phụ huynh đồng ý ghi danh khóa học Web Fullstack"
            }
        });
        assert.strictEqual(completeRes.status, 200);
        assert.strictEqual(completeRes.data.success, true);
        assert.strictEqual(completeRes.data.lead.callbackStatus, "completed");
        assert.strictEqual(completeRes.data.lead.isOverdue, false);
        assert.strictEqual(completeRes.data.lead.overdueDays, 0);
        assert.strictEqual(completeRes.data.lead.callbackUrgency, "none");
        logPass("Đánh dấu hoàn thành lịch nhắc gọi lại thành công: callbackStatus='completed', xóa cảnh báo quá hạn");

        // Sau khi hoàn thành, lead không còn trong danh sách quá hạn nữa
        const checkOverdueAgainRes = await request("/api/leads?callbackFilter=overdue", {
            token: admissionsToken
        });
        assert.strictEqual(checkOverdueAgainRes.status, 200);
        const stillInOverdue = checkOverdueAgainRes.data.data.some(l => l.id === "lead_kn122_001");
        assert.strictEqual(stillInOverdue, false, "Lead đã hoàn tất không được xuất hiện trong bộ lọc quá hạn nữa");
        logPass("Lead vừa hoàn thành biến mất khỏi danh sách quá hạn ngay lập tức");

        // =========================================================================
        // TIÊU CHÍ 5: THỐNG KÊ LỊCH NHẮC GỌI LẠI (REMINDER DASHBOARD KPI SUMMARY)
        // =========================================================================
        console.log("\n=== 5. THỐNG KÊ LỊCH NHẮC GỌI LẠI (REMINDER DASHBOARD SUMMARY) ===");

        const reminderStatsRes = await request("/api/leads/reminders/summary", {
            token: admissionsToken
        });
        assert.strictEqual(reminderStatsRes.status, 200);
        assert.strictEqual(reminderStatsRes.data.success, true);
        assert.strictEqual(typeof reminderStatsRes.data.overdueCount, "number");
        assert.strictEqual(typeof reminderStatsRes.data.todayCount, "number");
        assert.strictEqual(typeof reminderStatsRes.data.nextWeekCount, "number");
        assert.strictEqual(typeof reminderStatsRes.data.pendingCallbacksCount, "number");
        logPass(`KPI Lịch nhắc gọi lại: ${reminderStatsRes.data.overdueCount} quá hạn, ${reminderStatsRes.data.todayCount} hôm nay, ${reminderStatsRes.data.nextWeekCount} tuần sau`);

        // =========================================================================
        // TIÊU CHÍ 6: KIỂM SOÁT PHÂN QUYỀN VÀ BẢO MẬT (RBAC)
        // =========================================================================
        console.log("\n=== 6. KIỂM SOÁT PHÂN QUYỀN TRUY CẬP (RBAC) ===");

        // 6.1 Học viên (student) bị chặn 403 Forbidden khi cố ghi nhật ký chăm sóc
        const studentForbiddenRes = await request("/api/leads/lead_init_001/care-logs", {
            method: "POST",
            token: studentToken,
            body: {
                type: "gọi",
                content: "Hack tài khoản"
            }
        });
        assert.strictEqual(studentForbiddenRes.status, 403);
        logPass("RBAC: Chặn học viên (student) ghi nhật ký chăm sóc Lead (403 Forbidden)");

        // 6.2 Người lạ không có token bị chặn 401 Unauthorized
        const unauthRes = await request("/api/leads/lead_init_001/care-logs", {
            method: "POST",
            body: {
                type: "gọi",
                content: "Không có token"
            }
        });
        assert.strictEqual(unauthRes.status, 401);
        logPass("RBAC: Chặn truy cập khi không có Authentication Token (401 Unauthorized)");

        // 6.3 Quản trị viên (admin) và Quản lý đào tạo (manager) có toàn quyền
        const adminCareRes = await request("/api/leads/lead_init_003/care-logs", {
            method: "POST",
            token: adminToken,
            body: {
                type: "gọi",
                content: "Admin trực tiếp gọi điện kiểm tra chất lượng tư vấn tuyển sinh",
                result: "Đạt chuẩn"
            }
        });
        assert.strictEqual(adminCareRes.status, 201);
        logPass("RBAC: Quản trị viên (admin) có quyền ghi nhận tương tác chăm sóc");

        const managerCareRes = await request("/api/leads/lead_init_003/care-logs", {
            method: "POST",
            token: managerToken,
            body: {
                type: "nhắn",
                content: "Quản lý gửi thông báo mở lớp bổ sung vào thứ 7 tuần tới",
                result: "Đã gửi"
            }
        });
        assert.strictEqual(managerCareRes.status, 201);
        logPass("RBAC: Quản lý đào tạo (training_manager) có quyền ghi nhận tương tác chăm sóc");

        console.log("\n=======================================================");
        console.log("   TẤT CẢ CÁC BÀI TEST TỰ ĐỘNG KN-122 ĐÃ ĐẠT 100%!     ");
        console.log("=======================================================\n");

    } finally {
        await stopServer();
    }
}

runTests().catch((err) => {
    console.error("\x1b[31mTEST FAILED:\x1b[0m", err);
    process.exit(1);
});
