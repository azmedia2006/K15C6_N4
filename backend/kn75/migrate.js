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
