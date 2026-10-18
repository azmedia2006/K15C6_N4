/**
 * Enrollment Service (Dịch vụ Quản lý Ghi danh Học viên)
 * 
 * Nghiệp vụ đáp ứng:
 * 1. Chọn nhiều học viên để ghi danh cùng lúc (Batch Enrollment).
 * 2. Chặn ghi danh khi lớp đã đủ sĩ số hoặc học viên đã ở trong lớp.
 * 3. Ghi nhận ngày ghi danh (enrolledAt) và người thực hiện (enrolledBy, enrolledByName).
 * 4. Ghi nhận nhật ký thao tác (Audit Log) theo tiêu chuẩn hệ thống TMS.
 */

const { users } = require("./authService");
const { recordAuditLog } = require("./roleService");
const {
    addStudentCurrentClass,
    removeStudentCurrentClass,
    ensureStudentProfiles
} = require("./studentService");

// 1. Danh sách lớp học chuẩn của hệ thống TMS kèm sĩ số tối đa
const initialClasses = [
    {
        id: "cls_pmp_01",
        code: "K15-PM01",
        name: "Quản trị dự án PMP",
        courseName: "Quản trị dự án Chuyên nghiệp (PMP)",
        instructorName: "ThS. Trần Minh",
        room: "Phòng Lab A2",
        maxCapacity: 35,
        status: "Đang học",
        createdAt: "2026-02-01T08:00:00.000Z"
    },
    {
        id: "cls_da_02",
        code: "K15-DA02",
        name: "Phân tích dữ liệu",
        courseName: "Khoa học Dữ liệu & Trí tuệ Nhân tạo",
        instructorName: "Lê Hoa",
        room: "Phòng B1",
        maxCapacity: 30,
        status: "Đang học",
        createdAt: "2026-02-05T08:00:00.000Z"
    },
    {
        id: "cls_web_01",
        code: "K16-WEB01",
        name: "Lập trình Web Enterprise",
        courseName: "Lập trình Web Fullstack (NodeJS & React)",
        instructorName: "Phạm Quân",
        room: "Zoom Online",
        maxCapacity: 40,
        status: "Khai giảng tuần sau",
        createdAt: "2026-02-10T08:00:00.000Z"
    },
    {
        id: "cls_fs_01",
        code: "WD-2026-01",
        name: "Lớp Fullstack Web K15 - Ca Sáng",
        courseName: "Lập trình Web Fullstack (NodeJS & React)",
        instructorName: "ThS. Trần Minh",
        room: "Phòng Lab A1",
        maxCapacity: 25,
        status: "Đang học",
        createdAt: "2026-02-01T08:00:00.000Z"
    }
];

