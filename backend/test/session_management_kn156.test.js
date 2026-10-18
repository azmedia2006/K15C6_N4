'use strict';
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'tms-kn156-'));
process.env.SCHEDULE_DATA_FILE = path.join(temporary, 'state.json');
const service = require('../scheduleService');
const { users, generateToken } = require('../authService');
const app = require('../server');
const database=require('../localDatabase');const initialState=database.snapshot();
let server, origin;
const auth = id => generateToken(users.find(u => u.id === id));
async function api(url, method = 'GET', body, userId = 'usr_manager') {
    const response = await fetch(origin + url, { method, headers: { 'Content-Type': 'application/json', ...(userId ? { Authorization: 'Bearer ' + auth(userId) } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, data: await response.json() };
}
const sessions = () => service.getClassSchedule('cls_fs_01');
const first = () => sessions()[0];
const endpoint = id => '/api/schedules/session/' + id;
before(async () => { await new Promise(resolve => { server = app.listen(0, '127.0.0.1', resolve); }); origin = 'http://127.0.0.1:' + server.address().port; });
beforeEach(() => { database.restore(initialState); database.commit(); });
after(async () => { await new Promise(resolve => server.close(resolve)); fs.rmSync(temporary, { recursive: true, force: true }); });

test('KN-168: detail provides editable flag, version and 404', async () => {
    let r = await api(endpoint(first().id)); assert.equal(r.status, 200); assert.equal(r.data.session.editable, true); assert.equal(r.data.session.version, 1);
    r = await api(endpoint('missing')); assert.equal(r.status, 404);
});
test('KN-170: change date, time, room, lesson; stable session number', async () => {
    const s = first(); const r = await api(endpoint(s.id), 'PUT', { date: '2026-07-14', startTime: '09:00', endTime: '10:00', room: 'Lab C', lessonTopic: 'Nội dung mới', version: 1 });
    assert.equal(r.status, 200); assert.equal(r.data.session.dayOfWeek, 2); assert.equal(r.data.session.sessionNumber, s.sessionNumber); assert.equal(r.data.session.version, 2); assert.equal(r.data.notificationCount, 2);
});
test('KN-171: room overlap conflicts, no mutation/history/inbox', async () => {
    const s = first(), target = sessions()[1];
    const r = await api(endpoint(s.id), 'PUT', { date: target.date, instructor: 'GV khác', room: target.room, version: 1 });
    assert.equal(r.status, 409); assert.equal(r.data.code, 'SCHEDULE_CONFLICT'); assert.deepEqual(service.getSessionDetail(s.id), s); assert.equal(service.getSessionHistory(s.id).length, 0); assert.equal(service.getNotifications('usr_student').length, 0);
});
test('KN-171: instructor conflict across classes even in different rooms', async () => {
    service.createClass({ id: 'other', code: 'OTHER', name: 'Other' });
    const s = first(); service.saveClassSchedule('other', [{ ...s, id: 'other-session', date: '2026-07-10', room: 'B9' }]);
    const r = await api(endpoint(s.id), 'PUT', { date: '2026-07-10', room: 'C9' }); assert.equal(r.status, 409);
});
test('KN-171: same-class overlap is blocked even when room and instructor differ', async () => {
    const s = first(), target = sessions()[1];
    const r = await api(endpoint(s.id), 'PUT', { date: target.date, room: 'Different room', instructor: 'Different teacher' }); assert.equal(r.status, 409);
});
test('KN-171: adjacent time boundaries are allowed', async () => {
    const s = first(), target = sessions()[1];
    const r = await api(endpoint(s.id), 'PUT', { date: target.date, startTime: target.endTime, endTime: '12:30' }); assert.equal(r.status, 200);
});
test('KN-171: cancelled sessions do not reserve room/instructor', async () => {
    const a = first(), b = sessions()[1];
    assert.equal((await api(endpoint(b.id) + '/cancel', 'POST', { reason: 'Giảng viên bận' })).status, 200);
    assert.equal((await api(endpoint(a.id), 'PUT', { date: b.date })).status, 200);
});
test('KN-170: invalid dates, times, empty room and unknown instructor ID are rejected', async () => {
    for (const body of [{ date: '2026-02-30' }, { date: 'nonsense' }, { startTime: '24:00' }, { endTime: '07:00' }, { startTime: '12:00', endTime: '12:00' }, { room: ' ' }, { instructorId: 'unknown' }, { note: {} }]) {
        assert.equal((await api(endpoint(first().id), 'PUT', body)).status, 400, JSON.stringify(body));
    }
});
test('KN-172: cancellation requires nonblank reason', async () => {
    for (const reason of [undefined, '', '  ', 'x'.repeat(1001), 12]) assert.equal((await api(endpoint(first().id) + '/cancel', 'POST', { reason })).status, 400);
});
test('KN-172: soft cancellation retains session, reason and stable numbering', async () => {
    const s = first(); const r = await api(endpoint(s.id) + '/cancel', 'POST', { reason: '  Giảng viên báo bận đột xuất  ', version: 1 });
    assert.equal(r.status, 200); assert.equal(r.data.session.status, 'cancelled'); assert.equal(r.data.session.cancelReason, 'Giảng viên báo bận đột xuất'); assert.equal(sessions().length, 12); assert.equal(r.data.session.editable, false);
    assert.equal((await api(endpoint(s.id), 'PUT', { room: 'Z' })).status, 409);
    assert.equal((await api(endpoint(s.id) + '/cancel', 'POST', { reason: 'Lặp' })).status, 409); assert.equal(service.getNotifications('usr_student').length, 1);
});
test('KN-175: attendance locks updates, cancellation and legacy DELETE', async () => {
    const s = first(); let r = await api(endpoint(s.id) + '/attendance', 'POST', { students: [{ studentId: 'usr_student', status: 'present' }] }, 'usr_teacher');
    assert.equal(r.status, 200); assert.equal(r.data.session.editable, false);
    assert.equal((await api(endpoint(s.id), 'PUT', { room: 'Z' })).status, 409);
    assert.equal((await api(endpoint(s.id) + '/cancel', 'POST', { reason: 'Bận' })).status, 409);
    assert.equal((await api(endpoint(s.id), 'DELETE', { reason: 'Bận' })).status, 409);
});
test('KN-175: attendance rejects invalid or partial roster', async () => {
    assert.equal((await api(endpoint(first().id) + '/attendance', 'POST', { students: [] })).status, 400);
    assert.equal((await api(endpoint(first().id) + '/attendance', 'POST', { students: [{ studentId: 'outsider', status: 'present' }] })).status, 400);
    service.setClassMembers('cls_fs_01', { studentIds: ['usr_student', 'usr_student2'] });
    assert.equal((await api(endpoint(first().id) + '/attendance', 'POST', { students: [{ studentId: 'usr_student', status: 'present' }] })).status, 400);
});
test('KN-175: cannot bypass locks with status fields, bulk save or bulk clear', async () => {
    const s = first(); assert.equal((await api(endpoint(s.id), 'PUT', { status: 'completed' })).status, 400);
    assert.equal((await api('/api/schedules/save', 'POST', { classId: 'cls_fs_01', sessions: sessions() })).status, 409);
    assert.equal((await api('/api/schedules/class/cls_fs_01', 'DELETE')).status, 409);
});
test('KN-173: notification ownership, read persistence, deduplication', async () => {
    const s = first(); await api(endpoint(s.id), 'PUT', { room: 'C5' });
    const student = await api('/api/schedule-notifications', 'GET', undefined, 'usr_student'); const teacher = await api('/api/schedule-notifications', 'GET', undefined, 'usr_teacher');
    assert.equal(student.data.notifications.length, 1); assert.equal(teacher.data.notifications.length, 1); assert.match(student.data.notifications[0].message, /C5/);
    const id = student.data.notifications[0].id;
    assert.equal((await api('/api/schedule-notifications/' + id + '/read', 'PATCH', {}, 'usr_teacher')).status, 404);
    assert.equal((await api('/api/schedule-notifications/' + id + '/read', 'PATCH', {}, 'usr_student')).status, 200);
    assert.ok(service.getNotifications('usr_student')[0].readAt);
});
test('KN-173: replacement instructor, old instructor and every student receive one notification', async () => {
    users.push({ id: 'test_teacher', name: 'Giảng viên thay thế', email: 'replacement@example.test', role: 'instructor' });
    try {
        service.setClassMembers('cls_fs_01', { studentIds: ['usr_student', 'usr_student2'] });
        const r = await api(endpoint(first().id), 'PUT', { instructor: 'Giảng viên thay thế', instructorId: 'test_teacher' }); assert.equal(r.status, 200); assert.equal(r.data.notificationCount, 4);
        for (const id of ['usr_student', 'usr_student2', 'usr_teacher', 'test_teacher']) assert.equal(service.getNotifications(id).length, 1);
    } finally { users.splice(users.findIndex(u => u.id === 'test_teacher'), 1); }
});
test('KN-177: history retains full before/after, actor, action and cancellation reason', async () => {
    const s = first(); await api(endpoint(s.id), 'PUT', { room: 'C9' }); await api(endpoint(s.id) + '/cancel', 'POST', { reason: 'Mưa lớn' });
    const r = await api(endpoint(s.id) + '/history'); assert.equal(r.status, 200); assert.equal(r.data.history.length, 2);
    assert.equal(r.data.history[0].before.room, s.room); assert.equal(r.data.history[0].after.room, 'C9'); assert.equal(r.data.history[0].actorId, 'usr_manager'); assert.equal(r.data.history[1].reason, 'Mưa lớn');
});
test('KN-176: RBAC and scoped detail: anonymous/student/teacher cannot mutate', async () => {
    const s = first(); assert.equal((await api(endpoint(s.id), 'PUT', { room: 'C' }, null)).status, 401);
    for (const id of ['usr_student', 'usr_teacher']) {
        assert.equal((await api(endpoint(s.id), 'PUT', { room: 'C' }, id)).status, 403);
        assert.equal((await api(endpoint(s.id) + '/cancel', 'POST', { reason: 'Bận' }, id)).status, 403);
        assert.equal((await api(endpoint(s.id) + '/history', 'GET', undefined, id)).status, 403);
    }
    assert.equal((await api(endpoint(s.id), 'GET', undefined, 'usr_visitor')).status, 403);
    assert.equal((await api(endpoint(s.id), 'PUT', { room: 'C' }, 'usr_admin')).status, 200);
});
test('KN-176: optimistic concurrency prevents lost updates and double notifications', async () => {
    const s = first(); const results = await Promise.all([api(endpoint(s.id), 'PUT', { room: 'C1', version: 1 }), api(endpoint(s.id), 'PUT', { room: 'C2', version: 1 })]);
    assert.deepEqual(results.map(r => r.status).sort(), [200,409]); assert.equal(service.getSessionHistory(s.id).length, 1); assert.equal(service.getNotifications('usr_student').length, 1);
});
test('KN-176: sessions, inbox, history and attendance survive a new Node process', async () => {
    const s = first(); await api(endpoint(s.id), 'PUT', { room: 'Persistent' });
    await api(endpoint(s.id) + '/attendance', 'POST', { students: [{ studentId: 'usr_student', status: 'late' }] });
    const child = spawnSync(process.execPath, ['-e', `const s=require('./scheduleService');const x=s.getSessionDetail(${JSON.stringify(s.id)});if(x.room!=='Persistent'||x.editable||s.getSessionHistory(x.id).length!==2||s.getNotifications('usr_student').length!==1)process.exit(1);`], { cwd: path.join(__dirname, '..'), env: process.env, encoding: 'utf8' });
    assert.equal(child.status, 0, child.stderr);
});
test('KN-176: disk failure rolls session, history and inbox back together', async () => {
    const s = first(); const rename = fs.renameSync; fs.renameSync = () => { throw new Error('simulated disk failure'); };
    try { assert.throws(() => service.updateSession(s.id, { room: 'Never committed' }, { id: 'usr_manager' }), /disk failure/); }
    finally { fs.renameSync = rename; }
    assert.deepEqual(service.getSessionDetail(s.id), s); assert.equal(service.getSessionHistory(s.id).length, 0); assert.equal(service.getNotifications('usr_student').length, 0);
});
test('KN-176: new schedule save validates overlap atomically', () => {
    const s = first(); service.createClass({ id: 'new', code: 'NEW', name: 'New' });
    assert.throws(() => service.saveClassSchedule('new', [{ ...s, id: 'collision' }]), /Trùng lịch/); assert.equal(service.getClassSchedule('new').length, 0);
});
test('KN-176: unknown class filter must not leak all schedules', async () => { const r = await api('/api/schedules?classId=unknown'); assert.equal(r.data.sessions.length, 0); });
test('KN-176: private state file is not served statically', async () => { assert.equal((await fetch(origin + '/backend/data/schedules-kn156.json')).status, 403); });
test('KN-176: legacy DELETE requires reason and cancels instead of deleting', async () => {
    const s = first(); assert.equal((await api(endpoint(s.id), 'DELETE')).status, 400);
    const r = await api(endpoint(s.id), 'DELETE', { reason: 'Bận đột xuất' }); assert.equal(r.status, 200); assert.equal(r.data.session.status, 'cancelled'); assert.equal(sessions().length, 12);
});
test('KN-176: unknown class recipient resolution never includes unrelated enrollments', () => {
    service.createClass({ id: 'empty', code: 'EMPTY', name: 'Empty' }); assert.deepEqual(service.getRoster('empty'), []);
});
