const crypto = require("crypto");
const {
    users,
    hashPassword,
    generateSalt,
    findUserByEmail,
    loginAttempts
} = require("./authService");

const {
    sendActivationEmail,
    sentEmails
} = require("./emailService");

// 8 vai trò hợp lệ trong hệ thống TMS
const VALID_ROLES = [
    "administrator",
    "training_manager",
    "instructor",
    "teaching_assistant",
    "student",
    "admissions",
    "accountant",
    "visitor"
];

// Khởi tạo các trường bổ sung cho người dùng mặc định nếu chưa có
const defaultPhones = {
    "usr_admin": "0912345678",
    "usr_manager": "0987654321",
    "usr_teacher": "0901122334",
    "usr_ta": "0934567890",
    "usr_student": "0978123456",
    "usr_student2": "0978123456",
    "usr_admissions": "0965432198",
    "usr_accountant": "0945678912",
    "usr_visitor": "0922334455"
};

// Dữ liệu ảnh đại diện & avatar thu nhỏ mặc định cho học viên (phục vụ giảng viên nhận diện khuôn mặt KN-68)
const defaultAvatars = {
    "usr_student": "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='50' fill='%2310b981'/><circle cx='50' cy='38' r='20' fill='%23ffffff'/><path d='M20 85 C20 62 35 56 50 56 C65 56 80 62 80 85 Z' fill='%23ffffff'/></svg>",
    "usr_student2": "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='50' fill='%2310b981'/><circle cx='50' cy='38' r='20' fill='%23ffffff'/><path d='M20 85 C20 62 35 56 50 56 C65 56 80 62 80 85 Z' fill='%23ffffff'/></svg>"
};

users.forEach(u => {
    if (!u.status) u.status = "active";
    if (!u.phone) u.phone = defaultPhones[u.id] || "0900000000";
    if (!u.avatar) u.avatar = defaultAvatars[u.id] || "";
    if (!u.thumbnail) u.thumbnail = defaultAvatars[u.id] || "";
    if (!u.createdAt) u.createdAt = new Date("2026-01-15T08:00:00Z").toISOString();
    if (!u.updatedAt) u.updatedAt = new Date("2026-01-15T08:00:00Z").toISOString();
});

// Sinh ID duy nhất cho tài khoản mới
function generateUserId() {
    return "usr_" + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
}

// Sinh mật khẩu tạm ngẫu nhiên an toàn nếu admin không chỉ định
function generateRandomTempPassword() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
    let pass = "TMS@";
    for (let i = 0; i < 6; i++) {
        pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pass;
}

// Kiểm tra định dạng email
function isValidEmail(email) {
    if (!email || typeof email !== "string") return false;
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email.trim());
}



// Lấy danh sách người dùng có hỗ trợ lọc, tìm kiếm và phân trang (mặc định 20 dòng theo KN-11)
function getUsers({ query = "", role = "", status = "", page = 1, limit = 20 } = {}) {
    let result = [...users];

    // Lọc theo từ khóa tìm kiếm (Tên, email, số điện thoại)
    if (query && String(query).trim()) {
        const q = String(query).trim().toLowerCase();
        result = result.filter(u => 
            (u.name && u.name.toLowerCase().includes(q)) ||
            (u.email && u.email.toLowerCase().includes(q)) ||
            (u.phone && u.phone.includes(q))
        );
    }

    // Lọc theo vai trò
    if (role && String(role).trim() && role !== "all") {
        const r = String(role).trim().toLowerCase();
        result = result.filter(u => u.role && u.role.toLowerCase() === r);
    }

    // Lọc theo trạng thái
    if (status && String(status).trim() && status !== "all") {
        const s = String(status).trim().toLowerCase();
        result = result.filter(u => u.status && u.status.toLowerCase() === s);
    }

    const total = result.length;
    const currentPage = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.max(1, parseInt(limit, 10) || 50);
    const totalPages = Math.ceil(total / pageSize) || 1;
    const startIndex = (currentPage - 1) * pageSize;
    const paginated = result.slice(startIndex, startIndex + pageSize);

    // Chuẩn hóa dữ liệu trả về, bảo mật không kèm passwordHash và salt
    const sanitizedUsers = paginated.map(u => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        phone: u.phone,
        status: u.status,
        avatar: u.avatar || "",
        thumbnail: u.thumbnail || "",
        createdAt: u.createdAt,
        updatedAt: u.updatedAt
    }));

    return {
        users: sanitizedUsers,
        total,
        page: currentPage,
        limit: pageSize,
        totalPages
    };
}

