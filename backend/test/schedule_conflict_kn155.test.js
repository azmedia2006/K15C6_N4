'use strict';
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'tms-kn155-'));
process.env.SCHEDULE_DATA_FILE = path.join(temporary, 'state.json');
const service = require('../scheduleService');
const { users, generateToken } = require('../authService');
const app = require('../server');
const database = require('../localDatabase');
const initialState = database.snapshot();
let server, origin;

const auth = id => generateToken(users.find(user => user.id === id));
async function api(url, body, userId = 'usr_manager') {
    const response = await fetch(origin + url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + auth(userId) },
        body: JSON.stringify(body)
    });
    return { status: response.status, data: await response.json() };
}
function createConflictingClass(id) {
    service.createClass({ id, code: id.toUpperCase(), name: `Class ${id}` });
    const existing = service.getClassSchedule('cls_fs_01')[0];
    return { classId: id, sessions: [{ ...existing, id: `${id}-session` }] };
}

before(async () => {
    await new Promise(resolve => { server = app.listen(0, '127.0.0.1', resolve); });
    origin = 'http://127.0.0.1:' + server.address().port;
});
beforeEach(() => { database.restore(initialState); database.commit(); });
after(async () => {
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(temporary, { recursive: true, force: true });
});

test('KN-155: conflicting schedules are blocked with both sessions identified', async () => {
    const payload = createConflictingClass('kn155-blocked');
    const response = await api('/api/schedules/save', payload);

    assert.equal(response.status, 409);
    assert.equal(response.data.code, 'SCHEDULE_CONFLICT');
    assert.equal(response.data.details[0].candidate.className, 'Class kn155-blocked');
    assert.equal(response.data.details[0].conflicting.sessionNumber, 1);
    assert.deepEqual(response.data.details[0].reasons, ['room', 'instructor']);
    assert.equal(service.getClassSchedule(payload.classId).length, 0);
});

test('KN-155: manager can explicitly confirm an override', async () => {
    const payload = createConflictingClass('kn155-override');
    const response = await api('/api/schedules/save', { ...payload, overrideConflicts: true });

    assert.equal(response.status, 200);
    assert.equal(response.data.conflicts.length, 1);
    assert.equal(response.data.conflicts[0].candidate.id, 'kn155-override-session');
    assert.equal(service.getClassSchedule(payload.classId).length, 1);
});

test('KN-155: non-manager cannot override a conflict', async () => {
    const payload = createConflictingClass('kn155-forbidden');
    const response = await api('/api/schedules/save', { ...payload, overrideConflicts: true }, 'usr_student');

    assert.equal(response.status, 403);
    assert.equal(service.getClassSchedule(payload.classId).length, 0);
});
