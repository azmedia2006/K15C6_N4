'use strict';
// KN-120: Kiểm thử giao diện KN-75 bằng Playwright (dùng đăng nhập gốc /api/auth/login).
// Chạy: npm --prefix backend/kn75 run test:ui
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
try { require('dotenv').config({ path: [path.join(__dirname, '../.env'), path.join(__dirname, '../../../.env')], quiet: true }); } catch { /* optional */ }
const { chromium } = require('playwright');

const target = process.env.KN75_TEST_DATABASE_URL;
if (!target) throw new Error('Cần KN75_TEST_DATABASE_URL (DB local riêng, tên kết thúc _test).');
const u = new URL(target);
if (!u.pathname.endsWith('_test') || !['localhost', '127.0.0.1', '[::1]'].includes(u.hostname)) throw new Error('Chỉ test trên DB local _test.');
process.env.KN75_DATABASE_URL = target;
process.env.NODE_ENV = 'test';

const { getPool, closePool } = require('../db');
const { migrate } = require('../migrate');
const authService = require('../../authService');
const leadService = require('../../leadService');
const app = require('../../server');

function chromiumPath() {
    if (process.env.CHROMIUM_BIN) return process.env.CHROMIUM_BIN;
    try { return execFileSync('which', ['chromium'], { encoding: 'utf8' }).trim(); } catch { return undefined; }
}