// Lấy chi tiết người dùng theo ID
function getUserById(id) {
    const user = users.find(u => u.id === id);
    if (!user) return null;
    return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        phone: user.phone,
        status: user.status,
        avatar: user.avatar || "",
        thumbnail: user.thumbnail || "",
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
    };
}

// Tạo người dùng mới (KN-11: Cấp quyền truy cập cho nhân sự mới)
function createUser({ email, name, role, phone = "", password = "" }) {
    if (!email || !String(email).trim()) {
        throw { status: 400, message: "Email không được để trống." };
    }
    const normalizedEmail = String(email).trim().toLowerCase();
    if (!isValidEmail(normalizedEmail)) {
        throw { status: 400, message: "Định dạng email không hợp lệ." };
    }

    // Kiểm tra trùng lặp email
    const existing = findUserByEmail(normalizedEmail);
    if (existing) {
        throw { status: 409, message: "Email này đã được sử dụng bởi một tài khoản khác trong hệ thống." };
    }

    if (!name || !String(name).trim() || String(name).trim().length < 2) {
        throw { status: 400, message: "Họ và tên bắt buộc và phải có ít nhất 2 ký tự." };
    }

    const assignedRole = String(role || "instructor").trim().toLowerCase();
    if (!VALID_ROLES.includes(assignedRole)) {
        throw { status: 400, message: `Vai trò '${role}' không hợp lệ. Danh sách hợp lệ: ${VALID_ROLES.join(", ")}` };
    }

    // Xác định mật khẩu (tự sinh mật khẩu tạm nếu chưa cung cấp)
    const rawPassword = password && String(password).trim() ? String(password).trim() : generateRandomTempPassword();
    const salt = generateSalt();
    const passwordHash = hashPassword(rawPassword, salt);
    const nowIso = new Date().toISOString();

    const newUser = {
        id: generateUserId(),
        email: normalizedEmail,
        name: String(name).trim(),
        role: assignedRole,
        phone: String(phone || "").trim(),
        status: "active",
        salt,
        passwordHash,
        createdAt: nowIso,
        updatedAt: nowIso
    };

    users.push(newUser);

    // KN-11 & KN-86: Gửi email kích hoạt qua SMTP thật kèm mật khẩu tạm thời cho nhân sự mới
    const emailResult = sendActivationEmail({
        to: newUser.email,
        name: newUser.name,
        temporaryPassword: rawPassword,
        role: newUser.role
    });

    return {
        user: {
            id: newUser.id,
            email: newUser.email,
            name: newUser.name,
            role: newUser.role,
            phone: newUser.phone,
            status: newUser.status,
            createdAt: newUser.createdAt,
            updatedAt: newUser.updatedAt
        },
        temporaryPassword: rawPassword, // Trả về mật khẩu để Admin gửi cho nhân sự mới
        emailSent: true,
        activationEmail: emailResult
    };
}

// Cập nhật thông tin người dùng (KN-11: Sửa thông tin tài khoản)
function updateUser(id, { name, role, phone, status, password }) {
    const userIndex = users.findIndex(u => u.id === id);
    if (userIndex === -1) {
        throw { status: 404, message: "Không tìm thấy người dùng với mã định danh đã cung cấp." };
    }

    const targetUser = users[userIndex];

    if (name !== undefined) {
        const trimmedName = String(name).trim();
        if (trimmedName.length < 2) {
            throw { status: 400, message: "Họ và tên phải có ít nhất 2 ký tự." };
        }
        targetUser.name = trimmedName;
    }

    if (role !== undefined) {
        const assignedRole = String(role).trim().toLowerCase();
        if (!VALID_ROLES.includes(assignedRole)) {
            throw { status: 400, message: `Vai trò '${role}' không hợp lệ.` };
        }
        targetUser.role = assignedRole;
    }

    if (phone !== undefined) {
        targetUser.phone = String(phone).trim();
    }

    if (status !== undefined) {
        const validStatuses = ["active", "inactive", "locked"];
        const s = String(status).trim().toLowerCase();
        if (!validStatuses.includes(s)) {
            throw { status: 400, message: `Trạng thái '${status}' không hợp lệ. (Hợp lệ: ${validStatuses.join(", ")})` };
        }
        targetUser.status = s;
        // Nếu chuyển sang active, mở khóa loginAttempts nếu có
        if (s === "active" && loginAttempts.has(targetUser.email.toLowerCase())) {
            loginAttempts.delete(targetUser.email.toLowerCase());
        }
    }

    if (password && String(password).trim()) {
        const newPass = String(password).trim();
        targetUser.salt = generateSalt();
        targetUser.passwordHash = hashPassword(newPass, targetUser.salt);
        // Reset khóa đăng nhập khi đổi mật khẩu
        loginAttempts.delete(targetUser.email.toLowerCase());
    }

    targetUser.updatedAt = new Date().toISOString();

    return {
        id: targetUser.id,
        email: targetUser.email,
        name: targetUser.name,
        role: targetUser.role,
        phone: targetUser.phone,
        status: targetUser.status,
        createdAt: targetUser.createdAt,
        updatedAt: targetUser.updatedAt
    };
}

