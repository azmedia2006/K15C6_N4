/**
 * KN-154: Auto Schedule Generator Service (Sinh Thời khóa biểu Tự động theo Mẫu lặp)
 * 
 * Nghiệp vụ User Story KN-154 (Sprint 4):
 * - Người thực hiện: Minh Quân (training_manager / administrator)
 * - Khai báo mẫu lặp: Các thứ trong tuần, ca học, ngày bắt đầu, số buổi (vd: lớp 60 buổi).
 * - Hệ thống sinh đủ số buổi và TỰ ĐỘNG BỎ QUA ngày nghỉ lễ đã khai báo.
 * - Xem trước (preview) danh sách các buổi học và cho phép tùy chỉnh trước khi lưu.
 * - Mỗi buổi học được gắn với một bài học trong môn (Syllabus Mapping).
 * - Quản lý, lưu trữ, cập nhật thời khóa biểu theo chuẩn TMS.
 */

const { getSubjectById, subjects, classes: initialSubjectClasses } = require("./subjectService");
const { recordAuditLog } = require("./roleService");
const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");
const { users } = require("./authService");
const { userHasRole } = require("./roleService");
const DATA_FILE = process.env.SCHEDULE_DATA_FILE || path.join(__dirname, "data", "schedules-kn156.json");
const clone = value => JSON.parse(JSON.stringify(value));
let sessionHistory = [], notifications = [], attendanceRecords = [];
function fail(message, status = 400, code = "INVALID_SESSION", details) {
    const error = new Error(message); Object.assign(error, { status, code, details }); throw error;
}
function isStaff(user) { return user && (user.role === "instructor" || userHasRole(user.id, "instructor")); }
function normalize(value) { return String(value || "").normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("vi"); }
function findInstructor(session) {
    return users.find(u => isStaff(u) && (session.instructorId ? u.id === session.instructorId : normalize(u.name) === normalize(session.instructor)));
}
function snapshot() { return clone({ holidays, classSchedules, activeClasses, sessionHistory, notifications, attendanceRecords }); }
function restore(data) {
    ({ holidays, classSchedules, activeClasses } = data);
    sessionHistory = data.sessionHistory || []; notifications = data.notifications || []; attendanceRecords = data.attendanceRecords || [];
}
// Single-process demo: synchronous atomic rename commits session + history + inbox together.
function transaction(fn) {
    return (...args) => {
        const before = snapshot();
        try {
            const result = fn(...args);
            require('./localDatabase').commit();
            return clone(result);
        } catch (error) { restore(before); throw error; }
    };
}

// 1. Danh sách Ngày nghỉ Lễ mặc định (Hệ thống TMS & Việt Nam)
const DEFAULT_HOLIDAYS = [
    {
        id: "hol_new_year",
        name: "Tết Dương Lịch",
        date: "2026-01-01",
        recurringMonthDay: "01-01",
        description: "Nghỉ Tết Dương Lịch toàn quốc",
        type: "national"
    },
    {
        id: "hol_tet_2026_01",
        name: "Nghỉ Tết Nguyên Đán (28 Tết)",
        date: "2026-02-15",
        description: "Kỳ nghỉ Tết Âm lịch Bính Ngọ",
        type: "national"
    },
    {
        id: "hol_tet_2026_02",
        name: "Nghỉ Tết Nguyên Đán (29 Tết)",
        date: "2026-02-16",
        description: "Kỳ nghỉ Tết Âm lịch Bính Ngọ",
        type: "national"
    },
    {
        id: "hol_tet_2026_03",
        name: "Nghỉ Tết Nguyên Đán (30 Tết)",
        date: "2026-02-17",
        description: "Kỳ nghỉ Tết Âm lịch Bính Ngọ",
        type: "national"
    },
    {
        id: "hol_tet_2026_04",
        name: "Mùng 1 Tết Nguyên Đán",
        date: "2026-02-18",
        description: "Kỳ nghỉ Tết Âm lịch Bính Ngọ",
        type: "national"
    },
    {
        id: "hol_tet_2026_05",
        name: "Mùng 2 Tết Nguyên Đán",
        date: "2026-02-19",
        description: "Kỳ nghỉ Tết Âm lịch Bính Ngọ",
        type: "national"
    },
    {
        id: "hol_tet_2026_06",
        name: "Mùng 3 Tết Nguyên Đán",
        date: "2026-02-20",
        description: "Kỳ nghỉ Tết Âm lịch Bính Ngọ",
        type: "national"
    },
    {
        id: "hol_tet_2026_07",
        name: "Mùng 4 Tết Nguyên Đán",
        date: "2026-02-21",
        description: "Kỳ nghỉ Tết Âm lịch Bính Ngọ",
        type: "national"
    },
    {
        id: "hol_tet_2026_08",
        name: "Mùng 5 Tết Nguyên Đán",
        date: "2026-02-22",
        description: "Kỳ nghỉ Tết Âm lịch Bính Ngọ",
        type: "national"
    },
    {
        id: "hol_hung_kings",
        name: "Giỗ Tổ Hùng Vương",
        date: "2026-04-26",
        recurringMonthDay: "04-26",
        description: "10/3 Âm lịch Giỗ Tổ Hùng Vương",
        type: "national"
    },
    {
        id: "hol_liberation",
        name: "Ngày Giải phóng Miền Nam",
        date: "2026-04-30",
        recurringMonthDay: "04-30",
        description: "30/4 Ngày Giải phóng Miền Nam",
        type: "national"
    },
    {
        id: "hol_labor_day",
        name: "Ngày Quốc tế Lao Động",
        date: "2026-05-01",
        recurringMonthDay: "05-01",
        description: "01/5 Quốc tế Lao Động",
        type: "national"
    },
    {
        id: "hol_national_day_01",
        name: "Quốc khánh Việt Nam",
        date: "2026-09-02",
        recurringMonthDay: "09-02",
        description: "Quốc khánh nước CHXHCN Việt Nam",
        type: "national"
    },
    {
        id: "hol_national_day_02",
        name: "Nghỉ liền kề Quốc khánh",
        date: "2026-09-03",
        recurringMonthDay: "09-03",
        description: "Kỳ nghỉ Quốc khánh 02/09",
        type: "national"
    },
    {
        id: "hol_teachers_day",
        name: "Ngày Nhà giáo Việt Nam",
        date: "2026-11-20",
        recurringMonthDay: "11-20",
        description: "Tri ân giảng viên, cán bộ giáo dục",
        type: "school"
    }
];

