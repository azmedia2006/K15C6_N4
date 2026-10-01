// Cấu sở dữ liệu mô phỏng trong bộ nhớ cho 8 vai trò người dùng hệ thống TMS
const crypto = require("crypto");

// Hàm hash bảo vệ mật khẩu bằng PBKDF2 (chuẩn an toàn NIST)
function hashPassword(password, salt) {
    return crypto.pbkdf2Sync(password, salt, 10000, 64, "sha512").toString("hex");
}

function generateSalt() {
    return crypto.randomBytes(16).toString("hex");
}

// Khởi tạo danh sách người dùng mẫu với mật khẩu đã băm (hashed)
const users = [
    { id: "usr_admin", email: "admin@tms.edu.vn", name: "Nguyễn Văn Anh", role: "administrator", salt: "s1", passwordHash: "" },
    { id: "usr_manager", email: "manager@tms.edu.vn", name: "Đỗ Quốc Bảo", role: "training_manager", salt: "s2", passwordHash: "" },
    { id: "usr_teacher", email: "teacher@tms.edu.vn", name: "ThS. Trần Minh", role: "instructor", salt: "s3", passwordHash: "" },
    { id: "usr_ta", email: "ta@tms.edu.vn", name: "Nguyễn Thu Hà", role: "teaching_assistant", salt: "s4", passwordHash: "" },
    { id: "usr_student", email: "student@tms.edu.vn", name: "Lê Minh Tuấn", role: "student", salt: "s5", passwordHash: "" },
    { id: "usr_student2", email: "sv001", name: "Lê Minh Tuấn", role: "student", salt: "s6", passwordHash: "" },
    { id: "usr_admissions", email: "admissions@tms.edu.vn", name: "Vũ Hải Yến", role: "admissions", salt: "s7", passwordHash: "" },
    { id: "usr_accountant", email: "accountant@tms.edu.vn", name: "Phạm Thanh Mai", role: "accountant", salt: "s8", passwordHash: "" },
    { id: "usr_visitor", email: "visitor@tms.edu.vn", name: "Khách tham quan", role: "visitor", salt: "s9", passwordHash: "" }
];

const passwords = {
    "admin@tms.edu.vn": "admin123",
    "manager@tms.edu.vn": "manager123",
    "teacher@tms.edu.vn": "teacher123",
    "ta@tms.edu.vn": "ta123456",
    "student@tms.edu.vn": "student123",
    "sv001": "student123",
    "admissions@tms.edu.vn": "admissions123",
    "accountant@tms.edu.vn": "accountant123",
    "visitor@tms.edu.vn": "visitor123"
};

// Khởi tạo hash mật khẩu
users.forEach(u => {
    u.salt = generateSalt();
    u.passwordHash = hashPassword(passwords[u.email] || "123456", u.salt);
});

// Quản lý trạng thái khóa tài khoản và số lần sai liên tiếp
const loginAttempts = new Map(); // key: email, value: { count: number, lockoutUntil: number }

const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 phút (900 giây)
const MAX_FAILED_ATTEMPTS = 5;

// Tìm kiếm người dùng theo email hoặc mã định danh
function findUserByEmail(email) {
    const normalized = String(email || "").trim().toLowerCase();
    return users.find(u => u.email.toLowerCase() === normalized);
}

// Tạo session token an toàn
function generateToken(user) {
    const payload = {
        userId: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        issuedAt: Date.now(),
        expiresAt: Date.now() + (24 * 60 * 60 * 1000)
    };
    return Buffer.from(JSON.stringify(payload)).toString("base64");
}

module.exports = {
    findUserByEmail,
    hashPassword,
    generateSalt,
    generateToken,
    loginAttempts,
    LOCK_DURATION_MS,
    MAX_FAILED_ATTEMPTS,
    users
};