// Xóa hoặc vô hiệu hóa tài khoản
function deleteUser(id, currentAdminId = null) {
    const userIndex = users.findIndex(u => u.id === id);
    if (userIndex === -1) {
        throw { status: 404, message: "Không tìm thấy người dùng." };
    }

    const targetUser = users[userIndex];

    // Không cho phép tự xóa tài khoản của chính mình
    if (currentAdminId && targetUser.id === currentAdminId) {
        throw { status: 403, message: "Bạn không thể tự xóa tài khoản quản trị của chính mình." };
    }

    // Không cho phép xóa admin duy nhất còn lại
    if (targetUser.role === "administrator") {
        const adminCount = users.filter(u => u.role === "administrator").length;
        if (adminCount <= 1) {
            throw { status: 403, message: "Hệ thống phải có ít nhất một Quản trị viên." };
        }
    }

    // Xóa khỏi danh sách users và giải phóng map loginAttempts
    users.splice(userIndex, 1);
    loginAttempts.delete(targetUser.email.toLowerCase());

    return { success: true, message: `Đã xóa tài khoản '${targetUser.name}' (${targetUser.email}) thành công.` };
}

// =========================================================================
// KN-66: NHẬP DANH SÁCH NGƯỜI DÙNG HÀNG LOẠT TỪ TỆP EXCEL / CSV
// =========================================================================

const XLSX = require("xlsx");

// Bản đồ ánh xạ tên vai trò tiếng Việt / tiếng Anh sang mã vai trò chuẩn TMS
const ROLE_NAME_MAP = {
    "học viên": "student",
    "hoc vien": "student",
    "sinh viên": "student",
    "sinh vien": "student",
    "học sinh": "student",
    "hoc sinh": "student",
    "student": "student",
    "giảng viên": "instructor",
    "giang vien": "instructor",
    "giáo viên": "instructor",
    "giao vien": "instructor",
    "thầy cô": "instructor",
    "thay co": "instructor",
    "instructor": "instructor",
    "teacher": "instructor",
    "trợ giảng": "teaching_assistant",
    "tro giang": "teaching_assistant",
    "teaching assistant": "teaching_assistant",
    "teaching_assistant": "teaching_assistant",
    "ta": "teaching_assistant",
    "quản lý đào tạo": "training_manager",
    "quan ly dao tao": "training_manager",
    "training manager": "training_manager",
    "training_manager": "training_manager",
    "tư vấn tuyển sinh": "admissions",
    "tu van tuyen sinh": "admissions",
    "tuyển sinh": "admissions",
    "tuyen sinh": "admissions",
    "tư vấn": "admissions",
    "tu van": "admissions",
    "admissions": "admissions",
    "kế toán": "accountant",
    "ke toan": "accountant",
    "kế toán đào tạo": "accountant",
    "accountant": "accountant",
    "quản trị viên": "administrator",
    "quan tri vien": "administrator",
    "quản trị hệ thống": "administrator",
    "quan tri he thong": "administrator",
    "admin": "administrator",
    "administrator": "administrator",
    "khách": "visitor",
    "khach": "visitor",
    "khách tham quan": "visitor",
    "khach tham quan": "visitor",
    "khách truy cập": "visitor",
    "khach truy cap": "visitor",
    "visitor": "visitor"
};

function normalizeRole(inputRole) {
    if (!inputRole || !String(inputRole).trim()) {
        return "student"; // Mặc định là học viên khi import khóa học viên mới
    }
    const clean = String(inputRole).trim().toLowerCase();
    if (ROLE_NAME_MAP[clean]) {
        return ROLE_NAME_MAP[clean];
    }
    if (VALID_ROLES.includes(clean)) {
        return clean;
    }
    return null;
}

