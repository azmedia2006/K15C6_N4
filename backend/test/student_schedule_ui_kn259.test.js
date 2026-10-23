const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");

for (const file of [
    "schedule-calendar.js",
    "frontend/schedule-calendar.js"
]) {
    test(`KN-259: kiem tra giao dien ${file}`, () => {
        const source = fs.readFileSync(
            path.join(root, file), "utf8"
        );

        assert.ok(source.includes("sched-next-session-card"));
        assert.ok(source.includes("sched-next-session-content"));
        assert.ok(source.includes("/api/schedules/next"));

        assert.ok(source.includes("nextSession === null"));
        assert.ok(source.includes(
            "Hiện bạn chưa có buổi học nào sắp tới."
        ));

        assert.ok(source.includes("Ngày học:"));
        assert.ok(source.includes("Giờ học:"));
        assert.ok(source.includes("Phòng học:"));
        assert.ok(source.includes("Giảng viên:"));

        console.log(`PASS: ${file}`);
    });
}