// 2. Danh mục Ca học chuẩn của Hệ thống TMS
const STANDARD_SHIFTS = [
    { id: "morning", name: "Ca Sáng", startTime: "08:00", endTime: "11:30", description: "08:00 - 11:30 (Sáng)" },
    { id: "afternoon", name: "Ca Chiều", startTime: "13:30", endTime: "17:00", description: "13:30 - 17:00 (Chiều)" },
    { id: "evening", name: "Ca Tối", startTime: "18:00", endTime: "21:00", description: "18:00 - 21:00 (Tối)" },
    { id: "custom", name: "Ca Tùy chỉnh", startTime: "09:00", endTime: "12:00", description: "Giờ học linh hoạt" }
];

// 3. Môn học mẫu kèm Giáo trình Bài học chuẩn (Syllabus)
// Hỗ trợ ánh xạ từng buổi học với bài học trong môn (KN-164)
const SUBJECT_SYLLABI = {
    "sbj_js_core": [
        { number: 1, topic: "Giới thiệu JavaScript Hiện đại & Cài đặt Môi trường", type: "theory" },
        { number: 2, topic: "Cú pháp ES6+: Destructuring, Spread, Rest, Arrow Functions", type: "theory" },
        { number: 3, topic: "Xử lý Bất đồng bộ: Callback, Promise & Async/Await", type: "practice" },
        { number: 4, topic: "DOM Manipulation & Xử lý Sự kiện Chuyên sâu", type: "practice" },
        { number: 5, topic: "Fetch API & Tích hợp RESTful Services", type: "practice" },
        { number: 6, topic: "Kiểm tra Tiến độ Giữa kỳ & Giải quyết Bài toán Thực tế", type: "assessment" },
        { number: 7, topic: "Lập trình Hướng đối tượng OOP & Prototypes trong JS", type: "theory" },
        { number: 8, topic: "Kiến trúc Module ES6 & Webpack / Bundler cơ bản", type: "practice" },
        { number: 9, topic: "Xử lý Lỗi, Debugging & Performance Optimization", type: "practice" },
        { number: 10, topic: "Unit Testing với Jest & Clean Code Principles", type: "practice" },
        { number: 11, topic: "Workshop: Xây dựng Mini SPA với Vanilla JS", type: "workshop" },
        { number: 12, topic: "Bảo vệ Đồ án Môn học JS Core & Tổng kết Điểm", type: "exam" }
    ],
    "sbj_react_spa": [
        { number: 1, topic: "Tổng quan ReactJS, JSX & Virtual DOM Architecture", type: "theory" },
        { number: 2, topic: "Components, Props & State Management cơ bản", type: "practice" },
        { number: 3, topic: "React Hooks Toàn diện: useState, useEffect, useRef", type: "practice" },
        { number: 4, topic: "Advanced Hooks: useMemo, useCallback & Custom Hooks", type: "practice" },
        { number: 5, topic: "Xử lý Biểu mẫu (Forms), Validation với React Hook Form & Yup", type: "practice" },
        { number: 6, topic: "Định tuyến Client-side với React Router DOM v6", type: "practice" },
        { number: 7, topic: "Quản trị State tập trung: Context API & Redux Toolkit", type: "theory" },
        { number: 8, topic: "Thực hành Redux Toolkit & RTK Query Call API", type: "practice" },
        { number: 9, topic: "UI Libraries: TailwindCSS, Headless UI & Lucide Icons", type: "practice" },
        { number: 10, topic: "Authentication, Protected Routes & JWT Handling", type: "practice" },
        { number: 11, topic: "Kiểm tra Đánh giá Dự án Giữa khóa ReactJS", type: "assessment" },
        { number: 12, topic: "Performance Optimization & Lazy Loading", type: "theory" },
        { number: 13, topic: "Triển khai Ứng dụng lên Vercel / Netlify", type: "practice" },
        { number: 14, topic: "Bảo vệ Đồ án React SPA Thực chiến", type: "exam" }
    ],
    "sbj_fullstack_60": [
        // Giáo trình chuyên sâu 60 buổi cho lớp Fullstack Enterprise
    ]
};

// 4. In-Memory Store
let holidays = [];
let classSchedules = {}; // { [classId]: [ session1, session2, ... ] }
let activeClasses = [];

/**
 * Khởi tạo dữ liệu ban đầu
 */
