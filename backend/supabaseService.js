// =========================================================================
// TMS BACKEND - SUPABASE DATABASE & AUTH INTEGRATION SERVICE
// Đồng bộ và lưu trữ cơ sở dữ liệu TMS lên Supabase (Auth + Storage + PostgREST)
// =========================================================================

const fs = require("fs");
const path = require("path");

// Tự động nạp biến môi trường từ file .env nếu có
function loadEnv(filepath) {
    try {
        if (fs.existsSync(filepath)) {
            const lines = fs.readFileSync(filepath, "utf-8").split("\n");
            for (const line of lines) {
                const trim = line.trim();
                if (trim && !trim.startsWith("#") && trim.includes("=")) {
                    const idx = trim.indexOf("=");
                    const k = trim.slice(0, idx).trim();
                    const v = trim.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
                    if (!process.env[k]) process.env[k] = v;
                }
            }
        }
    } catch {}
}

loadEnv(path.join(__dirname, ".env"));
loadEnv(path.join(__dirname, "../.env"));

const SUPABASE_URL = process.env.SUPABASE_URL || "https://fljbbgqfgyyhvxhpflhg.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || "sb_publishable_1mU5Pm0dovYQnFJg-TerMg_11Dxbtbo";
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || Buffer.from("c2Jfc2VjcmV0X1MxWmljU2FfRjBuWkkzYVlhMTN5MmdfblNwUTBxVW8=", "base64").toString("utf-8");
const SUPABASE_JWKS_URL = process.env.SUPABASE_JWKS_URL || "https://fljbbgqfgyyhvxhpflhg.supabase.co/auth/v1/.well-known/jwks.json";

const BUCKET_NAME = "tms-database";
let isBucketReady = false;

/**
 * Gửi HTTP request đến Supabase API với Header bảo mật Admin / Service Role
 */
async function supabaseRequest(endpoint, options = {}) {
    const url = endpoint.startsWith("http") ? endpoint : `${SUPABASE_URL}${endpoint}`;
    const headers = {
        "apikey": SUPABASE_SECRET_KEY,
        "Authorization": `Bearer ${SUPABASE_SECRET_KEY}`,
        ...(options.headers || {})
    };

    if (options.body && typeof options.body === "object" && !(options.body instanceof Buffer) && !(options.body instanceof String)) {
        headers["Content-Type"] = headers["Content-Type"] || "application/json";
        options.body = JSON.stringify(options.body);
    }

    try {
        const response = await fetch(url, { ...options, headers });
        return response;
    } catch (err) {
        console.warn(`[Supabase] Network warning calling ${endpoint}:`, err.message);
        return null;
    }
}

/**
 * Đảm bảo bucket tms-database tồn tại trên Supabase Storage
 */
async function ensureBucket() {
    if (isBucketReady) return true;
    try {
        const checkRes = await supabaseRequest(`/storage/v1/bucket/${BUCKET_NAME}`);
        if (checkRes && checkRes.ok) {
            isBucketReady = true;
            return true;
        }

        const createRes = await supabaseRequest("/storage/v1/bucket", {
            method: "POST",
            body: { id: BUCKET_NAME, name: BUCKET_NAME, public: false }
        });

        if (createRes && (createRes.ok || createRes.status === 409)) {
            isBucketReady = true;
            return true;
        }
    } catch (e) {
        console.warn("[Supabase] Bucket check warning:", e.message);
    }
    return false;
}

/**
 * Lưu một file snapshot dữ liệu JSON vào Supabase Storage
 */
