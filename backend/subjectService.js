/**
 * KN-70: Subject Catalog Management Service (Quản lý Danh mục Môn học)
 * 
 * Nghiệp vụ User Story KN-70 (Sprint 2):
 * - Dành cho Quản lý đào tạo (training_manager) & Quản trị hệ thống (administrator).
 * - Khai báo môn học: Mã môn, Tên môn, Số buổi, Trọng số, Mô tả chuẩn đầu ra.
 * - Một môn học có thể được dùng lại ở nhiều chương trình đào tạo (N-N program_subjects).
 * - Ràng buộc nghiệp vụ: Môn học đã có lớp học liên kết (classCount > 0) thì KHÔNG được xóa.
 */

// 1. Dữ liệu mẫu ban đầu: Danh mục Chương trình đào tạo (Programs)
const initialPrograms = [
    {
        id: "prog_fullstack",
        code: "PROG_WEB",
        name: "Lập trình Web Fullstack (NodeJS & React)",
        description: "Lộ trình đào tạo toàn diện từ phát triển giao diện React đến kiến trúc Backend NodeJS RESTful.",
        totalSessions: 48,
        createdAt: "2026-01-10T08:00:00.000Z"
    },
    {
        id: "prog_data_ai",
        code: "PROG_DATA",
        name: "Khoa học Dữ liệu & Trí tuệ Nhân tạo (Python AI/ML)",
        description: "Phân tích dữ liệu lớn, trực quan hóa BI Dashboard và xây dựng mô hình học máy ứng dụng.",
        totalSessions: 40,
        createdAt: "2026-01-10T08:00:00.000Z"
    },
    {
        id: "prog_java_enterprise",
        code: "PROG_JAVA",
        name: "Lập trình Java Spring Boot Doanh nghiệp",
        description: "Thiết kế hệ thống microservices, bảo mật Spring Security và tối ưu cơ sở dữ liệu doanh nghiệp.",
        totalSessions: 52,
        createdAt: "2026-01-10T08:00:00.000Z"
    },
    {
        id: "prog_project_mgmt",
        code: "PROG_PMP",
        name: "Quản trị Dự án Chuyên nghiệp (PMP & Agile/Scrum)",
        description: "Khung kiến thức chuẩn PMI, quản trị phạm vi, tiến độ, chi phí và quy trình Scrum thực chiến.",
        totalSessions: 24,
        createdAt: "2026-01-10T08:00:00.000Z"
    }
];

// 2. Dữ liệu mẫu ban đầu: Danh mục Môn học (Subjects)
const initialSubjects = [
    {
        id: "sbj_js_core",
        code: "JS_CORE",
        name: "Lập trình JavaScript Nâng cao & ES6+",
        sessions: 12,
        weight: 1.5,
        outcomes: "Thành thạo cú pháp ES6+, xử lý bất đồng bộ (Promise, Async/Await), kiến trúc Module và lập trình hướng sự kiện hiện đại.",
        createdAt: "2026-01-15T09:00:00.000Z",
        updatedAt: "2026-01-15T09:00:00.000Z"
    },
    {
        id: "sbj_db_sql",
        code: "DB_SQL",
        name: "Cơ sở Dữ liệu Quan hệ & Tối ưu Truy vấn SQL",
        sessions: 10,
        weight: 1.0,
        outcomes: "Thiết kế mô hình thực thể quan hệ chuẩn 3NF, thành thạo truy vấn SQL nâng cao, indexing và quản lý giao dịch ACID.",
        createdAt: "2026-01-15T09:00:00.000Z",
        updatedAt: "2026-01-15T09:00:00.000Z"
    },
    {
        id: "sbj_react_spa",
        code: "FE_REACT",
        name: "Phát triển Giao diện SPA với ReactJS & Tailwind",
        sessions: 14,
        weight: 2.0,
        outcomes: "Xây dựng ứng dụng một trang (SPA) tương thích responsive, React Hooks, quản trị state tập trung và tích hợp REST API.",
        createdAt: "2026-01-15T09:00:00.000Z",
        updatedAt: "2026-01-15T09:00:00.000Z"
    },
    {
        id: "sbj_node_api",
        code: "BE_NODE",
        name: "Kiến trúc RESTful API với NodeJS & Express",
        sessions: 12,
        weight: 1.5,
        outcomes: "Thiết kế backend phân lớp, middleware xác thực JWT, phân quyền đa vai trò RBAC và kiểm thử tự động endpoint.",
        createdAt: "2026-01-15T09:00:00.000Z",
        updatedAt: "2026-01-15T09:00:00.000Z"
    },
    {
        id: "sbj_python_ds",
        code: "PY_DATA",
        name: "Lập trình Python và Phân tích Dữ liệu Pandas",
        sessions: 14,
        weight: 2.0,
        outcomes: "Thu thập dữ liệu, làm sạch và xử lý dữ liệu với Numpy/Pandas, xây dựng đồ thị trực quan hóa dữ liệu đa chiều.",
        createdAt: "2026-01-15T09:00:00.000Z",
        updatedAt: "2026-01-15T09:00:00.000Z"
    },
    {
        id: "sbj_agile_git",
        code: "SE_AGILE",
        name: "Quy trình Git Flow và Quản lý Dự án Agile/Scrum",
        sessions: 6,
        weight: 1.0,
        outcomes: "Thao tác Git nâng cao (rebase, branching strategy), quản lý công việc trên Jira Sprint và tổ chức họp Daily Scrum.",
        createdAt: "2026-01-15T09:00:00.000Z",
        updatedAt: "2026-01-15T09:00:00.000Z"
    }
];