function initScheduleData() {
    sessionHistory = []; notifications = []; attendanceRecords = [];
    holidays = JSON.parse(JSON.stringify(DEFAULT_HOLIDAYS));
    classSchedules = {};
    activeClasses = [
        {
            id: "cls_fs_01",
            studentIds: ["usr_student"], // Explicit demo roster; editable by training manager.
            instructorId: "usr_teacher",
            code: "WD-2026-01",
            name: "Lớp Fullstack Web K15 - Ca Sáng",
            subjectId: "sbj_js_core",
            subjectName: "Lập trình JavaScript Nâng cao & ES6+",
            programId: "prog_fullstack",
            instructor: "ThS. Trần Minh",
            room: "Phòng Lab A1",
            defaultShift: "morning",
            status: "active"
        },
        {
            id: "cls_fs_02",
            code: "WD-2026-02",
            name: "Lớp Fullstack Web K15 - Ca Tối",
            subjectId: "sbj_react_spa",
            subjectName: "Phát triển Giao diện SPA với ReactJS & Tailwind",
            programId: "prog_fullstack",
            instructor: "ThS. Phạm Quân",
            room: "Phòng Lab A2",
            defaultShift: "evening",
            status: "active"
        },
        {
            id: "cls_da_01",
            code: "DA-2026-01",
            name: "Lớp Data Science K15 - Thực hành SQL",
            subjectId: "sbj_db_sql",
            subjectName: "Cơ sở Dữ liệu Quan hệ & Tối ưu Truy vấn SQL",
            programId: "prog_data_ai",
            instructor: "ThS. Lê Hoa",
            room: "Phòng B1",
            defaultShift: "afternoon",
            status: "active"
        },
        {
            id: "cls_pmp_60",
            code: "K15-FULL60",
            name: "Lớp Chuyên sâu Fullstack Doanh nghiệp (60 buổi)",
            subjectId: "sbj_js_core",
            subjectName: "Lập trình Web Toàn diện (Chương trình 60 buổi)",
            programId: "prog_fullstack",
            instructor: "Minh Quân",
            room: "Hội trường Lab A1",
            defaultShift: "morning",
            status: "active"
        }
    ];

    // Seed lịch mẫu cho cls_fs_01 (12 buổi) để có sẵn dữ liệu xem trực quan
    const seedResult = generateSchedulePreview({
        classId: "cls_fs_01",
        subjectId: "sbj_js_core",
        startDate: "2026-03-02",
        daysOfWeek: [1, 3, 5], // Thứ 2, 4, 6
        shift: "morning",
        startTime: "08:00",
        endTime: "11:30",
        room: "Phòng Lab A1",
        instructor: "ThS. Trần Minh",
        totalSessions: 12,
        skipHolidays: true
    });
    if (seedResult && seedResult.sessions) {
        classSchedules["cls_fs_01"] = seedResult.sessions;
    }
}

// Khởi tạo ngay khi nạp module
initScheduleData();

// ========================================================
// CÁC HÀM TIỆN ÍCH XỬ LÝ THỜI GIAN & NGÀY NGHỈ LỄ
// ========================================================

/**
 * Định dạng Date object thành chuỗi YYYY-MM-DD
 */
function formatDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

/**
 * Lấy tên thứ tiếng Việt từ chỉ số getDay() (0: Chủ Nhật, 1: Thứ 2, ...)
 */
function getDayOfWeekName(dayIndex) {
    const names = [
        "Chủ Nhật",
        "Thứ Hai",
        "Thứ Ba",
        "Thứ Tư",
        "Thứ Năm",
        "Thứ Sáu",
        "Thứ Bảy"
    ];
    return names[dayIndex] || "";
}

/**
 * Kiểm tra xem một ngày YYYY-MM-DD có phải là ngày nghỉ lễ hay không (KN-160)
 */
function checkIsHoliday(dateStr, customHolidays = []) {
    const allHolidays = [...holidays, ...customHolidays];
    const targetDate = new Date(dateStr + "T00:00:00");
    const monthDay = dateStr.slice(5); // "MM-DD"

    for (const h of allHolidays) {
        // Kiểm tra khớp chính xác ngày YYYY-MM-DD
        if (h.date === dateStr) {
            return { isHoliday: true, holiday: h };
        }
        // Kiểm tra ngày lễ định kỳ hàng năm MM-DD
        if (h.recurringMonthDay && h.recurringMonthDay === monthDay) {
            return { isHoliday: true, holiday: h };
        }
    }

    return { isHoliday: false, holiday: null };
}

/**
 * Tự động sinh danh mục bài học (Syllabus) cho môn học nếu chưa có sẵn (KN-164)
 */
function getLessonsForSubject(subjectId, totalSessions) {
    const predefined = SUBJECT_SYLLABI[subjectId];
    if (predefined && predefined.length >= totalSessions) {
        return predefined.slice(0, totalSessions);
    }

    // Nếu số buổi lớn hơn (ví dụ 60 buổi cho một môn lớn), sinh danh sách chuẩn hóa
    const lessons = [];
    const baseLessons = predefined || [];

    for (let i = 1; i <= totalSessions; i++) {
        if (i <= baseLessons.length) {
            lessons.push(baseLessons[i - 1]);
        } else {
            // Tự động tạo bài học theo phân bổ chuyên nghiệp:
            let topic = "";
            let type = "practice";

            if (i === Math.floor(totalSessions / 2)) {
                topic = `Đánh giá Tiến độ Giữa kỳ & Mini Project (Buổi ${i})`;
                type = "assessment";
            } else if (i === totalSessions - 1) {
                topic = `Tổng ôn tập, Review Code & Chuẩn bị Bảo vệ Đồ án (Buổi ${i})`;
                type = "workshop";
            } else if (i === totalSessions) {
                topic = `Bảo vệ Đồ án Tốt nghiệp & Trao Chứng nhận Hoàn thành (Buổi ${i})`;
                type = "exam";
            } else if (i % 6 === 0) {
                topic = `Workshop Thực chiến & Review Dự án Doanh nghiệp - Giai đoạn ${Math.floor(i / 6)}`;
                type = "workshop";
            } else if (i % 3 === 0) {
                topic = `Lab Thực hành Nâng cao & Tối ưu Hóa Hệ thống - Chuyên đề ${i}`;
                type = "practice";
            } else {
                topic = `Chuyên đề Kỹ thuật Chuyên sâu & Triển khai Module phần ${i}`;
                type = "theory";
            }

            lessons.push({
                number: i,
                topic: topic,
                type: type
            });
        }
    }

    return lessons;
}

