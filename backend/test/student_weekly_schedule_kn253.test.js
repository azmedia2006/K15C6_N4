const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");

const app = require("../server");
const auth = require("../authService");
const schedule = require("../scheduleService");
const { canSeeSession } = require("../businessRoutes");

const RealDate = global.Date;

test("KN-253: API lich hoc ca nhan theo tuan", async () => {
    const student = auth.users.find(u => u.role === "student");
    const instructor = auth.users.find(u => u.role === "instructor");

    assert.ok(student, "Missing student");
    assert.ok(instructor, "Missing instructor");

    const server = http.createServer(app);
    await new Promise(resolve =>
        server.listen(0, "127.0.0.1", resolve)
    );

    const base = `http://127.0.0.1:${server.address().port}`;
    const endpoint = `${base}/api/schedules/my-week`;

    async function request(user) {
        const response = await fetch(endpoint, {
            headers: {
                Authorization: `Bearer ${auth.generateToken(user)}`
            }
        });

        return {
            status: response.status,
            data: await response.json()
        };
    }

    try {
        // 1. Phai dang nhap.
        const anonymous = await fetch(endpoint);
        assert.equal(anonymous.status, 401);
        console.log("PASS: Authentication required");

        // 2. API chi danh cho hoc vien.
        const teacher = await request(instructor);
        assert.equal(teacher.status, 403);
        console.log("PASS: Student role required");

        // 3. Kiem tra lich tuan hien tai.
        const current = await request(student);
        assert.equal(current.status, 200);
        assert.equal(current.data.success, true);

        const monday = new Date(
            `${current.data.startDate}T00:00:00Z`
        );
        const sunday = new Date(
            `${current.data.endDate}T00:00:00Z`
        );

        assert.equal(monday.getUTCDay(), 1);
        assert.equal(sunday.getUTCDay(), 0);
        assert.equal(sunday - monday, 6 * 86400000);

        const expectedCurrent = schedule.getSchedules({
            startDate: current.data.startDate,
            endDate: current.data.endDate
        }).filter(s => canSeeSession(student, s));

        assert.deepEqual(
            current.data.sessions.map(s => s.id),
            expectedCurrent.map(s => s.id)
        );
        assert.equal(current.data.total, expectedCurrent.length);

        console.log("PASS: Current week and authorization");

        // 4. Gia lap mot tuan co lich hoc.
        const fakeTime = RealDate.parse("2026-03-18T00:00:00Z");

        global.Date = class extends RealDate {
            constructor(...args) {
                super(...(args.length ? args : [fakeTime]));
            }

            static now() {
                return fakeTime;
            }
        };

        const historical = await request(student);

        assert.equal(historical.status, 200);
        assert.equal(historical.data.startDate, "2026-03-16");
        assert.equal(historical.data.endDate, "2026-03-22");

        const expectedHistorical = schedule.getSchedules({
            startDate: "2026-03-16",
            endDate: "2026-03-22"
        }).filter(s => canSeeSession(student, s));

        assert.ok(expectedHistorical.length > 0);

        assert.deepEqual(
            historical.data.sessions.map(s => s.id),
            expectedHistorical.map(s => s.id)
        );

        console.log("PASS: Week with actual sessions");
        console.log("PASS: KN-253");
    } finally {
        global.Date = RealDate;
        await new Promise(resolve => server.close(resolve));
    }
});
