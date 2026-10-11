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