// 3. Dữ liệu mẫu ban đầu: Liên kết N-N Chương trình và Môn học (program_subjects)
// CHỨNG MINH TIÊU CHÍ: Một môn học dùng lại được ở nhiều chương trình đào tạo
const initialProgramSubjects = [
    // Môn Cơ sở dữ liệu (DB_SQL) được dùng chung cho 3 chương trình:
    { programId: "prog_fullstack", subjectId: "sbj_db_sql" },
    { programId: "prog_data_ai", subjectId: "sbj_db_sql" },
    { programId: "prog_java_enterprise", subjectId: "sbj_db_sql" },

    // Môn Git & Agile (SE_AGILE) được dùng chung cho cả 4 chương trình:
    { programId: "prog_fullstack", subjectId: "sbj_agile_git" },
    { programId: "prog_data_ai", subjectId: "sbj_agile_git" },
    { programId: "prog_java_enterprise", subjectId: "sbj_agile_git" },
    { programId: "prog_project_mgmt", subjectId: "sbj_agile_git" },

    // Các môn chuyên ngành:
    { programId: "prog_fullstack", subjectId: "sbj_js_core" },
    { programId: "prog_fullstack", subjectId: "sbj_react_spa" },
    { programId: "prog_fullstack", subjectId: "sbj_node_api" },
    { programId: "prog_data_ai", subjectId: "sbj_python_ds" }
];

// 4. Dữ liệu mẫu ban đầu: Lớp học liên kết môn (Classes)
// Dùng để kiểm tra ràng buộc nghiệp vụ: "Môn đã có lớp học thì không xoá được"
const initialClasses = [
    {
        id: "cls_fs_01",
        code: "WD-2026-01",
        name: "Lớp Fullstack Web K15 - Ca Sáng",
        subjectId: "sbj_js_core",
        programId: "prog_fullstack",
        status: "active",
        createdAt: "2026-02-01T08:00:00.000Z"
    },
    {
        id: "cls_fs_02",
        code: "WD-2026-02",
        name: "Lớp Fullstack Web K15 - Ca Tối",
        subjectId: "sbj_react_spa",
        programId: "prog_fullstack",
        status: "active",
        createdAt: "2026-02-01T08:00:00.000Z"
    },
    {
        id: "cls_da_01",
        code: "DA-2026-01",
        name: "Lớp Data Science K15 - Thực hành SQL",
        subjectId: "sbj_db_sql",
        programId: "prog_data_ai",
        status: "active",
        createdAt: "2026-02-05T08:00:00.000Z"
    },
    {
        id: "cls_py_01",
        code: "PY-2026-01",
        name: "Lớp Python AI & Phân tích dữ liệu",
        subjectId: "sbj_python_ds",
        programId: "prog_data_ai",
        status: "active",
        createdAt: "2026-02-10T08:00:00.000Z"
    }
    // Chú ý: Môn "sbj_node_api" và "sbj_agile_git" chưa có lớp học nào liên kết
    // phục vụ cho việc kiểm thử tính năng XÓA thành công!
];

// Bộ nhớ động (In-memory Store)
let programs = [];
let subjects = [];
let programSubjects = [];
let classes = [];

/**
 * Khởi tạo hoặc đặt lại dữ liệu gốc
 */
function initSubjectData() {
    programs = JSON.parse(JSON.stringify(initialPrograms));
    subjects = JSON.parse(JSON.stringify(initialSubjects));
    programSubjects = JSON.parse(JSON.stringify(initialProgramSubjects));
    classes = JSON.parse(JSON.stringify(initialClasses));
}

