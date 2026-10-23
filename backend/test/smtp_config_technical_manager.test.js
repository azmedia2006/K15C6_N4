'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tms-tech-smtp-'));
process.env.TMS_DATA_FILE = path.join(dir, 'db.json');
process.env.TMS_OFFLINE = 'true';

const app = require('../server');
const db = require('../localDatabase');
const auth = require('../authService');

let server;
let url;

async function request(route, method = 'GET', body, user = 'usr_tech') {
    let token = null;
    if (user) {
        const u = auth.users.find(x => x.id === user || x.role === user);
        if (u) token = auth.generateToken(u);
    }
    const res = await fetch(url + route, {
        method,
        headers: {
            'content-type': 'application/json',
            ...(token ? { authorization: 'Bearer ' + token } : {})
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    return { status: res.status, data: await res.json() };
}

before(async () => {
    server = app.listen(0, '127.0.0.1');
    await new Promise(r => server.once('listening', r));
    url = 'http://127.0.0.1:' + server.address().port;
});

after(async () => {
    await new Promise(r => server.close(r));
    fs.rmSync(dir, { recursive: true, force: true });
});

test('TECH-01: Technical Manager can read SMTP status with default tino configuration', async () => {
    const res = await request('/api/admin/smtp/status', 'GET', undefined, 'usr_tech');
    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);
    assert.ok(res.data.smtp);
    assert.equal(res.data.smtp.host, 'mx.tino.vn');
    assert.equal(res.data.smtp.port, 587);
    assert.equal(res.data.smtp.user, 'daotaotms@tuoitre24h.com');
    assert.equal(res.data.smtp.hasPassword, true);
});

test('TECH-02: Technical Manager can update SMTP configuration', async () => {
    const payload = {
        enabled: true,
        host: 'smtp.office365.com',
        port: 587,
        user: 'tech@tms.edu.vn',
        pass: 'NewPassword123!',
        fromName: 'TMS Technical Support',
        fromEmail: 'support@tms.edu.vn',
        secure: false,
        tls: true
    };
    const res = await request('/api/admin/smtp/config', 'POST', payload, 'usr_tech');
    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);
    assert.equal(res.data.smtp.host, 'smtp.office365.com');
    assert.equal(res.data.smtp.user, 'tech@tms.edu.vn');
    assert.equal(res.data.smtp.fromName, 'TMS Technical Support');
    assert.equal(res.data.smtp.hasPassword, true);
    // Raw password must not be exposed in return
    assert.equal(res.data.smtp.pass, undefined);
});

test('TECH-03: Status endpoint reflects updated SMTP configuration', async () => {
    const res = await request('/api/admin/smtp/status', 'GET', undefined, 'usr_tech');
    assert.equal(res.status, 200);
    assert.equal(res.data.smtp.host, 'smtp.office365.com');
    assert.equal(res.data.smtp.port, 587);
    assert.equal(res.data.smtp.fromName, 'TMS Technical Support');
    assert.equal(res.data.smtp.hasPassword, true);
    assert.equal(res.data.smtp.pass, undefined);
});

test('TECH-04: Non-technical users cannot update SMTP configuration', async () => {
    const payload = { host: 'malicious.host', user: 'hack' };
    const studentRes = await request('/api/admin/smtp/config', 'POST', payload, 'usr_student');
    assert.equal(studentRes.status, 403);

    const anonRes = await request('/api/admin/smtp/config', 'POST', payload, null);
    assert.equal(anonRes.status, 401);
});
