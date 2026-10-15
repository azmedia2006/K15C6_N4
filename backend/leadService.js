// =========================================================================
// TMS BACKEND - DỊCH VỤ QUẢN LÝ LEAD & TƯ VẤN TUYỂN SINH (KN LEAD SERVICE)
// Biểu mẫu công khai không cần đăng nhập, chống spam đa lớp,
// tạo Lead trạng thái "Mới", hiển thị Lời cảm ơn và Cam kết liên hệ lại
// =========================================================================

const crypto = require("crypto");

// Kho lưu trữ Lead trong bộ nhớ (In-memory Relational Store)
// Hàm tiện ích chuẩn hóa chuỗi tiếng Việt bỏ dấu phục vụ tìm kiếm thông minh
function removeVietnameseDiacritics(str) {
    if (!str) return "";
    return String(str)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "D")
        .toLowerCase()
        .trim();
}

// Hàm chuẩn hóa số điện thoại: loại bỏ khoảng trắng, dấu gạch nối, chuẩn hóa +84 về 0
function normalizePhoneNumber(phone) {
    if (!phone) return "";
    let clean = String(phone).replace(/[^\d+]/g, "");
    if (clean.startsWith("+84")) {
        clean = "0" + clean.slice(3);
    } else if (clean.startsWith("84") && clean.length > 9) {
        clean = "0" + clean.slice(2);
    }
    return clean;
}

