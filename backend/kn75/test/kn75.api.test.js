'use strict';
// KN-120: Kiểm thử tự động API KN-75 (node:test). Chạy: npm --prefix backend/kn75 test
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { spawnSync } = require('child_process');
try { require('dotenv').config({ path: [path.join(__dirname, '../.env'), path.join(__dirname, '../../../.env')], quiet: true }); } catch { /* optional */ }

const target = process.env.KN75_TEST_DATABASE_URL;
if (!target) throw new Error('Cần KN75_TEST_DATABASE_URL (DB local riêng, tên kết thúc _test).');
const parsed = new URL(target);
if (!parsed.pathname.endsWith('_test') || !['127.0.0.1', 'localhost', '[::1]'].includes(parsed.hostname)) {
    throw new Error('An toàn: test xóa dữ liệu nên chỉ chạy trên PostgreSQL local, tên DB kết thúc _test.');
}
process.env.KN75_DATABASE_URL = target;
process.env.NODE_ENV = 'test';

const { getPool, closePool } = require('../db');
const { migrate } = require('../migrate');
const authService = require('../../authService');
const leadService = require('../../leadService');
const app = require('../../server');

const MANAGER = 'usr_manager';
const A = 'usr_admissions';
const B = 'usr_kn75_b';
const C = 'usr_kn75_c';
const STUDENT = 'usr_student';
let server, base, pool;
const createdLeads = [];

function addUser(id, name, role) {
    if (!authService.users.some(u => u.id === id)) {
        authService.users.push({ id, email: id + '@tms.edu.vn', name, role, status: 'active', salt: 'kn75', passwordHash: '' });
    }
}
function setStatus(id, status) { authService.users.find(u => u.id === id).status = status; }
function addLead(id, extra = {}) {
    const now = new Date().toISOString();
    leadService.leads.push({ id, code: 'T' + id.slice(-8), fullName: 'Khách ' + id, phone: '0900000000', email: id + '@example.com',
        course: 'Tiếng Anh', notes: '', status: 'Mới', source: 'kn75-test', createdAt: now, updatedAt: now, assignedTo: null, ...extra });
    createdLeads.push(id);
    return id;
}
const token = id => authService.generateToken(authService.users.find(u => u.id === id));
async function call(method, url, actor = MANAGER, body) {
    const headers = { 'Content-Type': 'application/json' };
    if (actor) headers.Authorization = 'Bearer ' + token(actor);
    const r = await fetch(base + url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: r.status, body: await r.json() };
}
const assign = (ids, to = A, actor = MANAGER, reason = 'QA') =>
    call('POST', '/api/kn75/assignments', actor, { lead_ids: ids, tu_van_vien_id: to, reason });
const history = async id => (await pool.query(
    'SELECT * FROM public.kn75_lead_transfer_history WHERE lead_id=$1 ORDER BY id', [id])).rows;
const owner = async id => (await pool.query(
    'SELECT * FROM public.kn75_lead_assignments WHERE lead_id=$1', [id])).rows[0];

before(async () => {
    pool = getPool();
    await migrate(pool, () => {});
    addUser(B, 'Tư vấn viên B', 'admissions');
    addUser(C, 'Tư vấn viên C', 'admissions');
    server = app.listen(0, '127.0.0.1');
    await new Promise(r => server.once('listening', r));
    base = 'http://127.0.0.1:' + server.address().port;
});
beforeEach(async () => {
    await pool.query(`TRUNCATE public.kn75_lead_transfer_history, public.kn75_lead_assignments,
                      public.leads, public.users RESTART IDENTITY CASCADE`);
    [A, B, C].forEach(id => setStatus(id, 'active'));
    while (createdLeads.length) {
        const id = createdLeads.pop();
        const i = leadService.leads.findIndex(l => l.id === id);
        if (i !== -1) leadService.leads.splice(i, 1);
    }
});
after(async () => {
    if (server) await new Promise(r => server.close(r));
    await closePool();
});

// ---------- Phân công 1 / nhiều lead ----------
test('TC01 phân công 1 lead -> 1 bản ghi phân công + lịch sử lần đầu', async () => {
    const r = await assign(['lead_init_001']);
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.summary, { requested: 1, successful: 1, failed: 0 });
    assert.equal(r.body.successful[0].action, 'ASSIGNED');
    const a = await owner('lead_init_001');
    assert.equal(a.tu_van_vien_id, A); assert.equal(a.nguoi_giao_id, MANAGER);
    const h = await history('lead_init_001');
    assert.equal(h.length, 1); assert.equal(h[0].old_user_id, null);
    assert.equal(h[0].new_user_id, A); assert.equal(h[0].performed_by, MANAGER); assert.equal(h[0].reason, 'QA');
});