// Khởi tạo danh sách ghi danh mẫu ban đầu
function createInitialEnrollments() {
    const list = [
        {
            id: "enr_seed_001",
            classId: "cls_pmp_01",
            classCode: "K15-PM01",
            className: "Quản trị dự án PMP",
            courseName: "Quản trị dự án Chuyên nghiệp (PMP)",
            studentId: "usr_student",
            studentCode: "SV001",
            studentName: "Lê Minh Tuấn",
            studentEmail: "student@tms.edu.vn",
            enrolledAt: "2026-02-01T08:30:00.000Z",
            enrolledBy: "usr_admin",
            enrolledByName: "Nguyễn Văn Anh",
            status: "Đang học",
            notes: "Ghi danh đợt 1"
        },
        {
            id: "enr_seed_002",
            classId: "cls_pmp_01",
            classCode: "K15-PM01",
            className: "Quản trị dự án PMP",
            courseName: "Quản trị dự án Chuyên nghiệp (PMP)",
            studentId: "usr_student2",
            studentCode: "SV002",
            studentName: "Lê Minh Tuấn",
            studentEmail: "sv001",
            enrolledAt: "2026-02-01T08:45:00.000Z",
            enrolledBy: "usr_admin",
            enrolledByName: "Nguyễn Văn Anh",
            status: "Đang học",
            notes: "Ghi danh đợt 1"
        }
    ];

    // Tạo các bản ghi mô phỏng để sĩ số khớp với Dashboard:
    // K15-PM01: 32 / 35 (đã có 2 học viên thật + 30 mô phỏng = 32, còn 3 chỗ)
    for (let i = 3; i <= 32; i++) {
        list.push({
            id: `enr_sim_pm_${i}`,
            classId: "cls_pmp_01",
            classCode: "K15-PM01",
            className: "Quản trị dự án PMP",
            courseName: "Quản trị dự án Chuyên nghiệp (PMP)",
            studentId: `sim_pmp_${i}`,
            studentCode: `HV-PM${String(i).padStart(3, "0")}`,
            studentName: `Học viên PMP ${i}`,
            studentEmail: `hv.pm${i}@tms.edu.vn`,
            enrolledAt: "2026-02-02T09:00:00.000Z",
            enrolledBy: "usr_manager",
            enrolledByName: "Đỗ Quốc Bảo",
            status: "Đang học",
            notes: "Ghi danh khóa học"
        });
    }

    // K15-DA02: 28 / 30 (còn 2 chỗ)
    for (let i = 1; i <= 28; i++) {
        list.push({
            id: `enr_sim_da_${i}`,
            classId: "cls_da_02",
            classCode: "K15-DA02",
            className: "Phân tích dữ liệu",
            courseName: "Khoa học Dữ liệu & Trí tuệ Nhân tạo",
            studentId: `sim_da_${i}`,
            studentCode: `HV-DA${String(i).padStart(3, "0")}`,
            studentName: `Học viên DA ${i}`,
            studentEmail: `hv.da${i}@tms.edu.vn`,
            enrolledAt: "2026-02-05T09:00:00.000Z",
            enrolledBy: "usr_admissions",
            enrolledByName: "Vũ Hải Yến",
            status: "Đang học",
            notes: "Ghi danh khóa học"
        });
    }

    // K16-WEB01: 40 / 40 (ĐÃ ĐỦ SĨ SỐ - 0 chỗ trống)
    for (let i = 1; i <= 40; i++) {
        list.push({
            id: `enr_sim_web_${i}`,
            classId: "cls_web_01",
            classCode: "K16-WEB01",
            className: "Lập trình Web Enterprise",
            courseName: "Lập trình Web Fullstack (NodeJS & React)",
            studentId: `sim_web_${i}`,
            studentCode: `HV-WEB${String(i).padStart(3, "0")}`,
            studentName: `Học viên Web ${i}`,
            studentEmail: `hv.web${i}@tms.edu.vn`,
            enrolledAt: "2026-02-10T10:00:00.000Z",
            enrolledBy: "usr_manager",
            enrolledByName: "Đỗ Quốc Bảo",
            status: "Đang học",
            notes: "Lớp đã đủ sĩ số tối đa"
        });
    }

    return list;
}

// Bộ nhớ động In-Memory
let classes = [];
let enrollments = [];

function resetEnrollmentData() {
    classes = JSON.parse(JSON.stringify(initialClasses));
    enrollments = createInitialEnrollments();
}

// Khởi tạo lần đầu
resetEnrollmentData();

/**
 * Tìm lớp học theo ID hoặc Mã lớp (không phân biệt chữ hoa/thường)
 */
function findClass(idOrCode) {
    if (!idOrCode) return null;
    const normalized = String(idOrCode).trim().toLowerCase();
    return classes.find(c =>
        c.id.toLowerCase() === normalized ||
        c.code.toLowerCase() === normalized
    );
}

/**
 * Lấy số lượng học viên đã ghi danh vào lớp
 */
function getEnrolledCount(classIdOrCode) {
    const cls = findClass(classIdOrCode);
    if (!cls) return 0;
    return enrollments.filter(e => e.classId === cls.id || e.classCode === cls.code).length;
}

/**
 * Kiểm tra xem lớp học đã đủ sĩ số hay chưa
 */
function isClassFull(classIdOrCode) {
    const cls = findClass(classIdOrCode);
    if (!cls) return false;
    return getEnrolledCount(cls.id) >= cls.maxCapacity;
}

/**
 * Lấy số chỗ trống còn lại của lớp học
 */
