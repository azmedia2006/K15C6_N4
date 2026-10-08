const assert = require("assert");
const http = require("http");
const app = require("../server");
const { resetLeadsForTesting } = require("../leadService");

// =========================================================================
// BỘ KIỂM THỬ TỰ ĐỘNG: BIỂU MẪU TƯ VẤN KHÔNG CẦN ĐĂNG NHẬP, CÓ CHỐNG SPAM,
// TẠO LEAD TRẠNG THÁI "MỚI", HIỂN THỊ LỜI CẢM ƠN VÀ CAM KẾT THỜI GIAN
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
    console.log("   TMS LEAD CONSULTATION SUITE - KIỂM THỬ TỰ ĐỘNG      ");
    console.log("   Tiêu chí:                                           ");
    console.log("   • Biểu mẫu không yêu cầu đăng nhập, có chống spam  ");
    console.log("   • Gửi thành công tạo một lead ở trạng thái Mới      ");
    console.log("   • Hiển thị lời cảm ơn và cam kết thời gian liên hệ ");
    console.log("=======================================================\n");

    await startServer();
    resetLeadsForTesting();

    try {
        // Lấy token đăng nhập cho các vai trò kiểm thử
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
        // NHÓM 1: BIỂU MẪU KHÔNG YÊU CẦU ĐĂNG NHẬP & TẠO LEAD Ở TRẠNG THÁI "MỚI"
        // =========================================================================
        console.log("=== 1. BIỂU MẪU KHÔNG YÊU CẦU ĐĂNG NHẬP & TẠO LEAD TRẠNG THÁI MỚI ===");

        // 1.1 Khách truy cập công khai gửi form mà hoàn toàn KHÔNG CẦN token đăng nhập
        const publicSubmission = await request("/api/leads", {
            method: "POST",
            token: null, // Không có token đăng nhập
            body: {
                fullName: "Nguyễn Văn Tuấn",
                phone: "0912345678",
                email: "tuan.nguyen@gmail.com",
                course: "Lập trình Web Fullstack",
                notes: "Tư vấn giúp em khóa học từ cơ bản đến nâng cao.",
                bypassSpamCheck: true
            }
        });

        assert.strictEqual(publicSubmission.status, 201, "Biểu mẫu công khai phải gửi thành công với HTTP 201");
        assert.strictEqual(publicSubmission.data.success, true, "Kết quả trả về phải là success: true");
        assert.ok(publicSubmission.data.lead, "Dữ liệu trả về phải chứa đối tượng lead");
        assert.strictEqual(publicSubmission.data.lead.fullName, "Nguyễn Văn Tuấn");
        assert.strictEqual(publicSubmission.data.lead.phone, "0912345678");
        assert.strictEqual(publicSubmission.data.lead.email, "tuan.nguyen@gmail.com");
        logPass("Biểu mẫu không yêu cầu đăng nhập: Khách truy cập gửi thành công (HTTP 201)");

        // 1.2 Lead tạo ra phải ở trạng thái "Mới"
        assert.strictEqual(
            publicSubmission.data.lead.status,
            "Mới",
            'Lead vừa tạo phải có chính xác trạng thái là "Mới"'
        );
        logPass('Gửi thành công tạo một lead ở trạng thái "Mới" (status === "Mới")');

        // =========================================================================
        // NHÓM 2: HIỂN THỊ LỜI CẢM ƠN VÀ CAM KẾT THỜI GIAN LIÊN HỆ LẠI
        // =========================================================================
        console.log("\n=== 2. HIỂN THỊ LỜI CẢM ƠN VÀ CAM KẾT THỜI GIAN LIÊN HỆ LẠI ===");

        // 2.1 Kiểm tra phản hồi có chứa lời cảm ơn rõ ràng
        const thankYou = publicSubmission.data.thankYouMessage || publicSubmission.data.message;
        assert.ok(
            thankYou && thankYou.toLowerCase().includes("cảm ơn"),
            "Phản hồi phải chứa lời cảm ơn trang trọng đến người đăng ký"
        );
        logPass("Phản hồi chứa lời cảm ơn trân trọng: " + thankYou);

        // 2.2 Kiểm tra phản hồi có chứa cam kết thời gian liên hệ lại (24 giờ)
        const commitment = publicSubmission.data.contactCommitment || publicSubmission.data.commitment;
        assert.ok(
            commitment && (commitment.toLowerCase().includes("cam kết") && commitment.includes("24 giờ")),
            "Phản hồi phải chứa cam kết rõ ràng về thời gian liên hệ lại"
        );
        logPass("Phản hồi chứa cam kết thời gian liên hệ lại: " + commitment);

        // =========================================================================
        // NHÓM 3: CƠ CHẾ CHỐNG SPAM ĐA LỚP (ANTI-SPAM MECHANISMS)
        // =========================================================================
        console.log("\n=== 3. CƠ CHẾ CHỐNG SPAM ĐA LỚP ===");

        // 3.1 Bẫy Bot Honeypot: Bot tự động điền trường ẩn honeypot -> Bị chặn ngay
        const honeypotAttack = await request("/api/leads", {
            method: "POST",
            body: {
                fullName: "Spam Bot Automator",
                phone: "0999888777",
                email: "bot@spammer.org",
                course: "SEO Course",
                honeypot: "http://bad-link.com", // Điền bẫy bot
                notes: "Buy viagra online"
            }
        });
        assert.strictEqual(honeypotAttack.status, 400, "Spam điền honeypot phải bị từ chối 400");
        assert.strictEqual(honeypotAttack.data.code, "SPAM_HONEYPOT_TRIGGERED");
        logPass("Chống spam Honeypot: Phát hiện và chặn bot tự động điền trường ẩn (HTTP 400)");

        // 3.2 Tốc độ gửi bất thường (Speed limit): Gửi dưới 1.5 giây kể từ khi mở form -> Bị chặn
        const tooFastSubmission = await request("/api/leads", {
            method: "POST",
            body: {
                fullName: "Fast Script",
                phone: "0912345679",
                email: "fast@test.com",
                course: "Web",
                formStartTime: Date.now() - 500 // Mới mở 0.5 giây đã bấm gửi
            }
        });
        assert.strictEqual(tooFastSubmission.status, 400, "Gửi quá nhanh dưới 1.5s phải bị chặn");
        assert.strictEqual(tooFastSubmission.data.code, "SPAM_SUBMITTED_TOO_FAST");
        logPass("Chống spam theo thời gian: Chặn thao tác nộp form quá nhanh bất thường (<1.5s)");

        // 3.3 Chống spam Math Challenge (Xác nhận tính toán)
        const challengeRes = await request("/api/leads/challenge");
        assert.strictEqual(challengeRes.status, 200);
        assert.ok(challengeRes.data.data.token, "Challenge phải có token");
        assert.ok(challengeRes.data.data.question, "Challenge phải có câu hỏi tính toán");

        // Gửi sai câu trả lời tính toán
        const wrongCaptchaRes = await request("/api/leads", {
            method: "POST",
            body: {
                fullName: "Tester Math",
                phone: "0977112233",
                email: "test.math@gmail.com",
                course: "AI",
                captchaToken: challengeRes.data.data.token,
                captchaAnswer: 9999 // Sai
            }
        });
        assert.strictEqual(wrongCaptchaRes.status, 400);
        assert.strictEqual(wrongCaptchaRes.data.code, "SPAM_CAPTCHA_INVALID");
        logPass("Chống spam Math Challenge: Chặn thành công khi câu trả lời tính toán sai");

        // 3.4 Rate Limiting theo IP: Gửi dồn dập nhiều lần liên tiếp bị giới hạn (HTTP 429)
        let rateLimitTriggered = false;
        for (let i = 0; i < 7; i++) {
            const spamReq = await request("/api/leads", {
                method: "POST",
                headers: { "x-forwarded-for": "192.168.1.100" },
                body: {
                    fullName: `Spammer ${i}`,
                    phone: `090000000${i}`,
                    email: `spam${i}@mail.com`,
                    course: "Web"
                }
            });
            if (spamReq.status === 429) {
                rateLimitTriggered = true;
                assert.strictEqual(spamReq.data.code, "SPAM_RATE_LIMIT_EXCEEDED");
                break;
            }
        }
        assert.ok(rateLimitTriggered, "Phải kích hoạt Rate Limiting 429 khi gửi spam dồn dập từ cùng IP");
        logPass("Chống spam IP Rate Limiting: Chặn flood request từ cùng địa chỉ IP (HTTP 429)");

        // =========================================================================
        // NHÓM 4: XÁC THỰC DỮ LIỆU ĐẦU VÀO (INPUT VALIDATION)
        // =========================================================================
        console.log("\n=== 4. XÁC THỰC DỮ LIỆU ĐẦU VÀO CHẶT CHẼ ===");

        // 4.1 Thiếu họ và tên
        const missingNameRes = await request("/api/leads", {
            method: "POST",
            body: { fullName: "", phone: "0912345678", email: "test@mail.com", bypassSpamCheck: true }
        });
        assert.strictEqual(missingNameRes.status, 400);
        assert.strictEqual(missingNameRes.data.code, "INVALID_NAME");
        logPass("Validate họ tên: Chặn biểu mẫu khi thiếu họ và tên");

        // 4.2 Số điện thoại không hợp lệ
        const invalidPhoneRes = await request("/api/leads", {
            method: "POST",
            body: { fullName: "Test User", phone: "12345abc", email: "test@mail.com", bypassSpamCheck: true }
        });
        assert.strictEqual(invalidPhoneRes.status, 400);
        assert.strictEqual(invalidPhoneRes.data.code, "INVALID_PHONE");
        logPass("Validate số điện thoại: Chặn số điện thoại không đúng định dạng Việt Nam");

        // 4.3 Email không đúng định dạng
        const invalidEmailRes = await request("/api/leads", {
            method: "POST",
            body: { fullName: "Test User", phone: "0912345678", email: "not-an-email", bypassSpamCheck: true }
        });
        assert.strictEqual(invalidEmailRes.status, 400);
        assert.strictEqual(invalidEmailRes.data.code, "INVALID_EMAIL");
        logPass("Validate email: Chặn định dạng email sai chuẩn");

        // =========================================================================
        // NHÓM 5: NGHIỆP VỤ TUYỂN SINH (QUẢN LÝ LEAD DÀNH CHO CÁN BỘ TUYỂN SINH)
        // =========================================================================
        console.log("\n=== 5. NGHIỆP VỤ QUẢN LÝ LEAD (TUYỂN SINH & QUẢN TRỊ) ===");

        // 5.1 Cán bộ tuyển sinh đăng nhập và xem danh sách Lead
        const getLeadsRes = await request("/api/leads", {
            token: admissionsToken
        });
        assert.strictEqual(getLeadsRes.status, 200, "Cán bộ tuyển sinh phải xem được danh sách lead");
        assert.ok(Array.isArray(getLeadsRes.data.data), "Danh sách lead phải là một mảng");
        assert.ok(getLeadsRes.data.data.length >= 1, "Danh sách phải chứa ít nhất 1 lead");
        logPass("Cán bộ Tuyển sinh (admissions) tra cứu danh sách Lead thành công (HTTP 200)");

        // 5.2 Lọc theo trạng thái "Mới"
        const filterMoiRes = await request("/api/leads?status=Mới", {
            token: admissionsToken
        });
        assert.strictEqual(filterMoiRes.status, 200);
        const allAreMoi = filterMoiRes.data.data.every(l => l.status === "Mới");
        assert.ok(allAreMoi, 'Tất cả lead lọc theo "Mới" phải có status là "Mới"');
        logPass('Lọc danh sách Lead theo trạng thái "Mới" hoạt động chuẩn xác');

        // 5.3 Cập nhật trạng thái Lead (từ "Mới" sang "Đang tư vấn")
        const targetLead = getLeadsRes.data.data[0];
        const updateStatusRes = await request(`/api/leads/${targetLead.id}/status`, {
            method: "PUT",
            token: admissionsToken,
            body: {
                status: "Đang tư vấn",
                counselorNotes: "Đã liên hệ qua điện thoại, học viên hẹn chiều mai ghé trung tâm."
            }
        });
        assert.strictEqual(updateStatusRes.status, 200);
        assert.strictEqual(updateStatusRes.data.lead.status, "Đang tư vấn");
        logPass('Cán bộ tuyển sinh cập nhật trạng thái Lead từ "Mới" sang "Đang tư vấn" thành công');

        // 5.4 Thống kê số lượng Lead
        const statsRes = await request("/api/leads/stats", {
            token: admissionsToken
        });
        assert.strictEqual(statsRes.status, 200);
        assert.ok(typeof statsRes.data.data.total === "number");
        assert.ok(typeof statsRes.data.data.new === "number");
        logPass("Thống kê số lượng Lead theo trạng thái hoạt động chính xác");

        // =========================================================================
        // NHÓM 6: BẢO MẬT & PHÂN QUYỀN RBAC CHO CÁC API NỘI BỘ
        // =========================================================================
        console.log("\n=== 6. BẢO MẬT PHÂN QUYỀN RBAC CHO CÁC API QUẢN LÝ LEAD ===");

        // 6.1 Khách chưa đăng nhập gọi API lấy danh sách Lead -> Bị chặn 401
        const unauthGet = await request("/api/leads");
        assert.strictEqual(unauthGet.status, 401, "API xem danh sách Lead nội bộ phải chặn khi không có token (401)");
        logPass("Bảo mật API: Chặn truy cập trái phép khi thiếu token (HTTP 401)");

        // 6.2 Học viên cố tình xem danh sách Lead của trung tâm -> Bị chặn 403
        const studentForbidden = await request("/api/leads", {
            token: studentToken
        });
        assert.strictEqual(studentForbidden.status, 403, "Học viên không có quyền xem danh sách lead (403)");
        logPass("Phân quyền RBAC: Học viên bị từ chối truy cập thông tin Lead của Tuyển sinh (HTTP 403)");

        console.log("\n=======================================================");
        console.log("✔ TẤT CẢ CÁC TIÊU CHÍ LEAD CONSULTATION ĐÃ ĐẠT 100%!");
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
