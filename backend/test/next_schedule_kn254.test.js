const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");

const app = require("../server");
const auth = require("../authService");
const { getSchedules } = require("../scheduleService");
const { canSeeSession } = require("../businessRoutes");

const RealDate = global.Date;

function mockTime(timestamp) {
    global.Date = class extends RealDate {
        constructor(...args) {
            super(...(args.length ? args : [timestamp]));
        }
        static now() {
            return timestamp;
        }
    };
}

test("KN-254: next student schedule API", async () => {
    const students = auth.users.filter(u => u.role === "student");
    const sessions = getSchedules({});

    assert.ok(students.length > 0, "No student test account");
    assert.ok(sessions.length > 0, "No schedule test data");

    const dates = sessions.map(s => s.date).sort();
    const beforeFirst = RealDate.parse(
        `${dates[0]}T00:00:00+07:00`
    ) - 86400000;
    const afterLast = RealDate.parse(
        `${dates.at(-1)}T00:00:00+07:00`
    ) + 86400000;

    const server = http.createServer(app);
    await new Promise(resolve =>
        server.listen(0, "127.0.0.1", resolve)
    );

    const base = `http://127.0.0.1:${server.address().port}`;

    async function getNext(student) {
        const response = await fetch(`${base}/api/schedules/next`, {
            headers: {
                Authorization: `Bearer ${auth.generateToken(student)}`
            }
        });

        assert.equal(response.status, 200);
        const result = await response.json();
        assert.equal(result.success, true);
        return result.session;
    }

    try {
        const anonymous = await fetch(`${base}/api/schedules/next`);
        assert.equal(anonymous.status, 401);
        console.log("PASS: Authentication required");

        mockTime(beforeFirst);

        let upcomingCount = 0;

        for (const student of students) {
            const allowed = sessions
                .filter(s => canSeeSession(student, s))
                .sort((a, b) =>
                    `${a.date}T${a.startTime}`.localeCompare(
                        `${b.date}T${b.startTime}`
                    )
                );

            const actual = await getNext(student);
            assert.deepEqual(actual, allowed[0] || null);

            if (actual) {
                assert.ok(canSeeSession(student, actual));
                upcomingCount++;
            }
        }

        assert.ok(upcomingCount > 0, "No upcoming student session");
        console.log("PASS: Nearest authorized upcoming session");

        mockTime(afterLast);

        for (const student of students) {
            assert.equal(await getNext(student), null);
        }

        console.log("PASS: No upcoming session returns null");
        console.log("PASS: KN-254");
    } finally {
        global.Date = RealDate;
        await new Promise(resolve => server.close(resolve));
    }
});
