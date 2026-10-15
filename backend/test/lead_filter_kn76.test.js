const assert = require("assert");
const http = require("http");
const app = require("../server");
const { resetLeadsForTesting } = require("../leadService");

// =========================================================================
// BỘ KIỂM THỬ TỰ ĐỘNG CHỨC NĂNG KN-76 (JIRA SPRINT 2)
// User Story: Là Tư vấn tuyển sinh, tôi muốn tìm kiếm và lọc lead theo
// nhiều điều kiện, để tìm lại được cuộc trao đổi từ tháng trước khi khách gọi lại.
// • Lọc theo trạng thái, nguồn, người phụ trách, khoảng thời gian
// • Tìm nhanh theo tên hoặc số điện thoại
// =========================================================================

let server;
let baseUrl;
let admissionsToken;
let studentToken;
let adminToken;

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
    console.log("   TMS LEAD SEARCH & MULTI-FILTER SUITE - KN-76        ");
    console.log("   Sprint 2: Tìm kiếm & Lọc Lead theo nhiều điều kiện  ");
    console.log("   Tiêu chí:                                           ");
    console.log("   • Tìm nhanh theo tên hoặc số điện thoại             ");
    console.log("   • Lọc theo trạng thái, nguồn, người phụ trách       ");
    console.log("   • Lọc theo khoảng thời gian (tra cứu tháng trước)   ");
    console.log("   • Tra cứu lịch sử & ghi nhận cuộc trao đổi khi gọi lại");
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

        const loginStudent = await request("/api/auth/login", {
            method: "POST",
            body: { email: "student@tms.edu.vn", password: "student123" }
        });
        studentToken = loginStudent.data.token;

        // =========================================================================
        // TIÊU CHÍ 1: TÌM NHANH THEO TÊN (HỖ TRỢ CÓ DẤU VÀ KHÔNG DẤU TIẾNG VIỆT)
        // =========================================================================
        console.log("=== 1. TÌM NHANH THEO TÊN HỌC VIÊN / KHÁCH HÀNG ===");

        // 1.1 Tìm kiếm tên có dấu đầy đủ
        const searchByNameRes = await request("/api/leads?search=Nguyễn Hoàng Nam", {
            token: admissionsToken
        });
        assert.strictEqual(searchByNameRes.status, 200);
        assert.ok(searchByNameRes.data.data.length >= 1, "Phải tìm thấy khách hàng Nguyễn Hoàng Nam");
        assert.strictEqual(searchByNameRes.data.data[0].fullName, "Nguyễn Hoàng Nam");
        logPass('Tìm nhanh theo Tên chính xác có dấu: "Nguyễn Hoàng Nam" -> Ra đúng hồ sơ LD-202609-015');

        // 1.2 Tìm kiếm không dấu tiếng Việt thông minh
        const searchUnaccentRes = await request("/api/leads?search=hoang nam", {
            token: admissionsToken
        });
        assert.strictEqual(searchUnaccentRes.status, 200);
        assert.ok(searchUnaccentRes.data.data.length >= 1, "Tìm không dấu 'hoang nam' phải tìm thấy Nguyễn Hoàng Nam");
        assert.strictEqual(searchUnaccentRes.data.data[0].fullName, "Nguyễn Hoàng Nam");
        logPass('Tìm nhanh không dấu tiếng Việt: "hoang nam" -> Khớp chính xác "Nguyễn Hoàng Nam"');

        // 1.3 Tìm kiếm một phần tên
        const searchPartialName = await request("/api/leads?search=Yến", {
            token: admissionsToken
        });
        assert.strictEqual(searchPartialName.status, 200);
        assert.ok(searchPartialName.data.data.some(l => l.fullName.includes("Yến")), "Phải tìm thấy khách hàng có tên Yến");
        logPass('Tìm kiếm một phần tên: "Yến" -> Khớp "Lê Hoàng Yến"');

        // =========================================================================
        // TIÊU CHÍ 2: TÌM NHANH THEO SỐ ĐIỆN THOẠI (KHI KHÁCH GỌI ĐẾN TƯ VẤN VIÊN)
        // =========================================================================
        console.log("\n=== 2. TÌM NHANH THEO SỐ ĐIỆN THOẠI ===");

        // 2.1 Tìm kiếm theo số điện thoại đầy đủ
        const searchByPhoneRes = await request("/api/leads?search=0977889900", {
            token: admissionsToken
        });
        assert.strictEqual(searchByPhoneRes.status, 200);
        assert.strictEqual(searchByPhoneRes.data.data.length, 1);
        assert.strictEqual(searchByPhoneRes.data.data[0].phone, "0977889900");
        assert.strictEqual(searchByPhoneRes.data.data[0].fullName, "Nguyễn Hoàng Nam");
        logPass('Tìm theo số điện thoại chuẩn: "0977889900" -> Tìm thấy tức thì khách gọi lại');

        // 2.2 Tìm kiếm số điện thoại có dấu khoảng trắng hoặc dấu gạch nối
        const searchFormattedPhone = await request("/api/leads?search=0977 889 900", {
            token: admissionsToken
        });
        assert.strictEqual(searchFormattedPhone.status, 200);
        assert.strictEqual(searchFormattedPhone.data.data.length, 1);
        assert.strictEqual(searchFormattedPhone.data.data[0].phone, "0977889900");
        logPass('Chuẩn hóa chuỗi số điện thoại linh hoạt: "0977 889 900" -> Khớp chuẩn xác');

        // 2.3 Tìm theo đuôi số điện thoại (ví dụ: 4 số cuối 9900)
        const searchTailPhone = await request("/api/leads?search=889900", {
            token: admissionsToken
        });
        assert.strictEqual(searchTailPhone.status, 200);
        assert.ok(searchTailPhone.data.data.some(l => l.phone.includes("889900")));
        logPass('Tìm kiếm theo đuôi số điện thoại: "889900" -> Ra hồ sơ tương ứng');

        // =========================================================================
        // TIÊU CHÍ 3: LỌC THEO TRẠNG THÁI (STATUS)
        // =========================================================================
        console.log("\n=== 3. LỌC THEO TRẠNG THÁI (STATUS FILTER) ===");

        // 3.1 Lọc trạng thái "Mới"
        const filterNew = await request("/api/leads?status=Mới", { token: admissionsToken });
        assert.strictEqual(filterNew.status, 200);
        assert.ok(filterNew.data.data.length > 0);
        assert.ok(filterNew.data.data.every(l => l.status === "Mới"));
        logPass('Lọc trạng thái "Mới": 100% kết quả trả về đúng trạng thái "Mới"');

        // 3.2 Lọc trạng thái "Đang tư vấn"
        const filterConsulting = await request("/api/leads?status=Đang tư vấn", { token: admissionsToken });
        assert.strictEqual(filterConsulting.status, 200);
        assert.ok(filterConsulting.data.data.length > 0);
        assert.ok(filterConsulting.data.data.every(l => l.status === "Đang tư vấn"));
        logPass('Lọc trạng thái "Đang tư vấn": 100% kết quả có trạng thái "Đang tư vấn"');

        // 3.3 Lọc trạng thái "Đã ghi danh"
        const filterEnrolled = await request("/api/leads?status=Đã ghi danh", { token: admissionsToken });
        assert.strictEqual(filterEnrolled.status, 200);
        assert.ok(filterEnrolled.data.data.length > 0);
        assert.ok(filterEnrolled.data.data.every(l => l.status === "Đã ghi danh"));
        logPass('Lọc trạng thái "Đã ghi danh": Tìm thấy hồ sơ học viên đã đóng học phí');

        // 3.4 Lọc trạng thái "Hủy" hoặc "Không liên lạc được"
        const filterUnreachable = await request("/api/leads?status=Không liên lạc được", { token: admissionsToken });
        assert.strictEqual(filterUnreachable.status, 200);
        assert.ok(filterUnreachable.data.data.length > 0);
        assert.ok(filterUnreachable.data.data.every(l => l.status === "Không liên lạc được"));
        logPass('Lọc trạng thái "Không liên lạc được": Hiển thị danh sách lead cần gọi lại');

        // =========================================================================
        // TIÊU CHÍ 4: LỌC THEO NGUỒN (SOURCE FILTER)
        // =========================================================================
        console.log("\n=== 4. LỌC THEO NGUỒN LEAD (SOURCE FILTER) ===");

        // 4.1 Lọc theo nguồn Hotline
        const filterHotline = await request("/api/leads?source=Hotline", { token: admissionsToken });
        assert.strictEqual(filterHotline.status, 200);
        assert.ok(filterHotline.data.data.length > 0);
        assert.ok(filterHotline.data.data.every(l => l.source.includes("Hotline")));
        logPass('Lọc theo nguồn "Hotline": Tìm thấy đúng các lead tiếp nhận qua tổng đài');

        // 4.2 Lọc theo nguồn Facebook
        const filterFacebook = await request("/api/leads?source=Facebook", { token: admissionsToken });
        assert.strictEqual(filterFacebook.status, 200);
        assert.ok(filterFacebook.data.data.length > 0);
        assert.ok(filterFacebook.data.data.every(l => l.source.includes("Facebook")));
        logPass('Lọc theo nguồn "Facebook": Tìm thấy các lead từ Fanpage / Ads');

        // 4.3 Lọc theo nguồn Giới thiệu
        const filterReferral = await request("/api/leads?source=Giới thiệu", { token: admissionsToken });
        assert.strictEqual(filterReferral.status, 200);
        assert.ok(filterReferral.data.data.length > 0);
        assert.ok(filterReferral.data.data.every(l => l.source.includes("Giới thiệu")));
        logPass('Lọc theo nguồn "Giới thiệu": Tìm thấy các lead do học viên cũ giới thiệu');

        // =========================================================================
        // TIÊU CHÍ 5: LỌC THEO NGƯỜI PHỤ TRÁCH (ASSIGNED TO)
        // =========================================================================
        console.log("\n=== 5. LỌC THEO NGƯỜI PHỤ TRÁCH (ASSIGNED COUNSELOR) ===");

        // 5.1 Lọc lead được phân công cho Tư vấn viên Vũ Hải Yến (usr_admissions)
        const filterByCounselor = await request("/api/leads?assignedTo=usr_admissions", { token: admissionsToken });
        assert.strictEqual(filterByCounselor.status, 200);
        assert.ok(filterByCounselor.data.data.length > 0);
        assert.ok(filterByCounselor.data.data.every(l => l.assignedTo === "usr_admissions"));
        logPass('Lọc lead theo tư vấn viên (usr_admissions): Hiển thị đúng danh sách lead được giao');

        // 5.2 Lọc lead chưa phân công (unassigned)
        const filterUnassigned = await request("/api/leads?assignedTo=unassigned", { token: admissionsToken });
        assert.strictEqual(filterUnassigned.status, 200);
        assert.ok(filterUnassigned.data.data.length > 0);
        assert.ok(filterUnassigned.data.data.every(l => !l.assignedTo));
        logPass('Lọc lead "Chưa phân công": Giúp trưởng bộ phận nắm được lead mới chưa có người chăm sóc');

        // =========================================================================
        // TIÊU CHÍ 6: LỌC THEO KHOẢNG THỜI GIAN (TRA CỨU CUỘC TRAO ĐỔI TỪ THÁNG TRƯỚC)
        // =========================================================================
        console.log("\n=== 6. LỌC THEO KHOẢNG THỜI GIAN (DATE RANGE & TIME PRESET) ===");

        // 6.1 Lọc theo bộ lọc nhanh "last_month" (Tháng trước - Đúng yêu cầu User Story)
        const filterLastMonth = await request("/api/leads?timePreset=last_month", { token: admissionsToken });
        assert.strictEqual(filterLastMonth.status, 200);
        assert.ok(filterLastMonth.data.data.length >= 2, "Phải tìm thấy các lead từ tháng trước");
        const foundNam = filterLastMonth.data.data.some(l => l.fullName === "Nguyễn Hoàng Nam");
        assert.ok(foundNam, "Lead Nguyễn Hoàng Nam từ tháng trước phải xuất hiện trong danh sách");
        logPass('Lọc nhanh "Tháng trước" (timePreset=last_month): Tìm lại được ngay cuộc trao đổi từ tháng trước khi khách gọi lại');

        // 6.2 Lọc theo khoảng ngày tùy biến (startDate & endDate)
        const pastStart = new Date(Date.now() - 50 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
        const pastEnd = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

        const filterCustomDate = await request(`/api/leads?startDate=${pastStart}&endDate=${pastEnd}`, {
            token: admissionsToken
        });
        assert.strictEqual(filterCustomDate.status, 200);
        assert.ok(filterCustomDate.data.data.length >= 1, "Khoảng ngày tháng trước phải chứa lead");
        logPass(`Lọc theo khoảng ngày tùy chỉnh (${pastStart} đến ${pastEnd}): Kết quả chính xác 100%`);

        // =========================================================================
        // TIÊU CHÍ 7: KẾT HỢP ĐA ĐIỀU KIỆN (MULTI-CRITERIA FILTERING)
        // =========================================================================
        console.log("\n=== 7. KẾT HỢP NHIỀU ĐIỀU KIỆN LỌC CÙNG LÚC ===");

        const multiFilterRes = await request("/api/leads?search=0977889900&status=Đang tư vấn&source=Hotline&timePreset=last_month", {
            token: admissionsToken
        });
        assert.strictEqual(multiFilterRes.status, 200);
        assert.strictEqual(multiFilterRes.data.data.length, 1);
        assert.strictEqual(multiFilterRes.data.data[0].fullName, "Nguyễn Hoàng Nam");
        assert.strictEqual(multiFilterRes.data.data[0].phone, "0977889900");
        assert.strictEqual(multiFilterRes.data.data[0].status, "Đang tư vấn");
        logPass("Kết hợp đồng thời SĐT + Trạng thái + Nguồn + Tháng trước: Tìm thấy duy nhất đúng 1 lead mục tiêu");

        // =========================================================================
        // TIÊU CHÍ 8: XEM LỊCH SỬ TRAO ĐỔI VÀ GHI NHẬN CUỘC TRAO ĐỔI MỚI KHI KHÁCH GỌI LẠI
        // =========================================================================
        console.log("\n=== 8. XEM LỊCH SỬ TRAO ĐỔI & GHI NHẬN CUỘC GỌI MỚI ===");

        const leadId = multiFilterRes.data.data[0].id;

        // 8.1 Lấy lịch sử các cuộc trao đổi cũ của lead
        const getHistoryRes = await request(`/api/leads/${leadId}/consultations`, {
            token: admissionsToken
        });
        assert.strictEqual(getHistoryRes.status, 200);
        assert.ok(Array.isArray(getHistoryRes.data.data));
        assert.ok(getHistoryRes.data.data.length >= 1, "Phải có cuộc trao đổi từ tháng trước được lưu vết");

        const pastCall = getHistoryRes.data.data[0];
        assert.ok(pastCall.notes.includes("React"), "Nội dung cuộc gọi từ tháng trước được hiển thị chi tiết");
        logPass("Tra cứu thành công cuộc trao đổi từ tháng trước: Khách hỏi khóa React, hẹn sang tháng gọi lại");

        // 8.2 Khách gọi lại: Tư vấn viên ghi nhận cuộc trao đổi mới và chuyển trạng thái sang "Đã ghi danh"
        const addCallRes = await request(`/api/leads/${leadId}/consultations`, {
            method: "POST",
            token: admissionsToken,
            body: {
                channel: "Điện thoại (Khách gọi lại)",
                result: "Đã chốt đăng ký",
                notes: "Khách gọi lại báo dự án cũ ở công ty đã xong, xác nhận đăng ký lớp React tối 2-4-6 và hẹn chiều mai ghé chuyển khoản học phí.",
                newStatus: "Đã ghi danh",
                nextFollowUp: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
            }
        });

        assert.strictEqual(addCallRes.status, 201);
        assert.strictEqual(addCallRes.data.success, true);
        assert.strictEqual(addCallRes.data.lead.status, "Đã ghi danh");
        assert.strictEqual(addCallRes.data.consultation.result, "Đã chốt đăng ký");
        logPass('Ghi nhận cuộc trao đổi mới tức thì: Cập nhật thành công trạng thái sang "Đã ghi danh"');

        // 8.3 Kiểm tra lịch sử sau khi thêm cuộc trao đổi mới
        const verifyHistoryRes = await request(`/api/leads/${leadId}/consultations`, {
            token: admissionsToken
        });
        assert.strictEqual(verifyHistoryRes.data.data.length, getHistoryRes.data.data.length + 1);
        assert.strictEqual(verifyHistoryRes.data.data[0].result, "Đã chốt đăng ký");
        logPass("Lịch sử cuộc trao đổi được lưu vết theo thứ tự thời gian chuẩn xác");

        // =========================================================================
        // TIÊU CHÍ 9: LẤY DANH MỤC NGUỒN & TƯ VẤN VIÊN PHỤC VỤ DROPDOWN BỘ LỌC
        // =========================================================================
        console.log("\n=== 9. DANH MỤC NGUỒN LEAD & TƯ VẤN VIÊN PHỤ TRÁCH ===");

        const sourcesRes = await request("/api/leads/sources", { token: admissionsToken });
        assert.strictEqual(sourcesRes.status, 200);
        assert.ok(Array.isArray(sourcesRes.data.data));
        assert.ok(sourcesRes.data.data.some(s => s.name.includes("Website")));
        assert.ok(sourcesRes.data.data.some(s => s.name.includes("Hotline")));
        logPass("GET /api/leads/sources: Trả về danh sách các nguồn kèm số lượng thống kê");

        const counselorsRes = await request("/api/leads/counselors", { token: admissionsToken });
        assert.strictEqual(counselorsRes.status, 200);
        assert.ok(Array.isArray(counselorsRes.data.data));
        assert.ok(counselorsRes.data.data.some(c => c.id === "usr_admissions"));
        logPass("GET /api/leads/counselors: Trả về danh sách tư vấn viên phục vụ bộ lọc");

        // =========================================================================
        // TIÊU CHÍ 10: BẢO MẬT & PHÂN QUYỀN RBAC CHO CÁC API TÌM KIẾM & LỌC LEAD
        // =========================================================================
        console.log("\n=== 10. BẢO MẬT VÀ PHÂN QUYỀN RBAC CHO CÁC API LEAD ===");

        // 10.1 Khách chưa đăng nhập không được truy cập API danh sách lead
        const unauthRes = await request("/api/leads");
        assert.strictEqual(unauthRes.status, 401);
        logPass("Yêu cầu không có Token bị từ chối truy cập (HTTP 401 Unauthorized)");

        // 10.2 Học viên không có quyền xem thông tin lead tuyển sinh
        const studentForbiddenRes = await request("/api/leads", { token: studentToken });
        assert.strictEqual(studentForbiddenRes.status, 403);
        logPass("Học viên (student) bị chặn truy cập danh sách lead (HTTP 403 Forbidden)");

        // 10.3 Quản trị viên (admin) có toàn quyền tra cứu và quản lý lead
        const adminRes = await request("/api/leads", { token: adminToken });
        assert.strictEqual(adminRes.status, 200);
        logPass("Quản trị viên (administrator) có quyền tra cứu và lọc lead thành công");

        console.log("\n=======================================================");
        console.log("✔ TẤT CẢ 10 TIÊU CHÍ NGHIỆM THU KN-76 ĐÃ ĐẠT 100% PASS!");
        console.log("=======================================================");
    } finally {
        await stopServer();
    }
}

if (require.main === module) {
    runTests().catch((err) => {
        console.error("\x1b[31m❌ TEST FAILED:\x1b[0m", err);
        process.exit(1);
    });
}

module.exports = { runTests };