function getRemainingSlots(classIdOrCode) {
    const cls = findClass(classIdOrCode);
    if (!cls) return 0;
    const count = getEnrolledCount(cls.id);
    return Math.max(0, cls.maxCapacity - count);
}

/**
 * Kiểm tra xem một học viên đã ở trong lớp học này chưa
 */
function isStudentEnrolledInClass(studentIdOrCode, classIdOrCode) {
    const cls = findClass(classIdOrCode);
    if (!cls) return false;

    // 1. Kiểm tra trong danh sách enrollments
    const inEnrollments = enrollments.some(e =>
        (e.classId === cls.id || e.classCode === cls.code) &&
        (e.studentId === studentIdOrCode || (e.studentCode && e.studentCode.toLowerCase() === String(studentIdOrCode).toLowerCase()))
    );
    if (inEnrollments) return true;

    // 2. Kiểm tra trong student profile (currentClasses)
    const allStudents = ensureStudentProfiles ? ensureStudentProfiles() : [];
    const student = allStudents.find(u =>
        u.id === studentIdOrCode || (u.studentCode && u.studentCode.toLowerCase() === String(studentIdOrCode).toLowerCase())
    );
    if (student && Array.isArray(student.currentClasses)) {
        return student.currentClasses.some(c =>
            c.className === cls.code || c.classId === cls.id
        );
    }

    return false;
}

/**
 * Lấy danh sách toàn bộ lớp học kèm sĩ số động và trạng thái đầy lớp
 */
function getAllClasses() {
    return classes.map(cls => {
        const enrolledCount = getEnrolledCount(cls.id);
        const remainingSlots = Math.max(0, cls.maxCapacity - enrolledCount);
        const isFull = enrolledCount >= cls.maxCapacity;
        return {
            ...cls,
            enrolledCount,
            remainingSlots,
            isFull,
            capacityDisplay: `${enrolledCount} / ${cls.maxCapacity}`
        };
    });
}

/**
 * Lấy chi tiết lớp học kèm danh sách học viên đã ghi danh
 */
function getClassDetail(idOrCode) {
    const cls = findClass(idOrCode);
    if (!cls) return null;

    const enrolledCount = getEnrolledCount(cls.id);
    const remainingSlots = Math.max(0, cls.maxCapacity - enrolledCount);
    const isFull = enrolledCount >= cls.maxCapacity;

    const enrolledStudents = enrollments
        .filter(e => e.classId === cls.id || e.classCode === cls.code)
        .map(e => ({
            enrollmentId: e.id,
            studentId: e.studentId,
            studentCode: e.studentCode,
            studentName: e.studentName,
            studentEmail: e.studentEmail,
            enrolledAt: e.enrolledAt,
            enrolledBy: e.enrolledBy,
            enrolledByName: e.enrolledByName,
            status: e.status,
            notes: e.notes
        }));

    return {
        ...cls,
        enrolledCount,
        remainingSlots,
        isFull,
        capacityDisplay: `${enrolledCount} / ${cls.maxCapacity}`,
        students: enrolledStudents
    };
}

/**
 * Lấy danh sách bản ghi ghi danh (Enrollments) có hỗ trợ bộ lọc
 */
function getEnrollmentsList(filters = {}) {
    let result = [...enrollments];

    if (filters.classId) {
        const cls = findClass(filters.classId);
        if (cls) {
            result = result.filter(e => e.classId === cls.id || e.classCode === cls.code);
        } else { return []; }
    }

    if (filters.studentId) {
        result = result.filter(e => e.studentId === filters.studentId || e.studentCode === filters.studentId);
    }

    if (filters.search) {
        const query = String(filters.search).trim().toLowerCase();
        result = result.filter(e =>
            (e.studentName && e.studentName.toLowerCase().includes(query)) ||
            (e.studentCode && e.studentCode.toLowerCase().includes(query)) ||
            (e.classCode && e.classCode.toLowerCase().includes(query)) ||
            (e.className && e.className.toLowerCase().includes(query)) ||
            (e.enrolledByName && e.enrolledByName.toLowerCase().includes(query))
        );
    }

    // Sắp xếp mới nhất lên đầu
    return result.sort((a, b) => new Date(b.enrolledAt) - new Date(a.enrolledAt));
}

