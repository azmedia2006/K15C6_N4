// =========================================================================
// TMS BACKEND - DỊCH VỤ QUẢN LÝ LEAD & TƯ VẤN TUYỂN SINH (KN LEAD SERVICE)
// Biểu mẫu công khai không cần đăng nhập, chống spam đa lớp,
// tạo Lead trạng thái "Mới", hiển thị Lời cảm ơn và Cam kết liên hệ lại
// =========================================================================

const crypto = require("crypto");

// Kho lưu trữ Lead trong bộ nhớ (In-memory Relational Store)
// Khởi tạo các lead mẫu ban đầu phục vụ kiểm thử và nghiệp vụ Tuyển sinh
let leads = [
    {
        id: "lead_init_001",
        code: "LD-202610-001",
        fullName: "Trần Minh Quân",
        name: "Trần Minh Quân",
        phone: "0912345678",
        email: "minhquan.tran@gmail.com",
        course: "Lập trình Web Fullstack (NodeJS & React)",
        notes: "Em muốn đăng ký lớp học buổi tối trong tuần để vừa học vừa đi làm.",
        status: "Mới", // Trạng thái ban đầu
        source: "Website (Biểu mẫu công khai)",
        ip: "127.0.0.1",
        createdAt: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
        updatedAt: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
        assignedTo: null,
        counselorNotes: "",
        contactCommitment: "Cam kết liên hệ lại trong vòng 24 giờ làm việc",
        thankYouMessage: "Cảm ơn bạn đã quan tâm và đăng ký tư vấn tại Hệ Thống Đào Tạo TMS!"
    },
    {
        id: "lead_init_002",
        code: "LD-202610-002",
        fullName: "Lê Hoàng Yến",
        name: "Lê Hoàng Yến",
        phone: "0988776655",
        email: "hoangyen.le@gmail.com",
        course: "Lập trình Java Spring Boot Doanh nghiệp",
        notes: "Em là sinh viên năm cuối muốn bổ sung chứng chỉ và dự án thực tế.",
        status: "Mới",
        source: "Website (Biểu mẫu công khai)",
        ip: "127.0.0.1",
        createdAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
        updatedAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
        assignedTo: "usr_admissions",
        counselorNotes: "",
        contactCommitment: "Cam kết liên hệ lại trong vòng 24 giờ làm việc",
        thankYouMessage: "Cảm ơn bạn đã quan tâm và đăng ký tư vấn tại Hệ Thống Đào Tạo TMS!"
    },
    {
        id: "lead_init_003",
        code: "LD-202610-003",
        fullName: "Phạm Hải Đăng",
        name: "Phạm Hải Đăng",
        phone: "0933221100",
        email: "haidang.pham@gmail.com",
        course: "Trí tuệ Nhân tạo & Ứng dụng Python (AI/ML)",
        notes: "Đã tư vấn qua điện thoại, hẹn lên trung tâm ký hợp đồng đào tạo.",
        status: "Đang tư vấn",
        source: "Website (Biểu mẫu công khai)",
        ip: "127.0.0.1",
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
        updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
        assignedTo: "usr_admissions",
        counselorNotes: "Học viên hẹn sáng thứ 7 lên làm thủ tục ghi danh.",
        contactCommitment: "Cam kết liên hệ lại trong vòng 24 giờ làm việc",
        thankYouMessage: "Cảm ơn bạn đã quan tâm và đăng ký tư vấn tại Hệ Thống Đào Tạo TMS!"
    }
];

// Bộ nhớ theo dõi chống spam theo IP và thời gian (Rate Limiting & Anti-Spam Store)
const ipSubmissionTimestamps = new Map(); // IP -> Array<timestamps>
const recentSubmissionsByKey = new Map(); // "phone:email" -> lastTimestamp
const antiSpamTokens = new Map(); // token -> { answer, expiresAt }

// Khóa bí mật nội bộ để ký token chống spam
const ANTI_SPAM_SECRET = "tms_anti_spam_salt_key_2026";

/**
 * Sinh câu hỏi tính toán chống spam ngẫu nhiên (Math Challenge)
 */