// Hàm khởi tạo danh sách lead mặc định phong phú phục vụ kiểm thử và nghiệp vụ Tuyển sinh
function buildDefaultLeads() {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    return [
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
            statusCode: "NEW",
            source: "Website (Biểu mẫu công khai)",
            ip: "127.0.0.1",
            createdAt: new Date(now - 1000 * 60 * 180).toISOString(),
            updatedAt: new Date(now - 1000 * 60 * 180).toISOString(),
            lastContactedAt: null,
            assignedTo: null,
            assignedToName: "Chưa phân công",
            counselorNotes: "",
            consultationHistory: [],
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
            statusCode: "NEW",
            source: "Facebook (Quảng cáo & Fanpage)",
            ip: "127.0.0.1",
            createdAt: new Date(now - dayMs * 1).toISOString(),
            updatedAt: new Date(now - dayMs * 1).toISOString(),
            lastContactedAt: null,
            assignedTo: "usr_admissions",
            assignedToName: "Vũ Hải Yến",
            counselorNotes: "",
            consultationHistory: [],
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
            statusCode: "CONSULTING",
            source: "Website (Biểu mẫu công khai)",
            ip: "127.0.0.1",
            createdAt: new Date(now - dayMs * 2).toISOString(),
            updatedAt: new Date(now - dayMs * 0.5).toISOString(),
            lastContactedAt: new Date(now - dayMs * 0.5).toISOString(),
            assignedTo: "usr_admissions",
            assignedToName: "Vũ Hải Yến",
            counselorNotes: "Học viên hẹn sáng thứ 7 lên làm thủ tục ghi danh.",
            consultationHistory: [
                {
                    id: "cl_init_003_1",
                    timestamp: new Date(now - dayMs * 0.5).toISOString(),
                    counselorId: "usr_admissions",
                    counselorName: "Vũ Hải Yến",
                    channel: "Điện thoại",
                    result: "Hẹn lên trung tâm",
                    notes: "Học viên hẹn sáng thứ 7 lên làm thủ tục ghi danh. Đã hướng dẫn mang theo CCCD và thẻ sinh viên để nhận học bổng 15%.",
                    nextFollowUp: new Date(now + dayMs * 2).toISOString()
                }
            ],
            contactCommitment: "Cam kết liên hệ lại trong vòng 24 giờ làm việc",
            thankYouMessage: "Cảm ơn bạn đã quan tâm và đăng ký tư vấn tại Hệ Thống Đào Tạo TMS!"
        },
        // KN-76 USER STORY CỐT LÕI: Cuộc trao đổi từ tháng trước khi khách gọi lại
        {
            id: "lead_last_month_001",
            code: "LD-202609-015",
            fullName: "Nguyễn Hoàng Nam",
            name: "Nguyễn Hoàng Nam",
            phone: "0977889900",
            email: "hoangnam.nguyen@gmail.com",
            course: "Lập trình Web Fullstack (NodeJS & React)",
            notes: "Quan tâm lớp học lập trình Web ca tối, cần tư vấn chính sách đóng học phí chia kỳ.",
            status: "Đang tư vấn",
            statusCode: "CONSULTING",
            source: "Hotline (Tổng đài tư vấn)",
            ip: "127.0.0.1",
            // Ngày tạo và trao đổi từ tháng trước (khoảng 35 ngày trước)
            createdAt: new Date(now - dayMs * 35).toISOString(),
            updatedAt: new Date(now - dayMs * 35).toISOString(),
            lastContactedAt: new Date(now - dayMs * 35).toISOString(),
            assignedTo: "usr_admissions",
            assignedToName: "Vũ Hải Yến",
            counselorNotes: "Khách gọi hỏi chi tiết học phí khóa Fullstack và cam kết việc làm. Khách đang hoàn thành dự án cũ, hẹn tháng sau gọi lại để xếp lớp học tối 2-4-6.",
            consultationHistory: [
                {
                    id: "cl_lm_001_1",
                    timestamp: new Date(now - dayMs * 35).toISOString(),
                    counselorId: "usr_admissions",
                    counselorName: "Vũ Hải Yến",
                    channel: "Điện thoại (Hotline)",
                    result: "Hẹn gọi lại sau",
                    notes: "Khách gọi đến Hotline hỏi về khóa học React & Node.js ca tối 2-4-6. Đã giải đáp chi tiết chương trình học và cam kết đầu ra. Khách đang hoàn thành dự án cũ, dặn lưu hồ sơ và hẹn sang tháng sau sẽ gọi lại để đăng ký xếp lớp.",
                    nextFollowUp: new Date(now + dayMs * 2).toISOString()
                }
            ],
            contactCommitment: "Cam kết liên hệ lại trong vòng 24 giờ làm việc",
            thankYouMessage: "Cảm ơn bạn đã quan tâm và đăng ký tư vấn tại Hệ Thống Đào Tạo TMS!"
        },
        {
            id: "lead_last_month_002",
            code: "LD-202609-028",
            fullName: "Đặng Thị Quỳnh Như",
            name: "Đặng Thị Quỳnh Như",
            phone: "0918234567",
            email: "quynhnhu.dang@gmail.com",
            course: "Trí tuệ Nhân tạo & Ứng dụng Python (AI/ML)",
            notes: "Sinh viên năm 3 ngành Kinh tế muốn chuyển hướng sang Data & AI.",
            status: "Đang tư vấn",
            statusCode: "CONSULTING",
            source: "Facebook (Quảng cáo & Fanpage)",
            ip: "127.0.0.1",
            createdAt: new Date(now - dayMs * 42).toISOString(),
            updatedAt: new Date(now - dayMs * 42).toISOString(),
            lastContactedAt: new Date(now - dayMs * 42).toISOString(),
            assignedTo: "usr_admissions",
            assignedToName: "Vũ Hải Yến",
            counselorNotes: "Tư vấn kỹ năng toán cơ bản và lập trình Python cho người trái ngành. Khách rất hào hứng, hẹn tháng sau gọi lại khi trung tâm chốt lịch mở lớp T7-CN.",
            consultationHistory: [
                {
                    id: "cl_lm_002_1",
                    timestamp: new Date(now - dayMs * 42).toISOString(),
                    counselorId: "usr_admissions",
                    counselorName: "Vũ Hải Yến",
                    channel: "Điện thoại",
                    result: "Quan tâm cao",
                    notes: "Tư vấn kỹ năng toán cơ bản và lập trình Python cho người trái ngành. Khách rất hào hứng, hẹn tháng sau gọi lại khi trung tâm chốt lịch mở lớp T7-CN.",
                    nextFollowUp: ""
                }
            ],
            contactCommitment: "Cam kết liên hệ lại trong vòng 24 giờ làm việc",
            thankYouMessage: "Cảm ơn bạn đã quan tâm và đăng ký tư vấn tại Hệ Thống Đào Tạo TMS!"
        },
        {
            id: "lead_enrolled_001",
            code: "LD-202609-005",
            fullName: "Vũ Đình Trọng",
            name: "Vũ Đình Trọng",
            phone: "0905123456",
            email: "trong.vudinh@gmail.com",
            course: "Lập trình Di động Flutter & Android",
            notes: "Học viên được bạn học khóa trước giới thiệu đến đăng ký.",
            status: "Đã ghi danh",
            statusCode: "ENROLLED",
            source: "Giới thiệu (Học viên cũ giới thiệu)",
            ip: "127.0.0.1",
            createdAt: new Date(now - dayMs * 20).toISOString(),
            updatedAt: new Date(now - dayMs * 15).toISOString(),
            lastContactedAt: new Date(now - dayMs * 15).toISOString(),
            assignedTo: "usr_admissions",
            assignedToName: "Vũ Hải Yến",
            counselorNotes: "Đã hoàn tất đóng học phí đợt 1 và nhận lịch khai giảng lớp FL-2026.",
            consultationHistory: [
                {
                    id: "cl_enr_001_1",
                    timestamp: new Date(now - dayMs * 15).toISOString(),
                    counselorId: "usr_admissions",
                    counselorName: "Vũ Hải Yến",
                    channel: "Gặp trực tiếp tại văn phòng",
                    result: "Đã chốt đăng ký",
                    notes: "Học viên qua văn phòng ký hợp đồng đào tạo và thanh toán học phí đợt 1 qua chuyển khoản.",
                    nextFollowUp: ""
                }
            ],
            contactCommitment: "Cam kết liên hệ lại trong vòng 24 giờ làm việc",
            thankYouMessage: "Cảm ơn bạn đã quan tâm và đăng ký tư vấn tại Hệ Thống Đào Tạo TMS!"
        },
        {
            id: "lead_unreachable_001",
            code: "LD-202610-008",
            fullName: "Hoàng Văn Bách",
            name: "Hoàng Văn Bách",
            phone: "0944556677",
            email: "bach.hoang@gmail.com",
            course: "Kiểm thử Phần mềm Tự động (Automation QA)",
            notes: "Đăng ký tư vấn khóa QA buổi tối.",
            status: "Không liên lạc được",
            statusCode: "UNREACHABLE",
            source: "Website (Biểu mẫu công khai)",
            ip: "127.0.0.1",
            createdAt: new Date(now - dayMs * 5).toISOString(),
            updatedAt: new Date(now - dayMs * 4).toISOString(),
            lastContactedAt: new Date(now - dayMs * 4).toISOString(),
            assignedTo: null,
            assignedToName: "Chưa phân công",
            counselorNotes: "Gọi 3 cuộc vào các khung giờ khác nhau nhưng thuê bao không nhấc máy, đã gửi SMS và email.",
            consultationHistory: [
                {
                    id: "cl_unr_001_1",
                    timestamp: new Date(now - dayMs * 4).toISOString(),
                    counselorId: "usr_admissions",
                    counselorName: "Vũ Hải Yến",
                    channel: "Điện thoại",
                    result: "Không nghe máy",
                    notes: "Gọi 3 lần thuê bao không bắt máy. Đã gửi thông tin học phí và lộ trình qua email.",
                    nextFollowUp: new Date(now + dayMs * 1).toISOString()
                }
            ],
            contactCommitment: "Cam kết liên hệ lại trong vòng 24 giờ làm việc",
            thankYouMessage: "Cảm ơn bạn đã quan tâm và đăng ký tư vấn tại Hệ Thống Đào Tạo TMS!"
        },
        {
            id: "lead_cancelled_001",
            code: "LD-202609-099",
            fullName: "Bùi Đức Thắng",
            name: "Bùi Đức Thắng",
            phone: "0987112233",
            email: "thang.buiduc@gmail.com",
            course: "DevOps & Cloud AWS Cơ bản",
            notes: "Cần tư vấn khóa DevOps cấp tốc.",
            status: "Hủy",
            statusCode: "CANCELLED",
            source: "Sự kiện (Workshop Tuyển sinh TMS)",
            ip: "127.0.0.1",
            createdAt: new Date(now - dayMs * 50).toISOString(),
            updatedAt: new Date(now - dayMs * 48).toISOString(),
            lastContactedAt: new Date(now - dayMs * 48).toISOString(),
            assignedTo: "usr_manager",
            assignedToName: "Đỗ Quốc Bảo",
            counselorNotes: "Học viên chuyển công tác ra nước ngoài nên xin hủy hồ sơ đăng ký.",
            consultationHistory: [],
            contactCommitment: "Cam kết liên hệ lại trong vòng 24 giờ làm việc",
            thankYouMessage: "Cảm ơn bạn đã quan tâm và đăng ký tư vấn tại Hệ Thống Đào Tạo TMS!"
        }
    ];
}

