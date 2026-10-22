'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { after, before, beforeEach, test } = require('node:test');

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tms-classrooms-'));
process.env.TMS_DATA_FILE = path.join(dataDir, 'db.json');
process.env.TMS_OFFLINE = 'true';

const database = require('../localDatabase');
const classrooms = require('../classroomService');
const app = require('../server');
const auth = require('../authService');
const initialState = database.snapshot();
let adminToken;
let studentToken;
let server;
let baseUrl;

async function request(route, method = 'GET', body, token = adminToken) {
    const response = await fetch(`${baseUrl}${route}`, {
        method,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    return { status: response.status, data: await response.json() };
}

before(async () => {
    server = http.createServer(app);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(() => {
    database.restore(initialState);
    database.commit();
    adminToken = auth.generateToken(auth.users.find(user => user.id === 'usr_admin'));
    studentToken = auth.generateToken(auth.users.find(user => user.id === 'usr_student'));
});

after(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    fs.rmSync(dataDir, { recursive: true, force: true });
});

test('classrooms validate input and prevent duplicate names', () => {
    assert.throws(
        () => classrooms.createClassroom({ name: '   ', type: 'physical', capacity: 10 }),
        /Tên phòng/
    );
    assert.throws(
        () => classrooms.createClassroom({ name: 'Online', type: 'online', capacity: 10, onlineUrl: 'javascript:alert(1)' }),
        /HTTP hoặc HTTPS/
    );
    classrooms.createClassroom({ name: 'Phòng A', type: 'physical', capacity: 20 });
    assert.throws(
        () => classrooms.createClassroom({ name: 'phòng a', type: 'physical', capacity: 30 }),
        error => error.status === 409
    );
    assert.equal(classrooms.getClassrooms().length, 1);
});

test('capacity validation handles online rooms and rejects invalid counts', () => {
    const online = classrooms.createClassroom({
        name: 'Online Room',
        type: 'online',
        capacity: 1,
        onlineUrl: 'https://meet.example.test/room'
    });
    assert.equal(classrooms.checkCapacity(online.id, 30).allowed, true);
    assert.throws(() => classrooms.checkCapacity(online.id, 0), /Sĩ số/);

    const physical = classrooms.createClassroom({
        name: 'Room 2',
        type: 'physical',
        capacity: 10
    });
    assert.equal(classrooms.validateRoomCapacity(physical.id, 11).valid, false);
});

test('classroom routes are available to imported apps and persist data', async () => {
    const created = await request('/api/classrooms', 'POST', {
        name: 'Lab 01',
        type: 'physical',
        capacity: 25
    });
    assert.equal(created.status, 201);
    const id = created.data.data.id;

    assert.equal((await request(`/api/classrooms/${id}`)).status, 200);
    assert.equal((await request(`/api/classrooms/${id}/check-capacity`, 'POST', { studentCount: 26 })).status, 409);
    const invalidCapacity = await request('/api/classrooms/validate-capacity', 'POST', {
        classroomId: id,
        studentCount: 26
    });
    assert.equal(invalidCapacity.status, 409);
    assert.equal(invalidCapacity.data.data.valid, false);
    assert.equal((await request(`/api/classrooms/${id}`, 'PUT', { status: 'inactive' })).status, 200);
    assert.equal((await request(`/api/classrooms/${id}/check-capacity`, 'POST', { studentCount: 5 })).data.allowed, false);

    const child = spawnSync(process.execPath, [
        '-e',
        `const db=require('./localDatabase');require('./classroomService');process.stdout.write(JSON.stringify(db.snapshot().classrooms))`
    ], {
        cwd: path.join(__dirname, '..'),
        env: process.env,
        encoding: 'utf8'
    });
    assert.equal(child.status, 0, child.stderr);
    assert.equal(JSON.parse(child.stdout).classrooms[0].status, 'inactive');

    assert.equal((await request(`/api/classrooms/${id}`, 'DELETE')).status, 200);
    assert.equal((await request(`/api/classrooms/${id}`)).status, 404);
});

test('classroom management requires authentication and a manager role', async () => {
    assert.equal((await request('/api/classrooms', 'GET', undefined, null)).status, 401);
    assert.equal((await request('/api/classrooms', 'POST', {
        name: 'Forbidden room',
        type: 'physical',
        capacity: 10
    }, studentToken)).status, 403);
});