function extractRowFields(row) {
    if (!row || typeof row !== "object") {
        return { name: "", email: "", phone: "", role: "", password: "" };
    }

    const findVal = (keys) => {
        for (const k of keys) {
            for (const actualKey of Object.keys(row)) {
                if (actualKey.trim().toLowerCase() === k.toLowerCase()) {
                    const val = row[actualKey];
                    return val != null ? String(val).trim() : "";
                }
            }
        }
        return "";
    };

    const name = findVal(["họ và tên", "họ tên", "họ và ten", "họ tên đầy đủ", "tên", "full name", "fullname", "name"]);
    const email = findVal(["email", "địa chỉ email", "email đăng nhập", "mail"]);
    const phone = findVal(["số điện thoại", "số đt", "sđt", "điện thoại", "phone", "phone number", "tel", "telephone"]);
    const role = findVal(["vai trò", "vai trò hệ thống", "chức vụ", "quyền", "role"]);
    const password = findVal(["mật khẩu", "mật khẩu ban đầu", "mật khẩu tạm", "password", "pass"]);

    return { name, email, phone, role, password };
}

function validateImportRow(rawRow, existingEmailsSet, batchEmailsMap, rowIndex) {
    const rowNumber = rowIndex + 1;
    const { name, email, phone, role, password } = extractRowFields(rawRow);
    const errors = [];

    // 1. Kiểm tra Họ và Tên
    if (!name) {
        errors.push("Họ và tên không được để trống.");
    } else if (name.length < 2) {
        errors.push("Họ và tên phải có ít nhất 2 ký tự.");
    }

    // 2. Kiểm tra Email
    let normalizedEmail = "";
    if (!email) {
        errors.push("Email không được để trống.");
    } else {
        normalizedEmail = email.toLowerCase();
        if (!isValidEmail(normalizedEmail)) {
            errors.push(`Định dạng email '${email}' không hợp lệ.`);
        } else if (existingEmailsSet.has(normalizedEmail)) {
            errors.push(`Email '${email}' đã tồn tại trong hệ thống.`);
        } else if (batchEmailsMap.has(normalizedEmail)) {
            errors.push(`Email '${email}' bị trùng lặp với dòng ${batchEmailsMap.get(normalizedEmail)} trong cùng tệp.`);
        } else {
            batchEmailsMap.set(normalizedEmail, rowNumber);
        }
    }

    // 3. Kiểm tra Vai trò
    const normalizedRole = normalizeRole(role);
    if (!normalizedRole) {
        errors.push(`Vai trò '${role}' không hợp lệ.`);
    }

    // 4. Kiểm tra Số điện thoại
    let cleanPhone = "";
    if (phone) {
        cleanPhone = phone.replace(/[\s\.\-\(\)]/g, "");
        if (!/^[0-9\+]{8,15}$/.test(cleanPhone)) {
            errors.push(`Số điện thoại '${phone}' không đúng định dạng.`);
        }
    }

    const isValid = errors.length === 0;

    return {
        rowNumber,
        isValid,
        errors,
        error: errors.join(" "),
        data: {
            name,
            email: normalizedEmail || email,
            phone: cleanPhone || phone || "",
            role: normalizedRole || "student",
            password: password || ""
        },
        originalData: rawRow
    };
}

function previewImportUsers(rows) {
    if (!Array.isArray(rows)) {
        throw { status: 400, message: "Dữ liệu dòng nhập (rows) phải là một danh sách mảng." };
    }

    const existingEmailsSet = new Set(users.map(u => (u.email || "").toLowerCase()));
    const batchEmailsMap = new Map();

    const evaluatedRows = rows.map((row, index) =>
        validateImportRow(row, existingEmailsSet, batchEmailsMap, index)
    );

    const validRows = evaluatedRows.filter(r => r.isValid);
    const invalidRows = evaluatedRows.filter(r => !r.isValid);

    return {
        totalRows: evaluatedRows.length,
        validCount: validRows.length,
        invalidCount: invalidRows.length,
        rows: evaluatedRows,
        validRows,
        invalidRows
    };
}

