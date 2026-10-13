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