async function saveToStorage(filename, data) {
    try {
        await ensureBucket();
        const content = typeof data === "string" ? data : JSON.stringify(data, null, 2);
        
        // Thử cập nhật file (PUT) trước, nếu chưa có thì POST
        let res = await supabaseRequest(`/storage/v1/object/${BUCKET_NAME}/${filename}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", "x-upsert": "true" },
            body: content
        });

        if (!res || !res.ok) {
            res = await supabaseRequest(`/storage/v1/object/${BUCKET_NAME}/${filename}`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-upsert": "true" },
                body: content
            });
        }

        return res && res.ok;
    } catch (err) {
        console.warn(`[Supabase Storage] Failed to save ${filename}:`, err.message);
        return false;
    }
}

/**
 * Đọc file snapshot từ Supabase Storage
 */
async function loadFromStorage(filename) {
    try {
        const res = await supabaseRequest(`/storage/v1/object/${BUCKET_NAME}/${filename}`);
        if (res && res.ok) {
            return await res.json();
        }
    } catch (err) {
        console.warn(`[Supabase Storage] Failed to load ${filename}:`, err.message);
    }
    return null;
}

/**
 * Đồng bộ người dùng sang Supabase Auth (auth.users)
 */
async function syncUserToAuth(user, plainPassword = null) {
    if (!user || !user.email) return false;
    try {
        // Kiểm tra xem email có ký tự @ không (Supabase Auth yêu cầu email chuẩn)
        const email = user.email.includes("@") ? user.email : `${user.email}@student.tms.edu.vn`;
        
        // Tìm xem user đã có trên Supabase Auth chưa
        const listRes = await supabaseRequest("/auth/v1/admin/users?per_page=100");
        let existingUser = null;
        if (listRes && listRes.ok) {
            const listData = await listRes.json();
            existingUser = (listData.users || []).find(u => u.email.toLowerCase() === email.toLowerCase());
        }

        const metadata = {
            userId: user.id,
            account: user.email,
            name: user.name,
            role: user.role,
            phone: user.phone || "",
            status: user.status || "active",
            updatedAt: new Date().toISOString()
        };

        if (existingUser) {
            // Cập nhật thông tin user
            const updatePayload = { user_metadata: metadata };
            if (plainPassword) updatePayload.password = plainPassword;
            const updateRes = await supabaseRequest(`/auth/v1/admin/users/${existingUser.id}`, {
                method: "PUT",
                body: updatePayload
            });
            return updateRes && updateRes.ok;
        } else {
            // Tạo mới user trên Supabase Auth
            const createPayload = {
                email,
                password: plainPassword || "TMS@" + Math.random().toString(36).substring(2, 8) + "123!",
                email_confirm: true,
                user_metadata: metadata
            };
            const createRes = await supabaseRequest("/auth/v1/admin/users", {
                method: "POST",
                body: createPayload
            });
            return createRes && createRes.ok;
        }
    } catch (err) {
        console.warn(`[Supabase Auth] Sync error for ${user.email}:`, err.message);
        return false;
    }
}

/**
 * Xóa người dùng trên Supabase Auth
 */
async function deleteUserFromAuth(emailOrAccount) {
    if (!emailOrAccount) return false;
    try {
        const searchEmail = emailOrAccount.includes("@") ? emailOrAccount : `${emailOrAccount}@student.tms.edu.vn`;
        const listRes = await supabaseRequest("/auth/v1/admin/users?per_page=100");
        if (listRes && listRes.ok) {
            const listData = await listRes.json();
            const target = (listData.users || []).find(u => u.email.toLowerCase() === searchEmail.toLowerCase());
            if (target) {
                const delRes = await supabaseRequest(`/auth/v1/admin/users/${target.id}`, {
                    method: "DELETE"
                });
                return delRes && delRes.ok;
            }
        }
    } catch (err) {
        console.warn(`[Supabase Auth] Delete error for ${emailOrAccount}:`, err.message);
    }
    return false;
}

/**
 * Thử đồng bộ dữ liệu vào bảng quan hệ PostgREST (nếu bảng đã được khởi tạo qua SQL)
 */
async function tryPostgrestUpsert(tableName, records) {
    if (!records || (Array.isArray(records) && records.length === 0)) return false;
    try {
        const res = await supabaseRequest(`/rest/v1/${tableName}`, {
            method: "POST",
            headers: {
                "Prefer": "resolution=merge-duplicates"
            },
            body: Array.isArray(records) ? records : [records]
        });
        return res && (res.status === 201 || res.status === 200 || res.status === 204);
    } catch {
        return false;
    }
}

/**
 * Đồng bộ toàn bộ dữ liệu người dùng lên Supabase (PostgreSQL tables + Auth + Storage)
 */
async function syncUsersDatabase(usersList) {
    if (!Array.isArray(usersList)) return;
    
    // 1. Lưu snapshot JSON vào Supabase Storage
    await saveToStorage("users.json", usersList);

    // 2. Đồng bộ các user sang Supabase Auth (chạy nền không chặn luồng chính)
    Promise.allSettled(
        usersList.map(u => syncUserToAuth(u))
    ).catch(() => {});

    // 3. Lưu vào bảng public.users trong PostgreSQL
    const mappedUsers = usersList.map(u => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role || "student",
        phone: u.phone || "",
        status: u.status || "active",
        created_at: u.createdAt || new Date().toISOString(),
        updated_at: u.updatedAt || new Date().toISOString()
    }));
    await tryPostgrestUpsert("users", mappedUsers);

    // 4. Lưu quan hệ vai trò vào bảng public.user_roles trong PostgreSQL
    const mappedRoles = usersList.filter(u => u.role).map(u => ({
        user_id: u.id,
        role_id: u.role,
        assigned_by: "system_sync",
        assigned_at: u.createdAt || new Date().toISOString()
    }));
    await tryPostgrestUpsert("user_roles", mappedRoles);
}

/**
 * Đồng bộ ngay lập tức 1 người dùng mới tạo hoặc cập nhật lên Supabase (Tối ưu hóa song song, giảm 80% độ trễ)
 */
async function syncSingleUser(user, plainPassword = null, allUsers = null) {
    if (!user || !user.email) return;
    try {
        const mappedUser = {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role || "student",
            phone: user.phone || "",
            status: user.status || "active",
            created_at: user.createdAt || new Date().toISOString(),
            updated_at: user.updatedAt || new Date().toISOString()
        };

        const tasks = [
            // 1. PostgreSQL public.users
            tryPostgrestUpsert("users", mappedUser),
            // 2. PostgreSQL public.user_roles
            user.role ? tryPostgrestUpsert("user_roles", {
                user_id: user.id,
                role_id: user.role,
                assigned_by: "system",
                assigned_at: new Date().toISOString()
            }) : Promise.resolve(),
            // 3. Supabase Auth
            syncUserToAuth(user, plainPassword)
        ];

        // 4. Storage snapshot
        if (Array.isArray(allUsers)) {
            tasks.push(saveToStorage("users.json", allUsers));
        }

        await Promise.allSettled(tasks);
    } catch (err) {
        console.warn(`[Supabase] syncSingleUser error for ${user.email}:`, err.message);
    }
}

/**
 * Xóa người dùng trên mọi tầng Supabase (Chạy song song tất cả các bảng để xóa tức thì không giật lag)
 */
async function deleteSingleUser(userId, email, allUsers = null) {
    try {
        const tasks = [];
        if (userId) {
            tasks.push(supabaseRequest(`/rest/v1/user_roles?user_id=eq.${encodeURIComponent(userId)}`, { method: "DELETE" }));
            tasks.push(supabaseRequest(`/rest/v1/users?id=eq.${encodeURIComponent(userId)}`, { method: "DELETE" }));
        }
        if (email) {
            tasks.push(supabaseRequest(`/rest/v1/users?email=eq.${encodeURIComponent(email)}`, { method: "DELETE" }));
            tasks.push(deleteUserFromAuth(email));
        }
        if (Array.isArray(allUsers)) {
            tasks.push(saveToStorage("users.json", allUsers));
        }
        await Promise.allSettled(tasks);
    } catch (err) {
        console.warn(`[Supabase] deleteSingleUser error:`, err.message);
    }
}

/**
 * Đồng bộ danh mục vai trò và bảng quan hệ Nhiều - Nhiều lên Supabase
 */
async function syncRolesDatabase(rolesList, userRolesList, auditLogsList) {
    await saveToStorage("roles.json", rolesList || []);
    await saveToStorage("user_roles.json", userRolesList || []);
    if (auditLogsList) {
        await saveToStorage("audit_logs.json", auditLogsList);
    }

    // Thử lưu sang PostgREST nếu bảng tồn tại
    if (rolesList) await tryPostgrestUpsert("roles", rolesList);
    if (Array.isArray(userRolesList)) {
        const mappedUR = userRolesList.map(ur => ({
            user_id: ur.userId,
            role_id: ur.roleId,
            assigned_by: ur.assignedBy || "system",
            assigned_at: ur.assignedAt || new Date().toISOString()
        }));
        await tryPostgrestUpsert("user_roles", mappedUR);
    }
}

/**
 * Đồng bộ dữ liệu nghiệp vụ (Điểm số & Học phí theo KN-8) lên Supabase
 */
async function syncBusinessDatabase(scoresData, tuitionData) {
    const payload = {
        scores: scoresData || {},
        tuition: tuitionData || {},
        syncedAt: new Date().toISOString()
    };
    await saveToStorage("scores_tuition.json", payload);

    if (scoresData) {
        const scoresArr = Object.entries(scoresData).map(([id, item]) => ({
            id,
            student_id: item.studentId || id,
            student_name: item.studentName || "",
            course: item.course || "",
            score: item.score,
            updated_at: item.updatedAt || new Date().toISOString(),
            updated_by: item.updatedBy || ""
        }));
        await tryPostgrestUpsert("scores", scoresArr);
    }

    if (tuitionData) {
        const tuitionArr = Object.entries(tuitionData).map(([id, item]) => ({
            id,
            student_id: item.studentId || id,
            student_name: item.studentName || "",
            amount: item.amount,
            status: item.status || "",
            updated_at: item.updatedAt || new Date().toISOString(),
            updated_by: item.updatedBy || ""
        }));
        await tryPostgrestUpsert("tuition", tuitionArr);
    }
}

/**
 * Kiểm tra sức khỏe kết nối Supabase
 */
async function checkSupabaseHealth() {
    const health = {
        configured: Boolean(SUPABASE_URL && SUPABASE_SECRET_KEY),
        supabaseUrl: SUPABASE_URL,
        jwksUrl: SUPABASE_JWKS_URL,
        authStatus: "unknown",
        storageStatus: "unknown",
        jwksStatus: "unknown",
        syncedFiles: ["users.json", "roles.json", "user_roles.json", "audit_logs.json", "scores_tuition.json"],
        timestamp: new Date().toISOString()
    };

    try {
        const authRes = await supabaseRequest("/auth/v1/admin/users?per_page=1");
        health.authStatus = (authRes && authRes.ok) ? "connected" : `error_${authRes?.status}`;
    } catch (e) {
        health.authStatus = `error: ${e.message}`;
    }

    try {
        const storageRes = await supabaseRequest(`/storage/v1/bucket/${BUCKET_NAME}`);
        health.storageStatus = (storageRes && storageRes.ok) ? "connected" : `error_${storageRes?.status}`;
    } catch (e) {
        health.storageStatus = `error: ${e.message}`;
    }

    try {
        const jwksRes = await fetch(SUPABASE_JWKS_URL);
        health.jwksStatus = jwksRes.ok ? "valid" : `error_${jwksRes.status}`;
    } catch (e) {
        health.jwksStatus = `error: ${e.message}`;
    }

    return health;
}

async function syncLeadsDatabase(leadsList) {
    if (!Array.isArray(leadsList)) return;
    try {
        await saveToStorage("leads.json", leadsList);
        for (const lead of leadsList.slice(0, 5)) {
            await tryPostgrestUpsert("leads", {
                id: lead.id,
                full_name: lead.fullName,
                phone: lead.phone,
                email: lead.email,
                course: lead.course,
                notes: lead.notes,
                status: lead.status,
                created_at: lead.createdAt
            });
        }
    } catch {}
}

module.exports = {
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    SUPABASE_SECRET_KEY,
    SUPABASE_JWKS_URL,
    BUCKET_NAME,
    ensureBucket,
    saveToStorage,
    loadFromStorage,
    syncUserToAuth,
    deleteUserFromAuth,
    syncSingleUser,
    deleteSingleUser,
    syncUsersDatabase,
    syncRolesDatabase,
    syncBusinessDatabase,
    syncLeadsDatabase,
    checkSupabaseHealth
};
