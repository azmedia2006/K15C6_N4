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