function generateAntiSpamChallenge() {
    const num1 = Math.floor(Math.random() * 9) + 1; // 1 - 9
    const num2 = Math.floor(Math.random() * 9) + 1; // 1 - 9
    const answer = num1 + num2;
    const expiresAt = Date.now() + 10 * 60 * 1000; // Có hiệu lực 10 phút

    const token = crypto
        .createHmac("sha256", ANTI_SPAM_SECRET)
        .update(`${num1}:${num2}:${answer}:${expiresAt}`)
        .digest("hex");

    antiSpamTokens.set(token, { answer, expiresAt });

    // Tự dọn dẹp token hết hạn
    if (antiSpamTokens.size > 500) {
        const now = Date.now();
        for (const [t, data] of antiSpamTokens.entries()) {
            if (data.expiresAt < now) antiSpamTokens.delete(t);
        }
    }

    return {
        question: `${num1} + ${num2}`,
        token: token,
        expiresAt: expiresAt
    };
}

/**
 * Kiểm tra câu trả lời câu hỏi tính toán chống spam
 */
function verifyAntiSpamChallenge(token, userAnswer) {
    if (!token) return true; // Nếu client không dùng math challenge, vẫn cho qua (hỗ trợ graceful fallback)
    const stored = antiSpamTokens.get(token);
    if (!stored) return false;
    if (Date.now() > stored.expiresAt) {
        antiSpamTokens.delete(token);
        return false;
    }
    const isValid = Number(userAnswer) === Number(stored.answer);
    if (isValid) antiSpamTokens.delete(token); // Sử dụng 1 lần (Single-use token)
    return isValid;
}

/**
 * Xác thực chống spam đa lớp (Multi-layer Anti-Spam Verification)
 * 1. Honeypot Field (Bẫy bot ẩn)
 * 2. Thời gian điền tối thiểu (Min submission time)
 * 3. Giới hạn tần suất IP (IP Rate Limiting)
 * 4. Chống trùng lặp liên tục (Duplicate flooding prevention)
 * 5. Câu hỏi xác nhận tính toán (Math challenge)
 */
function checkSpam(options = {}) {
    const {
        honeypot,
        formStartTime,
        ip = "127.0.0.1",
        phone,
        email,
        captchaAnswer,
        captchaToken,
        bypassSpamCheck = false
    } = options;

    if (bypassSpamCheck) {
        return { isSpam: false };
    }

    // 1. Kiểm tra Honeypot: Bot tự động thường điền tất cả các trường
    if (honeypot && String(honeypot).trim() !== "") {
        return {
            isSpam: true,
            code: "SPAM_HONEYPOT_TRIGGERED",
            message: "Hệ thống phát hiện thao tác không hợp lệ từ phần mềm tự động (Honeypot Triggered)."
        };
    }

    // 2. Kiểm tra thời gian điền (Speed check): Người thật không thể điền form dưới 1.5 giây
    if (formStartTime) {
        const elapsedMs = Date.now() - Number(formStartTime);
        if (elapsedMs > 0 && elapsedMs < 1500) {
            return {
                isSpam: true,
                code: "SPAM_SUBMITTED_TOO_FAST",
                message: "Thao tác gửi biểu mẫu quá nhanh so với thao tác người dùng thực. Vui lòng kiểm tra lại thông tin."
            };
        }
    }

    // 3. Giới hạn tần suất gửi theo IP (IP Rate Limiting)
    const now = Date.now();
    const timestamps = ipSubmissionTimestamps.get(ip) || [];
    // Giữ lại các lần gửi trong 60 giây gần nhất
    const recentFromIp = timestamps.filter(t => now - t < 60000);

    // Cho phép tối đa 5 lần gửi / 1 phút cho mỗi IP
    if (recentFromIp.length >= 5) {
        return {
            isSpam: true,
            code: "SPAM_RATE_LIMIT_EXCEEDED",
            message: "Bạn đã gửi yêu cầu quá nhiều lần trong thời gian ngắn. Vui lòng đợi 1 phút trước khi thử lại."
        };
    }

    // 4. Chặn gửi trùng lặp liên tục theo SĐT / Email (Duplicate Flood Check)
    if (phone || email) {
        const dedupKey = `${String(phone).trim()}:${String(email).trim().toLowerCase()}`;
        const lastSent = recentSubmissionsByKey.get(dedupKey);
        if (lastSent && now - lastSent < 15000) {
            return {
                isSpam: true,
                code: "SPAM_DUPLICATE_SUBMISSION",
                message: "Yêu cầu tư vấn của bạn đã được gửi gần đây. Cố vấn tuyển sinh sẽ liên hệ lại với bạn sớm nhất."
            };
        }
    }

    // 5. Kiểm tra Captcha / Math Challenge nếu có cung cấp
    if (captchaToken && captchaAnswer !== undefined) {
        if (!verifyAntiSpamChallenge(captchaToken, captchaAnswer)) {
            return {
                isSpam: true,
                code: "SPAM_CAPTCHA_INVALID",
                message: "Câu trả lời xác nhận chống spam chưa chính xác. Vui lòng thử lại."
            };
        }
    }

    // Ghi nhận lịch sử gửi hợp lệ
    recentFromIp.push(now);
    ipSubmissionTimestamps.set(ip, recentFromIp);
    if (phone || email) {
        const dedupKey = `${String(phone).trim()}:${String(email).trim().toLowerCase()}`;
        recentSubmissionsByKey.set(dedupKey, now);
    }

    return { isSpam: false };
}

