/**
 * TMS - Role-Based Access Control (RBAC) Test Suite
 * Sprint 1 - Issue: KN-8
 * Author: Doan Minh Quan (dtc245200761@ictu.edu.vn)
 */

const assert = require("assert");
const http = require("http");
const app = require("../server");
const { generateToken } = require("../authService");
const { BUSINESS_ROLES, PERMISSIONS } = require("../rbacService");

const TEST_PORT = 3002;
let serverInstance;

function request(path, options = {}) {
    return new Promise((resolve, reject) => {
        const method = options.method || "GET";
        const headers = {
            "Content-Type": "application/json",
            ...(options.headers || {})
        };
        if (options.token) {
            headers["Authorization"] = `Bearer ${options.token}`;
        }

        const req = http.request(
            {
                hostname: "127.0.0.1",
                port: TEST_PORT,
                path: path,
                method: method,
                headers: headers
            },
            (res) => {
                let rawData = "";
                res.on("data", (chunk) => {
                    rawData += chunk;
                });
                res.on("end", () => {
                    let parsedData;
                    try {
                        parsedData = JSON.parse(rawData);
                    } catch (e) {
                        parsedData = rawData;
                    }
                    resolve({
                        status: res.statusCode,
                        headers: res.headers,
                        data: parsedData
                    });
                });
            }
        );

        req.on("error", (err) => reject(err));

        if (options.body) {
            req.write(JSON.stringify(options.body));
        }
        req.end();
    });
}

function startServer() {
    return new Promise((resolve) => {
        serverInstance = app.listen(TEST_PORT, () => {
            resolve();
        });
    });
}

function stopServer() {
    return new Promise((resolve) => {
        if (serverInstance) {
            serverInstance.close(() => resolve());
        } else {
            resolve();
        }
    });
}

let testIndex = 0;
function logPass(title) {
    testIndex++;
    console.log(`  [PASS] Case ${testIndex}: ${title}`);
}