/**
 * THỰC HIỆN GHI DANH HÀNG LOẠT (BATCH ENROLLMENT)
 * 
 * Kiểm tra nghiêm ngặt 3 tiêu chuẩn:
 * 1. Chọn nhiều học viên cùng lúc: Nhận mảng `studentIds`
 * 2. Chặn ghi danh khi:
 *    - Lớp đã đủ sĩ số tối đa (current >= maxCapacity)
 *    - Số lượng học viên chọn vượt quá số chỗ trống còn lại (count + current > maxCapacity)
 *    - Học viên đã ở trong lớp này rồi (Duplicate prevention)
 * 3. Ghi nhận ngày ghi danh (enrolledAt) và người thực hiện (enrolledBy, enrolledByName)
 */
function batchEnrollStudents({ classId, studentIds, performer = {}, notes = "" }) {
    // 1. Kiểm tra tham số đầu vào
    if (!classId) {
        const err = new Error("Vui lòng chọn lớp học cần ghi danh.");
        err.statusCode = 400;
        err.code = "MISSING_CLASS_ID";
        throw err;
    }

    const targetClass = findClass(classId);
    if (!targetClass) {
        const err = new Error(`Không tìm thấy lớp học '${classId}' trong hệ thống.`);
        err.statusCode = 404;
        err.code = "CLASS_NOT_FOUND";
        throw err;
    }

    // Chuẩn hóa mảng studentIds
    let normalizedStudentIds = [];
    if (Array.isArray(studentIds)) {
        normalizedStudentIds = studentIds.map(id => String(id).trim()).filter(Boolean);
    } else if (typeof studentIds === "string" && studentIds.trim()) {
        normalizedStudentIds = [studentIds.trim()];
    }

    if (normalizedStudentIds.length === 0) {
        const err = new Error("Vui lòng chọn ít nhất một học viên để thực hiện ghi danh.");
        err.statusCode = 400;
        err.code = "EMPTY_STUDENT_LIST";
        throw err;
    }

    // 2. Chặn ghi danh khi lớp đã đủ sĩ số tối đa
    const currentEnrolled = getEnrolledCount(targetClass.id);
    if (currentEnrolled >= targetClass.maxCapacity) {
        const err = new Error(
            `Lớp học ${targetClass.code} (${targetClass.name}) đã đủ sĩ số tối đa (${targetClass.maxCapacity}/${targetClass.maxCapacity}). Không thể ghi danh thêm học viên.`
        );
        err.statusCode = 400;
        err.code = "CLASS_FULL";
        err.details = {
            classCode: targetClass.code,
            className: targetClass.name,
            currentEnrolled,
            maxCapacity: targetClass.maxCapacity,
            remainingSlots: 0
        };
        throw err;
    }

    // 3. Chặn ghi danh khi số lượng học viên chọn vượt quá chỗ trống còn lại
    const remainingSlots = targetClass.maxCapacity - currentEnrolled;
    if (normalizedStudentIds.length > remainingSlots) {
        const err = new Error(
            `Lớp học ${targetClass.code} chỉ còn lại ${remainingSlots} chỗ trống (${currentEnrolled}/${targetClass.maxCapacity}), không đủ cho ${normalizedStudentIds.length} học viên đã chọn.`
        );
        err.statusCode = 400;
        err.code = "CLASS_CAPACITY_EXCEEDED";
        err.details = {
            classCode: targetClass.code,
            className: targetClass.name,
            currentEnrolled,
            maxCapacity: targetClass.maxCapacity,
            remainingSlots,
            requestedCount: normalizedStudentIds.length
        };
        throw err;
    }

    // 4. Kiểm tra sự tồn tại của từng học viên và đảm bảo có vai trò học viên
    const allStudents = ensureStudentProfiles ? ensureStudentProfiles() : [];
    const validStudents = [];

    for (const sId of normalizedStudentIds) {
        const studentUser = users.find(u =>
            u.id === sId || (u.studentCode && u.studentCode.toLowerCase() === sId.toLowerCase())
        );

        if (!studentUser) {
            const err = new Error(`Không tìm thấy hồ sơ học viên với định danh '${sId}'.`);
            err.statusCode = 404;
            err.code = "STUDENT_NOT_FOUND";
            throw err;
        }

        // Đảm bảo người dùng có vai trò học viên
        const hasStudentRole = studentUser.role === "student" ||
            (Array.isArray(studentUser.roles) && studentUser.roles.includes("student"));
        if (!hasStudentRole) {
            const err = new Error(`Người dùng '${studentUser.name}' (${studentUser.email}) không có vai trò Học viên.`);
            err.statusCode = 400;
            err.code = "NOT_A_STUDENT";
            throw err;
        }

        validStudents.push(studentUser);
    }

    // 5. Chặn ghi danh khi học viên đã ở trong lớp học này rồi
    const duplicateStudents = [];
    for (const student of validStudents) {
        if (isStudentEnrolledInClass(student.id, targetClass.id)) {
            duplicateStudents.push(student);
        }
    }

    if (duplicateStudents.length > 0) {
        const names = duplicateStudents.map(s => `${s.name} [${s.studentCode || s.id}]`).join(", ");
        const err = new Error(
            `Học viên ${names} đã ở trong lớp ${targetClass.code} (${targetClass.name}) rồi. Không thể ghi danh trùng lặp.`
        );
        err.statusCode = 400;
        err.code = "STUDENT_ALREADY_ENROLLED";
        err.details = {
            classCode: targetClass.code,
            className: targetClass.name,
            duplicateStudents: duplicateStudents.map(s => ({
                id: s.id,
                code: s.studentCode || s.id,
                name: s.name
            }))
        };
        throw err;
    }

    // 6. Ghi nhận ngày ghi danh và người thực hiện
    const enrolledAt = new Date().toISOString();
    const enrolledBy = performer.id || "usr_admin";
    const enrolledByName = performer.name || performer.email || "Ban Đào tạo TMS";

    const newEnrollmentRecords = [];

    for (const student of validStudents) {
        const record = {
            id: `enr_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
            classId: targetClass.id,
            classCode: targetClass.code,
            className: targetClass.name,
            courseName: targetClass.courseName || targetClass.name,
            studentId: student.id,
            studentCode: student.studentCode || student.id,
            studentName: student.name,
            studentEmail: student.email,
            enrolledAt: enrolledAt,
            enrolledBy: enrolledBy,
            enrolledByName: enrolledByName,
            notes: notes || "",
            status: "Đang học"
        };

        enrollments.push(record);
        newEnrollmentRecords.push(record);

        // Cập nhật vào hồ sơ cá nhân của học viên (currentClasses)
        if (typeof addStudentCurrentClass === "function") {
            addStudentCurrentClass(student.id, {
                classId: targetClass.id,
                className: targetClass.code,
                courseName: targetClass.courseName || targetClass.name,
                status: "Đang học",
                enrolledAt: enrolledAt,
                enrolledBy: enrolledBy,
                enrolledByName: enrolledByName
            });
        }

        // Ghi Audit Log cho từng học viên được ghi danh
        try {
            recordAuditLog({
                adminId: enrolledBy,
                targetUserId: student.id,
                action: "ENROLL_STUDENT",
                roleId: "student",
                status: "SUCCESS",
                reason: `Ghi danh học viên ${student.name} [${student.studentCode || student.id}] vào lớp ${targetClass.code}. Người thực hiện: ${enrolledByName}`
            });
        } catch (_) {}
    }

    const updatedEnrolledCount = getEnrolledCount(targetClass.id);
    const updatedRemainingSlots = Math.max(0, targetClass.maxCapacity - updatedEnrolledCount);

    return {
        success: true,
        message: `Đã ghi danh thành công ${validStudents.length} học viên vào lớp ${targetClass.code} (${targetClass.name}).`,
        data: {
            class: {
                ...targetClass,
                enrolledCount: updatedEnrolledCount,
                remainingSlots: updatedRemainingSlots,
                isFull: updatedEnrolledCount >= targetClass.maxCapacity,
                capacityDisplay: `${updatedEnrolledCount} / ${targetClass.maxCapacity}`
            },
            enrolledCount: updatedEnrolledCount,
            enrolledAt,
            enrolledBy,
            enrolledByName,
            enrolledStudents: newEnrollmentRecords.map(r => ({
                id: r.studentId,
                code: r.studentCode,
                name: r.studentName,
                email: r.studentEmail,
                enrolledAt: r.enrolledAt,
                enrolledByName: r.enrolledByName
            }))
        }
    };
}

/**
 * Hủy ghi danh / Xóa học viên khỏi lớp học (giải phóng sĩ số)
 */
function unenrollStudent({ classId, studentId, performer = {} }) {
    const cls = findClass(classId);
    if (!cls) {
        const err = new Error("Không tìm thấy lớp học.");
        err.statusCode = 404;
        throw err;
    }

    const initialLen = enrollments.length;
    enrollments = enrollments.filter(e =>
        !((e.classId === cls.id || e.classCode === cls.code) && (e.studentId === studentId || e.studentCode === studentId))
    );

    if (enrollments.length === initialLen) {
        const err = new Error("Học viên không có trong danh sách ghi danh của lớp học này.");
        err.statusCode = 404;
        throw err;
    }

    // Xóa khỏi currentClasses trong hồ sơ học viên
    if (typeof removeStudentCurrentClass === "function") {
        removeStudentCurrentClass(studentId, cls.code);
    }

    // Ghi Audit Log
    try {
        recordAuditLog({
            adminId: performer.id || "usr_admin",
            targetUserId: studentId,
            action: "UNENROLL_STUDENT",
            roleId: "student",
            status: "SUCCESS",
            reason: `Hủy ghi danh học viên '${studentId}' khỏi lớp ${cls.code}. Người thực hiện: ${performer.name || performer.id}`
        });
    } catch (_) {}

    const updatedEnrolledCount = getEnrolledCount(cls.id);
    return {
        success: true,
        message: `Đã hủy ghi danh học viên khỏi lớp ${cls.code}.`,
        data: {
            classCode: cls.code,
            enrolledCount: updatedEnrolledCount,
            remainingSlots: Math.max(0, cls.maxCapacity - updatedEnrolledCount)
        }
    };
}

module.exports = {
    getAllClasses,
    getClassDetail,
    getEnrollmentsList,
    batchEnrollStudents,
    unenrollStudent,
    isStudentEnrolledInClass,
    isClassFull,
    getRemainingSlots,
    getEnrolledCount,
    findClass,
    resetEnrollmentData
};

module.exports.exportState=()=>({classes,enrollments});
module.exports.upsertSharedClass=cls=>{const old=classes.find(c=>c.id===cls.id);const value={maxCapacity:35,instructorName:cls.instructor||'',...cls};if(old)Object.assign(old,value);else classes.push(value);};
require('./localDatabase').register('enrollments',()=>({classes,enrollments}),v=>{classes=v.classes;enrollments=v.enrollments;});

module.exports.syncLinkedRoster=(classId,ids)=>{const cls=findClass(classId);if(!cls)return;for(const id of ids){if(!enrollments.some(e=>e.classId===classId&&e.studentId===id)){const u=users.find(u=>u.id===id);if(u)enrollments.push({id:require('crypto').randomUUID(),classId,classCode:cls.code,className:cls.name,studentId:id,studentName:u.name,studentEmail:u.email,enrolledAt:new Date().toISOString(),enrolledBy:'roster-link',status:'Đang học'});}}};

module.exports.replaceLinkedRoster=(classId,ids)=>{const cls=findClass(classId);if(!cls)throw new Error('Không tìm thấy lớp.');if(ids.length>cls.maxCapacity)throw new Error('Danh sách vượt sĩ số lớp.');const removed=enrollments.filter(e=>e.classId===classId&&!ids.includes(e.studentId));enrollments=enrollments.filter(e=>e.classId!==classId||ids.includes(e.studentId));for(const row of removed)removeStudentCurrentClass(row.studentId,cls.code);module.exports.syncLinkedRoster(classId,ids);};

module.exports.pruneOrphanedRoster=()=>{enrollments=enrollments.filter(row=>users.some(u=>u.id===row.studentId));};
