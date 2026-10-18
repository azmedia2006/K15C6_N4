# KN-75 — Code theo từng subtask
Thứ tự: KN-115 → KN-119 → KN-117 → KN-118 → KN-114 → KN-113 → KN-116 → KN-120. Tích hợp duy nhất vào code chung:
```js
// backend/server.js — thêm trước "// KN-49 & KN-50"
// KN-75: Phân công lead cho tư vấn viên (module độc lập, chỉ thêm route /api/kn75/*)
require("./kn75").mountKn75(app, { authenticateToken, requireRole });
```

## KN-115: Thiết kế mô hình dữ liệu phân công lead

**Mục tiêu:** Bảng phân công (lead_id PK, tu_van_vien_id, nguoi_giao_id, assigned_at) có FK, index; dùng lại bảng users/leads sẵn có trong supabase_schema.sql.

### `backend/kn75/migrations/001_lead_assignment_model.sql`

````sql
-- KN-115: Mô hình dữ liệu phân công lead cho tư vấn viên.
-- public.users và public.leads đã được định nghĩa trong supabase_schema.sql (của nhóm).
-- Hai lệnh CREATE TABLE IF NOT EXISTS dưới đây chỉ phục vụ DB local trống;
-- trên Supabase hiện có chúng là no-op, KHÔNG thay đổi bảng của người khác.
CREATE TABLE IF NOT EXISTS public.users (
    id VARCHAR(64) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(64) NOT NULL DEFAULT 'student',
    phone VARCHAR(32),
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    password_hash TEXT,
    salt VARCHAR(64),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.leads (
    id VARCHAR(64) PRIMARY KEY,
    code VARCHAR(32),
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(32) NOT NULL,
    email VARCHAR(255) NOT NULL,
    course VARCHAR(255),
    notes TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'Mới',
    source VARCHAR(255) DEFAULT 'Website (Biểu mẫu công khai)',
    ip VARCHAR(64),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bảng phân công: mỗi lead có đúng 1 người phụ trách hiện tại (PK = lead_id).
-- ON DELETE CASCADE để không chặn chức năng xóa user/lead của module khác.
CREATE TABLE IF NOT EXISTS public.kn75_lead_assignments (
    lead_id        VARCHAR(64) PRIMARY KEY
                   REFERENCES public.leads(id) ON DELETE CASCADE,
    tu_van_vien_id VARCHAR(64) NOT NULL
                   REFERENCES public.users(id) ON DELETE CASCADE,
    nguoi_giao_id  VARCHAR(64)
                   REFERENCES public.users(id) ON DELETE SET NULL,
    assigned_at    TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_kn75_assign_counselor
    ON public.kn75_lead_assignments (tu_van_vien_id, assigned_at DESC, lead_id);
CREATE INDEX IF NOT EXISTS idx_kn75_assign_assigner
    ON public.kn75_lead_assignments (nguoi_giao_id);
````

### `backend/kn75/db.js`

````js
'use strict';
// Kết nối PostgreSQL của KN-75. `pg` được nạp lười để server của nhóm
// vẫn khởi động bình thường khi chưa cài dependency hoặc chưa cấu hình DB.
let pool = null;

function kn75Error(status, code, message, extra) {
    return Object.assign(new Error(message), { status, code }, extra || {});
}

function getPool() {
    if (pool) return pool;
    const url = process.env.KN75_DATABASE_URL || process.env.DATABASE_URL;
    if (!url) {
        throw kn75Error(503, 'KN75_DB_NOT_CONFIGURED', 'Chức năng phân công lead chưa được cấu hình cơ sở dữ liệu (KN75_DATABASE_URL).');
    }
    let Pool;
    try {
        ({ Pool } = require('pg'));
    } catch {
        throw kn75Error(503, 'KN75_DEPENDENCY_MISSING', 'Thiếu thư viện pg. Chạy: npm --prefix backend/kn75 install');
    }
    pool = new Pool({
        connectionString: url,
        max: Number(process.env.KN75_DB_POOL_MAX || 10),
        connectionTimeoutMillis: 5000,
        idleTimeoutMillis: 10000,
        ssl: process.env.KN75_PGSSL === 'true' ? { rejectUnauthorized: true } : undefined
    });
    return pool;
}

async function closePool() {
    if (pool) {
        const p = pool;
        pool = null;
        await p.end();
    }
}

module.exports = { getPool, closePool, kn75Error };
````

### `backend/kn75/migrate.js`

````js
'use strict';
// Chạy migration KN-75: node backend/kn75/migrate.js (an toàn khi chạy lại).
const fs = require('fs');
const path = require('path');
const { getPool, closePool } = require('./db');

function loadEnvFiles() {
    try {
        require('dotenv').config({ path: [path.join(__dirname, '.env'), path.join(__dirname, '../.env'), path.join(__dirname, '../../.env')], quiet: true });
    } catch { /* dotenv là dependency sẵn có của dự án; bỏ qua nếu không có */ }
}

async function migrate(pool = getPool(), log = console.log) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query('SELECT pg_advisory_xact_lock(750075)');
        await client.query(`CREATE TABLE IF NOT EXISTS public.kn75_migrations (
            name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
        const dir = path.join(__dirname, 'migrations');
        const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
        for (const file of files) {
            const done = await client.query('SELECT 1 FROM public.kn75_migrations WHERE name = $1', [file]);
            if (done.rowCount) continue;
            await client.query(fs.readFileSync(path.join(dir, file), 'utf8'));
            await client.query('INSERT INTO public.kn75_migrations(name) VALUES ($1)', [file]);
            log('[KN75] Applied ' + file);
        }
        await client.query('COMMIT');
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
}

if (require.main === module) {
    loadEnvFiles();
    migrate()
        .then(() => console.log('[KN75] Migration hoàn tất.'))
        .catch(e => { console.error('[KN75] Migration lỗi:', e.message); process.exitCode = 1; })
        .finally(closePool);
}

module.exports = { migrate };
````

**Cách kiểm tra nhanh:** `node backend/kn75/migrate.js  # chạy 2 lần: lần 2 không áp lại`

**Tiêu chí hoàn thành:**
- [x] FK tới public.users, public.leads
- [x] Index theo tư vấn viên + ngày giao
- [x] Migration idempotent (TC19)
- [x] Không sửa bảng của module khác

## KN-119: Ghi nhận lịch sử chuyển giao

**Mục tiêu:** Trigger tự ghi người cũ, người mới, người thực hiện, lý do, thời gian mỗi khi người phụ trách thay đổi; lịch sử chỉ được thêm.

### `backend/kn75/migrations/002_transfer_history.sql`

````sql
-- KN-119: Lịch sử chuyển giao, ghi TỰ ĐỘNG bằng trigger khi người phụ trách thay đổi.
CREATE TABLE IF NOT EXISTS public.kn75_lead_transfer_history (
    id              BIGSERIAL PRIMARY KEY,
    lead_id         VARCHAR(64) NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    old_user_id     VARCHAR(64) REFERENCES public.users(id) ON DELETE SET NULL,  -- người cũ
    new_user_id     VARCHAR(64) REFERENCES public.users(id) ON DELETE SET NULL,  -- người mới
    performed_by    VARCHAR(64) REFERENCES public.users(id) ON DELETE SET NULL,  -- người thực hiện
    -- Ảnh chụp tên tại thời điểm chuyển giao: vẫn đọc được khi user bị xóa/đổi tên.
    old_user_name   VARCHAR(255),
    new_user_name   VARCHAR(255) NOT NULL,
    performed_by_name VARCHAR(255) NOT NULL,
    old_user_inactive BOOLEAN NOT NULL DEFAULT FALSE,
    reason          VARCHAR(500) NOT NULL DEFAULT '',
    transferred_at  TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_kn75_history_lead
    ON public.kn75_lead_transfer_history (lead_id, transferred_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_kn75_history_new_user
    ON public.kn75_lead_transfer_history (new_user_id, transferred_at DESC);

-- BEFORE: bắt buộc có ngữ cảnh người thực hiện; giao lại đúng người cũ = no-op.
CREATE OR REPLACE FUNCTION public.kn75_before_assignment() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF nullif(current_setting('kn75.actor', true), '') IS DISTINCT FROM NEW.nguoi_giao_id THEN
        RAISE EXCEPTION 'KN75: thiếu hoặc sai ngữ cảnh người thực hiện phân công';
    END IF;
    IF TG_OP = 'UPDATE' AND OLD.tu_van_vien_id = NEW.tu_van_vien_id THEN
        RETURN OLD;
    END IF;
    NEW.assigned_at := clock_timestamp();
    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS kn75_before_assignment ON public.kn75_lead_assignments;
CREATE TRIGGER kn75_before_assignment
    BEFORE INSERT OR UPDATE ON public.kn75_lead_assignments
    FOR EACH ROW EXECUTE FUNCTION public.kn75_before_assignment();

-- AFTER: ghi 1 dòng lịch sử (người cũ, người mới, người thực hiện, lý do, thời gian).
CREATE OR REPLACE FUNCTION public.kn75_after_assignment() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    v_old VARCHAR(64) := CASE WHEN TG_OP = 'UPDATE' THEN OLD.tu_van_vien_id END;
BEGIN
    IF TG_OP = 'UPDATE' AND OLD.tu_van_vien_id = NEW.tu_van_vien_id THEN
        RETURN NEW;
    END IF;
    INSERT INTO public.kn75_lead_transfer_history
        (lead_id, old_user_id, new_user_id, performed_by,
         old_user_name, new_user_name, performed_by_name,
         old_user_inactive, reason, transferred_at)
    VALUES
        (NEW.lead_id, v_old, NEW.tu_van_vien_id, NEW.nguoi_giao_id,
         (SELECT name FROM public.users WHERE id = v_old),
         coalesce((SELECT name FROM public.users WHERE id = NEW.tu_van_vien_id), NEW.tu_van_vien_id),
         coalesce((SELECT name FROM public.users WHERE id = NEW.nguoi_giao_id), NEW.nguoi_giao_id),
         coalesce(coalesce(current_setting('kn75.old_inactive', true), '') LIKE '%,' || v_old || ',%', FALSE),
         coalesce(current_setting('kn75.reason', true), ''),
         NEW.assigned_at);
    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS kn75_after_assignment ON public.kn75_lead_assignments;
CREATE TRIGGER kn75_after_assignment
    AFTER INSERT OR UPDATE ON public.kn75_lead_assignments
    FOR EACH ROW EXECUTE FUNCTION public.kn75_after_assignment();

-- Lịch sử chỉ được thêm, không sửa (DELETE chỉ xảy ra qua CASCADE khi xóa lead/user).
CREATE OR REPLACE FUNCTION public.kn75_history_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND (NEW.lead_id, NEW.new_user_name, NEW.performed_by_name, NEW.reason, NEW.transferred_at)
        IS NOT DISTINCT FROM (OLD.lead_id, OLD.new_user_name, OLD.performed_by_name, OLD.reason, OLD.transferred_at) THEN
        RETURN NEW; -- cho phép FK ON DELETE SET NULL cập nhật cột *_id
    END IF;
    RAISE EXCEPTION 'KN75: lịch sử chuyển giao chỉ được thêm mới';
END $$;

DROP TRIGGER IF EXISTS kn75_history_append_only ON public.kn75_lead_transfer_history;
CREATE TRIGGER kn75_history_append_only
    BEFORE UPDATE ON public.kn75_lead_transfer_history
    FOR EACH ROW EXECUTE FUNCTION public.kn75_history_append_only();
````

**Cách kiểm tra nhanh:** `npm --prefix backend/kn75 test  # TC01, TC12, TC18`

**Tiêu chí hoàn thành:**
- [x] Lịch sử tạo tự động trong cùng transaction
- [x] Lưu tên tại thời điểm chuyển giao
- [x] Không sửa được lịch sử (TC18)

## KN-117: API phân công một hoặc nhiều lead

**Mục tiêu:** POST /api/kn75/assignments nhận lead_ids + tu_van_vien_id, chạy trong transaction, trả danh sách thành công/thất bại; chỉ training_manager.

### `backend/kn75/store.js`

````js
'use strict';
// Adapter CHỈ ĐỌC tới dữ liệu in-memory của các module khác (auth/role/lead).
// KN-75 không sửa code hay cấu trúc dữ liệu của các module đó.
const authService = require('../authService');
const roleService = require('../roleService');
const leadService = require('../leadService');

const COUNSELOR_ROLE = 'admissions';
const MANAGER_ROLE = 'training_manager';

function roleCodesOf(user) {
    const codes = roleService.getUserRoles(user.id).map(r => r.code || r.id);
    if (!codes.length && user.role) codes.push(user.role);
    return codes;
}

function getUser(id) {
    if (typeof id !== 'string') return null;
    const u = authService.users.find(x => x.id === id);
    if (!u) return null;
    return {
        id: u.id,
        name: u.name,
        email: u.email,
        status: u.status || 'active',
        roles: roleCodesOf(u)
    };
}

function isActive(user) {
    return !!user && user.status === 'active';
}

function hasRole(user, role) {
    return !!user && user.roles.includes(role);
}

function listCounselors() {
    return authService.users
        .map(u => getUser(u.id))
        .filter(u => hasRole(u, COUNSELOR_ROLE));
}

function getLead(id) {
    if (typeof id !== 'string') return null;
    const lead = leadService.getLeadById(id);
    return lead && lead.id === id ? lead : null; // chỉ khớp đúng id, không khớp theo mã
}

function listLeads() {
    return leadService.getLeads({ page: 1, limit: Number.MAX_SAFE_INTEGER }).data;
}

module.exports = {
    COUNSELOR_ROLE, MANAGER_ROLE,
    getUser, isActive, hasRole, listCounselors, getLead, listLeads
};
````

### `backend/kn75/assignmentService.js`

````js
'use strict';
// KN-117: Phân công 1 hoặc nhiều lead (transaction, kết quả từng phần tử).
// KN-118: Phân công lại -> cập nhật người phụ trách, trigger tự ghi lịch sử,
//         cho phép chuyển lead khỏi tư vấn viên đã nghỉ việc.
const { getPool, kn75Error: err } = require('./db');
const store = require('./store');

const MAX_BATCH = 1000;
const ID_RE = /^[A-Za-z0-9_.:-]{1,64}$/;

function validatePayload(body) {
    const b = body || {};
    if (!Array.isArray(b.lead_ids)) throw err(400, 'INVALID_PAYLOAD', 'lead_ids phải là một mảng.');
    if (b.lead_ids.length === 0) throw err(400, 'EMPTY_LEAD_LIST', 'Danh sách lead cần phân công đang rỗng.');
    if (b.lead_ids.length > MAX_BATCH) throw err(400, 'BATCH_TOO_LARGE', 'Tối đa ' + MAX_BATCH + ' lead mỗi lần.');
    if (!b.lead_ids.every(x => typeof x === 'string' && ID_RE.test(x))) {
        throw err(400, 'INVALID_LEAD_ID', 'Mỗi lead_id phải là chuỗi hợp lệ, tối đa 64 ký tự.');
    }
    if (typeof b.tu_van_vien_id !== 'string' || !ID_RE.test(b.tu_van_vien_id)) {
        throw err(400, 'INVALID_COUNSELOR', 'tu_van_vien_id không hợp lệ.');
    }
    if (b.reason !== undefined && b.reason !== null && (typeof b.reason !== 'string' || b.reason.length > 500)) {
        throw err(400, 'INVALID_REASON', 'Lý do tối đa 500 ký tự.');
    }
    return { leadIds: b.lead_ids, counselorId: b.tu_van_vien_id, reason: (b.reason || '').trim() };
}

function checkCounselor(id) {
    const u = store.getUser(id);
    if (!u) throw err(400, 'COUNSELOR_NOT_FOUND', 'Tư vấn viên không tồn tại.');
    if (!store.hasRole(u, store.COUNSELOR_ROLE)) throw err(400, 'INVALID_COUNSELOR', 'Người nhận không có vai trò tư vấn viên.');
    if (!store.isActive(u)) throw err(400, 'COUNSELOR_INACTIVE', 'Tư vấn viên đã nghỉ việc hoặc bị khóa.');
    return u;
}

// Đảm bảo bản ghi user/lead tồn tại trong PostgreSQL để thỏa khóa ngoại.
// Chỉ INSERT khi chưa có (ON CONFLICT DO NOTHING) -> không ghi đè dữ liệu module khác.
async function ensureUsers(client, users) {
    for (const u of users) {
        await client.query(
            `INSERT INTO public.users (id, email, name, role, status)
             VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING`,
            [u.id, u.email || u.id + '@kn75.local', u.name || u.id, u.roles[0] || 'student', u.status]);
    }
    const ids = users.map(u => u.id);
    const found = await client.query('SELECT id FROM public.users WHERE id = ANY($1::varchar[])', [ids]);
    if (found.rowCount !== new Set(ids).size) {
        throw err(409, 'USER_SYNC_CONFLICT', 'Không đồng bộ được tài khoản sang CSDL (trùng email với tài khoản khác).');
    }
}

async function ensureLeads(client, leads) {
    if (!leads.length) return;
    await client.query(
        `INSERT INTO public.leads (id, code, full_name, phone, email, course, notes, status, source, created_at)
         SELECT * FROM unnest($1::varchar[], $2::varchar[], $3::varchar[], $4::varchar[], $5::varchar[],
                              $6::varchar[], $7::text[], $8::varchar[], $9::varchar[], $10::timestamptz[])
         ON CONFLICT (id) DO NOTHING`,
        [leads.map(l => l.id), leads.map(l => l.code || null), leads.map(l => l.fullName || ''),
         leads.map(l => l.phone || ''), leads.map(l => l.email || ''), leads.map(l => l.course || null),
         leads.map(l => l.notes || null), leads.map(l => l.status || 'Mới'), leads.map(l => l.source || null),
         leads.map(l => l.createdAt || new Date().toISOString())]);
}

async function assignLeads(actor, body, pool = getPool()) {
    const { leadIds, counselorId, reason } = validatePayload(body);
    if (!store.isActive(actor) || !store.hasRole(actor, store.MANAGER_ROLE)) {
        throw err(403, 'FORBIDDEN', 'Chỉ Quản lý đào tạo đang hoạt động được phân công lead.');
    }
    const counselor = checkCounselor(counselorId);

    const unique = Array.from(new Set(leadIds));
    const memoryLeads = new Map();
    unique.forEach(id => { const l = store.getLead(id); if (l) memoryLeads.set(id, l); });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await ensureUsers(client, actor.id === counselor.id ? [actor] : [actor, counselor]);
        await ensureLeads(client, Array.from(memoryLeads.values()));

        // Khóa các lead theo thứ tự cố định -> chống phân công đồng thời/ deadlock.
        const locked = await client.query(
            'SELECT id FROM public.leads WHERE id = ANY($1::varchar[]) ORDER BY id FOR UPDATE', [unique]);
        const existing = new Set(locked.rows.map(r => r.id));
        const current = await client.query(
            'SELECT lead_id, tu_van_vien_id FROM public.kn75_lead_assignments WHERE lead_id = ANY($1::varchar[])', [unique]);
        const owners = new Map(current.rows.map(r => [r.lead_id, r.tu_van_vien_id]));

        const successful = [];
        const failed = [];
        const seen = new Set();
        const changed = [];
        const inactiveOld = new Set();
        leadIds.forEach((id, index) => {
            let code = null;
            let message = '';
            if (seen.has(id)) { code = 'DUPLICATE_LEAD'; message = 'Lead bị trùng trong yêu cầu.'; }
            else if (!existing.has(id)) { code = 'LEAD_NOT_FOUND'; message = 'Lead không tồn tại.'; }
            else if (owners.get(id) === counselorId) { code = 'ALREADY_ASSIGNED'; message = 'Lead đã được giao cho đúng tư vấn viên này.'; }
            seen.add(id);
            if (code) { failed.push({ index, lead_id: id, code, message }); return; }
            const oldId = owners.get(id) || null;
            const oldUser = oldId ? store.getUser(oldId) : null;
            const oldInactive = !!oldId && !store.isActive(oldUser); // KN-118: người cũ nghỉ việc / bị xóa
            if (oldInactive) inactiveOld.add(oldId);
            successful.push({
                index, lead_id: id,
                action: oldId ? 'REASSIGNED' : 'ASSIGNED',
                old_user_id: oldId, old_user_inactive: oldInactive,
                new_user_id: counselorId
            });
            changed.push(id);
        });

        if (changed.length) {
            await client.query(
                `SELECT set_config('kn75.actor', $1, true), set_config('kn75.reason', $2, true),
                        set_config('kn75.old_inactive', $3, true)`,
                [actor.id, reason, ',' + Array.from(inactiveOld).join(',') + ',']);
            // Một dòng hiện tại / lead. Trigger ghi lịch sử người cũ -> người mới.
            await client.query(
                `INSERT INTO public.kn75_lead_assignments (lead_id, tu_van_vien_id, nguoi_giao_id)
                 SELECT id, $2, $3 FROM unnest($1::varchar[]) AS t(id) ORDER BY id
                 ON CONFLICT (lead_id) DO UPDATE
                 SET tu_van_vien_id = EXCLUDED.tu_van_vien_id, nguoi_giao_id = EXCLUDED.nguoi_giao_id`,
                [changed, counselorId, actor.id]);
        }
        await client.query('COMMIT');
        return {
            success: true,
            counselor: { id: counselor.id, name: counselor.name },
            successful,
            failed,
            summary: { requested: leadIds.length, successful: successful.length, failed: failed.length }
        };
    } catch (e) {
        await client.query('ROLLBACK').catch(() => {});
        throw e;
    } finally {
        client.release();
    }
}

module.exports = { assignLeads, validatePayload, MAX_BATCH };
````

### `backend/kn75/router.js`

````js
'use strict';
// Toàn bộ API KN-75 nằm dưới /api/kn75 -> không đụng route /api/leads của module khác.
const express = require('express');
const { kn75Error: err } = require('./db');
const store = require('./store');
const { assignLeads } = require('./assignmentService');
const q = require('./leadQueryService');

function createRouter({ authenticateToken, requireRole }) {
    const router = express.Router();

    router.use(authenticateToken);                     // dùng middleware xác thực sẵn có của dự án
    router.use((req, res, next) => {                   // bổ sung: chặn tài khoản đã nghỉ việc / bị khóa
        const me = store.getUser(req.user && req.user.id);
        if (!store.isActive(me)) return next(err(403, 'ACCOUNT_INACTIVE', 'Tài khoản không còn hoạt động.'));
        req.kn75User = me;
        next();
    });
    const manager = requireRole(store.MANAGER_ROLE);
    const counselor = requireRole(store.COUNSELOR_ROLE);

    // ---- Quản lý đào tạo ----
    router.get('/counselors', manager, (req, res) => {
        const data = store.listCounselors().map(u => ({ id: u.id, name: u.name, email: u.email, status: u.status }));
        res.json({ success: true, data: data.filter(u => u.status === 'active'), inactive: data.filter(u => u.status !== 'active') });
    });
    router.get('/leads', manager, async (req, res) => res.json(await q.listAllLeads(req.query)));
    router.get('/leads/:id/history', manager, async (req, res) =>
        res.json(await q.getHistory(req.kn75User, req.params.id, req.query, { manager: true })));
    router.post('/assignments', manager, async (req, res) => res.json(await assignLeads(req.kn75User, req.body)));

    // ---- Tư vấn viên: phạm vi luôn = chính mình ----
    router.get('/my-leads', counselor, async (req, res) => res.json(await q.listMyLeads(req.kn75User, req.query)));
    router.get('/my-leads/:id', counselor, async (req, res) =>
        res.json({ success: true, data: await q.getVisibleLead(req.kn75User, req.params.id, { manager: false }) }));
    router.get('/my-leads/:id/history', counselor, async (req, res) =>
        res.json(await q.getHistory(req.kn75User, req.params.id, req.query, { manager: false })));

    router.use((req, res) => res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Endpoint KN-75 không tồn tại.' }));
    // eslint-disable-next-line no-unused-vars
    router.use((e, req, res, next) => {
        if (e && e.type === 'entity.parse.failed') e = err(400, 'INVALID_JSON', 'Body JSON không hợp lệ.');
        if (!e.status) console.error('[KN75]', e.message);
        res.status(e.status || 500).json({
            success: false,
            code: e.status ? e.code : 'TRANSACTION_FAILED',
            message: e.status ? e.message : 'Không thể hoàn tất thao tác; không có thay đổi nào được lưu.'
        });
    });
    return router;
}

module.exports = { createRouter };
````

### `backend/kn75/index.js`

````js
'use strict';
// Điểm tích hợp duy nhất của KN-75 với server.js.
// Không bao giờ ném lỗi ra ngoài: nếu KN-75 lỗi cấu hình, các module khác vẫn chạy bình thường.
function mountKn75(app, deps) {
    try {
        const { createRouter } = require('./router');
        app.use('/api/kn75', createRouter(deps));
    } catch (e) {
        console.error('[KN75] Không thể khởi tạo module phân công lead:', e.message);
    }
}

module.exports = { mountKn75 };
````

**Cách kiểm tra nhanh:** `npm --prefix backend/kn75 test  # TC01–TC08, TC14, TC15`

**Tiêu chí hoàn thành:**
- [x] Transaction + rollback (TC15)
- [x] Kết quả từng lead
- [x] 403 cho tư vấn viên (TC07)
- [x] Lỗi: không tồn tại, trùng, đã giao đúng người, tư vấn viên không hợp lệ

## KN-118: Cập nhật người phụ trách khi phân công lại

**Mục tiêu:** UPSERT người phụ trách; trigger ghi lịch sử; cho phép chuyển lead khỏi tư vấn viên đã nghỉ; khóa dòng chống ghi đè đồng thời.

### `backend/kn75/assignmentService.js`

````js
'use strict';
// KN-117: Phân công 1 hoặc nhiều lead (transaction, kết quả từng phần tử).
// KN-118: Phân công lại -> cập nhật người phụ trách, trigger tự ghi lịch sử,
//         cho phép chuyển lead khỏi tư vấn viên đã nghỉ việc.
const { getPool, kn75Error: err } = require('./db');
const store = require('./store');

const MAX_BATCH = 1000;
const ID_RE = /^[A-Za-z0-9_.:-]{1,64}$/;

function validatePayload(body) {
    const b = body || {};
    if (!Array.isArray(b.lead_ids)) throw err(400, 'INVALID_PAYLOAD', 'lead_ids phải là một mảng.');
    if (b.lead_ids.length === 0) throw err(400, 'EMPTY_LEAD_LIST', 'Danh sách lead cần phân công đang rỗng.');
    if (b.lead_ids.length > MAX_BATCH) throw err(400, 'BATCH_TOO_LARGE', 'Tối đa ' + MAX_BATCH + ' lead mỗi lần.');
    if (!b.lead_ids.every(x => typeof x === 'string' && ID_RE.test(x))) {
        throw err(400, 'INVALID_LEAD_ID', 'Mỗi lead_id phải là chuỗi hợp lệ, tối đa 64 ký tự.');
    }
    if (typeof b.tu_van_vien_id !== 'string' || !ID_RE.test(b.tu_van_vien_id)) {
        throw err(400, 'INVALID_COUNSELOR', 'tu_van_vien_id không hợp lệ.');
    }
    if (b.reason !== undefined && b.reason !== null && (typeof b.reason !== 'string' || b.reason.length > 500)) {
        throw err(400, 'INVALID_REASON', 'Lý do tối đa 500 ký tự.');
    }
    return { leadIds: b.lead_ids, counselorId: b.tu_van_vien_id, reason: (b.reason || '').trim() };
}

function checkCounselor(id) {
    const u = store.getUser(id);
    if (!u) throw err(400, 'COUNSELOR_NOT_FOUND', 'Tư vấn viên không tồn tại.');
    if (!store.hasRole(u, store.COUNSELOR_ROLE)) throw err(400, 'INVALID_COUNSELOR', 'Người nhận không có vai trò tư vấn viên.');
    if (!store.isActive(u)) throw err(400, 'COUNSELOR_INACTIVE', 'Tư vấn viên đã nghỉ việc hoặc bị khóa.');
    return u;
}

// Đảm bảo bản ghi user/lead tồn tại trong PostgreSQL để thỏa khóa ngoại.
// Chỉ INSERT khi chưa có (ON CONFLICT DO NOTHING) -> không ghi đè dữ liệu module khác.
async function ensureUsers(client, users) {
    for (const u of users) {
        await client.query(
            `INSERT INTO public.users (id, email, name, role, status)
             VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING`,
            [u.id, u.email || u.id + '@kn75.local', u.name || u.id, u.roles[0] || 'student', u.status]);
    }
    const ids = users.map(u => u.id);
    const found = await client.query('SELECT id FROM public.users WHERE id = ANY($1::varchar[])', [ids]);
    if (found.rowCount !== new Set(ids).size) {
        throw err(409, 'USER_SYNC_CONFLICT', 'Không đồng bộ được tài khoản sang CSDL (trùng email với tài khoản khác).');
    }
}

async function ensureLeads(client, leads) {
    if (!leads.length) return;
    await client.query(
        `INSERT INTO public.leads (id, code, full_name, phone, email, course, notes, status, source, created_at)
         SELECT * FROM unnest($1::varchar[], $2::varchar[], $3::varchar[], $4::varchar[], $5::varchar[],
                              $6::varchar[], $7::text[], $8::varchar[], $9::varchar[], $10::timestamptz[])
         ON CONFLICT (id) DO NOTHING`,
        [leads.map(l => l.id), leads.map(l => l.code || null), leads.map(l => l.fullName || ''),
         leads.map(l => l.phone || ''), leads.map(l => l.email || ''), leads.map(l => l.course || null),
         leads.map(l => l.notes || null), leads.map(l => l.status || 'Mới'), leads.map(l => l.source || null),
         leads.map(l => l.createdAt || new Date().toISOString())]);
}

async function assignLeads(actor, body, pool = getPool()) {
    const { leadIds, counselorId, reason } = validatePayload(body);
    if (!store.isActive(actor) || !store.hasRole(actor, store.MANAGER_ROLE)) {
        throw err(403, 'FORBIDDEN', 'Chỉ Quản lý đào tạo đang hoạt động được phân công lead.');
    }
    const counselor = checkCounselor(counselorId);

    const unique = Array.from(new Set(leadIds));
    const memoryLeads = new Map();
    unique.forEach(id => { const l = store.getLead(id); if (l) memoryLeads.set(id, l); });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await ensureUsers(client, actor.id === counselor.id ? [actor] : [actor, counselor]);
        await ensureLeads(client, Array.from(memoryLeads.values()));

        // Khóa các lead theo thứ tự cố định -> chống phân công đồng thời/ deadlock.
        const locked = await client.query(
            'SELECT id FROM public.leads WHERE id = ANY($1::varchar[]) ORDER BY id FOR UPDATE', [unique]);
        const existing = new Set(locked.rows.map(r => r.id));
        const current = await client.query(
            'SELECT lead_id, tu_van_vien_id FROM public.kn75_lead_assignments WHERE lead_id = ANY($1::varchar[])', [unique]);
        const owners = new Map(current.rows.map(r => [r.lead_id, r.tu_van_vien_id]));

        const successful = [];
        const failed = [];
        const seen = new Set();
        const changed = [];
        const inactiveOld = new Set();
        leadIds.forEach((id, index) => {
            let code = null;
            let message = '';
            if (seen.has(id)) { code = 'DUPLICATE_LEAD'; message = 'Lead bị trùng trong yêu cầu.'; }
            else if (!existing.has(id)) { code = 'LEAD_NOT_FOUND'; message = 'Lead không tồn tại.'; }
            else if (owners.get(id) === counselorId) { code = 'ALREADY_ASSIGNED'; message = 'Lead đã được giao cho đúng tư vấn viên này.'; }
            seen.add(id);
            if (code) { failed.push({ index, lead_id: id, code, message }); return; }
            const oldId = owners.get(id) || null;
            const oldUser = oldId ? store.getUser(oldId) : null;
            const oldInactive = !!oldId && !store.isActive(oldUser); // KN-118: người cũ nghỉ việc / bị xóa
            if (oldInactive) inactiveOld.add(oldId);
            successful.push({
                index, lead_id: id,
                action: oldId ? 'REASSIGNED' : 'ASSIGNED',
                old_user_id: oldId, old_user_inactive: oldInactive,
                new_user_id: counselorId
            });
            changed.push(id);
        });

        if (changed.length) {
            await client.query(
                `SELECT set_config('kn75.actor', $1, true), set_config('kn75.reason', $2, true),
                        set_config('kn75.old_inactive', $3, true)`,
                [actor.id, reason, ',' + Array.from(inactiveOld).join(',') + ',']);
            // Một dòng hiện tại / lead. Trigger ghi lịch sử người cũ -> người mới.
            await client.query(
                `INSERT INTO public.kn75_lead_assignments (lead_id, tu_van_vien_id, nguoi_giao_id)
                 SELECT id, $2, $3 FROM unnest($1::varchar[]) AS t(id) ORDER BY id
                 ON CONFLICT (lead_id) DO UPDATE
                 SET tu_van_vien_id = EXCLUDED.tu_van_vien_id, nguoi_giao_id = EXCLUDED.nguoi_giao_id`,
                [changed, counselorId, actor.id]);
        }
        await client.query('COMMIT');
        return {
            success: true,
            counselor: { id: counselor.id, name: counselor.name },
            successful,
            failed,
            summary: { requested: leadIds.length, successful: successful.length, failed: failed.length }
        };
    } catch (e) {
        await client.query('ROLLBACK').catch(() => {});
        throw e;
    } finally {
        client.release();
    }
}

module.exports = { assignLeads, validatePayload, MAX_BATCH };
````

**Cách kiểm tra nhanh:** `npm --prefix backend/kn75 test  # TC12, TC13, TC16`

**Tiêu chí hoàn thành:**
- [x] Người cũ mất quyền, người mới có quyền
- [x] Đánh dấu old_user_inactive
- [x] Lọc lead của người đã nghỉ (assignment=inactive_owner)
- [x] Đồng thời an toàn (TC16)

## KN-114: API lấy danh sách lead theo tư vấn viên

**Mục tiêu:** GET /api/kn75/my-leads luôn lọc theo người đăng nhập trong SQL; phân trang, tìm kiếm, lọc trạng thái; 404 khi truy cập lead của người khác.

### `backend/kn75/leadQueryService.js`

````js
'use strict';
// KN-114: Lấy danh sách lead theo phạm vi được giao. Phạm vi luôn do backend quyết định.
const { getPool, kn75Error: err } = require('./db');
const store = require('./store');

const STATUSES = ['Mới', 'Đang tư vấn', 'Đã ghi danh', 'Hủy'];
const SCOPE_PARAMS = ['tu_van_vien_id', 'assignedTo', 'counselor_id', 'user_id', 'owner'];

function parseQuery(q, { allowAssignment = false } = {}) {
    const page = q.page === undefined ? 1 : Number(q.page);
    const limit = q.limit === undefined ? 20 : Number(q.limit);
    if (!Number.isSafeInteger(page) || page < 1 || page > 1e6 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
        throw err(400, 'INVALID_PAGINATION', 'page từ 1–1.000.000, limit từ 1–100.');
    }
    const search = q.search === undefined ? '' : q.search;
    const status = q.status === undefined ? '' : q.status;
    const assignment = q.assignment === undefined ? 'all' : q.assignment;
    if (typeof search !== 'string' || search.length > 200) throw err(400, 'INVALID_FILTER', 'Từ khóa tìm kiếm không hợp lệ.');
    if (typeof status !== 'string' || (status && !STATUSES.includes(status))) throw err(400, 'INVALID_FILTER', 'Trạng thái không hợp lệ.');
    if (allowAssignment && !['all', 'assigned', 'unassigned', 'inactive_owner'].includes(assignment)) {
        throw err(400, 'INVALID_FILTER', 'Bộ lọc phân công không hợp lệ.');
    }
    return { page, limit, search: search.trim().toLowerCase(), status, assignment };
}

function rejectScopeOverride(q) {
    if (SCOPE_PARAMS.some(k => q[k] !== undefined)) {
        throw err(400, 'SCOPE_OVERRIDE', 'Không được chỉ định người phụ trách khi truy vấn; backend tự xác định phạm vi.');
    }
}

// Ưu tiên dữ liệu live trong bộ nhớ (trạng thái do module lead cập nhật), fallback bản ghi DB.
function toLead(row) {
    const live = store.getLead(row.lead_id || row.id);
    const owner = row.tu_van_vien_id ? store.getUser(row.tu_van_vien_id) : null;
    return {
        id: row.lead_id || row.id,
        code: live ? live.code : row.code,
        fullName: live ? live.fullName : row.full_name,
        phone: live ? live.phone : row.phone,
        email: live ? live.email : row.email,
        course: live ? live.course : row.course,
        status: live ? live.status : row.status,
        createdAt: live ? live.createdAt : row.created_at,
        assignedTo: row.tu_van_vien_id || null,
        counselorName: owner ? owner.name : (row.counselor_name || null),
        ownerInactive: !!row.tu_van_vien_id && !store.isActive(owner),
        assignedBy: row.nguoi_giao_id || null,
        assignedAt: row.assigned_at || null
    };
}

function filterAndPage(items, { page, limit, search, status }) {
    const filtered = items.filter(l =>
        (!status || l.status === status) &&
        (!search || [l.fullName, l.phone, l.email, l.code, l.id].some(v => v && String(v).toLowerCase().includes(search))));
    const total = filtered.length;
    return {
        success: true,
        data: filtered.slice((page - 1) * limit, page * limit),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    };
}

const ASSIGNMENT_SELECT = `SELECT a.lead_id, a.tu_van_vien_id, a.nguoi_giao_id, a.assigned_at,
        l.code, l.full_name, l.phone, l.email, l.course, l.status, l.created_at, u.name AS counselor_name
    FROM public.kn75_lead_assignments a
    JOIN public.leads l ON l.id = a.lead_id
    LEFT JOIN public.users u ON u.id = a.tu_van_vien_id`;

// Tư vấn viên: chỉ lead có tu_van_vien_id = chính mình (lọc trong SQL).
async function listMyLeads(user, query, pool = getPool()) {
    rejectScopeOverride(query);
    const opts = parseQuery(query);
    const rows = await pool.query(ASSIGNMENT_SELECT + ' WHERE a.tu_van_vien_id = $1 ORDER BY a.assigned_at DESC, a.lead_id', [user.id]);
    return filterAndPage(rows.rows.map(toLead), opts);
}

// Quản lý: toàn bộ lead (bộ nhớ + lead đã giao trong DB) kèm người phụ trách.
async function listAllLeads(query, pool = getPool()) {
    const opts = parseQuery(query, { allowAssignment: true });
    const rows = await pool.query(ASSIGNMENT_SELECT + ' ORDER BY a.assigned_at DESC');
    const byId = new Map(rows.rows.map(r => [r.lead_id, r]));
    const items = store.listLeads().map(l => byId.has(l.id) ? toLead(byId.get(l.id)) : toLead({ lead_id: l.id }));
    const inMemory = new Set(items.map(l => l.id));
    rows.rows.filter(r => !inMemory.has(r.lead_id)).forEach(r => items.push(toLead(r)));
    const scoped = items.filter(l =>
        opts.assignment === 'all' ||
        (opts.assignment === 'assigned' && l.assignedTo) ||
        (opts.assignment === 'unassigned' && !l.assignedTo) ||
        (opts.assignment === 'inactive_owner' && l.ownerInactive));
    return filterAndPage(scoped, opts);
}

async function getVisibleLead(user, leadId, { manager }, pool = getPool()) {
    const res = await pool.query(ASSIGNMENT_SELECT + ' WHERE a.lead_id = $1', [leadId]);
    const row = res.rows[0];
    if (!manager && (!row || row.tu_van_vien_id !== user.id)) {
        // 404 thay vì 403: không tiết lộ lead của người khác có tồn tại hay không.
        throw err(404, 'LEAD_NOT_FOUND', 'Không tìm thấy lead trong phạm vi được giao.');
    }
    if (row) return toLead(row);
    if (store.getLead(leadId)) return toLead({ lead_id: leadId });
    throw err(404, 'LEAD_NOT_FOUND', 'Lead không tồn tại.');
}

async function getHistory(user, leadId, query, { manager }, pool = getPool()) {
    const opts = parseQuery(query);
    await getVisibleLead(user, leadId, { manager }, pool);
    const total = await pool.query('SELECT count(*)::int AS n FROM public.kn75_lead_transfer_history WHERE lead_id = $1', [leadId]);
    const rows = await pool.query(
        `SELECT id, lead_id, old_user_id, new_user_id, performed_by, old_user_name, new_user_name,
                performed_by_name, old_user_inactive, reason, transferred_at
         FROM public.kn75_lead_transfer_history WHERE lead_id = $1
         ORDER BY transferred_at DESC, id DESC LIMIT $2 OFFSET $3`,
        [leadId, opts.limit, (opts.page - 1) * opts.limit]);
    const n = total.rows[0].n;
    return { success: true, data: rows.rows, pagination: { page: opts.page, limit: opts.limit, total: n, totalPages: Math.ceil(n / opts.limit) } };
}

module.exports = { listMyLeads, listAllLeads, getVisibleLead, getHistory, STATUSES };
````

**Cách kiểm tra nhanh:** `npm --prefix backend/kn75 test  # TC09–TC11, TC17`

**Tiêu chí hoàn thành:**
- [x] Lọc ở backend
- [x] Chặn đổi phạm vi qua query
- [x] Phân trang/tìm kiếm/lọc trạng thái

## KN-113: Giao diện phân công lead hàng loạt

**Mục tiêu:** Chọn nhiều lead bằng checkbox (qua nhiều trang), chọn tư vấn viên, xác nhận, hiển thị kết quả từng lead.

### `frontend/kn75/LeadAssignment.html`

````html
<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Phân công lead • TMS</title>
<link rel="stylesheet" href="/frontend/kn75/kn75.css">
<script src="/frontend/kn75/common.js" defer></script>
<script src="/frontend/kn75/assignment.js" defer></script></head>
<body><main>
<header><a href="/frontend/Index.html">← Dashboard</a><span class="eyebrow">TUYỂN SINH / KN-75</span><h1>Phân công lead</h1><p>Chọn khách hàng tiềm năng và giao cho một tư vấn viên chịu trách nhiệm gọi lại.</p></header>
<p id="notice" role="status" aria-live="polite"></p>
<form id="filters" class="toolbar">
  <label>Tìm kiếm<input id="search" maxlength="200" placeholder="Tên, số điện thoại, email, mã lead"></label>
  <label>Trạng thái<select id="status"><option value="">Tất cả trạng thái</option><option>Mới</option><option>Đang tư vấn</option><option>Đã ghi danh</option><option>Hủy</option></select></label>
  <label>Phân công<select id="assignment"><option value="all">Tất cả</option><option value="unassigned">Chưa phân công</option><option value="assigned">Đã phân công</option><option value="inactive_owner">Người phụ trách đã nghỉ</option></select></label>
  <button type="submit">Tìm kiếm</button>
</form>
<section class="panel" aria-label="Danh sách lead"><div class="table-wrap"><table><thead><tr><th><input id="all" type="checkbox" aria-label="Chọn tất cả lead trên trang"></th><th>Khách hàng</th><th>Liên hệ</th><th>Trạng thái</th><th>Người phụ trách</th></tr></thead><tbody id="rows"></tbody></table></div><p id="empty" class="empty" hidden>Không có lead phù hợp.</p><div class="pager"><button id="prev" type="button">← Trước</button><span id="pagination"></span><button id="next" type="button">Sau →</button></div></section>
<section class="panel assignment"><h2>Giao trách nhiệm</h2>
  <div class="toolbar"><label>Tư vấn viên đang hoạt động<select id="counselor"><option value="">Chọn tư vấn viên</option></select></label><label>Lý do giao / chuyển giao<input id="reason" maxlength="500" placeholder="Ví dụ: Điều chỉnh nhóm chăm sóc"></label></div>
  <div class="actions"><strong id="selection">Đã chọn 0 lead</strong><button id="clear" type="button" class="secondary">Bỏ chọn</button><button id="assign" type="button" disabled>Phân công</button></div>
  <p class="hint">Có thể chọn qua nhiều trang, tối đa 1.000 lead mỗi lần. Lead đã giao đúng người sẽ được báo lỗi và không tạo lịch sử mới.</p></section>
<section id="result" class="panel" hidden><h2>Kết quả phân công</h2><p id="summary" role="status"></p><ul id="details"></ul></section>
<dialog id="confirm"><h2>Xác nhận phân công</h2><p id="confirm-text"></p><p id="confirm-reason" class="hint"></p><div class="actions"><button id="cancel-confirm" type="button" class="secondary">Hủy</button><button id="send" type="button">Đồng ý phân công</button></div></dialog>
</main></body></html>
````

### `frontend/kn75/assignment.js`

````js
'use strict';
// KN-113: Giao diện phân công lead hàng loạt (checkbox, chọn tư vấn viên, xác nhận, báo kết quả).
(async () => {
    const { $, node, api, notice, requireRole } = KN75;
    const MAX = 1000;
    let page = 1, totalPages = 0, current = [], busy = false, epoch = 0, pending = null;
    const selected = new Set();

    function controls() {
        $('selection').textContent = 'Đã chọn ' + selected.size + ' lead';
        $('assign').disabled = busy || !selected.size || !$('counselor').value;
        $('clear').disabled = busy || !selected.size;
        $('all').disabled = busy || !current.length;
        $('all').checked = current.length > 0 && current.every(l => selected.has(l.id));
        $('all').indeterminate = !$('all').checked && current.some(l => selected.has(l.id));
        $('prev').disabled = busy || page <= 1;
        $('next').disabled = busy || page >= totalPages;
    }

    function ownerCell(l) {
        const td = node('td', l.counselorName || (l.assignedTo ? l.assignedTo : 'Chưa phân công'));
        if (l.ownerInactive) td.append(node('small', 'Đã nghỉ việc / bị khóa', 'failure'));
        return td;
    }

    async function load() {
        const sequence = ++epoch;
        busy = true; controls(); $('rows').replaceChildren();
        try {
            const params = new URLSearchParams({ page: String(page), limit: '20', search: $('search').value.trim(),
                status: $('status').value, assignment: $('assignment').value });
            const result = await api('/api/kn75/leads?' + params);
            if (sequence !== epoch) return;
            current = result.data; totalPages = result.pagination.totalPages;
            if (page > Math.max(1, totalPages)) { page = Math.max(1, totalPages); busy = false; return load(); }
            current.forEach(l => {
                const row = node('tr');
                const pick = node('td'); const cb = node('input'); cb.type = 'checkbox';
                cb.checked = selected.has(l.id); cb.setAttribute('aria-label', 'Chọn ' + l.fullName);
                cb.addEventListener('change', () => {
                    if (cb.checked && selected.size >= MAX) { cb.checked = false; notice('Tối đa 1.000 lead mỗi lần.', true); return; }
                    if (cb.checked) selected.add(l.id); else selected.delete(l.id);
                    controls();
                });
                pick.append(cb);
                const name = node('td'); name.append(node('strong', l.fullName), node('small', l.code || l.id));
                const contact = node('td'); contact.append(node('span', l.phone), node('small', l.email));
                const status = node('td'); status.append(node('span', l.status, 'badge'));
                row.append(pick, name, contact, status, ownerCell(l));
                $('rows').append(row);
            });
            $('empty').hidden = current.length > 0;
            document.querySelector('.table-wrap').hidden = !current.length;
            $('pagination').textContent = 'Trang ' + page + ' / ' + Math.max(1, totalPages) + ' · ' + result.pagination.total + ' lead';
        } catch (e) {
            if (sequence === epoch) { current = []; notice(e.message, true); }
        } finally {
            if (sequence === epoch) { busy = false; controls(); }
        }
    }

    $('all').addEventListener('change', () => {
        const checked = $('all').checked;
        const adding = current.filter(l => !selected.has(l.id)).length;
        if (checked && selected.size + adding > MAX) { notice('Tối đa 1.000 lead mỗi lần.', true); controls(); return; }
        current.forEach(l => (checked ? selected.add(l.id) : selected.delete(l.id)));
        load();
    });
    $('clear').onclick = () => { selected.clear(); load(); };
    $('filters').onsubmit = e => { e.preventDefault(); if (busy) return; page = 1; load(); };
    $('prev').onclick = () => { if (!busy && page > 1) { page--; load(); } };
    $('next').onclick = () => { if (!busy && page < totalPages) { page++; load(); } };
    $('counselor').onchange = controls;

    // Bước xác nhận trước khi giao
    $('assign').onclick = () => {
        if (busy || !selected.size || !$('counselor').value) return;
        pending = { lead_ids: Array.from(selected), tu_van_vien_id: $('counselor').value, reason: $('reason').value.trim() };
        $('confirm-text').textContent = 'Giao ' + pending.lead_ids.length + ' lead cho ' +
            $('counselor').selectedOptions[0].textContent + '? Người phụ trách cũ (nếu có) sẽ không còn thấy các lead này.';
        $('confirm-reason').textContent = 'Lý do: ' + (pending.reason || 'Không cung cấp');
        $('confirm').showModal();
    };
    $('cancel-confirm').onclick = () => { $('confirm').close(); pending = null; };
    $('confirm').addEventListener('cancel', e => { if (busy) e.preventDefault(); else pending = null; });

    // Gửi và thông báo kết quả từng lead
    $('send').onclick = async () => {
        if (busy || !pending) return;
        busy = true; controls(); $('send').disabled = true; $('cancel-confirm').disabled = true;
        try {
            const r = await api('/api/kn75/assignments', { method: 'POST', body: JSON.stringify(pending) });
            r.successful.forEach(x => selected.delete(x.lead_id));
            $('summary').textContent = r.summary.successful + ' thành công · ' + r.summary.failed + ' không được giao.';
            $('details').replaceChildren();
            r.successful.forEach(x => $('details').append(node('li',
                x.lead_id + ': ' + (x.action === 'REASSIGNED' ? 'Đã chuyển giao' : 'Đã phân công') +
                (x.old_user_inactive ? ' (người cũ đã nghỉ việc)' : ''), 'success')));
            r.failed.forEach(x => $('details').append(node('li', x.lead_id + ': ' + x.message + ' [' + x.code + ']', 'failure')));
            $('result').hidden = false;
            notice(r.summary.failed ? 'Đã xử lý xong. Các lead lỗi vẫn được giữ trong lựa chọn.' : 'Phân công thành công.');
        } catch (e) {
            notice(e.message, true);
        } finally {
            busy = false; pending = null; $('confirm').close();
            $('send').disabled = false; $('cancel-confirm').disabled = false;
            await load();
        }
    };

    try {
        await requireRole('training_manager', 'Trang này chỉ dành cho Quản lý đào tạo.');
        const r = await api('/api/kn75/counselors');
        r.data.forEach(u => { const o = node('option', u.name + ' · ' + u.email); o.value = u.id; $('counselor').append(o); });
        if (!r.data.length) notice('Chưa có tư vấn viên đang hoạt động.', true);
        await load();
    } catch (e) {
        notice(e.message, true); controls();
    }
})();
````

### `frontend/kn75/common.js`

````js
'use strict';
// Tiện ích dùng chung cho 2 màn hình KN-75. Dùng token sẵn có do Login.html lưu (tms_token).
window.KN75 = (() => {
    const $ = id => document.getElementById(id);
    function node(tag, text, className) {
        const e = document.createElement(tag);
        if (text !== undefined) e.textContent = text;
        if (className) e.className = className;
        return e;
    }
    function notice(message, isError = false) {
        $('notice').textContent = message;
        $('notice').className = isError ? 'notice error' : 'notice';
    }
    async function api(url, options = {}) {
        const token = localStorage.getItem('tms_token') || localStorage.getItem('token');
        if (!token) { location.assign('/Login.html'); throw new Error('Vui lòng đăng nhập.'); }
        const response = await fetch(url, {
            ...options,
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token, ...(options.headers || {}) }
        });
        let data = {};
        try { data = await response.json(); } catch { /* body rỗng */ }
        if (response.status === 401) { location.assign('/Login.html'); }
        if (!response.ok) throw new Error(data.message || data.error || 'Yêu cầu thất bại (' + response.status + ').');
        return data;
    }
    async function requireRole(code, message) {
        const me = await api('/api/auth/me');
        const roles = (me.user.roles || []).map(r => r.code || r.id).concat(me.user.role ? [me.user.role] : []);
        if (!roles.includes(code)) throw new Error(message);
        return me.user;
    }
    const date = value => value ? new Date(value).toLocaleString('vi-VN') : 'Chưa được giao';
    return { $, node, notice, api, requireRole, date };
})();
````

### `frontend/kn75/kn75.css`

````css
:root{color-scheme:light dark;--bg:#fff;--surface:#f9f8f7;--text:#2c2c2b;--muted:#625f5a;--border:#dddcd9;--accent:#1768b2;--tint:#e5f2fc;--error:#a72e24;--success:#28764b}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:16px/1.5 system-ui,-apple-system,Segoe UI,sans-serif}main{max-width:1120px;margin:auto;padding:32px}header{margin-bottom:24px}a{color:var(--accent)}.eyebrow{display:block;font-size:14px;font-weight:600;letter-spacing:.07em;color:var(--muted);margin-top:24px}h1{font-size:36px;line-height:1.2;margin:8px 0 12px}h2{font-size:23px;margin:0 0 16px}header p,.hint{color:var(--muted)}.toolbar{display:flex;align-items:end;gap:16px;flex-wrap:wrap;margin:24px 0}label{display:flex;flex:1;min-width:180px;flex-direction:column;gap:8px;font-size:14px;font-weight:600}input:not([type=checkbox]),select{font:inherit;width:100%;min-height:44px;background:var(--bg);color:var(--text);padding:10px 12px;border:1px solid var(--border);border-radius:8px}input[type=checkbox]{width:22px;height:22px;cursor:pointer;accent-color:var(--accent);margin:10px}button{font:inherit;font-weight:600;min-height:44px;padding:10px 16px;border:1px solid var(--accent);border-radius:8px;background:var(--accent);color:#fff;cursor:pointer}button.secondary,.pager button{background:var(--bg);color:var(--text);border-color:var(--border)}button:disabled{opacity:.5;cursor:not-allowed}:focus-visible{outline:3px solid var(--accent);outline-offset:3px}.panel{border:1px solid var(--border);border-radius:12px;margin:24px 0;overflow:hidden}.assignment,#result{padding:24px}.table-wrap{overflow:auto}table{border-collapse:collapse;width:100%;text-align:left}th,td{padding:16px;border-bottom:1px solid var(--border);font-size:14px;vertical-align:middle}th{background:var(--surface);color:var(--muted);white-space:nowrap}td small{display:block;color:var(--muted);overflow-wrap:anywhere;margin-top:4px}.badge{display:inline-block;background:var(--tint);color:var(--accent);border-radius:6px;padding:4px 8px;white-space:nowrap}.pager,.actions{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:16px;flex-wrap:wrap}.actions{padding:0;justify-content:flex-end}.actions strong{margin-right:auto}.hint{font-size:14px;margin-bottom:0}.empty{text-align:center;padding:48px 16px;color:var(--muted)}.notice:not(:empty){padding:12px 16px;background:var(--tint);border-radius:8px}.notice.error{color:var(--error)}.success{color:var(--success)}.failure,#history-error{color:var(--error)}#details{max-height:320px;overflow:auto;padding-left:24px}dialog{max-width:620px;width:calc(100% - 32px);max-height:85vh;padding:24px;color:var(--text);background:var(--bg);border:1px solid var(--border);border-radius:12px}dialog::backdrop{background:#0006}#history-list{padding-left:24px}#history-list li{padding:16px 0;border-bottom:1px solid var(--border)}#history-list p{margin:8px 0;overflow-wrap:anywhere}#history-list small{color:var(--muted)}[hidden]{display:none!important}
@media(max-width:600px){main{padding:16px}h1{font-size:30px}label{min-width:100%}.toolbar>button{width:100%}.assignment,#result{padding:16px}.pager{gap:8px;font-size:14px}.pager button{padding:10px}th,td{padding:12px}table{min-width:690px}.actions{gap:8px}.actions strong{flex-basis:100%}}
@media(prefers-color-scheme:dark){:root{--bg:#191919;--surface:#202020;--text:#fff;--muted:#b6b6b4;--border:#484846;--accent:#91c6ff;--tint:#243344;--error:#ffa297;--success:#92d7b0}button{background:#1768b2;border-color:#1768b2}button.secondary,.pager button{background:var(--bg)}}

dialog h2,dialog p,td strong{overflow-wrap:anywhere}
````

**Cách kiểm tra nhanh:** `Mở /frontend/kn75/LeadAssignment.html bằng tài khoản manager; npm --prefix backend/kn75 run test:ui`

**Tiêu chí hoàn thành:**
- [x] Checkbox + chọn tất cả trang
- [x] Hộp xác nhận
- [x] Thông báo kết quả
- [x] Responsive 390px

## KN-116: Giao diện danh sách lead của tư vấn viên

**Mục tiêu:** Hiển thị lead được giao, trạng thái, ngày giao và lịch sử chuyển giao.

### `frontend/kn75/MyLeads.html`

````html
<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Lead của tôi • TMS</title>
<link rel="stylesheet" href="/frontend/kn75/kn75.css">
<script src="/frontend/kn75/common.js" defer></script>
<script src="/frontend/kn75/my-leads.js" defer></script></head>
<body><main>
<header><a href="/frontend/Index.html">← Dashboard</a><span class="eyebrow">TUYỂN SINH / KHÁCH HÀNG ĐƯỢC GIAO</span><h1>Lead của tôi</h1><p>Danh sách khách hàng tiềm năng bạn chịu trách nhiệm gọi lại. Phạm vi được kiểm tra tại máy chủ.</p></header>
<p id="notice" role="status" aria-live="polite"></p>
<form id="filters" class="toolbar">
  <label>Tìm kiếm<input id="search" maxlength="200" placeholder="Tên, số điện thoại, email, mã lead"></label>
  <label>Trạng thái<select id="status"><option value="">Tất cả trạng thái</option><option>Mới</option><option>Đang tư vấn</option><option>Đã ghi danh</option><option>Hủy</option></select></label>
  <button type="submit">Tìm kiếm</button>
</form>
<section class="panel"><div class="table-wrap"><table><thead><tr><th>Khách hàng</th><th>Liên hệ</th><th>Trạng thái</th><th>Ngày giao</th><th>Lịch sử</th></tr></thead><tbody id="rows"></tbody></table></div><p id="empty" class="empty" hidden>Chưa có lead được giao phù hợp với bộ lọc.</p><div class="pager"><button id="prev" type="button">← Trước</button><span id="pagination"></span><button id="next" type="button">Sau →</button></div></section>
<dialog id="history"><h2 id="history-title">Lịch sử chuyển giao</h2><p id="history-error" role="alert"></p><ol id="history-list"></ol><div class="pager"><button id="history-prev" type="button">← Trước</button><span id="history-page"></span><button id="history-next" type="button">Sau →</button></div><button id="close-history" type="button" class="secondary">Đóng</button></dialog>
</main></body></html>
````

### `frontend/kn75/my-leads.js`

````js
'use strict';
// KN-116: Danh sách lead của tư vấn viên theo phạm vi được giao + xem lịch sử chuyển giao.
(async () => {
    const { $, node, api, notice, date, requireRole } = KN75;
    let page = 1, totalPages = 0, busy = false, epoch = 0;
    let historyId = null, hpage = 1, htotal = 0, hepoch = 0;

    function controls() { $('prev').disabled = busy || page <= 1; $('next').disabled = busy || page >= totalPages; }

    async function load() {
        const sequence = ++epoch;
        busy = true; controls(); $('rows').replaceChildren();
        try {
            const query = new URLSearchParams({ page: String(page), limit: '20', search: $('search').value.trim(), status: $('status').value });
            const r = await api('/api/kn75/my-leads?' + query);
            if (sequence !== epoch) return;
            totalPages = r.pagination.totalPages;
            if (page > Math.max(1, totalPages)) { page = Math.max(1, totalPages); busy = false; return load(); }
            for (const l of r.data) {
                const row = node('tr'), name = node('td'), contact = node('td'), status = node('td'), action = node('td');
                name.append(node('strong', l.fullName), node('small', l.code || l.id));
                contact.append(node('span', l.phone), node('small', l.email));
                status.append(node('span', l.status, 'badge'));
                const button = node('button', 'Xem lịch sử', 'secondary'); button.type = 'button';
                button.onclick = () => {
                    historyId = l.id; hpage = 1;
                    $('history-title').textContent = 'Chuyển giao · ' + l.fullName;
                    $('history').showModal(); loadHistory();
                };
                action.append(button);
                row.append(name, contact, status, node('td', date(l.assignedAt)), action);
                $('rows').append(row);
            }
            $('empty').hidden = r.data.length > 0;
            document.querySelector('.table-wrap').hidden = !r.data.length;
            $('pagination').textContent = 'Trang ' + page + ' / ' + Math.max(1, totalPages) + ' · ' + r.pagination.total + ' lead';
        } catch (e) {
            if (sequence === epoch) notice(e.message, true);
        } finally {
            if (sequence === epoch) { busy = false; controls(); }
        }
    }

    async function loadHistory() {
        const sequence = ++hepoch;
        $('history-list').replaceChildren(); $('history-error').textContent = '';
        $('history-prev').disabled = true; $('history-next').disabled = true;
        try {
            const r = await api('/api/kn75/my-leads/' + encodeURIComponent(historyId) + '/history?page=' + hpage + '&limit=10');
            if (sequence !== hepoch) return;
            htotal = r.pagination.totalPages;
            r.data.forEach(h => {
                const item = node('li');
                item.append(
                    node('strong', (h.old_user_name || 'Chưa phân công') + (h.old_user_inactive ? ' (đã nghỉ)' : '') + ' → ' + h.new_user_name),
                    node('p', 'Người thực hiện: ' + h.performed_by_name),
                    node('p', 'Lý do: ' + (h.reason || 'Không cung cấp')),
                    node('small', date(h.transferred_at)));
                $('history-list').append(item);
            });
            if (!r.data.length) $('history-list').append(node('li', 'Chưa có lịch sử chuyển giao.'));
            $('history-page').textContent = 'Trang ' + hpage + ' / ' + Math.max(1, htotal);
            $('history-prev').disabled = hpage <= 1; $('history-next').disabled = hpage >= htotal;
        } catch (e) {
            if (sequence === hepoch) $('history-error').textContent = e.message;
        }
    }

    $('filters').onsubmit = e => { e.preventDefault(); if (busy) return; page = 1; notice(''); load(); };
    $('prev').onclick = () => { if (!busy && page > 1) { page--; load(); } };
    $('next').onclick = () => { if (!busy && page < totalPages) { page++; load(); } };
    $('history-prev').onclick = () => { if (hpage > 1) { hpage--; loadHistory(); } };
    $('history-next').onclick = () => { if (hpage < htotal) { hpage++; loadHistory(); } };
    $('close-history').onclick = () => { $('history').close(); hepoch++; };
    $('history').addEventListener('cancel', () => hepoch++);

    try {
        await requireRole('admissions', 'Trang này dành cho tư vấn viên.');
        await load();
    } catch (e) {
        notice(e.message, true);
    }
})();
````

**Cách kiểm tra nhanh:** `Mở /frontend/kn75/MyLeads.html bằng tài khoản admissions`

**Tiêu chí hoàn thành:**
- [x] Chỉ lead của mình
- [x] Trạng thái + ngày giao
- [x] Xem lịch sử có phân trang

## KN-120: Kiểm thử

**Mục tiêu:** Bảng test case ở TEST_CASES.md; test tự động API và UI.

### `backend/kn75/test/kn75.api.test.js`

````js
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
````

### `backend/kn75/test/kn75.ui.test.js`

````js
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
````

### `backend/kn75/package.json`

````json
{
  "name": "tms-kn75-lead-assignment",
  "version": "1.0.0",
  "private": true,
  "description": "KN-75 - Phân công lead cho tư vấn viên (module độc lập, không thay đổi dependency của dự án gốc)",
  "scripts": {
    "migrate": "node migrate.js",
    "test": "node --test --test-concurrency=1 test/kn75.api.test.js",
    "test:ui": "node test/kn75.ui.test.js"
  },
  "dependencies": {
    "pg": "^8.13.0"
  },
  "devDependencies": {
    "playwright": "^1.48.0"
  }
}
````

**Cách kiểm tra nhanh:** `npm --prefix backend/kn75 test && npm --prefix backend/kn75 run test:ui`

**Tiêu chí hoàn thành:**
- [x] 21/21 test API
- [x] 13/13 kiểm tra UI
- [x] 11/11 bộ test cũ của nhóm vẫn pass