async function runRbacTests() {
    console.log("\n--- Chay kiem thu he thong phan quyen RBAC (KN-8) ---");

    await startServer();

    try {
        const adminToken = generateToken({ id: "usr_admin", email: "admin@tms.edu.vn", name: "Nguyen Van Anh", role: BUSINESS_ROLES.ADMINISTRATOR });
        const teacherToken = generateToken({ id: "usr_teacher", email: "teacher@tms.edu.vn", name: "Tran Minh", role: BUSINESS_ROLES.INSTRUCTOR });
        const accountantToken = generateToken({ id: "usr_accountant", email: "accountant@tms.edu.vn", name: "Pham Thanh Mai", role: BUSINESS_ROLES.ACCOUNTANT });
        const studentToken = generateToken({ id: "usr_student", email: "student@tms.edu.vn", name: "Le Minh Tuan", role: BUSINESS_ROLES.STUDENT });

        // 1. Khai bao quyen cho 8 vai tro
        {
            const res = await request("/api/rbac/matrix", { token: adminToken });
            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.data.success, true);
            assert.strictEqual(res.data.roles.length, 8);
            assert.ok(res.data.matrix.instructor);
            assert.ok(res.data.matrix.accountant);
            assert.ok(res.data.matrix.administrator);
            logPass("Khai bao day du ma tran quyen cho 8 vai tro");
        }

        {
            const resTeacherPerms = await request("/api/rbac/my-permissions", { token: teacherToken });
            assert.strictEqual(resTeacherPerms.status, 200);
            assert.strictEqual(resTeacherPerms.data.role, BUSINESS_ROLES.INSTRUCTOR);
            assert.ok(resTeacherPerms.data.permissions.includes(PERMISSIONS.GRADES_UPDATE));
            assert.ok(!resTeacherPerms.data.permissions.includes(PERMISSIONS.TUITION_UPDATE));
            logPass("Giang vien co quyen grades:update va khong co quyen tuition:update");
        }

        // 2. Giang vien sua diem thanh cong, sua hoc phi bi chan
        {
            const resGradeUpdate = await request("/api/grades/sv_01", {
                method: "PUT",
                token: teacherToken,
                body: { subject: "Lap trinh Web", score: 9.5 }
            });
            assert.strictEqual(resGradeUpdate.status, 200);
            assert.strictEqual(resGradeUpdate.data.success, true);
            logPass("Giang vien sua diem sinh vien thanh cong (HTTP 200)");
        }

        {
            const resTuitionBlocked = await request("/api/tuitions/sv_01", {
                method: "PUT",
                token: teacherToken,
                body: { paidAmount: 20000000 }
            });
            assert.strictEqual(resTuitionBlocked.status, 403);
            assert.strictEqual(resTuitionBlocked.data.success, false);
            assert.strictEqual(resTuitionBlocked.data.errorCode, "FORBIDDEN_PERMISSION_DENIED");
            assert.ok(resTuitionBlocked.data.message.includes("Truy cập bị từ chối"));
            logPass("Chan giang vien sua hoc phi (HTTP 403 Forbidden)");
        }

        // 3. Ke toan sua hoc phi thanh cong, sua diem bi chan
        {
            const resTuitionUpdate = await request("/api/tuitions/sv_02", {
                method: "PUT",
                token: accountantToken,
                body: { paidAmount: 15000000, status: "completed" }
            });
            assert.strictEqual(resTuitionUpdate.status, 200);
            assert.strictEqual(resTuitionUpdate.data.success, true);
            logPass("Ke toan cap nhat hoc phi thanh cong (HTTP 200)");
        }

        {
            const resGradeBlocked = await request("/api/grades/sv_01", {
                method: "PUT",
                token: accountantToken,
                body: { subject: "Lap trinh Web", score: 10.0 }
            });
            assert.strictEqual(resGradeBlocked.status, 403);
            assert.strictEqual(resGradeBlocked.data.success, false);
            assert.strictEqual(resGradeBlocked.data.errorCode, "FORBIDDEN_PERMISSION_DENIED");
            assert.ok(resGradeBlocked.data.message.includes("Truy cập bị từ chối"));
            logPass("Chan ke toan sua diem (HTTP 403 Forbidden)");
        }

        // 4. Quan tri vien co toan quyen
        {
            const resAdminGrade = await request("/api/grades/sv_01", {
                method: "PUT",
                token: adminToken,
                body: { subject: "Lap trinh Web", score: 8.8 }
            });
            assert.strictEqual(resAdminGrade.status, 200);

            const resAdminTuition = await request("/api/tuitions/sv_01", {
                method: "PUT",
                token: adminToken,
                body: { paidAmount: 15000000 }
            });
            assert.strictEqual(resAdminTuition.status, 200);
            logPass("Quan tri he thong duoc phep cap nhat ca diem va hoc phi");
        }

        // 5. Hoc vien bi tu choi mac dinh khi sua diem/hoc phi
        {
            const resStudentGrade = await request("/api/grades/sv_01", {
                method: "PUT",
                token: studentToken,
                body: { subject: "Lap trinh Web", score: 10 }
            });
            assert.strictEqual(resStudentGrade.status, 403);

            const resStudentTuition = await request("/api/tuitions/sv_01", {
                method: "PUT",
                token: studentToken,
                body: { paidAmount: 0 }
            });
            assert.strictEqual(resStudentTuition.status, 403);
            logPass("Hoc vien bi chan khi co y sua diem hoac hoc phi");
        }

        // 6. Chan request khong co token
        {
            const resNoToken = await request("/api/grades/sv_01", {
                method: "PUT",
                body: { subject: "Test", score: 10 }
            });
            assert.strictEqual(resNoToken.status, 401);
            logPass("Chan request khong co token (HTTP 401)");
        }

        // 7. Vai tro la bi tu choi theo nguyen tac Default Deny
        {
            const invalidRoleToken = generateToken({ id: "usr_fake", email: "fake@tms.edu.vn", name: "Fake User", role: "guest_unregistered" });
            const resFakeRole = await request("/api/grades/sv_01", {
                method: "PUT",
                token: invalidRoleToken,
                body: { subject: "Test", score: 10 }
            });
            assert.strictEqual(resFakeRole.status, 403);
            logPass("Vai tro khong xac dinh bi tu choi mac dinh (Default Deny)");
        }

        // 8. Quan tri vien tuy bien phan quyen
        {
            const resUpdateMatrix = await request("/api/rbac/matrix/visitor", {
                method: "PUT",
                token: adminToken,
                body: { permissions: [PERMISSIONS.COURSES_VIEW, PERMISSIONS.REPORTS_VIEW] }
            });
            assert.strictEqual(resUpdateMatrix.status, 200);
            logPass("Cap nhat ma tran phan quyen thanh cong");
        }

        // 9. Thong bao loi tieng Viet ro rang
        {
            const resForbiddenCheck = await request("/api/tuitions/sv_01", {
                method: "PUT",
                token: teacherToken,
                body: { paidAmount: 1000 }
            });
            assert.strictEqual(resForbiddenCheck.status, 403);
            assert.ok(resForbiddenCheck.data.message.includes("Vui lòng liên hệ Quản trị hệ thống"));
            assert.strictEqual(resForbiddenCheck.data.detail.requiredPermission, "tuition:update");
            logPass("Thong bao loi tieng Viet ro rang khi khong du quyen");
        }

        console.log("\nKet qua: 12/12 ca kiem thu KN-8 dat yeu cau.\n");
    } finally {
        await stopServer();
    }
}

runRbacTests().catch((err) => {
    console.error("Loi kiem thu:", err);
    process.exit(1);
});
