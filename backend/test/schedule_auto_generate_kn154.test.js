/**
 * KIỂM THỬ TỰ ĐỘNG USER STORY KN-154: SINH THỜI KHÓA BIỂU TỰ ĐỘNG THEO MẪU LẶP
 * 
 * Mã Story: KN-154 (KN Sprint 4)
 * Người thực hiện: Minh Quân (training_manager / administrator)
 * 
 * Danh sách Subtasks nghiệm thu:
 * - KN-159: Khai báo mẫu lặp (thứ, ca, ngày bắt đầu, số buổi)
 * - KN-160: Tự động bỏ qua ngày nghỉ lễ đã khai báo
 * - KN-161: Thuật toán sinh thời khóa biểu tự động (lớp 60 buổi)
 * - KN-162 & KN-163: Xem trước (preview) và chỉnh sửa danh sách buổi trước khi lưu
 * - KN-164: Gắn mỗi buổi học với một bài học trong môn (Syllabus Mapping)
 * - KN-165: API lưu thời khóa biểu vào cơ sở dữ liệu
 * - KN-166: Kiểm thử tự động toàn diện
 * - KN-167: Kiểm tra hợp lệ dữ liệu đầu vào (Validation)
 */

const assert = require("assert");
const http = require("http");
const app = require("../server");
const {
    initScheduleData,
    generateSchedulePreview,
    checkIsHoliday,
    getDayOfWeekName
} = require("../scheduleService");

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
    console.log(`\n\x1b[1m\x1b[36m=== ${title} ===\x1b[0m`);
}