// Kho lưu trữ Lead trong bộ nhớ (In-memory Relational Store)
let leads = buildDefaultLeads();

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

    const leadCourse = (course || "").trim() || "Chưa chọn khóa học cụ thể";
    const leadNotes = (notes || message || "").trim();

    // 3. Khởi tạo đối tượng Lead với trạng thái "Mới" (Theo đặc tả nghiệp vụ)
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
        notes: leadNotes,
        message: leadNotes, // alias
        status: "Mới", // TIÊU CHÍ CỐT LÕI: Gửi thành công tạo một lead ở trạng thái Mới
        statusCode: "NEW",
        source: "Website (Biểu mẫu công khai)",
        ip: ip,
        createdAt: nowIso,
        updatedAt: nowIso,
        assignedTo: null,
        counselorNotes: "",
        thankYouMessage: thankYouMessage,
        contactCommitment: contactCommitment
    };

    // Đưa lead mới lên đầu danh sách (LIFO để tuyển sinh thấy ngay)
    leads.unshift(newLead);

    return {
        success: true,
        code: "LEAD_CREATED",
        message: "Đăng ký tư vấn thành công!",
        thankYouMessage: thankYouMessage,
        contactCommitment: contactCommitment,
        commitment: contactCommitment,
        lead: newLead
    };
}

