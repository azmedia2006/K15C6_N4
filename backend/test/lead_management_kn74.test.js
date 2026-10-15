const assert = require("assert");
const http = require("http");
const app = require("../server");
const { resetLeadsForTesting } = require("../leadService");

let server;
let baseUrl;

async function request(endpoint, { method = "GET", body, token } = {}) {
    const headers = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(`${baseUrl}${endpoint}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body)
    });
    return {
        status: response.status,
        data: await response.json()
    };
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
    resetLeadsForTesting();
    server = http.createServer(app);
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;

    try {
        const admissionsToken = await login("admissions@tms.edu.vn", "admissions123");
        const managerToken = await login("manager@tms.edu.vn", "manager123");
        const adminToken = await login("admin@tms.edu.vn", "admin123");

        const created = await request("/api/leads/manage", {
            method: "POST",
            token: admissionsToken,
            body: {
                fullName: "Nguyễn KN74",
                phone: "0901111222",
                email: "kn74@example.com",
                source: "Facebook",
                course: "Lập trình Web"
            }
        });
        assert.strictEqual(created.status, 201);
        assert.strictEqual(created.data.lead.source, "Facebook");
        assert.strictEqual(created.data.lead.course, "Lập trình Web");
        const leadId = created.data.lead.id;

        const duplicates = await request("/api/leads/check-phone?phone=%2B84901111222", {
            token: admissionsToken
        });
        assert.strictEqual(duplicates.status, 200);
        assert.strictEqual(duplicates.data.duplicate, true);
        assert.strictEqual(duplicates.data.duplicates[0].id, leadId);

        const selfCheck = await request(`/api/leads/check-phone?phone=0901111222&excludeId=${leadId}`, {
            token: admissionsToken
        });
        assert.strictEqual(selfCheck.data.duplicate, false);

        const updated = await request(`/api/leads/${leadId}`, {
            method: "PUT",
            token: admissionsToken,
            body: {
                fullName: "Nguyễn KN74 đã cập nhật",
                phone: "0901111222",
                email: "updated@example.com",
                source: "Sự kiện",
                course: "Phân tích dữ liệu"
            }
        });
        assert.strictEqual(updated.status, 200);
        assert.strictEqual(updated.data.lead.fullName, "Nguyễn KN74 đã cập nhật");
        assert.strictEqual(updated.data.lead.source, "Sự kiện");
        assert.strictEqual(updated.data.lead.course, "Phân tích dữ liệu");

        const invalidUpdate = await request(`/api/leads/${leadId}`, {
            method: "PUT",
            token: admissionsToken,
            body: { fullName: "Nguyễn KN74", phone: "bad", email: "updated@example.com", source: "Website" }
        });
        assert.strictEqual(invalidUpdate.status, 400);
        assert.strictEqual(invalidUpdate.data.code, "INVALID_PHONE");

        const admissionsDelete = await request(`/api/leads/${leadId}`, {
            method: "DELETE",
            token: admissionsToken
        });
        assert.strictEqual(admissionsDelete.status, 403);

        const adminDelete = await request(`/api/leads/${leadId}`, {
            method: "DELETE",
            token: adminToken
        });
        assert.strictEqual(adminDelete.status, 403);

        const managerDelete = await request(`/api/leads/${leadId}`, {
            method: "DELETE",
            token: managerToken
        });
        assert.strictEqual(managerDelete.status, 200);
        assert.strictEqual(managerDelete.data.success, true);

        console.log("KN-74 lead management tests passed.");
    } finally {
        await new Promise(resolve => server.close(resolve));
    }
}

if (require.main === module) {
    runTests().catch(error => {
        console.error("KN-74 lead management tests failed:", error);
        process.exit(1);
    });
}

module.exports = { runTests };