test('TC02 phân công nhiều lead cùng lúc', async () => {
    const r = await assign(['lead_init_001', 'lead_init_002', 'lead_init_003'], B);
    assert.equal(r.status, 200); assert.equal(r.body.summary.successful, 3);
    const n = await pool.query('SELECT count(*)::int n FROM public.kn75_lead_assignments WHERE tu_van_vien_id=$1', [B]);
    assert.equal(n.rows[0].n, 3);
});

test('TC03 kết quả hỗn hợp: lead không tồn tại + lead trùng', async () => {
    const r = await assign(['lead_init_001', 'khong_ton_tai', 'lead_init_001', 'lead_init_002']);
    assert.equal(r.status, 200);
    assert.equal(r.body.summary.successful, 2); assert.equal(r.body.summary.failed, 2);
    assert.deepEqual(r.body.failed.map(f => [f.index, f.code]), [[1, 'LEAD_NOT_FOUND'], [2, 'DUPLICATE_LEAD']]);
    assert.equal((await history('lead_init_001')).length, 1, 'lead trùng không tạo lịch sử 2 lần');
});

test('TC04 giao lại đúng người đang phụ trách -> ALREADY_ASSIGNED, không thêm lịch sử', async () => {
    await assign(['lead_init_001']);
    const before1 = await owner('lead_init_001');
    const r = await assign(['lead_init_001']);
    assert.equal(r.body.failed[0].code, 'ALREADY_ASSIGNED'); assert.equal(r.body.summary.successful, 0);
    assert.equal((await history('lead_init_001')).length, 1);
    assert.equal((await owner('lead_init_001')).assigned_at.toISOString(), before1.assigned_at.toISOString());
});

test('TC05 danh sách rỗng / sai định dạng -> 400', async () => {
    assert.equal((await assign([])).body.code, 'EMPTY_LEAD_LIST');
    assert.equal((await call('POST', '/api/kn75/assignments', MANAGER, { tu_van_vien_id: A })).body.code, 'INVALID_PAYLOAD');
    assert.equal((await assign([123])).body.code, 'INVALID_LEAD_ID');
    assert.equal((await assign(['lead_init_001'], A, MANAGER, 'x'.repeat(501))).body.code, 'INVALID_REASON');
});

test('TC06 tư vấn viên không hợp lệ: không tồn tại / sai vai trò / nghỉ việc', async () => {
    let r = await assign(['lead_init_001'], 'usr_khong_co');
    assert.equal(r.status, 400); assert.equal(r.body.code, 'COUNSELOR_NOT_FOUND');
    r = await assign(['lead_init_001'], STUDENT);
    assert.equal(r.status, 400); assert.equal(r.body.code, 'INVALID_COUNSELOR');
    setStatus(C, 'inactive');
    r = await assign(['lead_init_001'], C);
    assert.equal(r.status, 400); assert.equal(r.body.code, 'COUNSELOR_INACTIVE');
    assert.equal(await owner('lead_init_001'), undefined);
});

// ---------- Phân quyền ----------
test('TC07 tư vấn viên gọi API phân công -> 403, không lưu gì', async () => {
    const r = await assign(['lead_init_001'], B, A);
    assert.equal(r.status, 403);
    assert.equal(await owner('lead_init_001'), undefined);
    assert.equal((await call('GET', '/api/kn75/leads', A)).status, 403);
    assert.equal((await call('GET', '/api/kn75/counselors', A)).status, 403);
});

test('TC08 không có token -> 401', async () => {
    assert.equal((await call('POST', '/api/kn75/assignments', null, { lead_ids: ['lead_init_001'], tu_van_vien_id: A })).status, 401);
    assert.equal((await call('GET', '/api/kn75/my-leads', null)).status, 401);
});

test('TC09 tư vấn viên A chỉ thấy lead của A (lọc tại backend)', async () => {
    await assign(['lead_init_001', 'lead_init_002'], A);
    await assign(['lead_init_003'], B);
    const r = await call('GET', '/api/kn75/my-leads', A);
    assert.equal(r.status, 200); assert.equal(r.body.pagination.total, 2);
    assert(r.body.data.every(l => l.assignedTo === A));
    assert(!r.body.data.some(l => l.id === 'lead_init_003'));
});

test('TC10 A gọi API trực tiếp vào lead của B -> 404, không lộ dữ liệu', async () => {
    await assign(['lead_init_003'], B);
    for (const url of ['/api/kn75/my-leads/lead_init_003', '/api/kn75/my-leads/lead_init_003/history', '/api/kn75/leads/lead_init_003/history']) {
        const r = await call('GET', url, A);
        assert([403, 404].includes(r.status), url); assert.equal(r.body.data, undefined);
    }
    assert.equal((await call('GET', '/api/kn75/my-leads/lead_init_003', B)).status, 200);
});

