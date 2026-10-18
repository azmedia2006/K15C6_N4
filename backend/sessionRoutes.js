"use strict";
// KN-156: scoped reads, manager-only mutations, inbox ownership checked server-side.
module.exports = function mountSessionRoutes(app, { authenticateToken, requireRole }) {
    const service = require("./scheduleService");
    const manage = requireRole("training_manager", "administrator");
    const handle = fn => (req, res) => {
        try { return res.json(fn(req)); }
        catch (error) {
            const status = error.status || 500;
            return res.status(status).json({ success: false, code: error.code || "SESSION_ERROR", message: status >= 500 ? "Không thể lưu dữ liệu. Thao tác chưa được áp dụng, vui lòng thử lại." : error.message, details: error.details });
        }
    };
    const mayRead = (req, id) => {
        const session = service.getSessionDetail(id);
        const codes = (req.user.roles || []).map(r => r.code || r.id);
        if (!["administrator", "training_manager"].some(r => req.user.role === r || codes.includes(r)) &&
            session.instructorId !== req.user.id && session.instructor !== req.user.name &&
            !service.getRoster(session.classId).some(u => u.id === req.user.id)) {
            const err = new Error("Bạn không thuộc lớp học này."); err.status = 403; throw err;
        }
        return session;
    };
    app.get("/api/schedules/people", authenticateToken, manage, handle(() => ({ success: true, people: service.getSchedulePeople() })));
    app.get("/api/schedules/classes/:classId/members", authenticateToken, requireRole('administrator','training_manager','instructor'), handle(req => {if(!require('./businessRoutes').canSeeClass(req.user,req.params.classId)){const e=new Error('Không phụ trách lớp này.');e.status=403;throw e;}return {success:true,members:service.getRoster(req.params.classId)};}));
    app.put("/api/schedules/classes/:classId/members", authenticateToken, manage, handle(req => service.setClassMembers(req.params.classId, req.body || {})));
    app.get("/api/schedules/session/:sessionId", authenticateToken, handle(req => ({ success: true, session: mayRead(req, req.params.sessionId) })));
    app.get("/api/schedules/session/:sessionId/history", authenticateToken, manage, handle(req => ({ success: true, history: service.getSessionHistory(req.params.sessionId) })));
    app.post("/api/schedules/session/:sessionId/cancel", authenticateToken, manage, handle(req => service.cancelSession(req.params.sessionId, req.body || {}, req.user)));
    app.post("/api/schedules/session/:sessionId/attendance", authenticateToken, requireRole("training_manager", "administrator", "instructor"), handle(req => service.markAttendance(req.params.sessionId, req.body || {}, req.user)));
    app.get("/api/schedule-notifications", authenticateToken, handle(req => ({ success: true, notifications: service.getNotifications(req.user.id) })));
    app.patch("/api/schedule-notifications/:id/read", authenticateToken, handle(req => ({ success: true, notification: service.readNotification(req.params.id, req.user.id) })));
};