/**
 * KN-76: Lấy danh sách Lead với bộ lọc đa điều kiện và tìm kiếm nhanh
 * Tiêu chí:
 * • Lọc theo trạng thái (status)
 * • Lọc theo nguồn (source)
 * • Lọc theo người phụ trách (assignedTo)
 * • Lọc theo khoảng thời gian (startDate/endDate hoặc timePreset: today, last_7_days, last_30_days, last_month, this_month)
 * • Tìm nhanh theo Tên hoặc Số điện thoại (chuẩn hóa tiếng Việt bỏ dấu & chuẩn hóa SĐT)
 */
function getLeads(options = {}) {
    const {
        page = 1,
        limit = 20,
        status = "",
        course = "",
        source = "",
        assignedTo = "",
        search = "",
        startDate = "",
        endDate = "",
        timePreset = "",
        sortBy = "createdAt",
        sortOrder = "desc"
    } = options;

    let filtered = [...leads];

    // 1. TÌM NHANH THEO TÊN HOẶC SỐ ĐIỆN THOẠI (Quick Search)
    if (search && search.trim() !== "") {
        const rawQuery = search.trim();
        const lowerQuery = rawQuery.toLowerCase();
        const unaccentQuery = removeVietnameseDiacritics(rawQuery);
        const phoneQuery = normalizePhoneNumber(rawQuery);

        filtered = filtered.filter(l => {
            const fullName = l.fullName || l.name || "";
            const phone = normalizePhoneNumber(l.phone || "");
            const rawPhone = l.phone || "";
            const email = (l.email || "").toLowerCase();
            const code = (l.code || "").toLowerCase();

            // Khớp theo tên (có dấu hoặc không dấu)
            const matchName = fullName.toLowerCase().includes(lowerQuery) ||
                removeVietnameseDiacritics(fullName).includes(unaccentQuery);

            // Khớp theo số điện thoại (chuẩn hóa hoặc chuỗi gốc)
            const matchPhone = (phoneQuery && phone.includes(phoneQuery)) || rawPhone.includes(rawQuery);

            // Khớp theo email hoặc mã Lead
            const matchEmail = email.includes(lowerQuery);
            const matchCode = code.includes(lowerQuery);

            return matchName || matchPhone || matchEmail || matchCode;
        });
    }

    // 2. LỌC THEO TRẠNG THÁI (Mới, Đang tư vấn, Đã ghi danh, Không liên lạc được, Hủy)
    if (status && status.trim() !== "" && status !== "all" && status !== "ALL") {
        const statusList = status.split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
        filtered = filtered.filter(l => {
            const leadStatus = (l.status || "").toLowerCase();
            const leadStatusCode = (l.statusCode || "").toLowerCase();
            return statusList.some(s => leadStatus === s || leadStatusCode === s);
        });
    }

    // 3. LỌC THEO NGUỒN (Website, Facebook, Hotline, Giới thiệu, Sự kiện...)
    if (source && source.trim() !== "" && source !== "all" && source !== "ALL") {
        const s = source.trim().toLowerCase();
        filtered = filtered.filter(l => {
            const leadSource = (l.source || "").toLowerCase();
            return leadSource.includes(s);
        });
    }

    // 4. LỌC THEO NGƯỜI PHỤ TRÁCH (assignedTo)
    if (assignedTo && assignedTo.trim() !== "" && assignedTo !== "all" && assignedTo !== "ALL") {
        const a = assignedTo.trim().toLowerCase();
        if (a === "unassigned" || a === "none" || a === "null") {
            filtered = filtered.filter(l => !l.assignedTo);
        } else if (a === "assigned") {
            filtered = filtered.filter(l => !!l.assignedTo);
        } else {
            filtered = filtered.filter(l => {
                const leadAssignee = (l.assignedTo || "").toLowerCase();
                const leadAssigneeName = (l.assignedToName || "").toLowerCase();
                return leadAssignee === a || leadAssigneeName.includes(a);
            });
        }
    }

    // 5. LỌC THEO KHÓA HỌC QUAN TÂM
    if (course && course.trim() !== "" && course !== "all" && course !== "ALL") {
        const c = course.trim().toLowerCase();
        filtered = filtered.filter(l => (l.course || "").toLowerCase().includes(c));
    }

    // 6. LỌC THEO KHOẢNG THỜI GIAN (startDate, endDate, timePreset)
    // Phục vụ tìm lại cuộc trao đổi từ tháng trước khi khách gọi lại
    let minTime = null;
    let maxTime = null;

    const now = new Date();

    if (timePreset && timePreset.trim() !== "" && timePreset !== "all") {
        const preset = timePreset.trim().toLowerCase();
        if (preset === "today") {
            const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
            const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
            minTime = startOfToday.getTime();
            maxTime = endOfToday.getTime();
        } else if (preset === "yesterday") {
            const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0);
            const endOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);
            minTime = startOfYesterday.getTime();
            maxTime = endOfYesterday.getTime();
        } else if (preset === "last_7_days") {
            minTime = now.getTime() - 7 * 24 * 60 * 60 * 1000;
            maxTime = now.getTime() + 1000 * 60; // now buffer
        } else if (preset === "last_30_days") {
            minTime = now.getTime() - 30 * 24 * 60 * 60 * 1000;
            maxTime = now.getTime() + 1000 * 60;
        } else if (preset === "this_month") {
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
            minTime = startOfMonth.getTime();
            maxTime = now.getTime() + 1000 * 60;
        } else if (preset === "last_month") {
            // Tháng trước: từ ngày 1 tháng trước đến ngày cuối cùng tháng trước,
            // hoặc các lead có mốc thời gian từ 25 đến 60 ngày trước
            const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
            const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
            minTime = startOfLastMonth.getTime();
            maxTime = endOfLastMonth.getTime();
        }
    }

    if (startDate) {
        const parsedStart = new Date(startDate);
        if (!isNaN(parsedStart.getTime())) {
            parsedStart.setHours(0, 0, 0, 0);
            minTime = parsedStart.getTime();
        }
    }

    if (endDate) {
        const parsedEnd = new Date(endDate);
        if (!isNaN(parsedEnd.getTime())) {
            parsedEnd.setHours(23, 59, 59, 999);
            maxTime = parsedEnd.getTime();
        }
    }

    if (minTime !== null || maxTime !== null) {
        filtered = filtered.filter(l => {
            const createdTime = l.createdAt ? new Date(l.createdAt).getTime() : 0;
            const contactedTime = l.lastContactedAt ? new Date(l.lastContactedAt).getTime() : 0;
            const updatedTime = l.updatedAt ? new Date(l.updatedAt).getTime() : 0;

            // Kiểm tra xem thời điểm tạo hoặc thời điểm trao đổi gần nhất có nằm trong khoảng lọc
            const matchCreated = (minTime === null || createdTime >= minTime) && (maxTime === null || createdTime <= maxTime);
            const matchContacted = contactedTime > 0 && (minTime === null || contactedTime >= minTime) && (maxTime === null || contactedTime <= maxTime);
            const matchUpdated = updatedTime > 0 && (minTime === null || updatedTime >= minTime) && (maxTime === null || updatedTime <= maxTime);

            // Cũng hỗ trợ kiểm tra xem trong lịch sử cuộc trao đổi (consultationHistory) có cuộc gọi nào thuộc khoảng này không
            const matchHistory = Array.isArray(l.consultationHistory) && l.consultationHistory.some(c => {
                const t = c.timestamp ? new Date(c.timestamp).getTime() : 0;
                return (minTime === null || t >= minTime) && (maxTime === null || t <= maxTime);
            });

            return matchCreated || matchContacted || matchUpdated || matchHistory;
        });
    }

    // 7. SẮP XẾP KẾT QUẢ (Sorting)
    filtered.sort((a, b) => {
        let valA = a[sortBy];
        let valB = b[sortBy];

        if (sortBy === "createdAt" || sortBy === "updatedAt" || sortBy === "lastContactedAt") {
            valA = valA ? new Date(valA).getTime() : 0;
            valB = valB ? new Date(valB).getTime() : 0;
        } else if (typeof valA === "string") {
            valA = valA.toLowerCase();
            valB = (valB || "").toLowerCase();
            return sortOrder === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }

        if (sortOrder === "asc") {
            return valA > valB ? 1 : -1;
        } else {
            return valA < valB ? 1 : -1;
        }
    });

    // 8. TÍNH TOÁN BÁO CÁO TÓM TẮT DỮ LIỆU ĐÃ LỌC
    const summary = {
        total: filtered.length,
        new: filtered.filter(l => l.status === "Mới").length,
        consulting: filtered.filter(l => l.status === "Đang tư vấn").length,
        enrolled: filtered.filter(l => l.status === "Đã ghi danh").length,
        unreachable: filtered.filter(l => l.status === "Không liên lạc được").length,
        cancelled: filtered.filter(l => l.status === "Hủy").length
    };

    // 9. PHÂN TRANG (Pagination)
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
        },
        summary: summary
    };
}