function importUsersBatch(rows, { currentAdminId, skipInvalid = true } = {}) {
    const preview = previewImportUsers(rows);
    const importedUsers = [];
    const skippedRows = [...preview.invalidRows];

    for (const validItem of preview.validRows) {
        try {
            const createRes = createUser({
                name: validItem.data.name,
                email: validItem.data.email,
                role: validItem.data.role,
                phone: validItem.data.phone,
                password: validItem.data.password
            });

            importedUsers.push({
                rowNumber: validItem.rowNumber,
                id: createRes.user.id,
                name: createRes.user.name,
                email: createRes.user.email,
                role: createRes.user.role,
                phone: createRes.user.phone,
                temporaryPassword: createRes.temporaryPassword,
                status: createRes.user.status,
                createdAt: createRes.user.createdAt
            });
        } catch (err) {
            skippedRows.push({
                rowNumber: validItem.rowNumber,
                isValid: false,
                errors: [err.message || "Lỗi tạo tài khoản"],
                error: err.message || "Lỗi tạo tài khoản",
                data: validItem.data,
                originalData: validItem.originalData
            });
        }
    }

    return {
        success: true,
        summary: {
            totalRows: preview.totalRows,
            validCount: preview.validCount,
            invalidCount: preview.invalidCount,
            importedCount: importedUsers.length,
            skippedCount: skippedRows.length,
            importedUsers,
            skippedRows
        }
    };
}

function parseExcelBuffer(buffer) {
    if (!buffer) return [];
    const wb = XLSX.read(buffer, { type: "buffer" });
    const firstSheetName = wb.SheetNames[0];
    if (!firstSheetName) return [];
    const ws = wb.Sheets[firstSheetName];
    return XLSX.utils.sheet_to_json(ws, { defval: "" });
}

