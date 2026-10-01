const assert = require("node:assert/strict");
const test = require("node:test");
const errors = require("../error-handler");

test("maps supported HTTP statuses to safe, user-facing copy", () => {
    assert.match(errors.getErrorDetails(401).message, /đăng nhập/i);
    assert.match(errors.getErrorDetails(403).message, /không có quyền/i);
    assert.match(errors.getErrorDetails(404).message, /không còn tồn tại/i);
    assert.match(errors.getErrorDetails(500).message, /đã được ẩn/i);
    assert.match(errors.getErrorDetails(503).message, /Không thể kết nối/i);
    assert.equal(errors.normalizeStatus(418), 500);
});

test("builds safe error and dashboard destinations", () => {
    assert.equal(errors.getErrorUrl(403), "./Error.html?code=403");
    assert.equal(errors.getErrorUrl("not-a-status"), "./Error.html?code=500");
    assert.equal(errors.getHomeUrl("training_manager"), "./Index.html?role=training_manager");
    assert.equal(errors.getHomeUrl("training_management"), "./Index.html?role=training_manager");
    assert.equal(errors.getHomeUrl("unexpected-role"), "./Login.html");
    assert.equal(errors.getHomeUrl(""), "./Login.html");
});

test("normalizes role aliases and checks page permissions", () => {
    assert.equal(errors.canAccess(["administrator"], "admin"), true);
    assert.equal(errors.canAccess(["administrator"], "student"), false);
    assert.equal(errors.canAccess(["training_manager", "administrator"], "Training Manager"), true);
    assert.equal(errors.canAccess(["administrator"], ""), false);
});

test("routes authorization, missing-page, and server errors to the shared page", () => {
    for (const status of [401, 403, 404, 500, 503]) {
        assert.equal(errors.shouldRedirectForStatus(status), true);
    }
    assert.equal(errors.shouldRedirectForStatus(400), false);
    assert.equal(errors.shouldRedirectForStatus(422), false);
    assert.equal(errors.shouldRedirectForStatus(200), false);
});

test("provides actionable API messages without exposing backend details", () => {
    assert.match(errors.getApiFailureMessage(400), /kiểm tra lại/i);
    assert.match(errors.getApiFailureMessage(409), /tải lại/i);
    assert.match(errors.getApiFailureMessage(423), /tạm khóa/i);
    assert.match(errors.getApiFailureMessage(500), /thử lại sau/i);
    assert.doesNotMatch(errors.getApiFailureMessage(500), /stack|sql|exception/i);
});

test("guards protected pages and sends unauthorized users to the matching error page", () => {
    const previousWindow = global.window;
    const redirects = [];
    global.window = {
        localStorage: { getItem: () => null },
        location: { replace: (url) => redirects.push(url) }
    };

    try {
        assert.equal(errors.guard(["administrator"]), false);
        assert.equal(redirects.pop(), "./Error.html?code=401");
        global.window.localStorage.getItem = () => "student";
        assert.equal(errors.guard(["administrator"]), false);
        assert.equal(redirects.pop(), "./Error.html?code=403");
        global.window.localStorage.getItem = () => "administrator";
        assert.equal(errors.guard(["administrator"]), true);
        assert.deepEqual(redirects, []);
    } finally {
        if (previousWindow === undefined) {
            delete global.window;
        } else {
            global.window = previousWindow;
        }
    }
});