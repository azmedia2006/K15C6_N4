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
        ssl: process.env.KN75_PGSSL === 'true' ? { rejectUnauthorized: false } : undefined
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