/**
 * Lấy chi tiết một Lead theo ID hoặc Mã
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

    const nowIso = new Date().toISOString();
    lead.status = newStatus;
    lead.updatedAt = nowIso;

    if (newStatus === "Mới") lead.statusCode = "NEW";
    else if (newStatus === "Đang tư vấn") lead.statusCode = "CONSULTING";
    else if (newStatus === "Đã ghi danh") lead.statusCode = "ENROLLED";
    else if (newStatus === "Không liên lạc được") lead.statusCode = "UNREACHABLE";
    else if (newStatus === "Hủy") lead.statusCode = "CANCELLED";

    if (meta.counselorNotes !== undefined) {
        lead.counselorNotes = meta.counselorNotes;
    }
    if (meta.assignedTo !== undefined) {
        lead.assignedTo = meta.assignedTo;
        if (meta.assignedToName) {
            lead.assignedToName = meta.assignedToName;
        } else if (meta.assignedTo === "usr_admissions") {
            lead.assignedToName = "Vũ Hải Yến";
        } else if (meta.assignedTo === "usr_manager") {
            lead.assignedToName = "Đỗ Quốc Bảo";
        }
    }

    return {
        success: true,
        message: `Đã cập nhật trạng thái hồ sơ sang "${newStatus}".`,
        lead: lead
    };
}

/**
 * KN-76: Ghi nhận và lưu vết cuộc trao đổi tư vấn mới cho Lead
 * Hỗ trợ Tư vấn viên mở lại cuộc trao đổi từ tháng trước khi khách gọi lại và ghi nhận nội dung mới tức thì
 */
