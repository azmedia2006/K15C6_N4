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
