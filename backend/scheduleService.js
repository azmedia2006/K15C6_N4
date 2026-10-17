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
    holidays = JSON.parse(JSON.stringify(DEFAULT_HOLIDAYS));
    classSchedules = {};
    activeClasses = [
        {
            id: "cls_fs_01",
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

    // Đánh số thứ tự lại từ 1 đến N để đảm bảo tính nhất quán
    const sanitizedSessions = sessionsList.map((s, idx) => ({
        ...s,
        sessionNumber: idx + 1,
        totalSessions: sessionsList.length,
        updatedAt: new Date().toISOString(),
        updatedBy: user.name || "Minh Quân"
    }));

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
    return classSchedules[classId] || [];
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
    if (classId && classSchedules[classId]) {
        allSessions = [...classSchedules[classId]];
    } else {
        Object.values(classSchedules).forEach(arr => {
            allSessions.push(...arr);
        });
    }

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

    return allSessions;
}

/**
 * Cập nhật một buổi học cụ thể (KN-163: cho phép chỉnh sửa từng buổi)
 */
function updateSession(sessionId, updateData, user = {}) {
    let foundSession = null;
    let foundClassId = null;

    for (const [clsId, sessArr] of Object.entries(classSchedules)) {
        const s = sessArr.find(item => item.id === sessionId);
        if (s) {
            foundSession = s;
            foundClassId = clsId;
            break;
        }
    }

    if (!foundSession) {
        throw new Error(`Không tìm thấy buổi học có mã ${sessionId}`);
    }

    // Cập nhật các trường được phép
    if (updateData.date) {
        foundSession.date = updateData.date;
        const d = new Date(updateData.date + "T00:00:00");
        foundSession.dayOfWeek = d.getDay();
        foundSession.dayOfWeekName = getDayOfWeekName(d.getDay());
    }
    if (updateData.shift) foundSession.shift = updateData.shift;
    if (updateData.startTime) foundSession.startTime = updateData.startTime;
    if (updateData.endTime) foundSession.endTime = updateData.endTime;
    if (updateData.room) foundSession.room = updateData.room;
    if (updateData.instructor) foundSession.instructor = updateData.instructor;
    if (updateData.lessonTopic) foundSession.lessonTopic = updateData.lessonTopic;
    if (updateData.lessonNumber !== undefined) foundSession.lessonNumber = updateData.lessonNumber;
    if (updateData.status) foundSession.status = updateData.status;
    if (updateData.note !== undefined) foundSession.note = updateData.note;

    foundSession.updatedAt = new Date().toISOString();
    foundSession.updatedBy = user.name || "Minh Quân";

    // Sắp xếp lại lịch của lớp theo ngày sau khi cập nhật ngày
    classSchedules[foundClassId].sort((a, b) => a.date.localeCompare(b.date));
    classSchedules[foundClassId].forEach((s, idx) => {
        s.sessionNumber = idx + 1;
    });

    return {
        success: true,
        message: "Cập nhật buổi học thành công.",
        session: foundSession
    };
}

/**
 * Xóa một buổi học khỏi thời khóa biểu
 */
function deleteSession(sessionId, user = {}) {
    let foundClassId = null;
    let deletedSession = null;

    for (const [clsId, sessArr] of Object.entries(classSchedules)) {
        const index = sessArr.findIndex(item => item.id === sessionId);
        if (index !== -1) {
            deletedSession = sessArr.splice(index, 1)[0];
            foundClassId = clsId;
            // Đánh số lại các buổi còn lại
            sessArr.forEach((s, idx) => {
                s.sessionNumber = idx + 1;
                s.totalSessions = sessArr.length;
            });
            break;
        }
    }

    if (!deletedSession) {
        throw new Error(`Không tìm thấy buổi học có mã ${sessionId}`);
    }

    return {
        success: true,
        message: "Đã xóa buổi học khỏi thời khóa biểu.",
        deletedSession: deletedSession,
        remainingSessionsCount: classSchedules[foundClassId].length
    };
}

/**
 * Xóa toàn bộ thời khóa biểu của một lớp học
 */
function clearClassSchedule(classId, user = {}) {
    if (!classId) throw new Error("Mã lớp không hợp lệ.");
    const count = classSchedules[classId] ? classSchedules[classId].length : 0;
    delete classSchedules[classId];

    const cls = activeClasses.find(c => c.id === classId);
    if (cls) {
        cls.hasSchedule = false;
        cls.totalSessions = 0;
    }

    return {
        success: true,
        message: `Đã xóa toàn bộ thời khóa biểu (${count} buổi) của lớp học.`,
        deletedCount: count
    };
}

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
    const id = classData.id || `cls_${Date.now()}`;
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

module.exports = {
    DEFAULT_HOLIDAYS,
    STANDARD_SHIFTS,
    SUBJECT_SYLLABI,
    initScheduleData,
    formatDateString,
    getDayOfWeekName,
    checkIsHoliday,
    getLessonsForSubject,
    generateSchedulePreview,
    saveClassSchedule,
    getClassSchedule,
    getSchedules,
    updateSession,
    deleteSession,
    clearClassSchedule,
    getClassesWithScheduleStatus,
    createClass,
    getHolidays,
    addHoliday,
    deleteHoliday
};