// Khởi chạy khởi tạo lần đầu
initSubjectData();

/**
 * Lấy danh sách toàn bộ chương trình đào tạo
 */
function getAllPrograms() {
    return programs.map(p => {
        // Đếm số môn đang thuộc chương trình này
        const assignedSubjects = programSubjects.filter(ps => ps.programId === p.id);
        return {
            ...p,
            subjectCount: assignedSubjects.length
        };
    });
}

/**
 * Lấy chi tiết chương trình đào tạo
 */
function getProgramById(programId) {
    const program = programs.find(p => p.id === programId);
    if (!program) return null;

    const assignedSubjectIds = programSubjects
        .filter(ps => ps.programId === programId)
        .map(ps => ps.subjectId);

    const programSubs = subjects
        .filter(s => assignedSubjectIds.includes(s.id))
        .map(s => {
            const classCount = classes.filter(c => c.subjectId === s.id).length;
            return { ...s, classCount };
        });

    return {
        ...program,
        subjects: programSubs
    };
}

/**
 * Tra cứu danh sách môn học kèm lọc, tìm kiếm và phân trang
 * Trả về danh sách chương trình đang dùng môn đó và số lớp học liên kết
 */
function getSubjects({ search = "", programId = "", page = 1, limit = 50 } = {}) {
    let result = subjects.map(subject => {
        // Tra cứu các chương trình đang sử dụng môn học này
        const assignedPrograms = programSubjects
            .filter(ps => ps.subjectId === subject.id)
            .map(ps => {
                const prog = programs.find(p => p.id === ps.programId);
                return prog ? { id: prog.id, code: prog.code, name: prog.name } : null;
            })
            .filter(Boolean);

        // Đếm số lớp học đang sử dụng môn học này
        const linkedClasses = classes.filter(c => c.subjectId === subject.id);

        return {
            ...subject,
            programs: assignedPrograms,
            programCount: assignedPrograms.length,
            classCount: linkedClasses.length,
            canDelete: linkedClasses.length === 0
        };
    });

    // Lọc theo từ khóa tìm kiếm (mã môn, tên môn, chuẩn đầu ra)
    if (search && search.trim() !== "") {
        const q = search.trim().toLowerCase();
        result = result.filter(s =>
            (s.code && s.code.toLowerCase().includes(q)) ||
            (s.name && s.name.toLowerCase().includes(q)) ||
            (s.outcomes && s.outcomes.toLowerCase().includes(q))
        );
    }

    // Lọc theo chương trình đào tạo
    if (programId && programId.trim() !== "") {
        const pid = programId.trim();
        result = result.filter(s => s.programs.some(p => p.id === pid));
    }

    // Phân trang
    const total = result.length;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 50);
    const startIndex = (pageNum - 1) * limitNum;
    const paginatedItems = result.slice(startIndex, startIndex + limitNum);

    return {
        items: paginatedItems,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum) || 1
    };
}

/**
 * Tra cứu chi tiết một môn học theo ID
 */
function getSubjectById(subjectId) {
    const subject = subjects.find(s => s.id === subjectId);
    if (!subject) return null;

    const assignedPrograms = programSubjects
        .filter(ps => ps.subjectId === subjectId)
        .map(ps => {
            const prog = programs.find(p => p.id === ps.programId);
            return prog ? { id: prog.id, code: prog.code, name: prog.name } : null;
        })
        .filter(Boolean);

    const linkedClasses = classes.filter(c => c.subjectId === subjectId);

    return {
        ...subject,
        programs: assignedPrograms,
        programCount: assignedPrograms.length,
        classes: linkedClasses,
        classCount: linkedClasses.length,
        canDelete: linkedClasses.length === 0
    };
}

/**
 * Khai báo môn học mới (Create Subject)
 * Validate:
 * - Mã môn (code): Không rỗng, viết hoa chuẩn hóa, không trùng
 * - Tên môn (name): Không rỗng
 * - Số buổi (sessions): Số nguyên > 0
 * - Trọng số (weight): Số > 0
 * - Mô tả chuẩn đầu ra (outcomes): Không rỗng
 * - Danh sách chương trình (programIds): Tùy chọn, gán môn vào nhiều chương trình
 */
