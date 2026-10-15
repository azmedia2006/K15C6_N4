const assert = require("assert");
const http = require("http");
const app = require("../server");

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

async function runTests() {
    server = http.createServer(app);
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;

    try {
        const managerToken = await login("manager@tms.edu.vn", "manager123");
        const admissionsToken = await login("admissions@tms.edu.vn", "admissions123");
        const studentToken = await login("student@tms.edu.vn", "student123");

        const list = await request("/api/students", { token: managerToken });
        assert.strictEqual(list.status, 200);
        assert.ok(list.data.total >= 2);
        assert.ok(list.data.data.some(student => student.studentCode === "SV001"));

        const byStudentCode = await request("/api/students?search=SV001", {
            token: managerToken
        });
        assert.strictEqual(byStudentCode.status, 200);
        assert.strictEqual(byStudentCode.data.data.length, 1);
        assert.strictEqual(byStudentCode.data.data[0].id, "usr_student");

        const byName = await request("/api/students?search=minh%20tu%E1%BA%A5n", {
            token: managerToken
        });
        assert.strictEqual(byName.status, 200);
        assert.strictEqual(byName.data.data[0].id, "usr_student");

        const byEmailOnly = await request("/api/students?search=student%40tms.edu.vn", {
            token: managerToken
        });
        assert.strictEqual(byEmailOnly.status, 200);
        assert.strictEqual(byEmailOnly.data.data.length, 0);

        const byPhone = await request("/api/students?search=0978-123-456", {
            token: managerToken
        });
        assert.strictEqual(byPhone.status, 200);
        assert.ok(byPhone.data.data.some(student => student.studentCode === "SV001"));

        const profile = await request("/api/students/SV001", { token: managerToken });
        assert.strictEqual(profile.status, 200);
        assert.strictEqual(profile.data.data.currentClasses[0].className, "K15-PM01");
        assert.ok(profile.data.data.courseHistory.length > 0);

        const updated = await request("/api/students/usr_student", {
            method: "PUT",
            token: managerToken,
            body: {
                name: "Lê Minh Tuấn KN124",
                phone: "0901234567",
                entryQualification: "Cao đẳng Công nghệ thông tin",
                notes: "Ưu tiên liên hệ qua email."
            }
        });
        assert.strictEqual(updated.status, 200);
        assert.strictEqual(updated.data.data.name, "Lê Minh Tuấn KN124");
        assert.strictEqual(updated.data.data.entryQualification, "Cao đẳng Công nghệ thông tin");
        assert.strictEqual(updated.data.data.notes, "Ưu tiên liên hệ qua email.");

        const updatedProfile = await request("/api/students/SV001", { token: managerToken });
        assert.strictEqual(updatedProfile.data.data.phone, "0901234567");
        assert.strictEqual(updatedProfile.data.data.currentClasses[0].className, "K15-PM01");

        const invalidUpdate = await request("/api/students/SV001", {
            method: "PUT",
            token: managerToken,
            body: { name: "Tên hợp lệ nhưng không nên lưu", notes: "x".repeat(5001) }
        });
        assert.strictEqual(invalidUpdate.status, 400);
        const unchangedProfile = await request("/api/students/SV001", { token: managerToken });
        assert.strictEqual(unchangedProfile.data.data.name, "Lê Minh Tuấn KN124");
        assert.strictEqual(unchangedProfile.data.data.notes, "Ưu tiên liên hệ qua email.");

        const admissionsUpdate = await request("/api/students/SV001", {
            method: "PUT",
            token: admissionsToken,
            body: { notes: "Không được phép sửa." }
        });
        assert.strictEqual(admissionsUpdate.status, 403);

        const studentList = await request("/api/students", { token: studentToken });
        assert.strictEqual(studentList.status, 403);

        const missing = await request("/api/students/not-a-student", { token: managerToken });
        assert.strictEqual(missing.status, 404);

        console.log("KN-124 student profile tests passed.");
    } finally {
        await new Promise(resolve => server.close(resolve));
    }
}

if (require.main === module) {
    runTests().catch(error => {
        console.error("KN-124 student profile tests failed:", error);
        process.exit(1);
    });
}

module.exports = { runTests };