test('TC11 A không đổi phạm vi bằng query string', async () => {
    const r = await call('GET', '/api/kn75/my-leads?tu_van_vien_id=' + B, A);
    assert.equal(r.status, 400); assert.equal(r.body.code, 'SCOPE_OVERRIDE');
});

// ---------- Phân công lại + lịch sử ----------
test('TC12 phân công lại A -> B tạo đúng bản ghi lịch sử', async () => {
    await assign(['lead_init_002'], A, MANAGER, 'Giao ban đầu');
    const r = await assign(['lead_init_002'], B, MANAGER, 'Chuyển nhóm chăm sóc');
    assert.equal(r.body.successful[0].action, 'REASSIGNED'); assert.equal(r.body.successful[0].old_user_id, A);
    const h = await history('lead_init_002');
    assert.equal(h.length, 2);
    const last = h[1];
    assert.equal(last.old_user_id, A); assert.equal(last.new_user_id, B); assert.equal(last.performed_by, MANAGER);
    assert.equal(last.reason, 'Chuyển nhóm chăm sóc'); assert.equal(last.old_user_inactive, false);
    assert.equal(last.old_user_name, 'Vũ Hải Yến'); assert.equal(last.new_user_name, 'Tư vấn viên B');
    assert.equal((await owner('lead_init_002')).assigned_at.toISOString(), last.transferred_at.toISOString());
    assert.equal((await call('GET', '/api/kn75/my-leads/lead_init_002', A)).status, 404);
    assert.equal((await call('GET', '/api/kn75/my-leads/lead_init_002', B)).status, 200);
    const hb = await call('GET', '/api/kn75/my-leads/lead_init_002/history', B);
    assert.equal(hb.body.pagination.total, 2); assert.equal(hb.body.data[0].new_user_id, B);
});

test('TC13 tư vấn viên cũ nghỉ việc: bị chặn truy cập, lead được chuyển cho người mới', async () => {
    await assign(['lead_init_001', 'lead_init_002'], A);
    setStatus(A, 'inactive');
    const blocked = await call('GET', '/api/kn75/my-leads', A);
    assert.equal(blocked.status, 403); assert.equal(blocked.body.code, 'ACCOUNT_INACTIVE');
    const orphan = await call('GET', '/api/kn75/leads?assignment=inactive_owner', MANAGER);
    assert.deepEqual(orphan.body.data.map(l => l.id).sort(), ['lead_init_001', 'lead_init_002']);
    const r = await assign(['lead_init_001', 'lead_init_002'], B, MANAGER, 'Tư vấn viên nghỉ việc');
    assert.equal(r.body.summary.successful, 2); assert(r.body.successful.every(s => s.old_user_inactive));
    const h = await history('lead_init_001');
    assert.equal(h[1].old_user_id, A); assert.equal(h[1].old_user_inactive, true);
    assert.equal((await call('GET', '/api/kn75/leads?assignment=inactive_owner', MANAGER)).body.pagination.total, 0);
});

test('TC14 1.000 lead trong 1 lần gọi; 1.001 lead -> 400', async () => {
    const ids = Array.from({ length: 1000 }, (_, i) => addLead('kn75_bulk_' + String(i).padStart(4, '0')));
    const t0 = Date.now();
    const r = await assign(ids, B);
    const ms = Date.now() - t0;
    assert.equal(r.status, 200); assert.equal(r.body.summary.successful, 1000);
    const n = await pool.query("SELECT count(*)::int n FROM public.kn75_lead_transfer_history WHERE lead_id LIKE 'kn75_bulk_%'");
    assert.equal(n.rows[0].n, 1000);
    assert(ms < 10000, '1.000 lead phải xong dưới 10 giây, thực tế ' + ms + 'ms');
    const page = await call('GET', '/api/kn75/my-leads?limit=100&page=10', B);
    assert.equal(page.body.pagination.total, 1000); assert.equal(page.body.data.length, 100);
    const tooMany = await assign([...ids, addLead('kn75_bulk_extra')], B);
    assert.equal(tooMany.status, 400); assert.equal(tooMany.body.code, 'BATCH_TOO_LARGE');
});

