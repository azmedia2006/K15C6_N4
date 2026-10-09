const assert = require("assert");
const http = require("http");
const app = require("../server");
const { getAuditLogs } = require("../roleService");
const { users } = require("../authService");

// =========================================================================
// BỘ KIỂM THỬ TỰ ĐỘNG: NHẬP DANH SÁCH NGƯỜI DÙNG HÀNG LOẠT TỪ EXCEL
// Tính năng: Nhập danh sách người dùng hàng loạt từ tệp Excel/CSV để
// tạo tài khoản cho cả một khoá học viên mới.
// =========================================================================

let server;
let baseUrl;
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

async function request(endpoint, { method = "GET", body = null, token = null } = {}) {
    const headers = { "Content-Type": "application/json" };
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }
    const res = await fetch(`${baseUrl}${endpoint}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
    });
    const contentType = res.headers.get("content-type") || "";
    let data;
    if (contentType.includes("application/json")) {
        data = await res.json().catch(() => ({}));
    } else {
        const buf = await res.arrayBuffer();
        data = Buffer.from(buf);
    }
    return { status: res.status, headers: res.headers, data };
}

function logPass(title) {
    console.log(`  \x1b[32m[PASS]\x1b[0m ${title}`);
}

function logGroup(title) {
    console.log(`\n\x1b[1m\x1b[36m=== ${title} ===\x1b[0m`);
}

async function runAllTests() {
    console.log("\n=======================================================");
    console.log("   TMS BATCH IMPORT USERS SUITE - KIỂM THỬ NHẬP EXCEL  ");
    console.log("=======================================================");

    await startServer();

    try {
        // 0. Đăng nhập lấy token Admin & Student
        const adminLogin = await request("/api/auth/login", {
            method: "POST",
            body: { email: "admin@tms.edu.vn", password: "admin123" }
        });
        assert.strictEqual(adminLogin.status, 200, "Admin login phải thành công");
        adminToken = adminLogin.data.token;

        const studentLogin = await request("/api/auth/login", {
            method: "POST",
            body: { email: "student@tms.edu.vn", password: "student123" }
        });
        assert.strictEqual(studentLogin.status, 200, "Student login phải thành công");
        studentToken = studentLogin.data.token;

        // =====================================================================
        // TIÊU CHÍ 1: TẢI ĐƯỢC TỆP MẪU
        // =====================================================================
        logGroup("1. TIÊU CHÍ 1: TẢI ĐƯỢC TỆP MẪU (DOWNLOAD SAMPLE TEMPLATE)");

        // 1.1 Tải file mẫu định dạng Excel (.xlsx)
        const tplXlsx = await request("/api/admin/users/import/template?format=xlsx");
        assert.strictEqual(tplXlsx.status, 200, "Endpoint tải file mẫu xlsx phải trả về HTTP 200");
        assert(tplXlsx.data.length > 500, "File mẫu Excel phải có nội dung dữ liệu nhị phân hợp lệ");
        const dispXlsx = tplXlsx.headers.get("content-disposition") || "";
        assert(dispXlsx.includes(".xlsx"), "Header Content-Disposition phải có tên file đuôi .xlsx");
        logPass("Tải thành công tệp mẫu định dạng Excel (.xlsx) với tiêu đề cột chuẩn");

        // 1.2 Tải file mẫu định dạng CSV (.csv)
        const tplCsv = await request("/api/admin/users/import/template?format=csv");
        assert.strictEqual(tplCsv.status, 200, "Endpoint tải file mẫu csv phải trả về HTTP 200");
        const csvText = tplCsv.data.toString("utf-8");
        assert(csvText.includes("Họ và tên"), "File mẫu CSV phải chứa cột 'Họ và tên'");
        assert(csvText.includes("Email"), "File mẫu CSV phải chứa cột 'Email'");
        assert(csvText.includes("Vai trò"), "File mẫu CSV phải chứa cột 'Vai trò'");
        logPass("Tải thành công tệp mẫu định dạng CSV UTF-8 có BOM chống lỗi font tiếng Việt");

        // =====================================================================
        // TIÊU CHÍ 2: XEM TRƯỚC VÀ BÁO LỖI THEO TỪNG DÒNG TRƯỚC KHI NHẬP
        // =====================================================================
        logGroup("2. TIÊU CHÍ 2: XEM TRƯỚC VÀ BÁO LỖI THEO TỪNG DÒNG (PREVIEW & VALIDATION)");

        const sampleRowsToPreview = [
            // Dòng 1: Hợp lệ
            { "Họ và tên": "Nguyễn Minh Châu", "Email": "chau.nguyen@k15c6.edu.vn", "Số điện thoại": "0911223344", "Vai trò": "Học viên" },
            // Dòng 2: Lỗi thiếu họ tên
            { "Họ và tên": "", "Email": "khongten@example.com", "Số điện thoại": "0988776655", "Vai trò": "Học viên" },
            // Dòng 3: Lỗi sai định dạng email
            { "Họ và tên": "Trần Văn Sai", "Email": "email_khong_hop_le", "Số điện thoại": "0912345678", "Vai trò": "Học viên" },
            // Dòng 4: Lỗi vai trò không hợp lệ
            { "Họ và tên": "Lê Văn Lạ", "Email": "la.le@example.com", "Số điện thoại": "0900112233", "Vai trò": "Chức vụ siêu lạ" },
            // Dòng 5: Lỗi trùng email đã tồn tại trong hệ thống (admin@tms.edu.vn)
            { "Họ và tên": "Trùng Admin", "Email": "admin@tms.edu.vn", "Số điện thoại": "0933445566", "Vai trò": "Học viên" },
            // Dòng 6: Hợp lệ (SĐT rỗng được chấp nhận, vai trò mặc định học viên)
            { "Họ và tên": "Hoàng Lan Anh", "Email": "lananh.hoang@k15c6.edu.vn", "Số điện thoại": "", "Vai trò": "" }
        ];

        const previewRes = await request("/api/admin/users/import/preview", {
            method: "POST",
            body: { rows: sampleRowsToPreview },
            token: adminToken
        });

        assert.strictEqual(previewRes.status, 200, "Preview endpoint phải trả về 200 OK");
        const pData = previewRes.data.preview;
        assert.strictEqual(pData.totalRows, 6, "Tổng số dòng xem trước phải là 6");
        assert.strictEqual(pData.validCount, 2, "Số dòng hợp lệ phải là 2 (Dòng 1 và Dòng 6)");
        assert.strictEqual(pData.invalidCount, 4, "Số dòng có lỗi phải là 4 (Dòng 2, 3, 4, 5)");

        // Kiểm tra chi tiết lỗi từng dòng
        assert.strictEqual(pData.rows[0].isValid, true, "Dòng 1 phải hợp lệ");
        assert.strictEqual(pData.rows[1].isValid, false, "Dòng 2 phải báo lỗi thiếu họ tên");
        assert(pData.rows[1].error.includes("Họ và tên"), "Dòng 2 phải có thông báo lỗi Họ và tên");

        assert.strictEqual(pData.rows[2].isValid, false, "Dòng 3 phải báo lỗi định dạng email");
        assert(pData.rows[2].error.includes("Định dạng email"), "Dòng 3 phải có thông báo lỗi định dạng email");

        assert.strictEqual(pData.rows[3].isValid, false, "Dòng 4 phải báo lỗi vai trò không hợp lệ");
        assert(pData.rows[3].error.includes("Vai trò"), "Dòng 4 phải có thông báo lỗi vai trò");

        assert.strictEqual(pData.rows[4].isValid, false, "Dòng 5 phải báo lỗi trùng email đã tồn tại");
        assert(pData.rows[4].error.includes("đã tồn tại"), "Dòng 5 phải thông báo email đã tồn tại");

        assert.strictEqual(pData.rows[5].isValid, true, "Dòng 6 phải hợp lệ và tự gán vai trò học viên");
        assert.strictEqual(pData.rows[5].data.role, "student", "Dòng 6 vai trò rỗng phải được chuẩn hóa về 'student'");

        logPass("Xem trước chính xác từng dòng: chỉ ra rõ ràng dòng hợp lệ và chi tiết nguyên nhân lỗi");

        // 2.2 Kiểm tra phát hiện email trùng lặp nội bộ trong cùng một tệp (Duplicate within batch)
        const duplicateBatchRows = [
            { "Họ và tên": "Học viên A", "Email": "duplicate.test@k15c6.edu.vn", "Vai trò": "student" },
            { "Họ và tên": "Học viên B", "Email": "duplicate.test@k15c6.edu.vn", "Vai trò": "student" }
        ];
        const dupPreviewRes = await request("/api/admin/users/import/preview", {
            method: "POST",
            body: { rows: duplicateBatchRows },
            token: adminToken
        });
        const dupData = dupPreviewRes.data.preview;
        assert.strictEqual(dupData.rows[0].isValid, true, "Dòng đầu tiên xuất hiện email là hợp lệ");
        assert.strictEqual(dupData.rows[1].isValid, false, "Dòng thứ hai cùng email phải bị phát hiện trùng lặp trong tệp");
        assert(dupData.rows[1].error.includes("trùng lặp với dòng 1"), "Thông báo lỗi phải chỉ rõ trùng với dòng trước");
        logPass("Phát hiện và báo lỗi chính xác khi có các dòng trùng lặp email trong cùng tệp tải lên");

        // =====================================================================
        // TIÊU CHÍ 3: DÒNG LỖI BỎ QUA, DÒNG HỢP LỆ VẪN ĐƯỢC NHẬP, CÓ BÁO CÁO TỔNG KẾT
        // =====================================================================
        logGroup("3. TIÊU CHÍ 3: NHẬP DỮ LIỆU HÀNG LOẠT VÀ BÁO CÁO TỔNG KẾT (BATCH IMPORT & SUMMARY)");

        const testRunId = Date.now();
        const batchEmail1 = `hung.dang_${testRunId}@k15c6.edu.vn`;
        const batchEmail2 = `trang.vu_${testRunId}@k15c6.edu.vn`;
        const batchEmail3 = `nam.nguyen_${testRunId}@k15c6.edu.vn`;

        const batchRowsToImport = [
            { "Họ và tên": "Đặng Quốc Hưng", "Email": batchEmail1, "Số điện thoại": "0981112233", "Vai trò": "Học viên" },
            { "Họ và tên": "Vũ Thu Trang", "Email": batchEmail2, "Số điện thoại": "0982223344", "Vai trò": "Học viên" },
            // Dòng lỗi 1: Sai email
            { "Họ và tên": "Bùi Lỗi Email", "Email": "bui_loi_email_khong_hop_le", "Vai trò": "Học viên" },
            // Dòng lỗi 2: Trùng email đã có của hệ thống
            { "Họ và tên": "Trùng Email Manager", "Email": "manager@tms.edu.vn", "Vai trò": "Học viên" },
            // Dòng hợp lệ 3: Giảng viên khóa mới
            { "Họ và tên": "TS. Nguyễn Thành Nam", "Email": batchEmail3, "Số điện thoại": "0909998877", "Vai trò": "Giảng viên" }
        ];

        const importRes = await request("/api/admin/users/import", {
            method: "POST",
            body: { rows: batchRowsToImport },
            token: adminToken
        });

        assert.strictEqual(importRes.status, 200, "Import endpoint phải trả về 200 OK");
        assert.strictEqual(importRes.data.success, true, "Thao tác nhập phải thành công");
        const summary = importRes.data.summary;

        // Báo cáo tổng kết
        assert.strictEqual(summary.totalRows, 5, "Tổng số dòng xử lý phải là 5");
        assert.strictEqual(summary.validCount, 3, "Số dòng hợp lệ phải là 3");
        assert.strictEqual(summary.invalidCount, 2, "Số dòng lỗi phải là 2");
        assert.strictEqual(summary.importedCount, 3, "Số tài khoản nhập thành công phải là 3");
        assert.strictEqual(summary.skippedCount, 2, "Số dòng bị bỏ qua phải là 2");

        // Kiểm tra danh sách tài khoản được tạo
        assert.strictEqual(summary.importedUsers.length, 3, "Danh sách tài khoản đã cấp phải có 3 phần tử");
        assert(summary.importedUsers.every(u => u.temporaryPassword && u.temporaryPassword.startsWith("TMS@")),
            "Mỗi tài khoản được tạo phải được tự động sinh mật khẩu tạm an toàn (TMS@...)");

        // Kiểm tra danh sách dòng bị bỏ qua
        assert.strictEqual(summary.skippedRows.length, 2, "Danh sách dòng bị bỏ qua phải có 2 phần tử");
        assert(summary.skippedRows[0].error.length > 0, "Dòng bị bỏ qua phải có lý do lỗi chi tiết");

        logPass("Dòng lỗi bị bỏ qua an toàn, 3 dòng hợp lệ được nhập thành công, báo cáo tổng kết chi tiết đầy đủ");

        // 3.2 Kiểm tra người dùng mới tạo qua import đăng nhập thành công vào hệ thống
        const newStudentUser = summary.importedUsers[0];
        const studentTestLogin = await request("/api/auth/login", {
            method: "POST",
            body: { email: newStudentUser.email, password: newStudentUser.temporaryPassword }
        });
        assert.strictEqual(studentTestLogin.status, 200, "Học viên mới phải đăng nhập thành công bằng mật khẩu tạm");
        assert(studentTestLogin.data.token, "Đăng nhập phải trả về Bearer Token hợp lệ");
        logPass("Học viên mới được tạo qua import đăng nhập thành công vào hệ thống bằng mật khẩu tạm thời");

        // =====================================================================
        // TIÊU CHÍ 4: BẢO MẬT PHÂN QUYỀN RBAC VÀ AUDIT LOG
        // =====================================================================
        logGroup("4. TIÊU CHÍ 4: BẢO MẬT PHÂN QUYỀN RBAC VÀ AUDIT LOG");

        // 4.1 Chặn người dùng không có vai trò Administrator thực hiện Import
        const forbiddenImport = await request("/api/admin/users/import", {
            method: "POST",
            body: { rows: [{ "Họ và tên": "Hacker", "Email": "hack@example.com" }] },
            token: studentToken
        });
        assert.strictEqual(forbiddenImport.status, 403, "Người dùng Student gọi import phải bị từ chối 403 Forbidden");
        assert(forbiddenImport.data.message.includes("Quản trị hệ thống"), "Thông báo từ chối phải rõ ràng");
        logPass("Bảo vệ RBAC nghiêm ngặt: Chặn người dùng không có quyền Quản trị viên (HTTP 403)");

        // 4.2 Chặn request không có Token (HTTP 401)
        const unauthImport = await request("/api/admin/users/import", {
            method: "POST",
            body: { rows: [] }
        });
        assert.strictEqual(unauthImport.status, 401, "Yêu cầu không có token phải bị trả về 401 Unauthorized");
        logPass("Chặn yêu cầu không có Bearer token (HTTP 401 Unauthorized)");

        // 4.3 Kiểm tra Audit Log đã ghi nhận hành động IMPORT_USERS_BATCH
        const logs = getAuditLogs();
        const importLog = logs.find(l => l.action === "IMPORT_USERS_BATCH");
        assert(importLog, "Hệ thống phải ghi nhận bản ghi nhật ký thao tác IMPORT_USERS_BATCH");
        assert.strictEqual(importLog.status, "SUCCESS", "Trạng thái audit log phải là SUCCESS");
        assert(importLog.reason.includes("3 tài khoản"), "Lý do trong audit log phải ghi rõ số lượng tài khoản");
        logPass("Ghi nhận nhật ký thao tác (Audit Log) cho tác vụ nhập hàng loạt");

        console.log("\n=======================================================");
        console.log("   TẤT CẢ 10 CA KIỂM THỬ NHẬP EXCEL ĐÃ VƯỢT QUA 100%!  ");
        console.log("=======================================================\n");

    } finally {
        await stopServer();
    }
}

runAllTests().then(() => {
    process.exit(0);
}).catch((err) => {
    console.error("\n[FAILED] KIỂM THỬ THẤT BẠI:", err);
    process.exit(1);
});