// ========================================================
// CORE ALGORITHM: SINH THỜI KHÓA BIỂU TỰ ĐỘNG (KN-161, KN-160, KN-164)
// ========================================================

/**
 * Thuật toán sinh thời khóa biểu tự động theo mẫu lặp
 * 
 * @param {Object} options
 * @param {string} options.classId - Mã lớp học
 * @param {string} options.subjectId - Mã môn học
 * @param {string} options.startDate - Ngày bắt đầu (YYYY-MM-DD)
 * @param {Array<number>} options.daysOfWeek - Danh sách các thứ trong tuần (vd: [1, 3, 5] = T2, T4, T6)
 * @param {string} options.shift - Ca học ('morning', 'afternoon', 'evening', 'custom')
 * @param {string} options.startTime - Giờ bắt đầu (vd: "08:00")
 * @param {string} options.endTime - Giờ kết thúc (vd: "11:30")
 * @param {string} options.room - Phòng học
 * @param {string} options.instructor - Giảng viên phụ trách
 * @param {number} options.totalSessions - Tổng số buổi cần sinh (vd: 60)
 * @param {boolean} options.skipHolidays - Có tự động bỏ qua ngày lễ hay không (mặc định true)
 * @param {Array} options.customHolidays - Danh sách ngày nghỉ bổ sung
 */