function generateUsersTemplate(format = "xlsx") {
    const templateData = [
        {
            "Họ và tên": "Nguyễn Văn An",
            "Email": "an.nguyen@example.com",
            "Số điện thoại": "0912345678",
            "Vai trò": "Học viên",
            "Mật khẩu ban đầu": ""
        },
        {
            "Họ và tên": "Trần Thị Bình",
            "Email": "binh.tran@example.com",
            "Số điện thoại": "0987654321",
            "Vai trò": "Học viên",
            "Mật khẩu ban đầu": ""
        },
        {
            "Họ và tên": "Lê Hoàng Nam",
            "Email": "nam.le@example.com",
            "Số điện thoại": "0901234567",
            "Vai trò": "Học viên",
            "Mật khẩu ban đầu": ""
        },
        {
            "Họ và tên": "Phạm Minh Đức",
            "Email": "duc.pham@example.com",
            "Số điện thoại": "0934567890",
            "Vai trò": "Giảng viên",
            "Mật khẩu ban đầu": ""
        },
        {
            "Họ và tên": "Hoàng Thu Thảo",
            "Email": "thao.hoang@example.com",
            "Số điện thoại": "0978901234",
            "Vai trò": "Trợ giảng",
            "Mật khẩu ban đầu": ""
        }
    ];

    if (format === "csv") {
        const headers = ["Họ và tên", "Email", "Số điện thoại", "Vai trò", "Mật khẩu ban đầu"];
        let csvContent = "\uFEFF" + headers.join(",") + "\n";
        templateData.forEach(row => {
            csvContent += `"${row["Họ và tên"]}","${row["Email"]}","${row["Số điện thoại"]}","${row["Vai trò"]}","${row["Mật khẩu ban đầu"]}"\n`;
        });
        return {
            contentType: "text/csv; charset=utf-8",
            filename: "tms_mau_nhap_nguoi_dung.csv",
            data: Buffer.from(csvContent, "utf-8")
        };
    }

    const ws = XLSX.utils.json_to_sheet(templateData, {
        header: ["Họ và tên", "Email", "Số điện thoại", "Vai trò", "Mật khẩu ban đầu"]
    });

    ws["!cols"] = [
        { wch: 22 },
        { wch: 28 },
        { wch: 16 },
        { wch: 18 },
        { wch: 20 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "DanhSachHocVien");
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    return {
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename: "tms_mau_nhap_nguoi_dung.xlsx",
        data: buffer
    };
}

// =========================================================================
// KN-68: Quản lý và xử lý tải lên ảnh đại diện & bản thu nhỏ (Thumbnail)
// Tiêu chí chấp nhận:
// 1. Chấp nhận định dạng JPG/PNG tối đa 2MB (2,097,152 bytes)
// 2. Cắt vuông và tạo bản thu nhỏ (thumbnail) phục vụ điểm danh nhận diện khuôn mặt
// =========================================================================

const MAX_AVATAR_SIZE_BYTES = 2 * 1024 * 1024; // 2MB
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/jpg", "image/png"];

function validateAndProcessAvatar({ avatarData, thumbnailData, mimeType, sizeBytes }) {
    if (!avatarData || typeof avatarData !== "string") {
        throw { status: 400, message: "Dữ liệu ảnh đại diện không được để trống." };
    }

    // 1. Kiểm tra định dạng tệp (MIME type)
    let detectedMime = mimeType ? String(mimeType).toLowerCase().trim() : "";
    if (avatarData.startsWith("data:")) {
        const match = avatarData.match(/^data:([^;]+);base64,/);
        if (match) {
            detectedMime = match[1].toLowerCase().trim();
        }
    }

    if (!detectedMime || !ALLOWED_MIME_TYPES.includes(detectedMime)) {
        throw {
            status: 400,
            message: "Định dạng tệp không hợp lệ. Chỉ chấp nhận tệp ảnh JPG hoặc PNG theo tiêu chí KN-68."
        };
    }

    // 2. Kiểm tra dung lượng tệp (Tối đa 2MB)
    let calculatedSize = sizeBytes;
    if (!calculatedSize && avatarData.startsWith("data:")) {
        const base64Str = avatarData.split(",")[1] || "";
        calculatedSize = Math.floor((base64Str.length * 3) / 4);
    }

    if (calculatedSize && calculatedSize > MAX_AVATAR_SIZE_BYTES) {
        const sizeMb = (calculatedSize / (1024 * 1024)).toFixed(2);
        throw {
            status: 400,
            message: `Dung lượng tệp ảnh quá lớn (${sizeMb}MB). Giới hạn tối đa là 2MB.`
        };
    }

    // Bản thu nhỏ (thumbnail): Nếu client chưa gửi bản thu nhỏ riêng, dùng chính avatar vuông
    const effectiveThumbnail = thumbnailData && typeof thumbnailData === "string"
        ? thumbnailData
        : avatarData;

    return {
        avatar: avatarData,
        thumbnail: effectiveThumbnail,
        mimeType: detectedMime,
        sizeBytes: calculatedSize || 0
    };
}

function updateUserAvatar(userId, avatarPayload) {
    const userIndex = users.findIndex(u => u.id === userId || u.email.toLowerCase() === String(userId).toLowerCase());
    if (userIndex === -1) {
        throw { status: 404, message: "Không tìm thấy người dùng để cập nhật ảnh đại diện." };
    }

    const processed = validateAndProcessAvatar(avatarPayload);
    const targetUser = users[userIndex];
    targetUser.avatar = processed.avatar;
    targetUser.thumbnail = processed.thumbnail;
    targetUser.updatedAt = new Date().toISOString();

    return {
        id: targetUser.id,
        name: targetUser.name,
        email: targetUser.email,
        role: targetUser.role,
        avatar: targetUser.avatar,
        thumbnail: targetUser.thumbnail,
        updatedAt: targetUser.updatedAt
    };
}

function deleteUserAvatar(userId) {
    const userIndex = users.findIndex(u => u.id === userId || u.email.toLowerCase() === String(userId).toLowerCase());
    if (userIndex === -1) {
        throw { status: 404, message: "Không tìm thấy người dùng." };
    }

    const targetUser = users[userIndex];
    targetUser.avatar = "";
    targetUser.thumbnail = "";
    targetUser.updatedAt = new Date().toISOString();

    return {
        id: targetUser.id,
        name: targetUser.name,
        avatar: "",
        thumbnail: "",
        message: "Đã xóa ảnh đại diện thành công."
    };
}

module.exports = {
    VALID_ROLES,
    ROLE_NAME_MAP,
    normalizeRole,
    extractRowFields,
    MAX_AVATAR_SIZE_BYTES,
    ALLOWED_MIME_TYPES,
    validateAndProcessAvatar,
    updateUserAvatar,
    deleteUserAvatar,
    getUsers,
    getUserById,
    createUser,
    updateUser,
    deleteUser,
    isValidEmail,
    generateRandomTempPassword,
    sendActivationEmail,
    sentEmails,
    validateImportRow,
    previewImportUsers,
    importUsersBatch,
    parseExcelBuffer,
    generateUsersTemplate
};
