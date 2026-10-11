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