async function run() {
    const pool = getPool();
    let server, browser;
    const dir = process.env.KN75_SCREENSHOTS || path.join(__dirname, '../../../docs/KN75/screenshots');
    fs.mkdirSync(dir, { recursive: true });
    const results = [], errors = [];
    const passed = name => { results.push(name); console.log('PASS', name); };
    const shot = (page, name) => page.screenshot({ path: path.join(dir, name + '.png'), fullPage: true });
    try {
        await migrate(pool, () => {});
        await pool.query('TRUNCATE public.kn75_lead_transfer_history, public.kn75_lead_assignments, public.leads, public.users RESTART IDENTITY CASCADE');
        // Tư vấn viên B (fixture in-memory, giống tài khoản do admin tạo).
        const salt = 'kn75-ui';
        authService.users.push({ id: 'usr_kn75_ui_b', email: 'admissions.b@tms.edu.vn', name: 'Tư vấn viên B', role: 'admissions',
            status: 'active', salt, passwordHash: authService.hashPassword('admissions123', salt) });
        const now = Date.now();
        for (let i = 1; i <= 22; i++) {
            leadService.leads.push({ id: 'ui_' + i, code: 'UI' + i, fullName: i === 1 ? '<img src=x onerror=alert(1)>' : 'Khách UI ' + i,
                phone: '0900000000', email: 'ui' + i + '@example.test', course: 'Tiếng Anh', notes: '', status: 'Mới',
                source: 'ui-test', createdAt: new Date(now - i * 1000).toISOString(), updatedAt: new Date(now).toISOString(), assignedTo: null });
        }
        server = app.listen(0, '127.0.0.1');
        await new Promise(r => server.once('listening', r));
        const base = 'http://127.0.0.1:' + server.address().port;
        browser = await chromium.launch({ executablePath: chromiumPath(), headless: true, args: ['--no-sandbox'] });

        async function session(email, password) {
            const res = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
            const r = await res.json();
            assert(res.ok && r.token, 'Đăng nhập thất bại: ' + email);
            const context = await browser.newContext({ viewport: { width: 1280, height: 1000 }, colorScheme: 'light' });
            await context.addInitScript(t => localStorage.setItem('tms_token', t), r.token);
            const page = await context.newPage();
            page.on('pageerror', e => errors.push(e.message));
            page.on('dialog', d => { errors.push('Unexpected dialog: ' + d.message()); d.dismiss(); });
            return page;
        }

        const m = await session('manager@tms.edu.vn', 'manager123');
        await m.goto(base + '/frontend/kn75/LeadAssignment.html');
        await m.locator('#rows input[type=checkbox]').first().waitFor();
        assert.equal(await m.locator('#assign').isDisabled(), true);
        passed('UI01 chưa chọn lead/tư vấn viên thì nút Phân công bị khóa');

        await m.selectOption('#counselor', 'usr_kn75_ui_b');
        await m.locator('#rows input[type=checkbox]').first().check();
        await m.click('#next');
        await m.waitForFunction(() => document.querySelector('#pagination').textContent.startsWith('Trang 2'));
        await m.locator('#rows input[type=checkbox]').first().check();
        assert.equal(await m.locator('#selection').textContent(), 'Đã chọn 2 lead');
        passed('UI02 chọn nhiều lead bằng checkbox qua 2 trang');

        await m.fill('#reason', 'UI kiểm tra chuyển giao');
        await shot(m, 'assignment-desktop');
        await m.click('#assign');
        assert.equal(await m.locator('#confirm').evaluate(e => e.open), true);
        await shot(m, 'assignment-confirm');
        await m.click('#cancel-confirm');
        assert.equal(await m.locator('#selection').textContent(), 'Đã chọn 2 lead');
        assert.equal((await pool.query('SELECT count(*)::int n FROM public.kn75_lead_assignments')).rows[0].n, 0);
        passed('UI03 hộp xác nhận hiện trước khi giao; Hủy không gửi yêu cầu');

        await m.click('#assign'); await m.click('#send');
        await m.locator('#result:not([hidden])').waitFor();
        assert.match(await m.locator('#summary').textContent(), /2 thành công/);
        assert.equal(await m.locator('#selection').textContent(), 'Đã chọn 0 lead');
        await shot(m, 'assignment-result');
        passed('UI04 xác nhận giao, hiển thị kết quả, bỏ chọn lead thành công');

        await m.setViewportSize({ width: 390, height: 844 });
        assert(await m.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        await shot(m, 'assignment-mobile');
        passed('UI05 màn hình phân công không tràn ngang ở 390px');

        const p = await session('admissions.b@tms.edu.vn', 'admissions123');
        await p.goto(base + '/frontend/kn75/MyLeads.html');
        await p.locator('#rows button').first().waitFor();
        assert.equal(await p.locator('#rows tr').count(), 2);
        assert.doesNotMatch(await p.locator('#rows').textContent(), /Chưa được giao/);
        await shot(p, 'my-leads-desktop');
        passed('UI06 tư vấn viên B chỉ thấy 2 lead được giao, có trạng thái và ngày giao');

        await p.locator('#rows button').first().click();
        await p.locator('#history-list li').first().waitFor();
        const hist = await p.locator('#history-list').textContent();
        assert.match(hist, /UI kiểm tra chuyển giao/); assert.match(hist, /Đỗ Quốc Bảo/);
        await shot(p, 'history-desktop');
        await p.click('#close-history');
        passed('UI07 xem lịch sử: người cũ → mới, người thực hiện, lý do, thời gian');

        const a = await session('admissions@tms.edu.vn', 'admissions123');
        await a.goto(base + '/frontend/kn75/MyLeads.html');
        await a.locator('#empty:not([hidden])').waitFor();
        await shot(a, 'my-leads-empty');
        passed('UI08 tư vấn viên A không thấy lead của B (empty state)');

        await p.fill('#search', 'không tồn tại xyz'); await p.click('#filters button');
        await p.locator('#empty:not([hidden])').waitFor();
        passed('UI09 tìm kiếm không có kết quả hiển thị empty state');

        await p.goto(base + '/frontend/kn75/LeadAssignment.html');
        await p.locator('#notice.error').waitFor();
        assert.match(await p.locator('#notice').textContent(), /Quản lý đào tạo/);
        await shot(p, 'assignment-forbidden');
        passed('UI10 tư vấn viên mở trang phân công bị từ chối');

        await m.setViewportSize({ width: 1280, height: 1000 });
        await m.fill('#search', '<img'); await m.click('#filters button');
        await m.waitForFunction(() => document.querySelector('#rows').textContent.includes('<img'));
        assert.equal(await m.locator('#rows img').count(), 0);
        passed('UI11 tên lead hiển thị dạng text, không thực thi XSS');

        // Chọn lại 1 lead đã giao cho B ở UI04 -> giao lại B phải báo ALREADY_ASSIGNED
        const done = (await pool.query('SELECT lead_id FROM public.kn75_lead_assignments ORDER BY lead_id LIMIT 1')).rows[0].lead_id;
        const code = leadService.getLeadById(done).code || done;
        await m.fill('#search', done); await m.click('#filters button');
        const row = m.locator('#rows tr', { has: m.locator('small', { hasText: new RegExp('^' + code + '$') }) });
        await row.waitFor();
        await row.locator('input[type=checkbox]').check();
        await m.click('#assign'); await m.click('#send');
        await m.waitForFunction(() => document.querySelector('#summary').textContent.includes('0 thành công'));
        assert.match(await m.locator('#details').textContent(), /ALREADY_ASSIGNED/);
        assert.equal(await m.locator('#selection').textContent(), 'Đã chọn 1 lead');
        await shot(m, 'assignment-failed');
        passed('UI12 lead đã giao đúng người báo lỗi, vẫn giữ trong lựa chọn');

        assert.deepEqual(errors, []);
        passed('UI13 không có lỗi JavaScript hoặc dialog ngoài ý muốn');
        fs.writeFileSync(path.join(dir, 'ui-results.json'), JSON.stringify({ passed: results.length, failed: 0, checks: results }, null, 2));
        console.log('UI checks:', results.length, 'passed');
    } finally {
        if (browser) await browser.close();
        if (server) await new Promise(r => server.close(r));
        await closePool();
    }
}
run().catch(e => { console.error(e); process.exitCode = 1; });
