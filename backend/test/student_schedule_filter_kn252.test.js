const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");

const app = require("../server");
const auth = require("../authService");
const schedule = require("../scheduleService");
const enrollment = require("../enrollmentService");
const { canSeeClass, canSeeSession } = require("../businessRoutes");

test("KN-252: Gioi han lich theo lop hoc vien", async () => {
    const server = http.createServer(app);

    await new Promise(resolve =>
        server.listen(0, "127.0.0.1", resolve)
    );

    const base = `http://127.0.0.1:${server.address().port}`;

    try {
        for (const role of ["student", "instructor", "administrator"]) {
            const user = auth.users.find(u => u.role === role);
            assert.ok(user, `Missing user: ${role}`);

            const headers = {
                Authorization: `Bearer ${auth.generateToken(user)}`
            };

            const [scheduleRes, classRes] = await Promise.all([
                fetch(`${base}/api/schedules`, { headers }),
                fetch(`${base}/api/schedules/classes`, { headers })
            ]);

            assert.equal(scheduleRes.status, 200);
            assert.equal(classRes.status, 200);

            const scheduleData = await scheduleRes.json();
            const classData = await classRes.json();

            assert.equal(scheduleData.success, true);
            assert.equal(classData.success, true);

            const expectedSessions = schedule.getSchedules({})
                .filter(s => canSeeSession(user, s));

            const expectedClasses = schedule.getClassesWithScheduleStatus()
                .filter(c => canSeeClass(user, c.id));

            assert.deepEqual(
                scheduleData.sessions.map(s => s.id).sort(),
                expectedSessions.map(s => s.id).sort()
            );

            assert.deepEqual(
                classData.classes.map(c => c.id).sort(),
                expectedClasses.map(c => c.id).sort()
            );

            if (role === "student") {
                const isEnrolled = classId =>
                    (schedule.getRoster(classId) || [])
                        .some(s => s.id === user.id) ||
                    enrollment.getEnrollmentsList()
                        .some(e =>
                            e.classId === classId &&
                            e.studentId === user.id
                        );

                for (const session of scheduleData.sessions) {
                    assert.ok(isEnrolled(session.classId));
                }

                for (const cls of classData.classes) {
                    assert.ok(isEnrolled(cls.id));
                }
            }

            console.log(`PASS: ${role} authorization`);
        }

        const sample = schedule.getSchedules({})
            .find(s => s.instructor);

        assert.ok(sample, "Missing instructor session");

        const outsider = {
            id: "kn252-outsider",
            role: "student",
            name: sample.instructor
        };

        assert.equal(canSeeSession(outsider, sample), false);
        assert.equal(canSeeClass(outsider, sample.classId), false);

        console.log("PASS: Instructor name collision blocked");
        console.log("PASS: KN-252");
    } finally {
        await new Promise(resolve => server.close(resolve));
    }
});
