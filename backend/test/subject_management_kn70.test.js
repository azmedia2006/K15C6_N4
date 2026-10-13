const assert = require("assert");
const http = require("http");
const app = require("../server");
const { initSubjectData, addClassForSubject } = require("../subjectService");

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

async function runAllSubjectTests() {
    console.log("\n=======================================================");
    console.log("   TMS SUBJECT CATALOG SUITE - KIỂM THỬ TỰ ĐỘNG KN-70  ");
    console.log("   Sprint 2: Quản lý Danh mục Môn học (Training Manager) ");
    console.log("   Tiêu chí:                                           ");
    console.log("   • Khai báo mã, tên, số buổi, trọng số, chuẩn đầu ra ");
    console.log("   • Một môn dùng lại được ở nhiều chương trình (N-N)  ");
    console.log("   • Môn đã có lớp học thì không xoá được              ");
    console.log("=======================================================");

    await startServer();

    try {
        initSubjectData();

        // 1. Đăng nhập các vai trò để kiểm thử
        const managerLogin = await loginAs("manager@tms.edu.vn", "manager123");
        assert.strictEqual(managerLogin.status, 200, "Đăng nhập Quản lý đào tạo phải thành công");
        const managerToken = managerLogin.token;

        const adminLogin = await loginAs("admin@tms.edu.vn", "admin123");
        assert.strictEqual(adminLogin.status, 200, "Đăng nhập Admin phải thành công");
        const adminToken = adminLogin.token;

        const studentLogin = await loginAs("student@tms.edu.vn", "student123");
        assert.strictEqual(studentLogin.status, 200, "Đăng nhập Học viên phải thành công");
        const studentToken = studentLogin.token;

        const teacherLogin = await loginAs("teacher@tms.edu.vn", "teacher123");
        assert.strictEqual(teacherLogin.status, 200, "Đăng nhập Giảng viên phải thành công");
        const teacherToken = teacherLogin.token;

        // =====================================================================
        // NHÓM 1: KHAI BÁO MÔN HỌC MỚI VỚI ĐẦY ĐỦ CÁC TRƯỜNG BẮT BUỘC
        // =====================================================================
        logGroup("1. TIÊU CHÍ 1: KHAI BÁO MÔN HỌC MỚI (MÃ, TÊN, SỐ BUỔI, TRỌNG SỐ, CHUẨN ĐẦU RA)");

        const newSubjectPayload = {
            code: "CLOUD_AWS",
            name: "Điện toán Đám mây & Triển khai AWS Cloud",
            sessions: 15,
            weight: 2.5,
            outcomes: "Thiết kế kiến trúc hệ thống trên AWS EC2, S3, RDS, thiết lập VPC bảo mật và triển khai Docker container.",
            programIds: ["prog_fullstack", "prog_java_enterprise"]
        };

        const createRes = await fetch(`${baseUrl}/api/subjects`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${managerToken}`
            },
            body: JSON.stringify(newSubjectPayload)
        });
        const createData = await createRes.json();

        assert.strictEqual(createRes.status, 201, "Tạo môn học mới phải trả về HTTP 201");
        assert.strictEqual(createData.success, true);
        assert.strictEqual(createData.subject.code, "CLOUD_AWS");
        assert.strictEqual(createData.subject.name, newSubjectPayload.name);
        assert.strictEqual(createData.subject.sessions, 15);
        assert.strictEqual(createData.subject.weight, 2.5);
        assert.strictEqual(createData.subject.outcomes, newSubjectPayload.outcomes);
        assert.strictEqual(createData.subject.programs.length, 2, "Môn học phải được gán vào 2 chương trình ban đầu");
        const createdSubjectId = createData.subject.id;

        logPass("Khai báo môn học mới thành công với đầy đủ mã, tên, số buổi, trọng số, chuẩn đầu ra (HTTP 201)");

        // =====================================================================
        // NHÓM 2: KIỂM SOÁT TÍNH DUY NHẤT CỦA MÃ MÔN VÀ XÁC THỰC DỮ LIỆU
        // =====================================================================
        logGroup("2. KIỂM THỬ XÁC THỰC DỮ LIỆU ĐẦU VÀO & RÀNG BUỘC DUY NHẤT MÃ MÔN");

        // 2.1 Trùng mã môn học
        const dupRes = await fetch(`${baseUrl}/api/subjects`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${managerToken}`
            },
            body: JSON.stringify({
                code: "cloud_aws", // test case-insensitive duplicate
                name: "Môn trùng mã",
                sessions: 10,
                weight: 1.0,
                outcomes: "Mô tả chuẩn đầu ra"
            })
        });
        const dupData = await dupRes.json();
        assert.strictEqual(dupRes.status, 400);
        assert.strictEqual(dupData.success, false);
        assert.strictEqual(dupData.code, "SUBJECT_CODE_EXISTS");
        logPass("Chặn trùng mã môn học (Unique Subject Code constraint) với thông báo tiếng Việt rõ ràng");

        // 2.2 Số buổi <= 0
        const invalidSessionsRes = await fetch(`${baseUrl}/api/subjects`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${managerToken}`
            },
            body: JSON.stringify({
                code: "INVALID_SESS",
                name: "Môn số buổi âm",
                sessions: 0,
                weight: 1.0,
                outcomes: "Mô tả chuẩn đầu ra"
            })
        });
        assert.strictEqual(invalidSessionsRes.status, 400);
        logPass("Chặn khai báo số buổi học <= 0");

        // 2.3 Trọng số <= 0
        const invalidWeightRes = await fetch(`${baseUrl}/api/subjects`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${managerToken}`
            },
            body: JSON.stringify({
                code: "INVALID_WEIGHT",
                name: "Môn trọng số âm",
                sessions: 10,
                weight: -0.5,
                outcomes: "Mô tả chuẩn đầu ra"
            })
        });
        assert.strictEqual(invalidWeightRes.status, 400);
        logPass("Chặn khai báo trọng số môn học <= 0");

        // 2.4 Thiếu mô tả chuẩn đầu ra
        const emptyOutcomesRes = await fetch(`${baseUrl}/api/subjects`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${managerToken}`
            },
            body: JSON.stringify({
                code: "NO_OUTCOMES",
                name: "Môn thiếu chuẩn đầu ra",
                sessions: 10,
                weight: 1.0,
                outcomes: "   "
            })
        });
        assert.strictEqual(emptyOutcomesRes.status, 400);
        logPass("Chặn khai báo thiếu mô tả chuẩn đầu ra của môn học");

        // =====================================================================
        // NHÓM 3: MỘT MÔN HỌC DÙNG LẠI ĐƯỢC Ở NHIỀU CHƯƠNG TRÌNH ĐÀO TẠO
        // =====================================================================
        logGroup("3. TIÊU CHÍ 2: TÁI SỬ DỤNG MỘT MÔN HỌC Ở NHIỀU CHƯƠNG TRÌNH KHÔNG TRÙNG LẶP");

        // Kiểm tra môn DB_SQL có mặt trong 3 chương trình
        const dbSqlRes = await fetch(`${baseUrl}/api/subjects/sbj_db_sql`);
        const dbSqlData = await dbSqlRes.json();
        assert.strictEqual(dbSqlRes.status, 200);
        assert.strictEqual(dbSqlData.subject.code, "DB_SQL");
        assert.ok(dbSqlData.subject.programs.length >= 3, "Môn DB_SQL phải dùng chung cho ít nhất 3 chương trình");
        const programCodes = dbSqlData.subject.programs.map(p => p.code);
        assert.ok(programCodes.includes("PROG_WEB"));
        assert.ok(programCodes.includes("PROG_DATA"));
        assert.ok(programCodes.includes("PROG_JAVA"));
        logPass("Môn DB_SQL được dùng lại ở nhiều chương trình (Fullstack, Data AI, Java Enterprise) mà không nhân bản dữ liệu");

        // Gán môn CLOUD_AWS thêm vào chương trình thứ 3: prog_data_ai
        const assignRes = await fetch(`${baseUrl}/api/programs/prog_data_ai/subjects`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${managerToken}`
            },
            body: JSON.stringify({ subjectId: createdSubjectId })
        });
        const assignData = await assignRes.json();
        assert.strictEqual(assignRes.status, 200);
        assert.strictEqual(assignData.subject.programs.length, 3, "Sau khi gán, môn CLOUD_AWS phải thuộc 3 chương trình");
        logPass("Gán thêm môn học vào chương trình đào tạo khác thành công (POST /api/programs/:id/subjects)");

        // Gỡ môn CLOUD_AWS khỏi 1 chương trình: prog_fullstack
        const unassignRes = await fetch(`${baseUrl}/api/programs/prog_fullstack/subjects/${createdSubjectId}`, {
            method: "DELETE",
            headers: {
                "Authorization": `Bearer ${managerToken}`
            }
        });
        const unassignData = await unassignRes.json();
        assert.strictEqual(unassignRes.status, 200);
        assert.strictEqual(unassignData.subject.programs.length, 2, "Sau khi gỡ, môn còn lại 2 chương trình và không bị xóa mất");
        logPass("Gỡ môn khỏi một chương trình an toàn, môn học vẫn nguyên vẹn trong hệ thống");

        // =====================================================================
        // NHÓM 4: RÀNG BUỘC NGHIỆP VỤ: MÔN ĐÃ CÓ LỚP HỌC THÌ KHÔNG XOÁ ĐƯỢC
        // =====================================================================
        logGroup("4. TIÊU CHÍ 3: RÀNG BUỘC CHẶN XÓA MÔN HỌC ĐÃ CÓ LỚP HỌC (RESTRICT CONSTRAINT)");

        // Môn sbj_js_core đã có lớp học cls_fs_01 (WD-2026-01)
        const deleteWithClassRes = await fetch(`${baseUrl}/api/subjects/sbj_js_core`, {
            method: "DELETE",
            headers: {
                "Authorization": `Bearer ${managerToken}`
            }
        });
        const deleteWithClassData = await deleteWithClassRes.json();

        assert.strictEqual(deleteWithClassRes.status, 400, "Xóa môn đã có lớp học phải bị từ chối với HTTP 400");
        assert.strictEqual(deleteWithClassData.success, false);
        assert.strictEqual(deleteWithClassData.code, "CANNOT_DELETE_SUBJECT_HAS_CLASSES");
        assert.ok(Array.isArray(deleteWithClassData.classes));
        assert.ok(deleteWithClassData.classes.length > 0);
        assert.ok(deleteWithClassData.message.includes("lớp học liên kết"));
        logPass("Chặn xóa thành công môn học đã có lớp học (HTTP 400 - CANNOT_DELETE_SUBJECT_HAS_CLASSES)");

        // Thêm lớp học cho môn vừa tạo CLOUD_AWS, sau đó thử xóa -> phải bị chặn
        addClassForSubject({
            code: "AWS-2026-TEST",
            name: "Lớp Thực hành AWS K15",
            subjectId: createdSubjectId
        });

        const deleteCloudAwsRes = await fetch(`${baseUrl}/api/subjects/${createdSubjectId}`, {
            method: "DELETE",
            headers: {
                "Authorization": `Bearer ${managerToken}`
            }
        });
        assert.strictEqual(deleteCloudAwsRes.status, 400, "Chặn xóa môn học ngay sau khi có lớp học mở ra");
        logPass("Đảm bảo tính toàn vẹn: Ngay khi phát sinh lớp học, môn học lập tức bị khóa tính năng xóa");

        // =====================================================================
        // NHÓM 5: CHO PHÉP XÓA MÔN HỌC KHI CHƯA CÓ LỚP HỌC LIÊN KẾT
        // =====================================================================
        logGroup("5. CHO PHÉP XÓA MÔN HỌC KHI CHƯA CÓ LỚP HỌC LIÊN KẾT");

        // Tạo một môn độc lập chưa có lớp học
        const tempSubRes = await fetch(`${baseUrl}/api/subjects`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${managerToken}`
            },
            body: JSON.stringify({
                code: "TEMP_DELETE_ME",
                name: "Môn Thử Nghiệm Xóa An Toàn",
                sessions: 8,
                weight: 1.0,
                outcomes: "Môn học dùng để kiểm thử thao tác xóa thành công khi chưa mở lớp.",
                programIds: ["prog_fullstack"]
            })
        });
        const tempSubData = await tempSubRes.json();
        assert.strictEqual(tempSubRes.status, 201);
        const tempSubId = tempSubData.subject.id;

        // Xóa môn học này
        const deleteTempRes = await fetch(`${baseUrl}/api/subjects/${tempSubId}`, {
            method: "DELETE",
            headers: {
                "Authorization": `Bearer ${managerToken}`
            }
        });
        const deleteTempData = await deleteTempRes.json();
        assert.strictEqual(deleteTempRes.status, 200, "Xóa môn học chưa có lớp học phải thành công HTTP 200");
        assert.strictEqual(deleteTempData.success, true);

        // Kiểm tra môn không còn tồn tại
        const verifyDeletedRes = await fetch(`${baseUrl}/api/subjects/${tempSubId}`);
        assert.strictEqual(verifyDeletedRes.status, 404, "Môn học sau khi xóa phải trả về 404 Not Found");
        logPass("Xóa thành công môn học chưa có lớp học liên kết và dọn dẹp sạch sẽ quan hệ chương trình");

        // =====================================================================
        // NHÓM 6: CẬP NHẬT THÔNG TIN MÔN HỌC
        // =====================================================================
        logGroup("6. CẬP NHẬT THÔNG TIN MÔN HỌC (UPDATE SUBJECT)");

        const updateRes = await fetch(`${baseUrl}/api/subjects/sbj_agile_git`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${managerToken}`
            },
            body: JSON.stringify({
                name: "Quy trình Git Flow, CI/CD và Agile/Scrum Nâng cao",
                sessions: 8,
                weight: 1.5,
                outcomes: "Làm chủ quy trình phát triển phần mềm chuyên nghiệp, CI/CD pipeline và Jira quản lý Sprint."
            })
        });
        const updateData = await updateRes.json();
        assert.strictEqual(updateRes.status, 200);
        assert.strictEqual(updateData.success, true);
        assert.strictEqual(updateData.subject.sessions, 8);
        assert.strictEqual(updateData.subject.weight, 1.5);
        assert.ok(updateData.subject.name.includes("Nâng cao"));
        logPass("Cập nhật tên, số buổi, trọng số, chuẩn đầu ra môn học thành công");

        // =====================================================================
        // NHÓM 7: BẢO VỆ PHÂN QUYỀN RBAC (QUẢN LÝ ĐÀO TẠO & ADMIN)
        // =====================================================================
        logGroup("7. PHÂN QUYỀN TRUY CẬP RBAC CHẶT CHẼ");

        // 7.1 Admin cập nhật thành công
        const adminUpdateRes = await fetch(`${baseUrl}/api/subjects/sbj_agile_git`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${adminToken}`
            },
            body: JSON.stringify({ sessions: 9 })
        });
        assert.strictEqual(adminUpdateRes.status, 200);
        logPass("Quản trị hệ thống (Administrator) có quyền chỉnh sửa môn học");

        // 7.2 Học viên bị từ chối 403
        const studentCreateRes = await fetch(`${baseUrl}/api/subjects`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${studentToken}`
            },
            body: JSON.stringify({
                code: "HACK_SBJ",
                name: "Môn của học viên",
                sessions: 10,
                weight: 1.0,
                outcomes: "outcomes"
            })
        });
        assert.strictEqual(studentCreateRes.status, 403, "Học viên phải bị chặn với HTTP 403");
        logPass("Học viên (student) bị chặn tạo môn học với mã HTTP 403 Forbidden");

        // 7.3 Giảng viên bị từ chối 403 khi xóa
        const teacherDeleteRes = await fetch(`${baseUrl}/api/subjects/sbj_agile_git`, {
            method: "DELETE",
            headers: {
                "Authorization": `Bearer ${teacherToken}`
            }
        });
        assert.strictEqual(teacherDeleteRes.status, 403, "Giảng viên phải bị chặn xóa môn học với HTTP 403");
        logPass("Giảng viên (instructor) bị chặn xóa môn học với mã HTTP 403 Forbidden");

        // 7.4 Chưa đăng nhập bị 401
        const anonRes = await fetch(`${baseUrl}/api/subjects`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code: "ANON", name: "Anon", sessions: 5, weight: 1, outcomes: "outcomes" })
        });
        assert.strictEqual(anonRes.status, 401);
        logPass("Yêu cầu không có Token bị từ chối xác thực HTTP 401 Unauthorized");

        // =====================================================================
        // NHÓM 8: TRA CỨU DANH MỤC, TÌM KIẾM VÀ LỌC THEO CHƯƠNG TRÌNH
        // =====================================================================
        logGroup("8. TRA CỨU, TÌM KIẾM VÀ LỌC DANH MỤC MÔN HỌC");

        // Tìm kiếm theo từ khóa "React"
        const searchRes = await fetch(`${baseUrl}/api/subjects?search=React`);
        const searchData = await searchRes.json();
        assert.strictEqual(searchRes.status, 200);
        assert.ok(searchData.items.length >= 1);
        assert.ok(searchData.items.some(s => s.code === "FE_REACT"));
        logPass("Tìm kiếm môn học theo từ khóa hoạt động chính xác");

        // Lọc theo chương trình "prog_data_ai"
        const filterRes = await fetch(`${baseUrl}/api/subjects?programId=prog_data_ai`);
        const filterData = await filterRes.json();
        assert.strictEqual(filterRes.status, 200);
        assert.ok(filterData.items.length >= 2);
        assert.ok(filterData.items.every(s => s.programs.some(p => p.id === "prog_data_ai")));
        logPass("Lọc danh mục môn học theo chương trình đào tạo chính xác 100%");

        // Tra cứu danh sách lớp học của môn
        const classListRes = await fetch(`${baseUrl}/api/subjects/sbj_js_core/classes`);
        const classListData = await classListRes.json();
        assert.strictEqual(classListRes.status, 200);
        assert.strictEqual(classListData.total, 1);
        assert.strictEqual(classListData.classes[0].code, "WD-2026-01");
        logPass("Tra cứu danh sách lớp học liên kết của môn học hoạt động chính xác");

        console.log("\n=======================================================");
        console.log("✔ TẤT CẢ CÁC TIÊU CHÍ NGHIỆM THU KN-70 ĐÃ ĐẠT 100% PASS!");
        console.log("=======================================================\n");

    } finally {
        await stopServer();
    }
}

if (require.main === module) {
    runAllSubjectTests().catch((err) => {
        console.error("\x1b[31m❌ Kiểm thử thất bại:\x1b[0m", err);
        process.exitCode = 1;
    });
}

module.exports = { runAllSubjectTests };