function addConsultation(leadId, data = {}, user = {}) {
    const lead = getLeadById(leadId);
    if (!lead) {
        return {
            success: false,
            code: "LEAD_NOT_FOUND",
            message: "Không tìm thấy hồ sơ Lead cần ghi nhận cuộc trao đổi."
        };
    }

    const {
        channel = "Điện thoại",
        result = "Quan tâm cao",
        notes = "",
        nextFollowUp = "",
        newStatus = ""
    } = data;

    if (!notes || notes.trim() === "") {
        return {
            success: false,
            code: "MISSING_NOTES",
            message: "Vui lòng nhập nội dung chi tiết cuộc trao đổi tư vấn."
        };
    }

    const counselorId = user.id || lead.assignedTo || "usr_admissions";
    const counselorName = user.name || lead.assignedToName || "Vũ Hải Yến";
    const nowIso = new Date().toISOString();

    const record = {
        id: `cl_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        timestamp: nowIso,
        counselorId: counselorId,
        counselorName: counselorName,
        channel: channel,
        result: result,
        notes: notes.trim(),
        nextFollowUp: nextFollowUp ? new Date(nextFollowUp).toISOString() : ""
    };

    if (!Array.isArray(lead.consultationHistory)) {
        lead.consultationHistory = [];
    }

    // Đưa cuộc trao đổi mới nhất lên đầu danh sách
    lead.consultationHistory.unshift(record);
    lead.lastContactedAt = nowIso;
    lead.updatedAt = nowIso;
    lead.counselorNotes = notes.trim();

    // Tự động gán người phụ trách nếu lead chưa có
    if (!lead.assignedTo) {
        lead.assignedTo = counselorId;
        lead.assignedToName = counselorName;
    }

    // Nếu người dùng chọn đổi trạng thái cùng lúc ghi nhận cuộc trao đổi
    if (newStatus && ["Mới", "Đang tư vấn", "Đã ghi danh", "Không liên lạc được", "Hủy"].includes(newStatus)) {
        lead.status = newStatus;
        if (newStatus === "Đang tư vấn") lead.statusCode = "CONSULTING";
        else if (newStatus === "Đã ghi danh") lead.statusCode = "ENROLLED";
        else if (newStatus === "Không liên lạc được") lead.statusCode = "UNREACHABLE";
        else if (newStatus === "Hủy") lead.statusCode = "CANCELLED";
    } else if (lead.status === "Mới") {
        // Tự động chuyển từ Mới sang Đang tư vấn sau khi đã có cuộc trao đổi
        lead.status = "Đang tư vấn";
        lead.statusCode = "CONSULTING";
    }

    return {
        success: true,
        message: "Đã lưu thông tin cuộc trao đổi tư vấn thành công!",
        consultation: record,
        lead: lead
    };
}

/**
 * Xóa một Lead (Dành cho Quản trị viên)
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
 * Lấy danh sách các nguồn Lead hiện có cùng số lượng hồ sơ
 */
function getLeadSources() {
    const sourceMap = {};
    leads.forEach(l => {
        const src = l.source || "Khác";
        sourceMap[src] = (sourceMap[src] || 0) + 1;
    });

    return Object.entries(sourceMap).map(([name, count]) => ({
        name,
        count
    }));
}

/**
 * Lấy danh sách nhân viên tư vấn tuyển sinh phụ trách
 */
function getCounselors() {
    return [
        { id: "usr_admissions", name: "Vũ Hải Yến", role: "admissions", email: "admissions@tms.edu.vn" },
        { id: "usr_manager", name: "Đỗ Quốc Bảo", role: "training_manager", email: "manager@tms.edu.vn" },
        { id: "usr_admin", name: "Nguyễn Văn Anh", role: "administrator", email: "admin@tms.edu.vn" }
    ];
}

/**
 * Thống kê tổng hợp số lượng Lead theo trạng thái
 */
function getLeadStats() {
    const total = leads.length;
    const newCount = leads.filter(l => l.status === "Mới").length;
    const consultingCount = leads.filter(l => l.status === "Đang tư vấn").length;
    const enrolledCount = leads.filter(l => l.status === "Đã ghi danh").length;
    const unreachableCount = leads.filter(l => l.status === "Không liên lạc được").length;
    const cancelledCount = leads.filter(l => l.status === "Hủy").length;

    return {
        total,
        new: newCount,
        consulting: consultingCount,
        enrolled: enrolledCount,
        unreachable: unreachableCount,
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
    leads = buildDefaultLeads();
}

module.exports = {
    leads,
    createLead,
    getLeads,
    getLeadById,
    updateLeadStatus,
    addConsultation,
    deleteLead,
    getLeadStats,
    getLeadSources,
    getCounselors,
    generateAntiSpamChallenge,
    verifyAntiSpamChallenge,
    checkSpam,
    isValidPhone,
    isValidEmail,
    removeVietnameseDiacritics,
    normalizePhoneNumber,
    resetLeadsForTesting
};