function createSubject({ code, name, sessions, weight, outcomes, programIds = [] }, createdBy = "training_manager") {
    // 1. Kiểm tra bắt buộc các trường
    if (!code || typeof code !== "string" || !code.trim()) {
        const error = new Error("Vui lòng cung cấp mã môn học.");
        error.statusCode = 400;
        error.field = "code";
        throw error;
    }

    if (!name || typeof name !== "string" || !name.trim()) {
        const error = new Error("Vui lòng cung cấp tên môn học.");
        error.statusCode = 400;
        error.field = "name";
        throw error;
    }

    const parsedSessions = parseInt(sessions, 10);
    if (isNaN(parsedSessions) || parsedSessions <= 0) {
        const error = new Error("Số buổi học phải là số nguyên dương lớn hơn 0.");
        error.statusCode = 400;
        error.field = "sessions";
        throw error;
    }

    const parsedWeight = parseFloat(weight);
    if (isNaN(parsedWeight) || parsedWeight <= 0) {
        const error = new Error("Trọng số môn học phải là số dương lớn hơn 0.");
        error.statusCode = 400;
        error.field = "weight";
        throw error;
    }

    if (!outcomes || typeof outcomes !== "string" || !outcomes.trim()) {
        const error = new Error("Vui lòng nhập mô tả chuẩn đầu ra của môn học.");
        error.statusCode = 400;
        error.field = "outcomes";
        throw error;
    }

    const normalizedCode = code.trim().toUpperCase();

    // 2. Kiểm tra tính duy nhất của mã môn học
    const existing = subjects.find(s => s.code.toUpperCase() === normalizedCode);
    if (existing) {
        const error = new Error(`Mã môn học "${normalizedCode}" đã tồn tại trong hệ thống. Vui lòng chọn mã môn khác.`);
        error.statusCode = 400;
        error.code = "SUBJECT_CODE_EXISTS";
        error.field = "code";
        throw error;
    }

    // 3. Tạo ID môn học
    const newId = `sbj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const newSubject = {
        id: newId,
        code: normalizedCode,
        name: name.trim(),
        sessions: parsedSessions,
        weight: parsedWeight,
        outcomes: outcomes.trim(),
        createdAt: now,
        updatedAt: now,
        createdBy
    };

    subjects.push(newSubject);

    // 4. Gán môn vào các chương trình đào tạo nếu có (Tái sử dụng môn học)
    if (Array.isArray(programIds) && programIds.length > 0) {
        for (const progId of programIds) {
            const validProg = programs.find(p => p.id === progId);
            if (validProg) {
                programSubjects.push({ programId: progId, subjectId: newId });
            }
        }
    }

    return getSubjectById(newId);
}

/**
 * Cập nhật thông tin môn học (Update Subject)
 */
function updateSubject(subjectId, { code, name, sessions, weight, outcomes, programIds }, updatedBy = "training_manager") {
    const subject = subjects.find(s => s.id === subjectId);
    if (!subject) {
        const error = new Error("Không tìm thấy môn học cần cập nhật.");
        error.statusCode = 404;
        throw error;
    }

    // Nếu cập nhật mã môn, kiểm tra tính duy nhất
    if (code !== undefined) {
        if (!code || typeof code !== "string" || !code.trim()) {
            const error = new Error("Mã môn học không được để trống.");
            error.statusCode = 400;
            error.field = "code";
            throw error;
        }
        const normalizedCode = code.trim().toUpperCase();
        const existing = subjects.find(s => s.id !== subjectId && s.code.toUpperCase() === normalizedCode);
        if (existing) {
            const error = new Error(`Mã môn học "${normalizedCode}" đã được sử dụng bởi môn học khác.`);
            error.statusCode = 400;
            error.code = "SUBJECT_CODE_EXISTS";
            throw error;
        }
        subject.code = normalizedCode;
    }

    if (name !== undefined) {
        if (!name || typeof name !== "string" || !name.trim()) {
            const error = new Error("Tên môn học không được để trống.");
            error.statusCode = 400;
            throw error;
        }
        subject.name = name.trim();
    }

    if (sessions !== undefined) {
        const parsedSessions = parseInt(sessions, 10);
        if (isNaN(parsedSessions) || parsedSessions <= 0) {
            const error = new Error("Số buổi học phải là số nguyên dương lớn hơn 0.");
            error.statusCode = 400;
            throw error;
        }
        subject.sessions = parsedSessions;
    }

    if (weight !== undefined) {
        const parsedWeight = parseFloat(weight);
        if (isNaN(parsedWeight) || parsedWeight <= 0) {
            const error = new Error("Trọng số môn học phải là số dương lớn hơn 0.");
            error.statusCode = 400;
            throw error;
        }
        subject.weight = parsedWeight;
    }

    if (outcomes !== undefined) {
        if (!outcomes || typeof outcomes !== "string" || !outcomes.trim()) {
            const error = new Error("Mô tả chuẩn đầu ra không được để trống.");
            error.statusCode = 400;
            throw error;
        }
        subject.outcomes = outcomes.trim();
    }

    // Cập nhật danh sách chương trình đào tạo nếu được truyền
    if (Array.isArray(programIds)) {
        // Xóa liên kết cũ
        programSubjects = programSubjects.filter(ps => ps.subjectId !== subjectId);
        // Thêm liên kết mới
        for (const progId of programIds) {
            const validProg = programs.find(p => p.id === progId);
            if (validProg) {
                programSubjects.push({ programId: progId, subjectId });
            }
        }
    }

    subject.updatedAt = new Date().toISOString();
    subject.updatedBy = updatedBy;

    return getSubjectById(subjectId);
}

/**
 * Xóa môn học (Delete Subject)
 * RÀNG BUỘC NGHIỆP VỤ BẮT BUỘC THEO KN-70:
 * "Môn đã có lớp học thì không xoá được"
 */
function deleteSubject(subjectId) {
    const subject = subjects.find(s => s.id === subjectId);
    if (!subject) {
        const error = new Error("Không tìm thấy môn học cần xóa.");
        error.statusCode = 404;
        throw error;
    }

    // 1. Kiểm tra ràng buộc lớp học liên kết
    const linkedClasses = classes.filter(c => c.subjectId === subjectId);
    if (linkedClasses.length > 0) {
        const classNames = linkedClasses.map(c => `${c.code} (${c.name})`).join(", ");
        const error = new Error(
            `Không thể xóa môn học "${subject.name}" [${subject.code}] vì đang có ${linkedClasses.length} lớp học liên kết: ${classNames}. Vui lòng chuyển đổi hoặc đóng các lớp học này trước.`
        );
        error.statusCode = 400;
        error.code = "CANNOT_DELETE_SUBJECT_HAS_CLASSES";
        error.classes = linkedClasses;
        throw error;
    }

    // 2. Cho phép xóa an toàn: Xóa môn học khỏi danh mục
    subjects = subjects.filter(s => s.id !== subjectId);

    // 3. Tự động xóa liên kết của môn học trong các chương trình đào tạo
    programSubjects = programSubjects.filter(ps => ps.subjectId !== subjectId);

    return {
        success: true,
        message: `Đã xóa thành công môn học "${subject.name}" [${subject.code}].`,
        deletedSubject: subject
    };
}

/**
 * Gán một môn học vào một chương trình đào tạo (Dùng lại môn cho nhiều chương trình)
 */
function addSubjectToProgram(programId, subjectId) {
    const program = programs.find(p => p.id === programId);
    if (!program) {
        const error = new Error("Không tìm thấy chương trình đào tạo.");
        error.statusCode = 404;
        throw error;
    }

    const subject = subjects.find(s => s.id === subjectId);
    if (!subject) {
        const error = new Error("Không tìm thấy môn học.");
        error.statusCode = 404;
        throw error;
    }

    // Kiểm tra đã gán chưa
    const alreadyAssigned = programSubjects.some(
        ps => ps.programId === programId && ps.subjectId === subjectId
    );

    if (!alreadyAssigned) {
        programSubjects.push({ programId, subjectId });
    }

    return getSubjectById(subjectId);
}

/**
 * Gỡ môn học khỏi chương trình đào tạo
 */
function removeSubjectFromProgram(programId, subjectId) {
    programSubjects = programSubjects.filter(
        ps => !(ps.programId === programId && ps.subjectId === subjectId)
    );
    return getSubjectById(subjectId);
}

/**
 * Lấy danh sách lớp học của một môn học
 */
function getClassesBySubjectId(subjectId) {
    return classes.filter(c => c.subjectId === subjectId);
}

/**
 * Thêm một lớp học mới gắn với môn (hỗ trợ kiểm thử ràng buộc)
 */
function addClassForSubject({ code, name, subjectId, programId = "prog_fullstack" }) {
    const newClass = {
        id: `cls_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        code: code || `CLASS-${Date.now()}`,
        name: name || "Lớp học mới",
        subjectId,
        programId,
        status: "active",
        createdAt: new Date().toISOString()
    };
    classes.push(newClass);
    return newClass;
}

module.exports = {
    initSubjectData,
    getAllPrograms,
    getProgramById,
    getSubjects,
    getSubjectById,
    createSubject,
    updateSubject,
    deleteSubject,
    addSubjectToProgram,
    removeSubjectFromProgram,
    getClassesBySubjectId,
    addClassForSubject
};