/**
 * Chuẩn hóa số điện thoại (bỏ ký tự thừa, quy đổi +84 về 0)
 */
function normalizePhone(phone) {
    if (!phone || typeof phone !== "string") return "";
    let clean = phone.replace(/[\s\.\-\(\)]/g, "");
    if (clean.startsWith("+84")) {
        clean = "0" + clean.slice(3);
    }
    return clean;
}

/**
 * Kiểm tra định dạng số điện thoại Việt Nam
 */
function isValidPhone(phone) {
    if (!phone || typeof phone !== "string") return false;
    const clean = phone.replace(/[\s\.\-\(\)]/g, "");
    // Số điện thoại Việt Nam: bắt đầu bằng 0 hoặc +84 kèm 9-10 chữ số
    return /^(0|\+84)(3|5|7|8|9)[0-9]{8}$/.test(clean) || /^0[1-9][0-9]{8,9}$/.test(clean);
}

/**
 * Kiểm tra định dạng Email
 */
function isValidEmail(email) {
    if (!email || typeof email !== "string") return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/**
 * KN-74: Kiểm tra trùng số điện thoại với các lead đã có trong hệ thống
 * @param {string} phone - Số điện thoại cần kiểm tra
 * @param {string|null} excludeLeadId - ID hoặc mã Lead cần bỏ qua (khi sửa chính lead đó)
 * @returns {{ isDuplicate: boolean, duplicateLead: object|null, message: string }}
 */
function checkDuplicatePhone(phone, excludeLeadId = null) {
    const cleanTarget = normalizePhone(phone);
    if (!cleanTarget) {
        return { isDuplicate: false, duplicateLead: null, message: "" };
    }

    const duplicateLead = leads.find(l => {
        if (excludeLeadId && (l.id === excludeLeadId || l.code === excludeLeadId)) {
            return false;
        }
        return normalizePhone(l.phone) === cleanTarget;
    });

    if (duplicateLead) {
        return {
            isDuplicate: true,
            duplicateLead: duplicateLead,
            message: `Cảnh báo: Số điện thoại này đã tồn tại trong hồ sơ của khách hàng "${duplicateLead.fullName || duplicateLead.name}" (Mã: ${duplicateLead.code}, Trạng thái: ${duplicateLead.status}).`
        };
    }

    return {
        isDuplicate: false,
        duplicateLead: null,
        message: "Số điện thoại hợp lệ, chưa bị trùng lặp."
    };
}

/**
 * Tạo một Lead mới từ biểu mẫu tư vấn công khai (Không yêu cầu đăng nhập)
 * Gửi thành công tạo một lead ở trạng thái "Mới"
 */
function createLead(leadData = {}, clientMeta = {}) {
    const {
        fullName,
        name,
        phone,
        email,
        course,
        notes,
        message,
        honeypot,
        formStartTime,
        captchaAnswer,
        captchaToken,
        bypassSpamCheck = false
    } = leadData;

    const ip = clientMeta.ip || "127.0.0.1";

    // 1. Kiểm tra chống spam
    const spamCheckResult = checkSpam({
        honeypot,
        formStartTime,
        ip,
        phone,
        email,
        captchaAnswer,
        captchaToken,
        bypassSpamCheck
    });

    if (spamCheckResult.isSpam) {
        return {
            success: false,
            code: spamCheckResult.code,
            message: spamCheckResult.message
        };
    }

    // 2. Validate dữ liệu đầu vào
    const leadName = (fullName || name || "").trim();
    if (!leadName || leadName.length < 2) {
        return {
            success: false,
            code: "INVALID_NAME",
            message: "Vui lòng nhập họ và tên hợp lệ (tối thiểu 2 ký tự)."
        };
    }

    if (leadName.length > 100) {
        return {
            success: false,
            code: "NAME_TOO_LONG",
            message: "Họ và tên không được vượt quá 100 ký tự."
        };
    }

    const leadPhone = (phone || "").trim();
    if (!leadPhone) {
        return {
            success: false,
            code: "MISSING_PHONE",
            message: "Vui lòng cung cấp số điện thoại liên hệ để nhận tư vấn."
        };
    }

    if (!isValidPhone(leadPhone)) {
        return {
            success: false,
            code: "INVALID_PHONE",
            message: "Số điện thoại không đúng định dạng. Vui lòng nhập số điện thoại Việt Nam hợp lệ (ví dụ: 0912345678)."
        };
    }

    const leadEmail = (email || "").trim().toLowerCase();
    if (!leadEmail) {
        return {
            success: false,
            code: "MISSING_EMAIL",
            message: "Vui lòng cung cấp địa chỉ email để nhận thông tin chi tiết chương trình đào tạo."
        };
    }

    if (!isValidEmail(leadEmail)) {
        return {
            success: false,
            code: "INVALID_EMAIL",
            message: "Địa chỉ email không đúng định dạng. Vui lòng kiểm tra lại (ví dụ: yourname@gmail.com)."
        };
    }

    const leadCourse = (course || leadData.program || "").trim() || "Chưa chọn khóa học cụ thể";
    const leadNotes = (notes || message || "").trim();
    const leadSource = (leadData.source || "").trim() || "Website (Biểu mẫu công khai)";
    const leadInitialStatus = (leadData.status || "").trim() || "Mới";

    // KN-74: Cảnh báo khi số điện thoại trùng với lead đã có
    const dupCheck = checkDuplicatePhone(leadPhone);
    const isDuplicatePhone = dupCheck.isDuplicate;
    const duplicateWarning = dupCheck.isDuplicate ? dupCheck.message : null;
    const duplicateLead = dupCheck.duplicateLead ? {
        id: dupCheck.duplicateLead.id,
        code: dupCheck.duplicateLead.code,
        fullName: dupCheck.duplicateLead.fullName || dupCheck.duplicateLead.name,
        phone: dupCheck.duplicateLead.phone,
        status: dupCheck.duplicateLead.status
    } : null;

    // 3. Khởi tạo đối tượng Lead với trạng thái "Mới" (hoặc trạng thái chỉ định)
    const nowIso = new Date().toISOString();
    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    const leadCode = `LD-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, "0")}-${randomSuffix}`;
    const leadId = `lead_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // Thông điệp cảm ơn và cam kết thời gian liên hệ lại chuẩn
    const thankYouMessage = "Cảm ơn bạn đã quan tâm và gửi yêu cầu tư vấn khóa học tại Hệ Thống Đào Tạo TMS!";
    const contactCommitment = "Chúng tôi cam kết sẽ liên hệ lại với bạn trong vòng 24 giờ làm việc (sớm nhất trong 30-60 phút vào giờ hành chính) để tư vấn chi tiết lộ trình học tập và học phí ưu đãi.";

    const newLead = {
        id: leadId,
        code: leadCode,
        fullName: leadName,
        name: leadName, // alias cho tương thích
        phone: leadPhone,
        email: leadEmail,
        course: leadCourse,
        program: leadCourse, // alias
        notes: leadNotes,
        message: leadNotes, // alias
        status: leadInitialStatus,
        statusCode: leadInitialStatus === "Mới" ? "NEW" : leadInitialStatus.toUpperCase(),
        source: leadSource,
        ip: ip,
        createdAt: nowIso,
        updatedAt: nowIso,
        assignedTo: leadData.assignedTo || null,
        counselorNotes: leadData.counselorNotes || "",
        thankYouMessage: thankYouMessage,
        contactCommitment: contactCommitment,
        isDuplicatePhone: isDuplicatePhone,
        duplicateWarning: duplicateWarning
    };

    // Đưa lead mới lên đầu danh sách (LIFO để tuyển sinh thấy ngay)
    leads.unshift(newLead);

    return {
        success: true,
        code: "LEAD_CREATED",
        message: duplicateWarning ? `Tạo lead thành công (${duplicateWarning})` : "Đăng ký tư vấn thành công!",
        thankYouMessage: thankYouMessage,
        contactCommitment: contactCommitment,
        commitment: contactCommitment,
        isDuplicatePhone: isDuplicatePhone,
        duplicateWarning: duplicateWarning,
        duplicateLead: duplicateLead,
        lead: newLead
    };
}

/**
 * Lấy danh sách Lead có phân trang, lọc theo trạng thái và tìm kiếm (Dành cho Cán bộ Tuyển sinh & Quản trị)
 */
function getLeads(options = {}) {
    const {
        page = 1,
        limit = 20,
        status = "",
        course = "",
        search = ""
    } = options;

    let filtered = [...leads];

    // Lọc theo trạng thái (vd: "Mới", "Đang tư vấn", "Đã ghi danh", "Hủy")
    if (status && status.trim() !== "") {
        const s = status.trim().toLowerCase();
        filtered = filtered.filter(l => (l.status && l.status.toLowerCase() === s) || (l.statusCode && l.statusCode.toLowerCase() === s));
    }

    // Lọc theo khóa học
    if (course && course.trim() !== "") {
        const c = course.trim().toLowerCase();
        filtered = filtered.filter(l => l.course && l.course.toLowerCase().includes(c));
    }

    // Tìm kiếm theo tên, sđt, email, mã hồ sơ
    if (search && search.trim() !== "") {
        const q = search.trim().toLowerCase();
        filtered = filtered.filter(l =>
            (l.fullName && l.fullName.toLowerCase().includes(q)) ||
            (l.phone && l.phone.includes(q)) ||
            (l.email && l.email.toLowerCase().includes(q)) ||
            (l.code && l.code.toLowerCase().includes(q))
        );
    }

    // Phân trang
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 20);
    const total = filtered.length;
    const totalPages = Math.ceil(total / limitNum) || 1;
    const startIndex = (pageNum - 1) * limitNum;
    const paginatedLeads = filtered.slice(startIndex, startIndex + limitNum);

    return {
        success: true,
        data: paginatedLeads,
        pagination: {
            page: pageNum,
            limit: limitNum,
            total: total,
            totalPages: totalPages
        }
    };
}

/**
 * Lấy chi tiết một Lead theo ID
 */
function getLeadById(id) {
    if (!id) return null;
    return leads.find(l => l.id === id || l.code === id) || null;
}

/**
 * Cập nhật trạng thái Lead (vd: chuyển từ "Mới" sang "Đang tư vấn", "Đã ghi danh", "Hủy")
 */
function updateLeadStatus(id, newStatus, meta = {}) {
    const lead = getLeadById(id);
    if (!lead) {
        return {
            success: false,
            code: "LEAD_NOT_FOUND",
            message: "Không tìm thấy hồ sơ Lead trong hệ thống."
        };
    }

    const validStatuses = ["Mới", "Đang tư vấn", "Đã ghi danh", "Không liên lạc được", "Hủy"];
    if (!validStatuses.includes(newStatus)) {
        return {
            success: false,
            code: "INVALID_STATUS",
            message: `Trạng thái không hợp lệ. Các trạng thái hợp lệ: ${validStatuses.join(", ")}`
        };
    }

    lead.status = newStatus;
    lead.updatedAt = new Date().toISOString();
    if (meta.counselorNotes !== undefined) {
        lead.counselorNotes = meta.counselorNotes;
    }
    if (meta.assignedTo !== undefined) {
        lead.assignedTo = meta.assignedTo;
    }

    return {
        success: true,
        message: `Đã cập nhật trạng thái hồ sơ sang "${newStatus}".`,
        lead: lead
    };
}

/**
 * KN-74: Cập nhật thông tin chi tiết Lead (Họ tên, SĐT, Email, Nguồn, Chương trình quan tâm, Ghi chú, Trạng thái)
 * Cảnh báo khi số điện thoại trùng với lead đã có trong hệ thống
 */
function updateLead(id, updateData = {}, user = null) {
    const lead = getLeadById(id);
    if (!lead) {
        return {
            success: false,
            code: "LEAD_NOT_FOUND",
            message: "Không tìm thấy hồ sơ Lead trong hệ thống."
        };
    }

    // Họ tên
    if (updateData.fullName !== undefined || updateData.name !== undefined) {
        const newName = (updateData.fullName || updateData.name || "").trim();
        if (!newName || newName.length < 2) {
            return {
                success: false,
                code: "INVALID_NAME",
                message: "Vui lòng nhập họ và tên hợp lệ (tối thiểu 2 ký tự)."
            };
        }
        lead.fullName = newName;
        lead.name = newName;
    }

    // Số điện thoại & Cảnh báo trùng lặp
    let duplicateWarning = null;
    let isDuplicatePhone = false;
    let duplicateLead = null;

    if (updateData.phone !== undefined) {
        const newPhone = String(updateData.phone).trim();
        if (!newPhone) {
            return {
                success: false,
                code: "MISSING_PHONE",
                message: "Vui lòng cung cấp số điện thoại liên hệ."
            };
        }
        if (!isValidPhone(newPhone)) {
            return {
                success: false,
                code: "INVALID_PHONE",
                message: "Số điện thoại không đúng định dạng. Vui lòng nhập số điện thoại Việt Nam hợp lệ."
            };
        }

        const dupCheck = checkDuplicatePhone(newPhone, lead.id);
        if (dupCheck.isDuplicate) {
            isDuplicatePhone = true;
            duplicateLead = {
                id: dupCheck.duplicateLead.id,
                code: dupCheck.duplicateLead.code,
                fullName: dupCheck.duplicateLead.fullName || dupCheck.duplicateLead.name,
                phone: dupCheck.duplicateLead.phone,
                status: dupCheck.duplicateLead.status
            };
            duplicateWarning = `Cảnh báo: Số điện thoại ${newPhone} đã trùng với khách hàng "${duplicateLead.fullName}" (Mã: ${duplicateLead.code}, Trạng thái: ${duplicateLead.status}).`;
        }

        lead.phone = newPhone;
    }

    // Email
    if (updateData.email !== undefined) {
        const newEmail = String(updateData.email).trim().toLowerCase();
        if (!newEmail) {
            return {
                success: false,
                code: "MISSING_EMAIL",
                message: "Vui lòng cung cấp địa chỉ email."
            };
        }
        if (!isValidEmail(newEmail)) {
            return {
                success: false,
                code: "INVALID_EMAIL",
                message: "Địa chỉ email không đúng định dạng."
            };
        }
        lead.email = newEmail;
    }

    // Nguồn khách hàng (Source)
    if (updateData.source !== undefined) {
        lead.source = String(updateData.source).trim() || lead.source;
    }

    // Chương trình / Khóa học quan tâm
    if (updateData.course !== undefined || updateData.program !== undefined) {
        const newCourse = String(updateData.course || updateData.program || "").trim();
        if (newCourse) {
            lead.course = newCourse;
            lead.program = newCourse;
        }
    }

    // Ghi chú
    if (updateData.notes !== undefined || updateData.message !== undefined) {
        lead.notes = String(updateData.notes || updateData.message || "").trim();
        lead.message = lead.notes;
    }

    // Ghi chú của tư vấn viên
    if (updateData.counselorNotes !== undefined) {
        lead.counselorNotes = String(updateData.counselorNotes || "").trim();
    }

    // Phân công tư vấn viên
    if (updateData.assignedTo !== undefined) {
        lead.assignedTo = updateData.assignedTo;
    }

    // Trạng thái hồ sơ
    if (updateData.status !== undefined) {
        const validStatuses = ["Mới", "Đang tư vấn", "Đã ghi danh", "Không liên lạc được", "Hủy"];
        if (!validStatuses.includes(updateData.status)) {
            return {
                success: false,
                code: "INVALID_STATUS",
                message: `Trạng thái không hợp lệ. Các trạng thái hợp lệ: ${validStatuses.join(", ")}`
            };
        }
        lead.status = updateData.status;
    }

    lead.updatedAt = new Date().toISOString();
    lead.isDuplicatePhone = isDuplicatePhone;
    lead.duplicateWarning = duplicateWarning;

    return {
        success: true,
        message: duplicateWarning ? `Cập nhật lead thành công (${duplicateWarning})` : "Cập nhật thông tin khách hàng tiềm năng thành công.",
        lead: lead,
        isDuplicatePhone: isDuplicatePhone,
        duplicateWarning: duplicateWarning,
        duplicateLead: duplicateLead
    };
}

/**
 * Xóa một Lead (Dành cho Quản lý đào tạo và Quản trị viên)
 */
function deleteLead(id) {
    const index = leads.findIndex(l => l.id === id || l.code === id);
    if (index === -1) {
        return {
            success: false,
            code: "LEAD_NOT_FOUND",
            message: "Không tìm thấy hồ sơ Lead cần xóa."
        };
    }

    const deleted = leads.splice(index, 1)[0];
    return {
        success: true,
        message: "Đã xóa hồ sơ Lead thành công.",
        lead: deleted
    };
}

/**
 * Thống kê tổng hợp số lượng Lead theo trạng thái
 */
function getLeadStats() {
    const total = leads.length;
    const newCount = leads.filter(l => l.status === "Mới").length;
    const consultingCount = leads.filter(l => l.status === "Đang tư vấn").length;
    const enrolledCount = leads.filter(l => l.status === "Đã ghi danh").length;
    const cancelledCount = leads.filter(l => l.status === "Hủy" || l.status === "Không liên lạc được").length;

    return {
        total,
        new: newCount,
        consulting: consultingCount,
        enrolled: enrolledCount,
        cancelled: cancelledCount
    };
}

/**
 * Đặt lại dữ liệu Lead về ban đầu (Dùng cho kiểm thử)
 */
function resetLeadsForTesting() {
    ipSubmissionTimestamps.clear();
    recentSubmissionsByKey.clear();
    antiSpamTokens.clear();
    leads = [
        {
            id: "lead_init_001",
            code: "LD-202610-001",
            fullName: "Trần Minh Quân",
            name: "Trần Minh Quân",
            phone: "0912345678",
            email: "minhquan.tran@gmail.com",
            course: "Lập trình Web Fullstack (NodeJS & React)",
            notes: "Em muốn đăng ký lớp học buổi tối trong tuần để vừa học vừa đi làm.",
            status: "Mới",
            source: "Website (Biểu mẫu công khai)",
            ip: "127.0.0.1",
            createdAt: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
            updatedAt: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
            assignedTo: null,
            counselorNotes: "",
            contactCommitment: "Cam kết liên hệ lại trong vòng 24 giờ làm việc",
            thankYouMessage: "Cảm ơn bạn đã quan tâm và đăng ký tư vấn tại Hệ Thống Đào Tạo TMS!"
        }
    ];
}

module.exports = {
    leads,
    createLead,
    updateLead,
    getLeads,
    getLeadById,
    updateLeadStatus,
    deleteLead,
    getLeadStats,
    generateAntiSpamChallenge,
    verifyAntiSpamChallenge,
    checkSpam,
    isValidPhone,
    isValidEmail,
    normalizePhone,
    checkDuplicatePhone,
    resetLeadsForTesting
};