test('TC15 lỗi giữa transaction -> rollback toàn bộ, không lưu phân công nào', async () => {
    const bad = addLead('kn75_bad_lead', { code: 'X'.repeat(40) }); // vượt VARCHAR(32) -> lỗi DB
    const r = await assign(['lead_init_001', bad], A);
    assert.equal(r.status, 500); assert.equal(r.body.code, 'TRANSACTION_FAILED');
    const n = await pool.query('SELECT count(*)::int n FROM public.kn75_lead_assignments');
    assert.equal(n.rows[0].n, 0);
    assert.equal((await pool.query('SELECT count(*)::int n FROM public.kn75_lead_transfer_history')).rows[0].n, 0);
});

test('TC16 hai lần phân công lại đồng thời -> chuỗi lịch sử nhất quán', async () => {
    await assign(['lead_init_001'], A);
    const [r1, r2] = await Promise.all([assign(['lead_init_001'], B), assign(['lead_init_001'], C)]);
    assert.equal(r1.status, 200); assert.equal(r2.status, 200);
    const h = await history('lead_init_001');
    assert.equal(h.length, 3);
    assert.equal(h[2].old_user_id, h[1].new_user_id, 'người cũ của lần sau = người mới của lần trước');
    assert.equal((await owner('lead_init_001')).tu_van_vien_id, h[2].new_user_id);
});

test('TC17 my-leads: phân trang, tìm kiếm, lọc trạng thái', async () => {
    const ids = [addLead('kn75_f_1', { fullName: 'Nguyễn An' }), addLead('kn75_f_2', { status: 'Đang tư vấn' }), addLead('kn75_f_3')];
    await assign(ids, B);
    assert.equal((await call('GET', '/api/kn75/my-leads?search=nguyễn an', B)).body.pagination.total, 1);
    const s = await call('GET', '/api/kn75/my-leads?status=' + encodeURIComponent('Đang tư vấn'), B);
    assert.deepEqual(s.body.data.map(l => l.id), ['kn75_f_2']);
    const p = await call('GET', '/api/kn75/my-leads?limit=2&page=2', B);
    assert.equal(p.body.data.length, 1); assert.equal(p.body.pagination.totalPages, 2);
    assert.equal((await call('GET', '/api/kn75/my-leads?status=abc', B)).status, 400);
    assert.equal((await call('GET', '/api/kn75/my-leads?limit=1000', B)).status, 400);
    assert(s.body.data[0].assignedAt, 'có ngày giao');
});

test('TC18 lịch sử chỉ được thêm, không sửa được', async () => {
    await assign(['lead_init_001'], A);
    await assert.rejects(pool.query("UPDATE public.kn75_lead_transfer_history SET reason='sửa'"), /chỉ được thêm/);
});

test('TC19 migration chạy lại an toàn (idempotent)', async () => {
    await migrate(pool, () => {});
    const n = await pool.query('SELECT count(*)::int n FROM public.kn75_migrations');
    assert.equal(n.rows[0].n, 2);
});

// ---------- Không ảnh hưởng module khác ----------
test('TC20 route cũ /api/leads và /api/auth/me vẫn hoạt động như trước', async () => {
    const leads = await call('GET', '/api/leads', MANAGER);
    assert.equal(leads.status, 200); assert(Array.isArray(leads.body.data));
    assert.equal((await call('GET', '/api/auth/me', A)).status, 200);
    assert.equal((await call('GET', '/api/khong-ton-tai', MANAGER)).status, 404);
});

test('TC21 chưa cấu hình DB KN-75: server vẫn chạy, chỉ /api/kn75 trả 503', () => {
    const script = `
      delete process.env.KN75_DATABASE_URL; delete process.env.DATABASE_URL; process.env.NODE_ENV='test';
      const app=require(${JSON.stringify(path.join(__dirname, '../../server'))});
      const {generateToken,users}=require(${JSON.stringify(path.join(__dirname, '../../authService'))});
      const s=app.listen(0,'127.0.0.1',async()=>{
        const h={Authorization:'Bearer '+generateToken(users.find(u=>u.id==='usr_manager'))};
        const b='http://127.0.0.1:'+s.address().port;
        const k=await fetch(b+'/api/kn75/leads',{headers:h}); const o=await fetch(b+'/api/leads',{headers:h});
        console.log(JSON.stringify({kn75:k.status,code:(await k.json()).code,old:o.status})); s.close(); process.exit(0);
      });`;
    const env = { ...process.env, KN75_DATABASE_URL: '', DATABASE_URL: '' };
    const out = spawnSync(process.execPath, ['-e', script], { env, encoding: 'utf8', timeout: 20000 });
    const line = out.stdout.trim().split('\n').pop();
    assert.deepEqual(JSON.parse(line), { kn75: 503, code: 'KN75_DB_NOT_CONFIGURED', old: 200 });
});
