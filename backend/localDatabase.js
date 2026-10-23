'use strict';
const fs=require('fs'),path=require('path');
const isServerless = Boolean(process.env.VERCEL || process.env.NOW_REGION || process.env.AWS_LAMBDA_FUNCTION_NAME);
const defaultLocalFile = path.join(__dirname, 'data', 'tms.json');
const file = process.env.TMS_DATA_FILE || (process.env.SCHEDULE_DATA_FILE ? path.join(path.dirname(process.env.SCHEDULE_DATA_FILE), 'tms-' + path.basename(process.env.SCHEDULE_DATA_FILE)) : (isServerless ? path.join('/tmp', 'tms.json') : defaultLocalFile));
let saved = {};
if (fs.existsSync(file)) {
    try {
        saved = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (!saved || typeof saved !== 'object') saved = {};
    } catch (e) {
        if (!isServerless) throw Error('Kho dữ liệu không hợp lệ. Hãy khôi phục bản sao lưu.');
    }
} else if (isServerless && !process.env.TMS_DATA_FILE && fs.existsSync(defaultLocalFile)) {
    try {
        saved = JSON.parse(fs.readFileSync(defaultLocalFile, 'utf8'));
        if (!saved || typeof saved !== 'object') saved = {};
    } catch {}
}
const registered = new Map();
let committing = false;
function register(name, get, set) {
    if (Object.hasOwn(saved, name)) set(JSON.parse(JSON.stringify(saved[name])));
    registered.set(name, { get, set });
}
function snapshot() {
    const all = { ...saved };
    for (const [name, hooks] of registered) all[name] = hooks.get();
    return JSON.parse(JSON.stringify(all));
}
function restore(value) {
    const copy = JSON.parse(JSON.stringify(value));
    for (const [name, h] of registered) if (Object.hasOwn(copy, name)) h.set(copy[name]);
}
function commit() {
    if (committing) return;
    committing = true;
    try {
        const state = snapshot();
        try {
            fs.mkdirSync(path.dirname(file), { recursive: true });
            const tmp = file + '.tmp';
            try {
                fs.writeFileSync(tmp, JSON.stringify(state, null, 2), { mode: 0o600 });
                fs.renameSync(tmp, file);
            } catch (e) {
                try { fs.unlinkSync(tmp); } catch {}
                throw e;
            }
        } catch (fsErr) {
            if (isServerless) {
                console.warn('[LocalDatabase] Cảnh báo lưu trữ serverless (chuyển sang bộ nhớ):', fsErr.message);
            } else {
                throw fsErr;
            }
        }
        saved = state;
    } finally {
        committing = false;
    }
}
function middleware(req, res, next) {
    const send = res.json.bind(res);
    res.json = value => {
        if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
            try {
                commit();
            } catch (e) {
                if (!isServerless) {
                    restore(saved);
                    res.status(503);
                    return send({ success: false, message: 'Không thể ghi dữ liệu. Thao tác chưa được lưu, hãy thử lại.' });
                }
            }
        }
        return send(value);
    };
    next();
}
module.exports = { register, commit, snapshot, restore, middleware, file, hasPersisted: name => Object.hasOwn(saved, name) };

module.exports.acquireLock = () => {
    if (isServerless) return;
    const lock = file + '.lock';
    try {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        if (fs.existsSync(lock)) {
            let pid;
            try {
                pid = Number(fs.readFileSync(lock, 'utf8'));
                process.kill(pid, 0);
                throw new Error('Kho dữ liệu đang được một tiến trình TMS khác sử dụng.');
            } catch (e) {
                if (e.code === 'ESRCH') fs.unlinkSync(lock);
                else throw e;
            }
        }
        const handle = fs.openSync(lock, 'wx', 0o600);
        fs.writeFileSync(handle, String(process.pid));
        fs.closeSync(handle);
        const cleanup = () => { try { if (fs.readFileSync(lock, 'utf8') === String(process.pid)) fs.unlinkSync(lock); } catch {} };
        process.on('exit', cleanup);
        process.on('SIGTERM', () => process.exit(0));
        process.on('SIGINT', () => process.exit(0));
    } catch (e) {
        if (!isServerless) throw e;
    }
};
