/**
 * TMS SYSTEM - AUTOMATED TESTING SUITE KN-71
 * Sprint: KN Sprint 2
 * User Story: KN-71
 * "Là Quản lý đào tạo, tôi muốn gắn môn học vào chương trình và
 *  sắp thứ tự học, để học viên học đúng lộ trình, không học môn
 *  nâng cao trước môn nền tảng."
 * 
 * Acceptance Criteria (Tiêu chí nghiệm thu):
 * 1. Thêm và gỡ môn học khỏi chương trình đào tạo
 * 2. Kéo thả để đổi thứ tự học, thứ tự được lưu lại
 * 3. Khai báo được môn tiên quyết (ràng buộc không học môn nâng cao trước môn nền tảng)
 * 4. Chặn vòng lặp tiên quyết (Cyclic Dependency)
 * 5. Chặn gỡ môn học đang làm tiên quyết cho môn khác
 * 6. Phân quyền RBAC chặt chẽ (Chỉ training_manager & administrator)
 */

const assert = require("assert");
const http = require("http");
const app = require("../server");
const { initSubjectData } = require("../subjectService");

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

async function runAllCurriculumTests() {
    console.log("\n=======================================================");
    console.log("   TMS CURRICULUM ROADMAP SUITE - AUTOMATED TESTS KN-71 ");
    console.log("   User Story: Gắn môn vào chương trình & Sắp thứ tự học");
    console.log("   Tiêu chí:                                           ");
    console.log("   • Thêm và gỡ môn học khỏi chương trình              ");
    console.log("   • Kéo thả để đổi thứ tự, thứ tự được lưu lại        ");
    console.log("   • Khai báo được môn tiên quyết (nền tảng -> nâng cao)");
    console.log("   • Chặn xóa/gỡ môn đang làm tiên quyết cho môn khác  ");
    console.log("=======================================================");

    await startServer();

    try {
        initSubjectData();

        // 1. Đăng nhập các vai trò
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
        // NHÓM 1: LẤY LỘ TRÌNH MÔN HỌC THEO THỨ TỰ & MÔN TIÊN QUYẾT
        // =====================================================================
        logGroup("1. LẤY DANH SÁCH LỘ TRÌNH ĐÀO TẠO KÈM THỨ TỰ VÀ MÔN TIÊN QUYẾT");

        const getRoadmapRes = await fetch(`${baseUrl}/api/programs/prog_fullstack/subjects`);
        const roadmapData = await getRoadmapRes.json();
        assert.strictEqual(getRoadmapRes.status, 200);
        assert.strictEqual(roadmapData.success, true);
        assert.ok(Array.isArray(roadmapData.subjects));
        assert.strictEqual(roadmapData.subjects.length, 5);

        // Kiểm tra thứ tự tăng dần
        for (let i = 0; i < roadmapData.subjects.length; i++) {
            assert.strictEqual(roadmapData.subjects[i].orderIndex, i + 1, `Môn thứ ${i} phải có orderIndex là ${i + 1}`);
        }

        // Kiểm tra môn React SPA (thứ tự 4) có môn tiên quyết là JS Core (thứ tự 2)
        const reactSub = roadmapData.subjects.find(s => s.code === "FE_REACT");
        assert.ok(reactSub, "Phải tìm thấy môn React SPA");
        assert.strictEqual(reactSub.prerequisiteSubjectId, "sbj_js_core");
        assert.strictEqual(reactSub.prerequisiteSubject.code, "JS_CORE");
        logPass("Lấy lộ trình môn học chính xác, sắp thứ tự tăng dần kèm thông tin môn tiên quyết");

        // =====================================================================
        // NHÓM 2: THÊM MÔN HỌC VÀO CHƯƠNG TRÌNH KÈM THỨ TỰ VÀ TIÊN QUYẾT BAN ĐẦU
        // =====================================================================
        logGroup("2. THÊM MÔN HỌC VÀO CHƯƠNG TRÌNH ĐÀO TẠO");

        // Gán môn Python (sbj_python_ds) vào chương trình Fullstack ở vị trí cuối cùng
        const addSubRes = await fetch(`${baseUrl}/api/programs/prog_fullstack/subjects`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${managerToken}`
            },
            body: JSON.stringify({
                subjectId: "sbj_python_ds",
                orderIndex: 6,
                prerequisiteSubjectId: "sbj_db_sql" // Môn DB_SQL có thứ tự 3 < 6 -> Hợp lệ
            })
        });
        const addSubData = await addSubRes.json();
        assert.strictEqual(addSubRes.status, 200);
        assert.strictEqual(addSubData.success, true);

        // Kiểm tra lại danh sách môn của chương trình
        const checkAddRes = await fetch(`${baseUrl}/api/programs/prog_fullstack/subjects`);
        const checkAddData = await checkAddRes.json();
        assert.strictEqual(checkAddData.totalSubjects, 6);
        const addedItem = checkAddData.subjects.find(s => s.id === "sbj_python_ds");
        assert.ok(addedItem);
        assert.strictEqual(addedItem.orderIndex, 6);
        assert.strictEqual(addedItem.prerequisiteSubjectId, "sbj_db_sql");
        logPass("Gắn môn học vào chương trình thành công với thứ tự và môn tiên quyết chỉ định (POST /api/programs/:id/subjects)");

        // =====================================================================
        // NHÓM 3: KHAI BÁO MÔN TIÊN QUYẾT & RÀNG BUỘC THỨ TỰ HỌC TẬP
        // =====================================================================
        logGroup("3. KHAI BÁO MÔN TIÊN QUYẾT & KIỂM TRA RÀNG BUỘC THỨ TỰ");

        // Chặn tự chọn chính mình làm môn tiên quyết
        const selfPrereqRes = await fetch(`${baseUrl}/api/programs/prog_fullstack/subjects/sbj_node_api/prerequisite`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${managerToken}`
            },
            body: JSON.stringify({ prerequisiteSubjectId: "sbj_node_api" })
        });
        const selfPrereqData = await selfPrereqRes.json();
        assert.strictEqual(selfPrereqRes.status, 400);
        assert.strictEqual(selfPrereqData.code, "SELF_PREREQUISITE_NOT_ALLOWED");
        logPass("Chặn thành công: Môn học không thể tự chọn chính mình làm môn tiên quyết");

        // Chặn chọn môn đứng sau làm môn tiên quyết (Vi phạm nguyên tắc không học nâng cao trước nền tảng)
        // Môn sbj_js_core (thứ tự 2) không thể chọn sbj_react_spa (thứ tự 4) làm môn tiên quyết
        const invalidOrderPrereqRes = await fetch(`${baseUrl}/api/programs/prog_fullstack/subjects/sbj_js_core/prerequisite`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${managerToken}`
            },
            body: JSON.stringify({ prerequisiteSubjectId: "sbj_react_spa" })
        });
        const invalidOrderPrereqData = await invalidOrderPrereqRes.json();
        assert.strictEqual(invalidOrderPrereqRes.status, 400);
        assert.strictEqual(invalidOrderPrereqData.code, "PREREQUISITE_ORDER_VIOLATION");
        assert.ok(invalidOrderPrereqData.message.includes("nâng cao trước môn nền tảng"));
        logPass("Chặn thành công: Môn tiên quyết không thể đứng sau môn hiện tại trong lộ trình học");

        // Cập nhật môn tiên quyết hợp lệ: Gán sbj_js_core làm tiên quyết cho sbj_node_api (Node API ở vị trí 5 > JS Core ở vị trí 2)
        const validPrereqRes = await fetch(`${baseUrl}/api/programs/prog_fullstack/subjects/sbj_node_api/prerequisite`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${managerToken}`
            },
            body: JSON.stringify({ prerequisiteSubjectId: "sbj_js_core" })
        });
        const validPrereqData = await validPrereqRes.json();
        assert.strictEqual(validPrereqRes.status, 200);
        assert.strictEqual(validPrereqData.success, true);
        logPass("Khai báo môn tiên quyết hợp lệ thành công (PUT /api/programs/:id/subjects/:subId/prerequisite)");

        // Gỡ bỏ môn tiên quyết: truyền null
        const clearPrereqRes = await fetch(`${baseUrl}/api/programs/prog_fullstack/subjects/sbj_node_api/prerequisite`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${managerToken}`
            },
            body: JSON.stringify({ prerequisiteSubjectId: null })
        });
        const clearPrereqData = await clearPrereqRes.json();
        assert.strictEqual(clearPrereqRes.status, 200);
        assert.strictEqual(clearPrereqData.success, true);
        const nodeSubUpdated = clearPrereqData.program.subjects.find(s => s.id === "sbj_node_api");
        assert.strictEqual(nodeSubUpdated.prerequisiteSubjectId, null);
        logPass("Gỡ bỏ môn tiên quyết an toàn khi truyền null");

        // =====================================================================
        // NHÓM 4: KÉO THẢ ĐỔI THỨ TỰ & LƯU LẠI (REORDER API)
        // =====================================================================
        logGroup("4. KÉO THẢ ĐỔI THỨ TỰ VÀ LƯU LẠI (REORDER SUBJECTS)");

        // Lấy lại danh sách hiện tại của prog_data_ai:
        // Ban đầu: [sbj_agile_git (#1), sbj_db_sql (#2), sbj_python_ds (#3)]
        // Lưu ý: sbj_python_ds có prerequisite là sbj_db_sql.
        // Đổi chỗ thứ tự hợp lệ: sbj_db_sql lên #1, sbj_agile_git xuống #2, sbj_python_ds giữ #3
        // (sbj_db_sql #1 vẫn đứng trước sbj_python_ds #3 -> HỢP LỆ)
        const validReorderRes = await fetch(`${baseUrl}/api/programs/prog_data_ai/subjects/reorder`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${managerToken}`
            },
            body: JSON.stringify({
                orders: [
                    { subjectId: "sbj_db_sql", orderIndex: 1 },
                    { subjectId: "sbj_agile_git", orderIndex: 2 },
                    { subjectId: "sbj_python_ds", orderIndex: 3 }
                ]
            })
        });
        const validReorderData = await validReorderRes.json();
        assert.strictEqual(validReorderRes.status, 200);
        assert.strictEqual(validReorderData.success, true);

        // Kiểm tra thứ tự mới đã được lưu lại chính xác
        const verifyReorderRes = await fetch(`${baseUrl}/api/programs/prog_data_ai/subjects`);
        const verifyReorderData = await verifyReorderRes.json();
        assert.strictEqual(verifyReorderData.subjects[0].id, "sbj_db_sql");
        assert.strictEqual(verifyReorderData.subjects[0].orderIndex, 1);
        assert.strictEqual(verifyReorderData.subjects[1].id, "sbj_agile_git");
        assert.strictEqual(verifyReorderData.subjects[1].orderIndex, 2);
        assert.strictEqual(verifyReorderData.subjects[2].id, "sbj_python_ds");
        assert.strictEqual(verifyReorderData.subjects[2].orderIndex, 3);
        logPass("Kéo thả đổi thứ tự học tập và lưu lại thành công vào hệ thống (PUT /api/programs/:id/subjects/reorder)");

        // THỬ NGHIỆM ĐỔI THỨ TỰ VI PHẠM RÀNG BUỘC TIÊN QUYẾT:
        // Đưa môn sbj_python_ds (nâng cao) lên vị trí #1, trước môn sbj_db_sql (tiên quyết, vị trí #2)
        // -> HỆ THỐNG PHẢI CHẶN VÀ BÁO LỖI!
        const invalidReorderRes = await fetch(`${baseUrl}/api/programs/prog_data_ai/subjects/reorder`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${managerToken}`
            },
            body: JSON.stringify({
                orders: [
                    { subjectId: "sbj_python_ds", orderIndex: 1 },
                    { subjectId: "sbj_db_sql", orderIndex: 2 },
                    { subjectId: "sbj_agile_git", orderIndex: 3 }
                ]
            })
        });
        const invalidReorderData = await invalidReorderRes.json();
        assert.strictEqual(invalidReorderRes.status, 400);
        assert.strictEqual(invalidReorderData.code, "PREREQUISITE_ORDER_VIOLATION");
        assert.ok(invalidReorderData.message.includes("nâng cao trước môn nền tảng"));
        logPass("Chặn đổi thứ tự nếu môn nâng cao bị xếp học trước môn nền tảng tiên quyết");

        // =====================================================================
        // NHÓM 5: RÀNG BUỘC KHI GỠ MÔN HỌC KHỎI CHƯƠNG TRÌNH
        // =====================================================================
        logGroup("5. RÀNG BUỘC KHI GỠ MÔN HỌC KHỎI CHƯƠNG TRÌNH");

        // Thử gỡ môn sbj_db_sql khỏi prog_data_ai:
        // Môn sbj_python_ds đang yêu cầu sbj_db_sql làm môn tiên quyết -> PHẢI BỊ CHẶN!
        const removePrereqRes = await fetch(`${baseUrl}/api/programs/prog_data_ai/subjects/sbj_db_sql`, {
            method: "DELETE",
            headers: {
                "Authorization": `Bearer ${managerToken}`
            }
        });
        const removePrereqData = await removePrereqRes.json();
        assert.strictEqual(removePrereqRes.status, 400);
        assert.strictEqual(removePrereqData.code, "CANNOT_REMOVE_PREREQUISITE_SUBJECT");
        assert.ok(removePrereqData.message.includes("đang là môn tiên quyết"));
        logPass("Chặn gỡ môn học khỏi chương trình khi đang là môn tiên quyết của môn khác");

        // Gỡ môn không phải là tiên quyết: sbj_python_ds khỏi prog_fullstack (đã gán ở nhóm 2)
        const removeSafeRes = await fetch(`${baseUrl}/api/programs/prog_fullstack/subjects/sbj_python_ds`, {
            method: "DELETE",
            headers: {
                "Authorization": `Bearer ${managerToken}`
            }
        });
        const removeSafeData = await removeSafeRes.json();
        assert.strictEqual(removeSafeRes.status, 200);
        assert.strictEqual(removeSafeData.success, true);

        // Kiểm tra danh sách còn lại của prog_fullstack: chuẩn hóa lại thứ tự 1..5
        const checkAfterRemoveRes = await fetch(`${baseUrl}/api/programs/prog_fullstack/subjects`);
        const checkAfterRemoveData = await checkAfterRemoveRes.json();
        assert.strictEqual(checkAfterRemoveData.totalSubjects, 5);
        for (let i = 0; i < checkAfterRemoveData.subjects.length; i++) {
            assert.strictEqual(checkAfterRemoveData.subjects[i].orderIndex, i + 1);
        }
        logPass("Gỡ môn khỏi chương trình an toàn và tự động chuẩn hóa lại thứ tự lộ trình (1, 2, 3...)");

        // =====================================================================
        // NHÓM 6: KIỂM SOÁT PHÂN QUYỀN RBAC CHO CÁC API LỘ TRÌNH (KN-71)
        // =====================================================================
        logGroup("6. PHÂN QUYỀN TRUY CẬP RBAC CHO CÁC API KN-71");

        // 1. Quản trị hệ thống (Administrator) có quyền thực hiện
        const adminReorderRes = await fetch(`${baseUrl}/api/programs/prog_project_mgmt/subjects/reorder`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${adminToken}`
            },
            body: JSON.stringify({ orders: [{ subjectId: "sbj_agile_git", orderIndex: 1 }] })
        });
        assert.strictEqual(adminReorderRes.status, 200);
        logPass("Administrator có đầy đủ quyền quản lý lộ trình và sắp xếp môn học");

        // 2. Học viên (Student) bị chặn 403 Forbidden
        const studentAssignRes = await fetch(`${baseUrl}/api/programs/prog_fullstack/subjects`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${studentToken}`
            },
            body: JSON.stringify({ subjectId: "sbj_python_ds" })
        });
        assert.strictEqual(studentAssignRes.status, 403, "Học viên bị chặn thêm môn vào lộ trình HTTP 403");
        logPass("Học viên (student) bị chặn gán môn vào lộ trình đào tạo với HTTP 403 Forbidden");

        // 3. Giảng viên (Instructor) bị chặn 403 Forbidden
        const teacherReorderRes = await fetch(`${baseUrl}/api/programs/prog_fullstack/subjects/reorder`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${teacherToken}`
            },
            body: JSON.stringify({ orders: [] })
        });
        assert.strictEqual(teacherReorderRes.status, 403, "Giảng viên bị chặn đổi thứ tự lộ trình HTTP 403");
        logPass("Giảng viên (instructor) bị chặn sắp xếp lại lộ trình với HTTP 403 Forbidden");

        // 4. Không có Token xác thực bị chặn 401 Unauthorized
        const noAuthRes = await fetch(`${baseUrl}/api/programs/prog_fullstack/subjects/sbj_react_spa/prerequisite`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prerequisiteSubjectId: null })
        });
        assert.strictEqual(noAuthRes.status, 401, "Yêu cầu không token bị từ chối HTTP 401");
        logPass("Yêu cầu không token bị từ chối xác thực HTTP 401 Unauthorized");

        console.log("\n=======================================================");
        console.log("✔ TẤT CẢ CÁC TIÊU CHÍ NGHIỆM THU KN-71 ĐÃ ĐẠT 100% PASS!");
        console.log("=======================================================\n");

    } finally {
        await stopServer();
    }
}

if (require.main === module) {
    runAllCurriculumTests()
        .then(() => process.exit(0))
        .catch(err => {
            console.error("TEST FAILED:", err);
            process.exit(1);
        });
}

module.exports = { runAllCurriculumTests };