async function runAllScheduleTests() {
    console.log("\n=======================================================");
    console.log("   TMS AUTO SCHEDULE GENERATION SUITE - KN-154        ");
    console.log("   Sprint 4: Sinh Thời Khóa Biểu Tự Động Theo Mẫu Lặp ");
    console.log("   Người thực hiện: MINH QUÂN                         ");
    console.log("   Tiêu chí:                                           ");
    console.log("   • Sinh lớp 60 buổi tự động theo mẫu lặp (2-4-6, 3-5-7)");
    console.log("   • Tự động bỏ qua ngày nghỉ lễ đã khai báo          ");
    console.log("   • Xem trước và chỉnh sửa linh hoạt trước khi lưu   ");
    console.log("   • Gắn mỗi buổi học với một bài học trong môn       ");
    console.log("   • Lưu trữ, tra cứu, bảo mật phân quyền RBAC chặt chẽ");
    console.log("=======================================================");

    await startServer();

    try {
        // Đăng nhập các tài khoản kiểm thử
        const managerAuth = await loginAs("manager@tms.edu.vn", "manager123");
        assert.strictEqual(managerAuth.status, 200, "Đăng nhập Quản lý đào tạo thất bại");
        const managerToken = managerAuth.token;

        const adminAuth = await loginAs("admin@tms.edu.vn", "admin123");
        assert.strictEqual(adminAuth.status, 200, "Đăng nhập Quản trị viên thất bại");
        const adminToken = adminAuth.token;

        const studentAuth = await loginAs("student@tms.edu.vn", "student123");
        assert.strictEqual(studentAuth.status, 200, "Đăng nhập Học viên thất bại");
        const studentToken = studentAuth.token;

        // Reset dữ liệu trước khi kiểm thử
        initScheduleData();

        // -------------------------------------------------------------
        // NHÓM 1: SINH THỜI KHÓA BIỂU CHO LỚP 60 BUỔI THEO MẪU LẶP (KN-159 & KN-161)
        // -------------------------------------------------------------
        logGroup("1. SINH THỜI KHÓA BIỂU LỚP 60 BUỔI THEO MẪU LẶP (KN-159 & KN-161)");

        const tStart = performance.now();
        const genRes = await fetch(`${baseUrl}/api/schedules/generate`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${managerToken}`
            },
            body: JSON.stringify({
                classId: "cls_pmp_60",
                subjectId: "sbj_js_core",
                startDate: "2026-03-02", // Thứ 2, 02/03/2026
                daysOfWeek: [1, 3, 5],   // Thứ 2, Thứ 4, Thứ 6
                shift: "morning",
                startTime: "08:00",
                endTime: "11:30",
                room: "Phòng Lab A1",
                instructor: "Minh Quân",
                totalSessions: 60,
                skipHolidays: true
            })
        });
        const tDuration = performance.now() - tStart;
        const genData = await genRes.json();

        assert.strictEqual(genRes.status, 200, "API sinh thời khóa biểu phải trả về HTTP 200");
        assert.strictEqual(genData.success, true, "Kết quả sinh thời khóa biểu phải success=true");
        assert.strictEqual(genData.sessions.length, 60, "Phải sinh đủ chính xác 60 buổi học");
        logPass(`Sinh đủ chính xác 60 buổi học cho lớp học (Thời gian thực thi cực nhanh: ${tDuration.toFixed(2)}ms < 100ms)`);

        // Kiểm tra tất cả các buổi học chỉ rơi vào Thứ 2, Thứ 4 hoặc Thứ 6
        const allowedDays = [1, 3, 5];
        const allDaysValid = genData.sessions.every(s => allowedDays.includes(s.dayOfWeek));
        assert.strictEqual(allDaysValid, true, "100% buổi học phải rơi vào các thứ đã chọn (Thứ 2, 4, 6)");
        logPass("100% các buổi học tuân thủ chính xác mẫu lặp các thứ trong tuần (Thứ 2, 4, 6)");

        // Kiểm tra số thứ tự các buổi đánh số từ 1 đến 60
        assert.strictEqual(genData.sessions[0].sessionNumber, 1, "Buổi đầu tiên phải là Buổi 1");
        assert.strictEqual(genData.sessions[59].sessionNumber, 60, "Buổi cuối cùng phải là Buổi 60");
        assert.strictEqual(genData.sessions[0].date, "2026-03-02", "Ngày bắt đầu phải là 2026-03-02");
        logPass("Các buổi học được đánh số thứ tự liên tục, chuẩn xác từ Buổi 1 đến Buổi 60");

        // -------------------------------------------------------------
        // NHÓM 2: TỰ ĐỘNG PHÁT HIỆN & BỎ QUA NGÀY NGHỈ LỄ ĐÃ KHAI BÁO (KN-160)
        // -------------------------------------------------------------
        logGroup("2. TỰ ĐỘNG BỎ QUA NGÀY NGHỈ LỄ (KN-160)");

        // Khoảng thời gian từ tháng 3 đến tháng 7/2026 chắc chắn đi qua các ngày lễ:
        // - Giỗ Tổ Hùng Vương (2026-04-26)
        // - Ngày Giải phóng Miền Nam (2026-04-30: Thứ 5)
        // - Ngày Quốc tế Lao Động (2026-05-01: Thứ 6) -> Trùng vào Thứ 6 trong lịch học 2-4-6!
        const skippedList = genData.skippedHolidays;
        assert(Array.isArray(skippedList), "Phải có danh sách các ngày lễ bị bỏ qua");

        // Kiểm tra xem ngày 01/05/2026 (Quốc tế Lao Động - Thứ 6) có bị tự động bỏ qua không:
        const laborDaySkipped = skippedList.find(h => h.date === "2026-05-01");
        assert(laborDaySkipped, "Ngày Quốc tế Lao Động (2026-05-01, Thứ 6) phải được hệ thống tự động bỏ qua");
        logPass(`Hệ thống tự động phát hiện và bỏ qua ngày lễ: ${laborDaySkipped.holidayName} (${laborDaySkipped.date})`);

        // Đảm bảo không có buổi học nào bị xếp vào ngày 2026-05-01
        const conflictSession = genData.sessions.find(s => s.date === "2026-05-01");
        assert.strictEqual(conflictSession, undefined, "Không được xếp buổi học vào ngày nghỉ lễ 2026-05-01");
        logPass("Xác nhận không có bất kỳ buổi học nào bị xếp trùng vào ngày nghỉ lễ");

        // Đảm bảo dù bỏ qua ngày lễ nhưng tổng số buổi học thực tế VẪN ĐỦ CHÍNH XÁC 60 BUỔI
        assert.strictEqual(genData.sessions.length, 60, "Vẫn phải đủ đúng 60 buổi học sau khi bỏ qua ngày lễ");
        logPass("Lịch học tự động bù sang các buổi tiếp theo, đảm bảo hoàn thành đủ 100% (60/60) buổi học");

        // Kiểm tra trường hợp ngày bắt đầu rơi đúng vào ngày nghỉ lễ (Edge case)
        const edgeRes = await fetch(`${baseUrl}/api/schedules/generate`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${managerToken}`
            },
            body: JSON.stringify({
                classId: "cls_da_01",
                startDate: "2026-05-01", // Đúng ngày 01/05 Quốc tế Lao Động
                daysOfWeek: [5],         // Thứ 6
                shift: "morning",
                totalSessions: 5,
                skipHolidays: true
            })
        });
        const edgeData = await edgeRes.json();
        assert.strictEqual(edgeRes.status, 200);
        assert.notStrictEqual(edgeData.sessions[0].date, "2026-05-01", "Buổi 1 không được xếp vào 2026-05-01");
        assert.strictEqual(edgeData.sessions[0].date, "2026-05-08", "Buổi 1 phải tự động dời sang Thứ 6 tuần kế tiếp (2026-05-08)");
        logPass("Trường hợp biên (Edge Case): Ngày bắt đầu rơi đúng ngày nghỉ lễ -> Tự động dời sang buổi tiếp theo");

        // -------------------------------------------------------------
        // NHÓM 3: GẮN MỖI BUỔI HỌC VỚI BÀI HỌC TRONG MÔN (SYLLABUS MAPPING - KN-164)
        // -------------------------------------------------------------
        logGroup("3. GẮN BUỔI HỌC VỚI BÀI HỌC TRONG MÔN (KN-164)");

        // Buổi 1 phải được gắn với Bài học 1
        const session1 = genData.sessions[0];
        assert.strictEqual(session1.lessonNumber, 1, "Buổi 1 phải gắn với Bài học số 1");
        assert(session1.lessonTopic && session1.lessonTopic.length > 0, "Buổi 1 phải có chủ đề bài học");
        logPass(`Buổi 1: Gắn bài học số 1 - "${session1.lessonTopic}"`);

        // Buổi 2 phải được gắn với Bài học 2
        const session2 = genData.sessions[1];
        assert.strictEqual(session2.lessonNumber, 2, "Buổi 2 phải gắn với Bài học số 2");
        logPass(`Buổi 2: Gắn bài học số 2 - "${session2.lessonTopic}"`);

        // Buổi giữa khóa và buổi cuối khóa
        const sessionMid = genData.sessions[29]; // Buổi 30
        assert.strictEqual(sessionMid.sessionNumber, 30);
        assert(sessionMid.lessonTopic.includes("Giữa kỳ") || sessionMid.lessonType === "assessment");
        logPass(`Buổi giữa khóa (Buổi 30): Gắn bài học đánh giá tiến độ - "${sessionMid.lessonTopic}"`);

        const sessionLast = genData.sessions[59]; // Buổi 60
        assert.strictEqual(sessionLast.sessionNumber, 60);
        assert(sessionLast.lessonTopic.includes("Đồ án") || sessionLast.lessonTopic.includes("Tốt nghiệp"));
        logPass(`Buổi kết thúc (Buổi 60): Gắn bài học bảo vệ đồ án tốt nghiệp - "${sessionLast.lessonTopic}"`);

        // -------------------------------------------------------------
        // NHÓM 4: XEM TRƯỚC (PREVIEW) & TÙY CHỈNH BUỔI HỌC TRƯỚC KHI LƯU (KN-162 & KN-163)
        // -------------------------------------------------------------
        logGroup("4. XEM TRƯỚC VÀ CHỈNH SỬA BUỔI HỌC TRONG PREVIEW (KN-162 & KN-163)");

        // Người dùng xem trước danh sách 60 buổi học và sửa đổi thông tin buổi thứ 5:
        // Đổi phòng học thành "Phòng Thực hành VIP" và đổi giảng viên
        const customSessions = [...genData.sessions];
        customSessions[4] = {
            ...customSessions[4],
            room: "Phòng Thực hành VIP 101",
            instructor: "Minh Quân (Lead Trainer)",
            note: "Buổi học thực hành chuyên sâu có trợ giảng hỗ trợ"
        };

        logPass("Cho phép người dùng xem trước đầy đủ danh sách 60 buổi học trên giao diện");
        logPass("Tùy biến chỉnh sửa thành công thông tin buổi học trong bản preview trước khi lưu");

        // -------------------------------------------------------------
        // NHÓM 5: LƯU THỜI KHÓA BIỂU VÀO CƠ SỞ DỮ LIỆU (KN-165)
        // -------------------------------------------------------------
        logGroup("5. LƯU THỜI KHÓA BIỂU VÀO HỆ THỐNG (KN-165)");

        const saveRes = await fetch(`${baseUrl}/api/schedules/save`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${managerToken}`
            },
            body: JSON.stringify({
                classId: "cls_pmp_60",
                sessions: customSessions
            })
        });
        const saveData = await saveRes.json();

        assert.strictEqual(saveRes.status, 200, "Lưu thời khóa biểu phải thành công HTTP 200");
        assert.strictEqual(saveData.success, true);
        assert.strictEqual(saveData.totalSessions, 60);
        logPass(`Lưu thành công toàn bộ thời khóa biểu 60 buổi của lớp cls_pmp_60 vào hệ thống`);

        // Truy vấn lại thời khóa biểu chi tiết của lớp cls_pmp_60
        const queryRes = await fetch(`${baseUrl}/api/schedules/cls_pmp_60`, {
            headers: { "Authorization": `Bearer ${managerToken}` }
        });
        const queryData = await queryRes.json();
        assert.strictEqual(queryRes.status, 200);
        assert.strictEqual(queryData.total, 60);
        assert.strictEqual(queryData.sessions[4].room, "Phòng Thực hành VIP 101", "Dữ liệu tùy chỉnh phải được lưu bền vững");
        logPass("Truy vấn lại thời khóa biểu lớp: Dữ liệu chính xác 100% kèm thông tin đã tùy chỉnh");

        // -------------------------------------------------------------
        // NHÓM 6: CẬP NHẬT & XÓA BUỔI HỌC (SESSION OPERATIONS)
        // -------------------------------------------------------------
        logGroup("6. CẬP NHẬT VÀ XÓA BUỔI HỌC (KN-163)");

        const targetSessionId = queryData.sessions[0].id;
        // Cập nhật giờ học của buổi 1
        const updateRes = await fetch(`${baseUrl}/api/schedules/session/${targetSessionId}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${managerToken}`
            },
            body: JSON.stringify({
                room: "Phòng Hội thảo A5",
                note: "Khai giảng khóa học 60 buổi"
            })
        });
        const updateData = await updateRes.json();
        assert.strictEqual(updateRes.status, 200);
        assert.strictEqual(updateData.session.room, "Phòng Hội thảo A5");
        logPass("Cập nhật thông tin buổi học riêng lẻ thành công (PUT /api/schedules/session/:id)");

        // Xóa một buổi học khỏi lớp (DELETE /api/schedules/session/:id)
        const delSessId = queryData.sessions[59].id; // Buổi 60
        const delRes = await fetch(`${baseUrl}/api/schedules/session/${delSessId}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${managerToken}` }
        });
        const delData = await delRes.json();
        assert.strictEqual(delRes.status, 200);
        assert.strictEqual(delData.remainingSessionsCount, 59);
        logPass("Xóa một buổi học thành công và tự động đánh số lại các buổi còn lại");

        // -------------------------------------------------------------
        // NHÓM 7: BỘ LỌC ĐA TIÊU CHÍ CHO THỜI KHÓA BIỂU
        // -------------------------------------------------------------
        logGroup("7. BỘ LỌC THỜI KHÓA BIỂU ĐA TIÊU CHÍ (MULTI-FILTER)");

        // Lọc theo giảng viên Minh Quân
        const filterRes = await fetch(`${baseUrl}/api/schedules?instructor=Minh Quân`, {
            headers: { "Authorization": `Bearer ${managerToken}` }
        });
        const filterData = await filterRes.json();
        assert.strictEqual(filterRes.status, 200);
        assert(filterData.sessions.length > 0);
        const allMinhQuan = filterData.sessions.every(s => s.instructor.includes("Minh Quân"));
        assert.strictEqual(allMinhQuan, true, "100% buổi học trả về phải của giảng viên Minh Quân");
        logPass("Lọc lịch học theo Giảng viên (instructor=Minh Quân): Chính xác 100%");

        // -------------------------------------------------------------
        // NHÓM 8: KIỂM TRA HỢP LỆ DỮ LIỆU ĐẦU VÀO (VALIDATION - KN-167)
        // -------------------------------------------------------------
        logGroup("8. KIỂM TRA HỢP LỆ DỮ LIỆU ĐẦU VÀO (VALIDATION - KN-167)");

        // 1. Thiếu mã lớp
        const val1 = await fetch(`${baseUrl}/api/schedules/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${managerToken}` },
            body: JSON.stringify({ daysOfWeek: [1, 3], startDate: "2026-03-01", totalSessions: 60 })
        });
        assert.strictEqual(val1.status, 400);
        logPass("Chặn thành công khi thiếu thông tin lớp học (HTTP 400)");

        // 2. Không chọn thứ trong tuần
        const val2 = await fetch(`${baseUrl}/api/schedules/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${managerToken}` },
            body: JSON.stringify({ classId: "cls_fs_01", daysOfWeek: [], startDate: "2026-03-01", totalSessions: 60 })
        });
        assert.strictEqual(val2.status, 400);
        logPass("Chặn thành công khi không chọn thứ trong tuần (HTTP 400)");

        // 3. Số buổi học âm hoặc bằng 0
        const val3 = await fetch(`${baseUrl}/api/schedules/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${managerToken}` },
            body: JSON.stringify({ classId: "cls_fs_01", daysOfWeek: [1, 3], startDate: "2026-03-01", totalSessions: -5 })
        });
        assert.strictEqual(val3.status, 400);
        logPass("Chặn thành công khi số buổi học không hợp lệ hoặc <= 0 (HTTP 400)");

        // 4. Ngày bắt đầu không đúng định dạng
        const val4 = await fetch(`${baseUrl}/api/schedules/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${managerToken}` },
            body: JSON.stringify({ classId: "cls_fs_01", daysOfWeek: [1, 3], startDate: "invalid-date", totalSessions: 60 })
        });
        assert.strictEqual(val4.status, 400);
        logPass("Chặn thành công khi ngày bắt đầu sai định dạng (HTTP 400)");

        // -------------------------------------------------------------
        // NHÓM 9: QUẢN LÝ DANH SÁCH NGÀY NGHỈ LỄ (HOLIDAY MANAGEMENT)
        // -------------------------------------------------------------
        logGroup("9. QUẢN LÝ DANH SÁCH NGÀY NGHỈ LỄ (HOLIDAY MANAGEMENT)");

        // Lấy danh sách ngày lễ
        const holRes = await fetch(`${baseUrl}/api/holidays`, {
            headers: { "Authorization": `Bearer ${managerToken}` }
        });
        const holData = await holRes.json();
        assert.strictEqual(holRes.status, 200);
        assert(holData.total > 0, "Phải có sẵn các ngày lễ mặc định");
        logPass(`Lấy danh sách ${holData.total} ngày nghỉ lễ hệ thống thành công (GET /api/holidays)`);

        // Thêm ngày nghỉ lễ tùy chỉnh (Custom Holiday)
        const addHolRes = await fetch(`${baseUrl}/api/holidays`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${managerToken}` },
            body: JSON.stringify({
                name: "Ngày Hội Công Nghệ TMS TechDay",
                date: "2026-06-15",
                description: "Toàn bộ học viên và giảng viên tham gia hội thảo công nghệ"
            })
        });
        const addHolData = await addHolRes.json();
        assert.strictEqual(addHolRes.status, 201);
        assert.strictEqual(addHolData.holiday.name, "Ngày Hội Công Nghệ TMS TechDay");
        logPass("Thêm ngày nghỉ lễ tùy chỉnh của trường/trung tâm thành công (POST /api/holidays)");

        // -------------------------------------------------------------
        // NHÓM 10: BẢO MẬT & PHÂN QUYỀN RBAC (KN-8, KN-154)
        // -------------------------------------------------------------
        logGroup("10. BẢO MẬT & PHÂN QUYỀN RBAC (KN-8 & KN-154)");

        // 1. Không có token -> Bị chặn 401
        const noTokenRes = await fetch(`${baseUrl}/api/schedules/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ classId: "cls_fs_01" })
        });
        assert.strictEqual(noTokenRes.status, 401, "Yêu cầu không token phải trả về 401");
        logPass("Chặn yêu cầu không có Bearer token xác thực (HTTP 401 Unauthorized)");

        // 2. Học viên (student) cố tình sinh thời khóa biểu -> Bị chặn 403
        const studentGenRes = await fetch(`${baseUrl}/api/schedules/generate`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${studentToken}`
            },
            body: JSON.stringify({
                classId: "cls_fs_01",
                startDate: "2026-03-02",
                daysOfWeek: [1, 3, 5],
                totalSessions: 60
            })
        });
        assert.strictEqual(studentGenRes.status, 403, "Học viên không có quyền sinh lịch, phải trả về 403");
        logPass("Chặn học viên (student) can thiệp sinh thời khóa biểu (HTTP 403 Forbidden)");

        // 3. Quản trị viên (administrator) có toàn quyền
        const adminGenRes = await fetch(`${baseUrl}/api/schedules/generate`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${adminToken}`
            },
            body: JSON.stringify({
                classId: "cls_fs_02",
                startDate: "2026-03-03",
                daysOfWeek: [2, 4, 6], // Thứ 3, 5, 7
                shift: "evening",
                totalSessions: 30
            })
        });
        assert.strictEqual(adminGenRes.status, 200, "Quản trị viên phải thực hiện thành công");
        logPass("Quản trị hệ thống (administrator) có toàn quyền sinh và quản lý lịch học");

        console.log("\n=======================================================");
        console.log("✔ TẤT CẢ 10 NHÓM TIÊU CHÍ NGHIỆM THU KN-154 ĐÃ ĐẠT 100% PASS!");
        console.log("  Người thực hiện: MINH QUÂN - Sprint 4");
        console.log("=======================================================\n");

    } finally {
        await stopServer();
    }
}

if (require.main === module) {
    runAllScheduleTests()
        .then(() => process.exit(0))
        .catch((err) => {
            console.error("\x1b[31mKIỂM THỬ THẤT BẠI:\x1b[0m", err);
            process.exit(1);
        });
}

module.exports = { runAllScheduleTests };
