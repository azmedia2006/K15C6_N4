const assert = require("assert");
const http = require("http");
const app = require("../server");
const { resetLeadsForTesting, leads } = require("../leadService");

// =========================================================================
// TMS BACKEND - BỘ KIỂM THỬ TỰ ĐỘNG CHỨC NĂNG KN-74 (KN SPRINT 2)
// User Story: Là Tư vấn tuyển sinh, tôi muốn quản lý danh sách khách hàng tiềm năng,
//             để không bỏ sót người đã để lại số điện thoại.
// Tiêu chí:
//   1. Tạo và sửa lead với họ tên, số điện thoại, email, nguồn, chương trình quan tâm
//   2. Cảnh báo khi số điện thoại trùng với lead đã có
//   3. Chỉ Quản lý đào tạo được xoá lead
// =========================================================================

let server;
let baseUrl;
let admissionsToken;
let managerToken;
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
    console.log("=================================================================");
    console.log("   TMS TEST SUITE: KN-74 QUẢN LÝ KHÁCH HÀNG TIỀM NĂNG (LEAD)     ");
    console.log("   Tiêu chí kiểm thử:                                            ");
    console.log("   • Tạo & sửa lead: họ tên, SĐT, email, nguồn, chương trình      ");
    console.log("   • Cảnh báo khi số điện thoại trùng với lead đã có             ");
    console.log("   • Phân quyền RBAC: Chỉ Quản lý đào tạo được xoá lead          ");
    console.log("=================================================================\n");

    await startServer();
    resetLeadsForTesting();

    try {
        // Lấy token đăng nhập cho các vai trò
        const loginAdmissions = await request("/api/auth/login", {
            method: "POST",
            body: { email: "admissions@tms.edu.vn", password: "admissions123" }
        });
        admissionsToken = loginAdmissions.data.token;
        assert.ok(admissionsToken, "Phải lấy được token Tư vấn tuyển sinh");

        const loginManager = await request("/api/auth/login", {
            method: "POST",
            body: { email: "manager@tms.edu.vn", password: "manager123" }
        });
        managerToken = loginManager.data.token;
        assert.ok(managerToken, "Phải lấy được token Quản lý đào tạo");

        const loginAdmin = await request("/api/auth/login", {
            method: "POST",
            body: { email: "admin@tms.edu.vn", password: "admin123" }
        });
        adminToken = loginAdmin.data.token;
        assert.ok(adminToken, "Phải lấy được token Quản trị viên");

        const loginStudent = await request("/api/auth/login", {
            method: "POST",
            body: { email: "student@tms.edu.vn", password: "student123" }
        });
        studentToken = loginStudent.data.token;
        assert.ok(studentToken, "Phải lấy được token Học viên");

        // =========================================================================
        // NHÓM 1: TẠO VÀ SỬA LEAD VỚI ĐẦY ĐỦ TRƯỜNG THÔNG TIN
        // =========================================================================
        console.log("=== 1. TẠO VÀ SỬA LEAD VỚI HỌ TÊN, SĐT, EMAIL, NGUỒN, CHƯƠNG TRÌNH ===");

        // 1.1 Cán bộ tuyển sinh tạo Lead với đầy đủ thông tin
        const createLeadRes = await request("/api/leads", {
            method: "POST",
            token: admissionsToken,
            body: {
                fullName: "Nguyễn Hoàng Nam",
                phone: "0966554433",
                email: "hoangnam.nguyen@gmail.com",
                source: "Facebook Fanpage",
                course: "Lập trình Web Fullstack (NodeJS & React)",
                notes: "Khách hàng muốn tìm hiểu lớp học cuối tuần và chính sách trả góp."
            }
        });

        assert.strictEqual(createLeadRes.status, 201, "Tạo lead phải trả về HTTP 201");
        assert.strictEqual(createLeadRes.data.success, true);
        const createdLead = createLeadRes.data.lead;
        assert.ok(createdLead && createdLead.id, "Lead mới phải có id");
        assert.strictEqual(createdLead.fullName, "Nguyễn Hoàng Nam");
        assert.strictEqual(createdLead.phone, "0966554433");
        assert.strictEqual(createdLead.email, "hoangnam.nguyen@gmail.com");
        assert.strictEqual(createdLead.source, "Facebook Fanpage");
        assert.strictEqual(createdLead.course, "Lập trình Web Fullstack (NodeJS & React)");
        assert.strictEqual(createdLead.status, "Mới");
        logPass("Tạo lead thành công với họ tên, SĐT, email, nguồn, chương trình quan tâm (HTTP 201)");

        // 1.2 Cán bộ tuyển sinh sửa lead (cập nhật họ tên, nguồn, chương trình quan tâm, trạng thái)
        const updateLeadRes = await request(`/api/leads/${createdLead.id}`, {
            method: "PUT",
            token: admissionsToken,
            body: {
                fullName: "Nguyễn Hoàng Nam (VIP)",
                phone: "0966554433", // giữ nguyên sđt
                email: "nam.nguyen.updated@gmail.com",
                source: "Sự kiện Hội thảo Công nghệ",
                course: "Trí tuệ Nhân tạo & Ứng dụng Python (AI/ML)",
                notes: "Khách hàng đã đổi sang quan tâm khóa AI, hẹn phỏng vấn đầu vào.",
                status: "Đang tư vấn"
            }
        });

        assert.strictEqual(updateLeadRes.status, 200, "Cập nhật lead phải trả về HTTP 200");
        assert.strictEqual(updateLeadRes.data.success, true);
        const updatedLead = updateLeadRes.data.lead;
        assert.strictEqual(updatedLead.fullName, "Nguyễn Hoàng Nam (VIP)");
        assert.strictEqual(updatedLead.email, "nam.nguyen.updated@gmail.com");
        assert.strictEqual(updatedLead.source, "Sự kiện Hội thảo Công nghệ");
        assert.strictEqual(updatedLead.course, "Trí tuệ Nhân tạo & Ứng dụng Python (AI/ML)");
        assert.strictEqual(updatedLead.status, "Đang tư vấn");
        logPass("Sửa lead thành công với họ tên, email, nguồn, chương trình và trạng thái mới (HTTP 200)");

        // 1.3 Xác thực dữ liệu đầu vào khi sửa (Validation)
        const invalidUpdateRes = await request(`/api/leads/${createdLead.id}`, {
            method: "PUT",
            token: admissionsToken,
            body: {
                phone: "123-abc-wrong"
            }
        });
        assert.strictEqual(invalidUpdateRes.status, 400);
        assert.strictEqual(invalidUpdateRes.data.code, "INVALID_PHONE");
        logPass("Validate dữ liệu khi sửa: Chặn số điện thoại sai định dạng");

        // =========================================================================
        // NHÓM 2: CẢNH BÁO KHI SỐ ĐIỆN THOẠI TRÙNG VỚI LEAD ĐÃ CÓ
        // =========================================================================
        console.log("\n=== 2. CẢNH BÁO KHI SỐ ĐIỆN THOẠI TRÙNG VỚI LEAD ĐÃ CÓ ===");

        // 2.1 API kiểm tra trùng số điện thoại theo thời gian thực (check-phone)
        // Số điện thoại "0912345678" đã có trong lead mẫu ban đầu (Trần Minh Quân)
        const checkDupPhoneRes = await request("/api/leads/check-phone?phone=0912345678", {
            token: admissionsToken
        });
        assert.strictEqual(checkDupPhoneRes.status, 200);
        assert.strictEqual(checkDupPhoneRes.data.isDuplicate, true, "Phải phát hiện số điện thoại bị trùng");
        assert.ok(checkDupPhoneRes.data.duplicateLead, "Phải trả về thông tin lead bị trùng");
        assert.strictEqual(checkDupPhoneRes.data.duplicateLead.fullName, "Trần Minh Quân");
        assert.ok(checkDupPhoneRes.data.message.includes("Cảnh báo"), "Thông điệp phải chứa cảnh báo trùng");
        logPass("API check-phone phát hiện chính xác số điện thoại đã tồn tại và trả thông tin lead trùng");

        // 2.2 API check-phone với số điện thoại mới chưa có
        const checkNewPhoneRes = await request("/api/leads/check-phone?phone=0971999888", {
            token: admissionsToken
        });
        assert.strictEqual(checkNewPhoneRes.status, 200);
        assert.strictEqual(checkNewPhoneRes.data.isDuplicate, false, "Số mới không được báo trùng");
        logPass("API check-phone xác nhận số điện thoại mới chưa bị trùng (isDuplicate === false)");

        // 2.3 API check-phone khi loại trừ ID của chính lead đó (excludeId)
        const checkSelfRes = await request(`/api/leads/check-phone?phone=0966554433&excludeId=${createdLead.id}`, {
            token: admissionsToken
        });
        assert.strictEqual(checkSelfRes.status, 200);
        assert.strictEqual(checkSelfRes.data.isDuplicate, false, "Không được báo trùng với chính mình khi sửa");
        logPass("API check-phone không báo trùng khi excludeId là chính lead đang sửa");

        // 2.4 Khi tạo lead mới nhưng dùng số điện thoại đã có: Trả về cảnh báo trùng
        const createDupRes = await request("/api/leads", {
            method: "POST",
            token: admissionsToken,
            body: {
                fullName: "Khách Hàng Đăng Ký Lại",
                phone: "0912345678", // trùng với Trần Minh Quân
                email: "dangkylai@gmail.com",
                source: "Website",
                course: "Lập trình Java Spring Boot"
            }
        });
        assert.strictEqual(createDupRes.status, 201);
        assert.strictEqual(createDupRes.data.isDuplicatePhone, true, "Phải gắn cờ isDuplicatePhone = true");
        assert.ok(createDupRes.data.duplicateWarning, "Phải trả về duplicateWarning trong phản hồi");
        assert.ok(createDupRes.data.duplicateWarning.includes("Trần Minh Quân"), "Cảnh báo phải nêu rõ tên khách hàng trùng");
        logPass("Tạo lead trùng SĐT: Hệ thống tạo thành công kèm cờ và thông báo duplicateWarning rõ ràng");

        // 2.5 Khi sửa lead đổi SĐT thành số trùng với lead khác: Trả về cảnh báo trùng
        const updateDupRes = await request(`/api/leads/${createdLead.id}`, {
            method: "PUT",
            token: admissionsToken,
            body: {
                phone: "0912345678" // đổi thành số của Trần Minh Quân
            }
        });
        assert.strictEqual(updateDupRes.status, 200);
        assert.strictEqual(updateDupRes.data.isDuplicatePhone, true, "Phải phát hiện sửa trùng số điện thoại");
        assert.ok(updateDupRes.data.duplicateWarning, "Phải trả về cảnh báo duplicateWarning khi sửa");
        logPass("Sửa lead sang SĐT trùng: Hệ thống phát hiện và trả về duplicateWarning chính xác");

        // =========================================================================
        // NHÓM 3: PHÂN QUYỀN RBAC - CHỈ QUẢN LÝ ĐÀO TẠO ĐƯỢC XOÁ LEAD
        // =========================================================================
        console.log("\n=== 3. PHÂN QUYỀN RBAC: CHỈ QUẢN LÝ ĐÀO TẠO ĐƯỢC XOÁ LEAD ===");

        // 3.1 Cán bộ tuyển sinh (admissions) cố gắng xóa lead -> BỊ TỪ CHỐI HTTP 403
        const admissionsDeleteRes = await request(`/api/leads/${createdLead.id}`, {
            method: "DELETE",
            token: admissionsToken
        });
        assert.strictEqual(admissionsDeleteRes.status, 403, "Cán bộ tuyển sinh KHÔNG được xóa lead (HTTP 403)");
        assert.strictEqual(admissionsDeleteRes.data.success, false);
        assert.ok(
            admissionsDeleteRes.data.message.includes("Chỉ Quản lý đào tạo"),
            `Thông báo từ chối phải nêu rõ: Chỉ Quản lý đào tạo mới có quyền xóa. Nhận được: ${admissionsDeleteRes.data.message}`
        );
        logPass("Cán bộ Tuyển sinh bị chặn khi xóa lead (HTTP 403: Chỉ Quản lý đào tạo được xoá lead)");

        // 3.2 Học viên (student) cố gắng xóa lead -> BỊ TỪ CHỐI HTTP 403
        const studentDeleteRes = await request(`/api/leads/${createdLead.id}`, {
            method: "DELETE",
            token: studentToken
        });
        assert.strictEqual(studentDeleteRes.status, 403, "Học viên KHÔNG được xóa lead (HTTP 403)");
        logPass("Học viên bị chặn khi cố xóa lead (HTTP 403)");

        // 3.3 Quản lý đào tạo (training_manager) xóa lead -> THÀNH CÔNG HTTP 200
        const managerDeleteRes = await request(`/api/leads/${createdLead.id}`, {
            method: "DELETE",
            token: managerToken
        });
        assert.strictEqual(managerDeleteRes.status, 200, "Quản lý đào tạo ĐƯỢC PHÉP xóa lead (HTTP 200)");
        assert.strictEqual(managerDeleteRes.data.success, true);
        assert.strictEqual(managerDeleteRes.data.message, "Đã xóa hồ sơ Lead thành công.");
        logPass("Quản lý Đào tạo (training_manager) xóa lead thành công (HTTP 200)");

        // Kiểm tra sau khi xóa: lead không còn trong danh sách
        const checkAfterDelete = await request(`/api/leads/${createdLead.id}`, {
            token: managerToken
        });
        assert.strictEqual(checkAfterDelete.status, 404, "Lead đã bị xóa không thể tìm thấy nữa (HTTP 404)");
        logPass("Lead đã xóa thành công và không còn tồn tại trong kho lưu trữ");

        // 3.4 Quản trị viên (administrator - quyền cao nhất) cũng có thể xóa lead
        // Tạo thêm 1 lead phụ để admin xóa thử
        const extraLead = await request("/api/leads", {
            method: "POST",
            token: admissionsToken,
            body: {
                fullName: "Lead Kiểm Thử Xóa Admin",
                phone: "0933887766",
                email: "test.admin.del@gmail.com",
                source: "Website",
                course: "Fullstack"
            }
        });
        assert.strictEqual(extraLead.status, 201);
        const adminDeleteRes = await request(`/api/leads/${extraLead.data.lead.id}`, {
            method: "DELETE",
            token: adminToken
        });
        assert.strictEqual(adminDeleteRes.status, 200, "Quản trị viên được phép xóa lead dự phòng");
        logPass("Quản trị viên (administrator) có thẩm quyền xóa lead dự phòng (HTTP 200)");

        console.log("\n=================================================================");
        console.log("✔ TẤT CẢ CÁC TIÊU CHÍ KN-74 ĐÃ ĐẠT 100%!");
        console.log("=================================================================");
    } finally {
        await stopServer();
    }
}

if (require.main === module) {
    runTests().catch((err) => {
        console.error("\x1b[31m❌ TEST KN-74 FAILED:\x1b[0m", err);
        process.exit(1);
    });
}

module.exports = { runTests };