function generateSchedulePreview(options) {
    const {
        classId,
        subjectId,
        startDate,
        daysOfWeek,
        shift = "morning",
        startTime = "08:00",
        endTime = "11:30",
        room = "Phòng Lab A1",
        instructor = "Minh Quân",
        totalSessions = 60,
        skipHolidays = true,
        customHolidays = []
    } = options;

    // 1. Validation đầu vào nghiêm ngặt (KN-167)
    if (!classId) {
        throw new Error("Vui lòng chọn lớp học cần sinh thời khóa biểu.");
    }
    if (!startDate || isNaN(Date.parse(startDate))) {
        throw new Error("Ngày bắt đầu không hợp lệ. Vui lòng nhập định dạng YYYY-MM-DD.");
    }
    if (!Array.isArray(daysOfWeek) || daysOfWeek.length === 0) {
        throw new Error("Vui lòng chọn ít nhất một thứ trong tuần để lặp lịch học (vd: Thứ 2, Thứ 4, Thứ 6).");
    }
    // Chuẩn hóa daysOfWeek thành mảng số hợp lệ (0-6)
    const validDays = daysOfWeek.map(d => Number(d)).filter(d => !isNaN(d) && d >= 0 && d <= 6);
    if (validDays.length === 0) {
        throw new Error("Danh sách thứ trong tuần không hợp lệ.");
    }
    const sessionCount = parseInt(totalSessions, 10);
    if (isNaN(sessionCount) || sessionCount <= 0 || sessionCount > 200) {
        throw new Error("Số buổi học phải là số nguyên dương hợp lệ từ 1 đến 200 buổi.");
    }

    // 2. Lấy thông tin lớp và môn học
    const classObj = activeClasses.find(c => c.id === classId) || {
        id: classId,
        code: classId,
        name: `Lớp học ${classId}`,
        room: room,
        instructor: instructor
    };

    const lessons = getLessonsForSubject(subjectId || classObj.subjectId || "sbj_js_core", sessionCount);

    // 3. Tiến hành duyệt ngày và sinh lịch (KN-161 & KN-160)
    const sessions = [];
    const skippedHolidays = [];

    // Bắt đầu từ startDate lúc 00:00:00 giờ địa phương
    const [startYear, startMonth, startDay] = startDate.split("-").map(Number);
    const currentDate = new Date(startYear, startMonth - 1, startDay, 12, 0, 0);

    let sessionIndex = 1;
    // Cơ chế an toàn tránh lặp vô hạn (tối đa duyệt 2000 ngày)
    let loopGuard = 0;
    const MAX_DAYS_GUARD = Math.max(sessionCount * 14, 2000);

    while (sessionIndex <= sessionCount && loopGuard < MAX_DAYS_GUARD) {
        loopGuard++;
        const currentDayOfWeek = currentDate.getDay(); // 0 (Sun) - 6 (Sat)
        const dateStr = formatDateString(currentDate);

        // Kiểm tra xem ngày hiện tại có nằm trong các thứ được chọn hay không
        if (validDays.includes(currentDayOfWeek)) {
            const dayName = getDayOfWeekName(currentDayOfWeek);

            // Kiểm tra ngày nghỉ lễ (KN-160)
            const holidayCheck = checkIsHoliday(dateStr, customHolidays);

            if (holidayCheck.isHoliday && skipHolidays) {
                // TỰ ĐỘNG BỎ QUA NGÀY LỄ:
                // Không tăng sessionIndex, ghi nhận nhật ký ngày lễ bị bỏ qua
                skippedHolidays.push({
                    date: dateStr,
                    dayOfWeek: currentDayOfWeek,
                    dayOfWeekName: dayName,
                    holidayId: holidayCheck.holiday.id,
                    holidayName: holidayCheck.holiday.name,
                    description: holidayCheck.holiday.description,
                    skippedForSession: sessionIndex,
                    originalShift: shift
                });
            } else {
                // NGÀY HỌC HỢP LỆ: Tạo buổi học
                const lesson = lessons[sessionIndex - 1] || {
                    number: sessionIndex,
                    topic: `Nội dung bài học chuyên sâu buổi ${sessionIndex}`,
                    type: "practice"
                };

                const sessionObj = {
                    id: `ses_${classId}_${sessionIndex}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                    classId: classId,
                    classCode: classObj.code || classId,
                    className: classObj.name || classId,
                    sessionNumber: sessionIndex,
                    totalSessions: sessionCount,
                    date: dateStr,
                    dayOfWeek: currentDayOfWeek,
                    dayOfWeekName: dayName,
                    shift: shift,
                    startTime: startTime,
                    endTime: endTime,
                    room: room || classObj.room || "Phòng Lab A1",
                    instructor: instructor || classObj.instructor || "Minh Quân",
                    lessonNumber: lesson.number,
                    lessonTopic: lesson.topic,
                    lessonType: lesson.type || "practice",
                    status: "scheduled", // scheduled | completed | cancelled
                    note: ""
                };

                sessions.push(sessionObj);
                sessionIndex++;
            }
        }

        // Tăng 1 ngày kế tiếp
        currentDate.setDate(currentDate.getDate() + 1);
    }

    if (sessions.length < sessionCount) {
        throw new Error(`Không thể sinh đủ ${sessionCount} buổi học trong phạm vi giới hạn ngày.`);
    }

    return {
        success: true,
        classInfo: {
            id: classObj.id,
            code: classObj.code,
            name: classObj.name,
            subjectId: subjectId || classObj.subjectId,
            room: room,
            instructor: instructor
        },
        pattern: {
            startDate: startDate,
            endDate: sessions[sessions.length - 1].date,
            daysOfWeek: validDays,
            daysOfWeekNames: validDays.map(getDayOfWeekName),
            shift: shift,
            startTime: startTime,
            endTime: endTime,
            totalSessionsRequested: sessionCount,
            totalSessionsGenerated: sessions.length
        },
        stats: {
            totalSessions: sessions.length,
            startDate: sessions[0].date,
            endDate: sessions[sessions.length - 1].date,
            skippedHolidaysCount: skippedHolidays.length,
            durationDays: Math.ceil((new Date(sessions[sessions.length - 1].date) - new Date(sessions[0].date)) / (1000 * 60 * 60 * 24)) + 1
        },
        skippedHolidays: skippedHolidays,
        sessions: sessions
    };
}

/**
 * Lưu chính thức thời khóa biểu vào hệ thống (KN-165)
 */
function saveClassSchedule(classId, sessionsList, user = {}) {
    if (!classId) {
        throw new Error("Mã lớp học không được để trống.");
    }
    if (!Array.isArray(sessionsList) || sessionsList.length === 0) {
        throw new Error("Danh sách buổi học không được để trống.");
    }

    if (!activeClasses.some(c => c.id === classId)) fail("Không tìm thấy lớp học.", 404, "CLASS_NOT_FOUND");
    if ((classSchedules[classId] || []).length) fail("Lớp đã có lịch. Hãy sửa hoặc hủy từng buổi để giữ lịch sử và khóa điểm danh.", 409, "SCHEDULE_EXISTS");
    const ids = new Set();
    const sanitizedSessions = sessionsList.map((s, idx) => {
        if (!s.id || typeof s.id !== "string" || ids.has(s.id) || getSchedules().some(existing => existing.id === s.id)) fail("Mã buổi học bị thiếu hoặc trùng.");
        ids.add(s.id);
        const session = {
            id: s.id, classId, sessionNumber: idx + 1, totalSessions: sessionsList.length,
            date: s.date, startTime: s.startTime, endTime: s.endTime, room: s.room, instructor: s.instructor,
            instructorId: s.instructorId || null, shift: s.shift || "custom",
            lessonNumber: s.lessonNumber, lessonTopic: s.lessonTopic || "", lessonType: s.lessonType || "theory",
            note: s.note || "", status: "scheduled", version: 1,
            updatedAt: new Date().toISOString(), updatedBy: user.id || user.name || "system"
        };
        validateSession(session);
        session.dayOfWeek = new Date(session.date + "T12:00:00").getDay();
        session.dayOfWeekName = getDayOfWeekName(session.dayOfWeek);
        return session;
    });
    sanitizedSessions.forEach((session, index) => checkConflicts(session, sanitizedSessions.slice(0, index)));

    classSchedules[classId] = sanitizedSessions;

    // Cập nhật trạng thái lớp học
    const cls = activeClasses.find(c => c.id === classId);
    if (cls) {
        cls.hasSchedule = true;
        cls.totalSessions = sanitizedSessions.length;
        cls.scheduleStartDate = sanitizedSessions[0].date;
        cls.scheduleEndDate = sanitizedSessions[sanitizedSessions.length - 1].date;
    }

    // Ghi nhật ký Audit Log
    recordAuditLog({
        action: "GENERATE_AND_SAVE_SCHEDULE",
        performedBy: user.name || "Minh Quân",
        targetUserId: classId,
        roleId: "training_manager",
        status: "SUCCESS",
        reason: `Đã sinh và lưu thành công thời khóa biểu ${sanitizedSessions.length} buổi cho lớp ${cls ? cls.name : classId}`
    });

    return {
        success: true,
        message: `Đã lưu thành công thời khóa biểu ${sanitizedSessions.length} buổi cho lớp học.`,
        classId: classId,
        totalSessions: sanitizedSessions.length,
        startDate: sanitizedSessions[0].date,
        endDate: sanitizedSessions[sanitizedSessions.length - 1].date,
        sessions: sanitizedSessions
    };
}

/**
 * Lấy toàn bộ thời khóa biểu của một lớp học
 */
function getClassSchedule(classId) {
    if (!classId) return [];
    return (classSchedules[classId] || []).map(decorateSession);
}

/**
 * Lấy tất cả thời khóa biểu theo bộ lọc (Query Filter)
 */
function getSchedules(query = {}) {
    const {
        classId,
        subjectId,
        instructor,
        room,
        startDate,
        endDate,
        status
    } = query;

    let allSessions = [];
    if (classId) {
        allSessions = [...(classSchedules[classId] || [])];
    } else {
        Object.values(classSchedules).forEach(arr => {
            allSessions.push(...arr);
        });
    }

    if (subjectId) allSessions = allSessions.filter(s => activeClasses.find(c => c.id === s.classId)?.subjectId === subjectId);
    // Áp dụng bộ lọc
    if (instructor) {
        const insLower = instructor.toLowerCase();
        allSessions = allSessions.filter(s => s.instructor && s.instructor.toLowerCase().includes(insLower));
    }
    if (room) {
        const roomLower = room.toLowerCase();
        allSessions = allSessions.filter(s => s.room && s.room.toLowerCase().includes(roomLower));
    }
    if (status) {
        allSessions = allSessions.filter(s => s.status === status);
    }
    if (startDate) {
        allSessions = allSessions.filter(s => s.date >= startDate);
    }
    if (endDate) {
        allSessions = allSessions.filter(s => s.date <= endDate);
    }

    // Sắp xếp theo ngày tăng dần
    allSessions.sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));

    return allSessions.map(decorateSession);
}

/**
 * Cập nhật một buổi học cụ thể (KN-163: cho phép chỉnh sửa từng buổi)
 */
function findSession(id) {
    const session = Object.values(classSchedules).flat().find(s => s.id === id);
    if (!session) fail("Không tìm thấy buổi học.", 404, "SESSION_NOT_FOUND");
    return session;
}
function lockReason(session) {
    if (attendanceRecords.some(a => a.sessionId === session.id) || session.attendanceTaken || session.attendanceAt || session.status === "completed") return "Buổi học đã điểm danh, không được sửa hoặc hủy.";
    if (session.status === "cancelled") return "Buổi học đã hủy, không được sửa tiếp.";
    return null;
}
function decorateSession(session) {
    const reason = lockReason(session);
    return { ...clone(session), version: session.version || 1, editable: !reason, lockReason: reason };
}
function getSessionDetail(id) { return decorateSession(findSession(id)); }
function assertEditable(session, version) {
    const reason = lockReason(session);
    if (reason) fail(reason, 409, "SESSION_LOCKED");
    if (version !== undefined && version !== (session.version || 1)) fail("Buổi học đã thay đổi. Vui lòng tải lại trước khi lưu.", 409, "VERSION_CONFLICT");
}
function validateSession(session) {
    if (typeof session.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(session.date) || isNaN(Date.parse(session.date)) || new Date(session.date + "T00:00:00Z").toISOString().slice(0,10) !== session.date) fail("Ngày học không hợp lệ (YYYY-MM-DD).");
    for (const key of ["startTime", "endTime"]) if (typeof session[key] !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(session[key])) fail("Giờ học không hợp lệ (HH:mm).");
    if (session.startTime >= session.endTime) fail("Giờ kết thúc phải sau giờ bắt đầu; không hỗ trợ buổi qua ngày.");
    for (const key of ["room", "instructor"]) {
        if (typeof session[key] !== "string" || !session[key].trim() || session[key].length > 255) fail("Phòng và giảng viên phải có từ 1 đến 255 ký tự.");
        session[key] = session[key].trim();
    }
    const teacher = findInstructor(session);
    if (session.instructorId && !teacher) fail("Giảng viên thay thế không hợp lệ.");
    if (teacher) { session.instructorId = teacher.id; session.instructor = teacher.name; }
    for (const key of ["note", "lessonTopic"]) if (session[key] !== undefined && (typeof session[key] !== "string" || session[key].length > 2000)) fail("Ghi chú/chủ đề không hợp lệ (tối đa 2000 ký tự).");
}
function checkConflicts(candidate, additional = []) {
    const conflicts = [...Object.values(classSchedules).flat(), ...additional].filter(other => {
        if (other.id === candidate.id || other.status === "cancelled" || other.date !== candidate.date) return false;
        if (!(candidate.startTime < other.endTime && candidate.endTime > other.startTime)) return false;
        const a = findInstructor(candidate), b = findInstructor(other);
        return other.classId === candidate.classId || normalize(candidate.room) === normalize(other.room) ||
            (a && b ? a.id === b.id : normalize(candidate.instructor) === normalize(other.instructor));
    });
    if (conflicts.length) fail("Trùng lịch lớp, phòng học hoặc giảng viên. Hãy chọn thời gian/phòng/giảng viên khác.", 409, "SCHEDULE_CONFLICT", conflicts.map(s => ({ id: s.id, classId: s.classId, date: s.date, startTime: s.startTime, endTime: s.endTime, room: s.room })));
}
function studentRecipients(classId) {
    const cls = activeClasses.find(c => c.id === classId);
    // Filter explicitly: the legacy enrollment service returns all rows for an unknown class.
    const rows = require("./enrollmentService").getEnrollmentsList().filter(e => e.classId === classId || (cls && e.classCode === cls.code));
    return [...new Set(rows.map(e => e.studentId))];
}
function addChange(before, after, action, reason, user) {
    const at = new Date().toISOString(), eventId = randomUUID();
    sessionHistory.push({ id: eventId, sessionId: after.id, classId: after.classId, action, reason: reason || null,
        actorId: user.id || null, actorName: user.name || "system", at, before: clone(before), after: clone(after) });
    const previousTeacher = findInstructor(before), nextTeacher = findInstructor(after);
    const recipients = new Set([...studentRecipients(after.classId), previousTeacher?.id, nextTeacher?.id].filter(Boolean));
    const text = action === "CANCELLED"
        ? `Buổi ${after.sessionNumber} ngày ${before.date} (${before.startTime}–${before.endTime}) đã hủy. Lý do: ${reason}`
        : `Buổi ${after.sessionNumber} thay đổi: ${before.date} ${before.startTime}–${before.endTime}, ${before.room}, ${before.instructor} → ${after.date} ${after.startTime}–${after.endTime}, ${after.room}, ${after.instructor}.`;
    for (const userId of recipients) notifications.push({ id: randomUUID(), eventId, userId, sessionId: after.id, classId: after.classId, message: text, createdAt: at, readAt: null });
    return { notificationCount: recipients.size, notificationWarning: (!previousTeacher || !nextTeacher) ? "Có giảng viên chưa liên kết tài khoản; không thể tạo thông báo cho người này. Hãy chọn giảng viên trong danh sách tài khoản." : null };
}
function updateSession(sessionId, updateData, user = {}) {
    const session = findSession(sessionId); assertEditable(session, updateData.version);
    const allowed = ["date", "shift", "startTime", "endTime", "room", "instructor", "instructorId", "lessonTopic", "lessonNumber", "note", "version"];
    if (Object.keys(updateData).some(k => !allowed.includes(k))) fail("Chỉ được sửa thông tin buổi học; hãy dùng API hủy/điểm danh riêng.");
    const before = clone(session), candidate = { ...session, ...updateData };
    if (updateData.instructor !== undefined && updateData.instructor !== session.instructor && updateData.instructorId === undefined) candidate.instructorId = null;
    validateSession(candidate); checkConflicts(candidate);
    if (allowed.filter(k => k !== "version").every(k => candidate[k] === session[k])) return { success: true, message: "Không có thay đổi.", session: decorateSession(session), notificationCount: 0 };
    candidate.dayOfWeek = new Date(candidate.date + "T12:00:00").getDay(); candidate.dayOfWeekName = getDayOfWeekName(candidate.dayOfWeek);
    candidate.version = (session.version || 1) + 1; candidate.updatedAt = new Date().toISOString(); candidate.updatedBy = user.id || user.name;
    Object.assign(session, candidate);
    const delivery = addChange(before, session, "UPDATED", null, user);
    return { success: true, message: "Đã cập nhật buổi học và tạo thông báo trong ứng dụng.", session: decorateSession(session), ...delivery };
}
function cancelSession(id, data = {}, user = {}) {
    const session = findSession(id); assertEditable(session, data.version);
    if (typeof data.reason !== "string" || !data.reason.trim() || data.reason.trim().length > 1000) fail("Bắt buộc nhập lý do hủy (1–1000 ký tự).", 400, "CANCEL_REASON_REQUIRED");
    const before = clone(session);
    Object.assign(session, { status: "cancelled", cancelReason: data.reason.trim(), cancelledAt: new Date().toISOString(), cancelledBy: user.id || user.name, updatedAt: new Date().toISOString(), updatedBy: user.id || user.name, version: (session.version || 1) + 1 });
    const delivery = addChange(before, session, "CANCELLED", session.cancelReason, user);
    return { success: true, message: "Đã hủy buổi học và giữ nguyên lịch sử.", session: decorateSession(session), ...delivery };
}
function deleteSession(id, user = {}, data = {}) { return cancelSession(id, data, user); }
function clearClassSchedule() { fail("Không được xóa hàng loạt lịch đã lưu. Hãy hủy từng buổi kèm lý do để bảo toàn lịch sử.", 409, "BULK_DELETE_DISABLED"); }
function getSessionHistory(id) { findSession(id); return clone(sessionHistory.filter(h => h.sessionId === id)); }
function getNotifications(userId) { return clone(notifications.filter(n => n.userId === userId).reverse()); }
function readNotification(id, userId) {
    const item = notifications.find(n => n.id === id && n.userId === userId);
    if (!item) fail("Không tìm thấy thông báo.", 404, "NOTIFICATION_NOT_FOUND");
    item.readAt = item.readAt || new Date().toISOString(); return item;
}
function markAttendance(id, data, user) {
    const session = findSession(id); assertEditable(session, data.version);
    const teacher = findInstructor(session);
    const roles = (user.roles || []).map(r => r.code || r.id);
    if (!["training_manager", "administrator"].some(r => roles.includes(r) || user.role === r) && teacher?.id !== user.id) fail("Chỉ giảng viên được phân công hoặc quản lý mới được điểm danh.", 403, "FORBIDDEN");
    const memberIds = studentRecipients(session.classId);
    if (!Array.isArray(data.students) || !data.students.length || data.students.length !== memberIds.length || new Set(data.students.map(s => s.studentId)).size !== data.students.length || data.students.some(s => !memberIds.includes(s.studentId) || !["present", "absent", "late", "excused"].includes(s.status))) fail("Phải điểm danh đủ học viên của lớp, không trùng và có trạng thái hợp lệ.");
    const before = clone(session);
    attendanceRecords.push({ id: randomUUID(), sessionId: id, actorId: user.id, at: new Date().toISOString(), students: clone(data.students) });
    session.updatedAt = new Date().toISOString(); session.updatedBy = user.id;
    session.status = "completed"; session.attendanceAt = new Date().toISOString(); session.attendanceTaken = true; session.version = (session.version || 1) + 1;
    sessionHistory.push({ id: randomUUID(), sessionId: id, classId: session.classId, action: "ATTENDANCE_TAKEN", actorId: user.id, actorName: user.name, at: session.attendanceAt, before, after: clone(session) });
    return { success: true, session: decorateSession(session) };
}
function getRoster(id) {
    if (!activeClasses.some(c => c.id === id)) fail("Không tìm thấy lớp.", 404);
    return studentRecipients(id).map(id => users.find(u => u.id === id)).filter(Boolean).map(u => ({ id: u.id, name: u.name, email: u.email }));
}
function setClassMembers(id, data) {
    const cls = activeClasses.find(c => c.id === id); if (!cls) fail("Không tìm thấy lớp.", 404);
    if (!Array.isArray(data.studentIds) || data.studentIds.some(id => !users.some(u => u.id === id && (u.role === "student" || userHasRole(u.id, "student"))))) fail("Danh sách học viên không hợp lệ.");
    cls.studentIds = [...new Set(data.studentIds)];
    require('./enrollmentService').replaceLinkedRoster(id,cls.studentIds);
    return { success: true, members: getRoster(id) };
}
function getSchedulePeople() { return users.filter(u => isStaff(u) || u.role === "student" || userHasRole(u.id, "student")).map(u => ({ id: u.id, name: u.name, email: u.email, type: isStaff(u) ? "instructor" : "student" })); }

/**
 * Danh sách lớp học kèm trạng thái thời khóa biểu
 */
function getClassesWithScheduleStatus() {
    return activeClasses.map(c => {
        const sched = classSchedules[c.id] || [];
        return {
            ...c,
            hasSchedule: sched.length > 0,
            totalSessionsCount: sched.length,
            startDate: sched.length > 0 ? sched[0].date : null,
            endDate: sched.length > 0 ? sched[sched.length - 1].date : null
        };
    });
}

/**
 * Thêm lớp học mới để xếp lịch
 */
function createClass(classData) {
    if (!classData.name || !classData.code) {
        throw new Error("Mã lớp và tên lớp học là bắt buộc.");
    }
    const id = classData.id || `cls_${randomUUID()}`;
    if (activeClasses.some(c => c.id === id || normalize(c.code) === normalize(classData.code))) fail("Mã lớp học đã tồn tại.", 409, "CLASS_EXISTS");
    const newClass = {
        id: id,
        code: classData.code,
        name: classData.name,
        subjectId: classData.subjectId || "sbj_js_core",
        subjectName: classData.subjectName || "Môn học chung",
        instructor: classData.instructor || "Minh Quân",
        room: classData.room || "Phòng Lab A1",
        defaultShift: classData.defaultShift || "morning",
        status: "active",
        createdAt: new Date().toISOString()
    };
    activeClasses.push(newClass);
    require('./enrollmentService').upsertSharedClass(newClass);
    require('./subjectService').upsertSharedClass(newClass);
    return newClass;
}

/**
 * Quản lý danh sách ngày nghỉ lễ (Holidays)
 */
function getHolidays() {
    return holidays;
}

function addHoliday(holidayData) {
    if (!holidayData.name || !holidayData.date) {
        throw new Error("Tên ngày lễ và ngày nghỉ (date) là bắt buộc.");
    }
    const id = holidayData.id || `hol_custom_${Date.now()}`;
    const newHoliday = {
        id: id,
        name: holidayData.name,
        date: holidayData.date,
        recurringMonthDay: holidayData.recurringMonthDay || holidayData.date.slice(5),
        description: holidayData.description || "Ngày nghỉ lễ bổ sung",
        type: holidayData.type || "custom"
    };
    holidays.push(newHoliday);
    return newHoliday;
}

function deleteHoliday(holidayId) {
    const index = holidays.findIndex(h => h.id === holidayId);
    if (index === -1) {
        throw new Error("Không tìm thấy ngày lễ cần xóa.");
    }
    const deleted = holidays.splice(index, 1)[0];
    return deleted;
}

if (fs.existsSync(DATA_FILE)) {
    const stored = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    if (!stored || !Array.isArray(stored.activeClasses) || !stored.classSchedules || !Array.isArray(stored.holidays)) throw new Error("Kho dữ liệu lịch học không hợp lệ; khôi phục bản sao lưu trước khi chạy.");
    restore(stored);
}

module.exports = {
    getSessionDetail, getSessionHistory, getNotifications, getRoster, getSchedulePeople,
    cancelSession: transaction(cancelSession), readNotification: transaction(readNotification),
    markAttendance: transaction(markAttendance), setClassMembers: transaction(setClassMembers),
    DEFAULT_HOLIDAYS,
    STANDARD_SHIFTS,
    SUBJECT_SYLLABI,
    initScheduleData,
    formatDateString,
    getDayOfWeekName,
    checkIsHoliday,
    getLessonsForSubject,
    generateSchedulePreview,
    saveClassSchedule: transaction(saveClassSchedule),
    getClassSchedule,
    getSchedules,
    updateSession: transaction(updateSession),
    deleteSession: transaction(deleteSession),
    clearClassSchedule: transaction(clearClassSchedule),
    getClassesWithScheduleStatus,
    createClass: transaction(createClass),
    getHolidays,
    addHoliday: transaction(addHoliday),
    deleteHoliday: transaction(deleteHoliday)
};

module.exports.upsertSharedClass=cls=>{const old=activeClasses.find(c=>c.id===cls.id);if(old)Object.assign(old,cls);else activeClasses.push({...cls});};
require('./localDatabase').register('schedules',snapshot,restore);
