/**
 * Batch Student Enrollment Test Suite
 * 
 * Kiểm thử toàn diện 3 yêu cầu nghiệp vụ:
 * 1. Chọn nhiều học viên để ghi danh cùng lúc (Batch Enrollment).
 * 2. Chặn ghi danh khi lớp đã đủ sĩ số hoặc học viên đã ở trong lớp (Capacity & Duplicate Protection).
 * 3. Ghi nhận ngày ghi danh (enrolledAt) và người thực hiện (enrolledBy, enrolledByName).
 * 4. Kiểm soát phân quyền RBAC và ghi nhật ký Audit Log.
 */

const assert = require("assert");
const http = require("http");
const app = require("../server");
const { createUser, deleteUser } = require("../userService");
const { users } = require("../authService");
const { getAuditLogs } = require("../roleService");
const { resetEnrollmentData, getEnrolledCount } = require("../enrollmentService");

let server;
let baseUrl;

async function request(endpoint, { method = "GET", body, token } = {}) {
    const headers = { "Content-Type": "application/json" };
    if (token) headers.Authorization = token;
    const response = await fetch(`${baseUrl}${endpoint}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body)
    });
    return { status: response.status, data: await response.json() };
}

async function login(email, password) {
    const response = await request("/api/auth/login", {
        method: "POST",
        body: { email, password }
    });
    assert.strictEqual(response.status, 200, `Login failed for ${email}`);
    return response.data.token;
}

function logGroup(title) {
    console.log(`\n=== ${title} ===`);
}

function logPass(msg) {
    console.log(`  ✔ PASS: ${msg}`);
}

async function runTests() {
    console.log("=======================================================");
    console.log("   TMS BATCH ENROLLMENT & CAPACITY PROTECTION SUITE    ");
    console.log("   Sprint 2: Ghi danh hàng loạt, kiểm soát sĩ số & vết ");
    console.log("=======================================================");

    resetEnrollmentData();

    server = http.createServer(app);
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;

    let createdTestUserIds = [];

    try {
        const adminToken = await login("admin@tms.edu.vn", "admin123");
        const managerToken = await login("manager@tms.edu.vn", "manager123");
        const admissionsToken = await login("admissions@tms.edu.vn", "admissions123");
        const teacherToken = await login("teacher@tms.edu.vn", "teacher123");
        const studentToken = await login("student@tms.edu.vn", "student123");
        const accountantToken = await login("accountant@tms.edu.vn", "accountant123");

        // Tạo 3 học viên thử nghiệm cho bài test ghi danh hàng loạt
        const testStudent1 = createUser({
            name: "Học Viên Mẫu 1",
            email: "student_test1@tms.edu.vn",
            role: "student",
            password: "password123"
        }).user;
        const testStudent2 = createUser({
            name: "Học Viên Mẫu 2",
            email: "student_test2@tms.edu.vn",
            role: "student",
            password: "password123"
        }).user;
        const testStudent3 = createUser({
            name: "Học Viên Mẫu 3",
            email: "student_test3@tms.edu.vn",
            role: "student",
            password: "password123"
        }).user;

        createdTestUserIds.push(testStudent1.id, testStudent2.id, testStudent3.id);

        // ========================================================
        // 1. KIỂM THỬ API DANH SÁCH & CHI TIẾT LỚP HỌC KÈM SĨ SỐ
        // ========================================================
        logGroup("1. KIỂM THỬ DANH SÁCH & SĨ SỐ LỚP HỌC (CLASSES API)");
        
        const classesRes = await request("/api/classes", { token: managerToken });
        assert.strictEqual(classesRes.status, 200, "Lấy danh sách lớp học thành công");
        assert.ok(classesRes.data.total >= 4, "Có ít nhất 4 lớp học trong hệ thống");
        
        const k15Pmp = classesRes.data.data.find(c => c.code === "K15-PM01");
        assert.ok(k15Pmp, "Tìm thấy lớp K15-PM01");
        assert.strictEqual(k15Pmp.maxCapacity, 35, "Sĩ số tối đa K15-PM01 là 35");
        assert.strictEqual(k15Pmp.enrolledCount, 32, "Sĩ số hiện tại K15-PM01 là 32");
        assert.strictEqual(k15Pmp.remainingSlots, 3, "K15-PM01 còn lại 3 chỗ trống");
        assert.strictEqual(k15Pmp.isFull, false, "K15-PM01 chưa đầy");
        logPass("API /api/classes trả về đầy đủ thông tin sĩ số và trạng thái còn chỗ của lớp K15-PM01 (32/35)");

        const k16Web = classesRes.data.data.find(c => c.code === "K16-WEB01");
        assert.ok(k16Web, "Tìm thấy lớp K16-WEB01");
        assert.strictEqual(k16Web.maxCapacity, 40, "Sĩ số tối đa K16-WEB01 là 40");
        assert.strictEqual(k16Web.enrolledCount, 40, "Sĩ số hiện tại K16-WEB01 là 40");
        assert.strictEqual(k16Web.remainingSlots, 0, "K16-WEB01 còn lại 0 chỗ trống");
        assert.strictEqual(k16Web.isFull, true, "K16-WEB01 đã đầy");
        logPass("API /api/classes phát hiện chính xác lớp đã đủ sĩ số tối đa: K16-WEB01 (40/40, isFull=true)");

        const classDetail = await request(`/api/classes/${k15Pmp.id}`, { token: managerToken });
        assert.strictEqual(classDetail.status, 200);
        assert.ok(Array.isArray(classDetail.data.data.students));
        assert.strictEqual(classDetail.data.data.students.length, 32);
        logPass("API /api/classes/:id trả về chi tiết lớp kèm danh sách 32 học viên");

        // ========================================================
        // 2. CHỌN NHIỀU HỌC VIÊN ĐỂ GHI DANH CÙNG LÚC (BATCH ENROLLMENT)
        // ========================================================
        logGroup("2. CHỌN NHIỀU HỌC VIÊN ĐỂ GHI DANH CÙNG LÚC (BATCH ENROLLMENT)");

        const batchRes = await request("/api/enrollments", {
            method: "POST",
            token: admissionsToken, // Cán bộ tuyển sinh thực hiện ghi danh
            body: {
                classId: "cls_pmp_01",
                studentIds: [testStudent1.id, testStudent2.id],
                notes: "Ghi danh hàng loạt đợt 2"
            }
        });

        assert.strictEqual(batchRes.status, 201, "Ghi danh hàng loạt trả về HTTP 201 Created");
        assert.strictEqual(batchRes.data.success, true);
        assert.strictEqual(batchRes.data.data.enrolledStudents.length, 2, "Ghi danh đúng 2 học viên cùng lúc");
        assert.strictEqual(batchRes.data.data.enrolledCount, 34, "Sĩ số lớp tăng từ 32 lên 34");
        assert.strictEqual(batchRes.data.data.class.remainingSlots, 1, "Chỗ trống giảm còn 1 chỗ");
        logPass("Chọn 2 học viên và ghi danh cùng lúc thành công (Sĩ số cập nhật: 34/35)");

        // Kiểm tra alias endpoint POST /api/classes/:classId/enrollments
        const aliasBatchRes = await request("/api/classes/cls_pmp_01/enrollments", {
            method: "POST",
            token: managerToken,
            body: {
                studentIds: [testStudent3.id],
                notes: "Ghi danh qua alias endpoint"
            }
        });
        assert.strictEqual(aliasBatchRes.status, 201, "Ghi danh qua alias endpoint thành công");
        assert.strictEqual(aliasBatchRes.data.data.enrolledCount, 35, "Lớp K15-PM01 đã đạt sĩ số tối đa 35/35");
        assert.strictEqual(aliasBatchRes.data.data.class.isFull, true, "isFull chuyển sang true");
        logPass("Alias endpoint POST /api/classes/:classId/enrollments hoạt động chuẩn xác");

        // ========================================================
        // 3. CHẶN GHI DANH KHI LỚP ĐÃ ĐỦ SĨ SỐ (CLASS CAPACITY PROTECTION)
        // ========================================================
        logGroup("3. CHẶN GHI DANH KHI LỚP ĐÃ ĐỦ SĨ SỐ");

        // Tạo thêm học viên mới để thử ghi danh vào lớp đã đầy
        const overflowStudent = createUser({
            name: "Học Viên Vượt Sĩ Số",
            email: "student_overflow@tms.edu.vn",
            role: "student",
            password: "password123"
        }).user;
        createdTestUserIds.push(overflowStudent.id);

        // 3.1: Ghi danh vào K15-PM01 (vừa đạt 35/35) -> BỊ CHẶN
        const blockedFullRes = await request("/api/enrollments", {
            method: "POST",
            token: adminToken,
            body: {
                classId: "cls_pmp_01",
                studentIds: [overflowStudent.id]
            }
        });

        assert.strictEqual(blockedFullRes.status, 400, "Bị từ chối với HTTP 400");
        assert.strictEqual(blockedFullRes.data.success, false);
        assert.strictEqual(blockedFullRes.data.code, "CLASS_FULL");
        assert.ok(
            blockedFullRes.data.message.includes("đã đủ sĩ số tối đa"),
            "Thông báo lỗi bằng tiếng Việt nêu rõ lớp đã đủ sĩ số tối đa"
        );
        logPass("Chặn ghi danh khi lớp đã đủ sĩ số tối đa (35/35): HTTP 400, CLASS_FULL");

        // 3.2: Ghi danh vào K16-WEB01 (vốn đã đầy 40/40) -> BỊ CHẶN
        const blockedK16Res = await request("/api/enrollments", {
            method: "POST",
            token: managerToken,
            body: {
                classId: "cls_web_01",
                studentIds: [overflowStudent.id]
            }
        });
        assert.strictEqual(blockedK16Res.status, 400);
        assert.strictEqual(blockedK16Res.data.code, "CLASS_FULL");
        logPass("Chặn ghi danh vào lớp K16-WEB01 đã đầy (40/40): HTTP 400");

        // 3.3: Lớp còn 2 chỗ nhưng chọn 3 học viên -> BỊ CHẶN DO VƯỢT QUÁ CHỖ CÒN LẠI
        // K15-DA02 có sĩ số 28/30 (còn 2 chỗ). Tạo 3 học viên và cố ghi danh cả 3:
        const studentA = createUser({ name: "HV A", email: "hva@tms.edu.vn", role: "student" }).user;
        const studentB = createUser({ name: "HV B", email: "hvb@tms.edu.vn", role: "student" }).user;
        const studentC = createUser({ name: "HV C", email: "hvc@tms.edu.vn", role: "student" }).user;
        createdTestUserIds.push(studentA.id, studentB.id, studentC.id);

        const exceededRes = await request("/api/enrollments", {
            method: "POST",
            token: adminToken,
            body: {
                classId: "cls_da_02", // max 30, current 28 => remaining 2
                studentIds: [studentA.id, studentB.id, studentC.id] // 3 học viên > 2 chỗ
            }
        });

        assert.strictEqual(exceededRes.status, 400);
        assert.strictEqual(exceededRes.data.code, "CLASS_CAPACITY_EXCEEDED");
        assert.ok(
            exceededRes.data.message.includes("chỉ còn lại 2 chỗ trống"),
            "Thông báo tiếng Việt nêu rõ số lượng chỗ trống còn lại"
        );
        logPass("Chặn ghi danh hàng loạt khi số học viên vượt quá chỗ trống (yêu cầu 3 > còn 2 chỗ): CLASS_CAPACITY_EXCEEDED");

        // ========================================================
        // 4. CHẶN GHI DANH KHI HỌC VIÊN ĐÃ Ở TRONG LỚP
        // ========================================================
        logGroup("4. CHẶN GHI DANH KHI HỌC VIÊN ĐÃ Ở TRONG LỚP");

        // 4.1: usr_student đã có trong K15-PM01 từ đầu -> Ghi danh lại bị chặn
        const duplicateSingleRes = await request("/api/enrollments", {
            method: "POST",
            token: adminToken,
            body: {
                classId: "cls_pmp_01",
                studentIds: ["usr_student"]
            }
        });

        // Chú ý: K15-PM01 đã đầy 35/35 thì bắt lỗi đầy trước hoặc duplicate. Hãy thử trên lớp còn chỗ WD-2026-01:
        // Ghi danh testStudent1 vào WD-2026-01 (còn nhiều chỗ)
        const firstEnroll = await request("/api/enrollments", {
            method: "POST",
            token: adminToken,
            body: {
                classId: "cls_fs_01",
                studentIds: [testStudent1.id]
            }
        });
        assert.strictEqual(firstEnroll.status, 201, "Ghi danh lần đầu thành công");

        // Cố tình ghi danh lại testStudent1 vào cùng lớp WD-2026-01 -> BỊ CHẶN DUPLICATE
        const duplicateRes = await request("/api/enrollments", {
            method: "POST",
            token: adminToken,
            body: {
                classId: "cls_fs_01",
                studentIds: [testStudent1.id]
            }
        });

        assert.strictEqual(duplicateRes.status, 400);
        assert.strictEqual(duplicateRes.data.success, false);
        assert.strictEqual(duplicateRes.data.code, "STUDENT_ALREADY_ENROLLED");
        assert.ok(
            duplicateRes.data.message.includes("đã ở trong lớp"),
            "Thông báo nêu rõ học viên đã ở trong lớp"
        );
        logPass("Chặn ghi danh trùng lặp học viên đơn lẻ đã ở trong lớp: HTTP 400, STUDENT_ALREADY_ENROLLED");

        // 4.2: Ghi danh hàng loạt chứa cả học viên mới và học viên đã có tên -> BỊ CHẶN
        const mixedBatchRes = await request("/api/enrollments", {
            method: "POST",
            token: adminToken,
            body: {
                classId: "cls_fs_01",
                studentIds: [studentA.id, testStudent1.id] // studentA mới, testStudent1 đã có
            }
        });

        assert.strictEqual(mixedBatchRes.status, 400);
        assert.strictEqual(mixedBatchRes.data.code, "STUDENT_ALREADY_ENROLLED");
        assert.ok(mixedBatchRes.data.message.includes(testStudent1.name));
        logPass("Chặn ghi danh hàng loạt khi phát hiện có học viên đã ở trong lớp: Báo rõ tên học viên trùng");

        // ========================================================
        // 5. GHI NHẬN NGÀY GHI DANH VÀ NGƯỜI THỰC HIỆN
        // ========================================================
        logGroup("5. GHI NHẬN NGÀY GHI DANH VÀ NGƯỜI THỰC HIỆN");

        // Ghi danh studentA vào lớp K15-DA02 với tư cách Vũ Hải Yến (admissions)
        const enrollWithAuditRes = await request("/api/enrollments", {
            method: "POST",
            token: admissionsToken,
            body: {
                classId: "cls_da_02",
                studentIds: [studentA.id],
                notes: "Tư vấn viên tiếp nhận và ghi danh chính thức"
            }
        });

        assert.strictEqual(enrollWithAuditRes.status, 201);
        const auditData = enrollWithAuditRes.data.data;

        // 5.1: Kiểm tra ngày ghi danh (enrolledAt)
        assert.ok(auditData.enrolledAt, "Có thuộc tính enrolledAt");
        const enrollDate = new Date(auditData.enrolledAt);
        assert.ok(!isNaN(enrollDate.getTime()), "enrolledAt là chuỗi thời gian hợp lệ ISO 8601");
        assert.ok(Date.now() - enrollDate.getTime() < 30000, "enrolledAt ghi nhận đúng thời điểm hiện tại");
        logPass(`Ngày ghi danh (enrolledAt) được ghi nhận chính xác: ${auditData.enrolledAt}`);

        // 5.2: Kiểm tra người thực hiện (enrolledBy & enrolledByName)
        assert.strictEqual(auditData.enrolledBy, "usr_admissions", "Người thực hiện là ID tài khoản đăng nhập: usr_admissions");
        assert.strictEqual(auditData.enrolledByName, "Vũ Hải Yến", "Tên người thực hiện: Vũ Hải Yến (Tư vấn tuyển sinh)");
        logPass(`Người thực hiện ghi danh được lưu vết: ${auditData.enrolledByName} (${auditData.enrolledBy})`);

        // 5.3: Kiểm tra hồ sơ học viên (Student Profile) được cập nhật ngày & người ghi danh
        const studentProfileRes = await request(`/api/students/${studentA.id}`, { token: managerToken });
        assert.strictEqual(studentProfileRes.status, 200);
        const enrolledClass = studentProfileRes.data.data.currentClasses.find(c => c.className === "K15-DA02");
        assert.ok(enrolledClass, "Lớp K15-DA02 xuất hiện trong currentClasses của học viên");
        assert.strictEqual(enrolledClass.status, "Đang học");
        assert.ok(enrolledClass.enrolledAt, "currentClasses chứa enrolledAt");
        assert.strictEqual(enrolledClass.enrolledByName, "Vũ Hải Yến", "currentClasses chứa tên người thực hiện");
        logPass("Hồ sơ học viên (currentClasses) được cập nhật đồng bộ ngày ghi danh và người thực hiện");

        // 5.4: Kiểm tra Audit Log của hệ thống
        const systemAuditLogs = getAuditLogs();
        const enrollLog = systemAuditLogs.find(l =>
            l.action === "ENROLL_STUDENT" && l.targetUserId === studentA.id
        );
        assert.ok(enrollLog, "Tìm thấy bản ghi Audit Log hành động ENROLL_STUDENT");
        assert.strictEqual(enrollLog.performed_by, "usr_admissions");
        assert.strictEqual(enrollLog.status, "SUCCESS");
        assert.ok(enrollLog.reason.includes("Vũ Hải Yến"));
        logPass("Nhật ký thao tác hệ thống (Audit Log) ghi vết đầy đủ hành động ghi danh kèm người thực hiện");

        // ========================================================
        // 6. KIỂM TRA PHÂN QUYỀN RBAC (SECURITY & ACCESS CONTROL)
        // ========================================================
        logGroup("6. PHÂN QUYỀN RBAC CHO TÍNH NĂNG GHI DANH");

        // 6.1: Học viên (student) không có quyền ghi danh -> 403 Forbidden
        const studentForbidden = await request("/api/enrollments", {
            method: "POST",
            token: studentToken,
            body: { classId: "cls_da_02", studentIds: [studentB.id] }
        });
        assert.strictEqual(studentForbidden.status, 403, "Học viên bị chặn 403");
        logPass("Học viên (student) bị chặn 403 khi gọi API ghi danh");

        // 6.2: Giảng viên (instructor) không có vai trò tuyển sinh/quản lý -> 403 Forbidden
        const teacherForbidden = await request("/api/enrollments", {
            method: "POST",
            token: teacherToken,
            body: { classId: "cls_da_02", studentIds: [studentB.id] }
        });
        assert.strictEqual(teacherForbidden.status, 403, "Giảng viên bị chặn 403");
        logPass("Giảng viên (instructor) bị chặn 403 khi gọi API ghi danh");

        // 6.3: Kế toán (accountant) không có quyền ghi danh -> 403 Forbidden
        const accountantForbidden = await request("/api/enrollments", {
            method: "POST",
            token: accountantToken,
            body: { classId: "cls_da_02", studentIds: [studentB.id] }
        });
        assert.strictEqual(accountantForbidden.status, 403, "Kế toán bị chặn 403");
        logPass("Kế toán (accountant) bị chặn 403 khi gọi API ghi danh");

        // 6.4: Thiếu Token xác thực -> 401 Unauthorized
        const unauthorizedRes = await request("/api/enrollments", {
            method: "POST",
            body: { classId: "cls_da_02", studentIds: [studentB.id] }
        });
        assert.strictEqual(unauthorizedRes.status, 401, "Thiếu token bị từ chối 401");
        logPass("Yêu cầu không có token bị từ chối với HTTP 401 Unauthorized");

        // 6.5: Quản trị viên (administrator) ghi danh thành công
        const adminEnroll = await request("/api/enrollments", {
            method: "POST",
            token: adminToken,
            body: { classId: "cls_da_02", studentIds: [studentB.id] }
        });
        assert.strictEqual(adminEnroll.status, 201, "Admin ghi danh thành công");
        logPass("Quản trị viên (administrator) có quyền ghi danh thành công");

        // ========================================================
        // 7. KIỂM THỬ HỦY GHI DANH & GIẢI PHÓNG SĨ SỐ (UNENROLL)
        // ========================================================
        logGroup("7. HỦY GHI DANH & GIẢI PHÓNG SĨ SỐ");

        const unenrollRes = await request(`/api/classes/cls_da_02/students/${studentB.id}`, {
            method: "DELETE",
            token: adminToken
        });
        assert.strictEqual(unenrollRes.status, 200, "Hủy ghi danh thành công");
        assert.strictEqual(unenrollRes.data.success, true);
        assert.strictEqual(unenrollRes.data.data.remainingSlots, 1, "Chỗ trống tăng lên sau khi hủy ghi danh");
        logPass("Hủy ghi danh học viên thành công và tự động giải phóng sĩ số lớp học");

        console.log("\n=======================================================");
        console.log("✔ TẤT CẢ CÁC TIÊU CHÍ GHI DANH & KIỂM SOÁT SĨ SỐ ĐẠT 100%!");
        console.log("=======================================================");

    } finally {
        // Dọn dẹp các tài khoản test đã tạo
        for (const uId of createdTestUserIds) {
            try { deleteUser(uId); } catch (_) {}
        }
        await new Promise(resolve => server.close(resolve));
    }
}

if (require.main === module) {
    runTests().catch(error => {
        console.error("Batch enrollment test failed:", error);
        process.exit(1);
    });
}

module.exports = { runTests };
