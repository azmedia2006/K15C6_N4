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
// CHỨNG MINH TIÊU CHÍ KN-70 & KN-71:
// - Một môn học dùng lại được ở nhiều chương trình đào tạo
// - Sắp thứ tự học theo lộ trình (orderIndex)
// - Khai báo môn tiên quyết (prerequisiteSubjectId) - không học nâng cao trước nền tảng
const initialProgramSubjects = [
    // Lộ trình chương trình Lập trình Web Fullstack (prog_fullstack):
    { programId: "prog_fullstack", subjectId: "sbj_agile_git", orderIndex: 1, prerequisiteSubjectId: null },
    { programId: "prog_fullstack", subjectId: "sbj_js_core", orderIndex: 2, prerequisiteSubjectId: "sbj_agile_git" },
    { programId: "prog_fullstack", subjectId: "sbj_db_sql", orderIndex: 3, prerequisiteSubjectId: null },
    { programId: "prog_fullstack", subjectId: "sbj_react_spa", orderIndex: 4, prerequisiteSubjectId: "sbj_js_core" },
    { programId: "prog_fullstack", subjectId: "sbj_node_api", orderIndex: 5, prerequisiteSubjectId: "sbj_db_sql" },

    // Lộ trình chương trình Khoa học Dữ liệu & AI (prog_data_ai):
    { programId: "prog_data_ai", subjectId: "sbj_agile_git", orderIndex: 1, prerequisiteSubjectId: null },
    { programId: "prog_data_ai", subjectId: "sbj_db_sql", orderIndex: 2, prerequisiteSubjectId: null },
    { programId: "prog_data_ai", subjectId: "sbj_python_ds", orderIndex: 3, prerequisiteSubjectId: "sbj_db_sql" },

    // Lộ trình chương trình Java Doanh nghiệp (prog_java_enterprise):
    { programId: "prog_java_enterprise", subjectId: "sbj_agile_git", orderIndex: 1, prerequisiteSubjectId: null },
    { programId: "prog_java_enterprise", subjectId: "sbj_db_sql", orderIndex: 2, prerequisiteSubjectId: null },

    // Lộ trình Quản trị Dự án (prog_project_mgmt):
    { programId: "prog_project_mgmt", subjectId: "sbj_agile_git", orderIndex: 1, prerequisiteSubjectId: null }
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

    const assignedPs = programSubjects
        .filter(ps => ps.programId === programId)
        .slice()
        .sort((a, b) => (a.orderIndex || 1) - (b.orderIndex || 1));

    const programSubs = assignedPs.map(ps => {
        const s = subjects.find(sub => sub.id === ps.subjectId);
        if (!s) return null;
        const classCount = classes.filter(c => c.subjectId === s.id).length;

        let prereqSubject = null;
        if (ps.prerequisiteSubjectId) {
            const prereq = subjects.find(sub => sub.id === ps.prerequisiteSubjectId);
            if (prereq) {
                prereqSubject = {
                    id: prereq.id,
                    code: prereq.code,
                    name: prereq.name
                };
            }
        }

        // Danh sách các môn trong chương trình đang nhận môn này làm môn tiên quyết
        const isPrerequisiteFor = assignedPs
            .filter(otherPs => otherPs.prerequisiteSubjectId === s.id)
            .map(otherPs => {
                const sub = subjects.find(sub => sub.id === otherPs.subjectId);
                return sub ? { id: sub.id, code: sub.code, name: sub.name, orderIndex: otherPs.orderIndex } : null;
            })
            .filter(Boolean);

        return {
            ...s,
            orderIndex: ps.orderIndex || 1,
            prerequisiteSubjectId: ps.prerequisiteSubjectId || null,
            prerequisiteSubject: prereqSubject,
            isPrerequisiteFor,
            classCount
        };
    }).filter(Boolean);

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
                const curSubs = programSubjects.filter(ps => ps.programId === progId);
                const nextOrder = curSubs.reduce((max, ps) => Math.max(max, ps.orderIndex || 1), 0) + 1;
                programSubjects.push({
                    programId: progId,
                    subjectId: newId,
                    orderIndex: nextOrder,
                    prerequisiteSubjectId: null
                });
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
        const oldLinks = programSubjects.filter(ps => ps.subjectId === subjectId);
        // Xóa liên kết cũ
        programSubjects = programSubjects.filter(ps => ps.subjectId !== subjectId);
        // Thêm liên kết mới
        for (const progId of programIds) {
            const validProg = programs.find(p => p.id === progId);
            if (validProg) {
                const prev = oldLinks.find(l => l.programId === progId);
                const curSubs = programSubjects.filter(ps => ps.programId === progId);
                const nextOrder = curSubs.reduce((max, ps) => Math.max(max, ps.orderIndex || 1), 0) + 1;
                programSubjects.push({
                    programId: progId,
                    subjectId,
                    orderIndex: prev ? (prev.orderIndex || nextOrder) : nextOrder,
                    prerequisiteSubjectId: prev ? prev.prerequisiteSubjectId : null
                });
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

    // 2. Ràng buộc: Kiểm tra môn có đang làm môn tiên quyết cho môn khác không
    const prereqDependents = programSubjects.filter(ps => ps.prerequisiteSubjectId === subjectId);
    if (prereqDependents.length > 0) {
        const depNames = prereqDependents.map(d => {
            const s = subjects.find(sub => sub.id === d.subjectId);
            const p = programs.find(prog => prog.id === d.programId);
            return `${s ? s.name : d.subjectId} (${p ? p.name : d.programId})`;
        }).join("; ");
        const error = new Error(`Không thể xóa môn học "${subject.name}" [${subject.code}] vì đang là môn tiên quyết của các môn: ${depNames}. Vui lòng gỡ ràng buộc môn tiên quyết trước khi xóa.`);
        error.statusCode = 400;
        error.code = "CANNOT_DELETE_PREREQUISITE_SUBJECT";
        throw error;
    }

    // 3. Cho phép xóa an toàn: Xóa môn học khỏi danh mục
    subjects = subjects.filter(s => s.id !== subjectId);

    // 4. Tự động xóa liên kết của môn học trong các chương trình đào tạo
    programSubjects = programSubjects.filter(ps => ps.subjectId !== subjectId);

    return {
        success: true,
        message: `Đã xóa thành công môn học "${subject.name}" [${subject.code}].`,
        deletedSubject: subject
    };
}

/**
 * Kiểm tra chu kỳ môn tiên quyết trong chương trình (Cycle Detection / DFS)
 */
function hasPrerequisiteCycle(programId) {
    const list = programSubjects.filter(ps => ps.programId === programId);
    const adj = new Map();
    for (const item of list) {
        if (!adj.has(item.subjectId)) adj.set(item.subjectId, []);
        if (item.prerequisiteSubjectId) {
            // Cạnh: subjectId phụ thuộc vào prerequisiteSubjectId
            adj.get(item.subjectId).push(item.prerequisiteSubjectId);
        }
    }

    const visited = new Set();
    const inStack = new Set();

    function dfs(node) {
        visited.add(node);
        inStack.add(node);
        const neighbors = adj.get(node) || [];
        for (const neighbor of neighbors) {
            if (!visited.has(neighbor)) {
                if (dfs(neighbor)) return true;
            } else if (inStack.has(neighbor)) {
                return true;
            }
        }
        inStack.delete(node);
        return false;
    }

    for (const node of adj.keys()) {
        if (!visited.has(node)) {
            if (dfs(node)) return true;
        }
    }
    return false;
}

/**
 * Gán một môn học vào một chương trình đào tạo (KN-70 & KN-71)
 * Hỗ trợ xác định thứ tự học ban đầu (orderIndex) và môn tiên quyết (prerequisiteSubjectId)
 */
function addSubjectToProgram(programId, subjectId, options = {}) {
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

    const currentProgSubjects = programSubjects.filter(ps => ps.programId === programId);
    const existing = currentProgSubjects.find(ps => ps.subjectId === subjectId);

    const maxOrder = currentProgSubjects.reduce((max, ps) => Math.max(max, ps.orderIndex || 1), 0);
    let targetOrder = Number.isInteger(options.orderIndex) && options.orderIndex > 0
        ? options.orderIndex
        : (existing ? existing.orderIndex : (maxOrder + 1));

    let prerequisiteId = options.prerequisiteSubjectId !== undefined
        ? (options.prerequisiteSubjectId || null)
        : (existing ? existing.prerequisiteSubjectId : null);

    // Kiểm tra ràng buộc môn tiên quyết nếu có
    if (prerequisiteId) {
        if (prerequisiteId === subjectId) {
            const error = new Error("Môn học không thể tự chọn chính mình làm môn tiên quyết.");
            error.statusCode = 400;
            error.code = "SELF_PREREQUISITE_NOT_ALLOWED";
            throw error;
        }

        const prereqSubject = subjects.find(s => s.id === prerequisiteId);
        if (!prereqSubject) {
            const error = new Error("Môn tiên quyết đã chọn không tồn tại trong danh mục.");
            error.statusCode = 400;
            error.code = "PREREQUISITE_NOT_FOUND";
            throw error;
        }

        const prereqInProg = currentProgSubjects.find(ps => ps.subjectId === prerequisiteId);
        if (!prereqInProg) {
            const error = new Error(`Môn tiên quyết "${prereqSubject.name}" [${prereqSubject.code}] chưa được gắn vào chương trình "${program.name}". Vui lòng gắn môn tiên quyết vào chương trình trước.`);
            error.statusCode = 400;
            error.code = "PREREQUISITE_NOT_IN_PROGRAM";
            throw error;
        }

        if (prereqInProg.orderIndex >= targetOrder) {
            const error = new Error(`Thứ tự học không hợp lệ: Môn tiên quyết "${prereqSubject.name}" [${prereqSubject.code}] (thứ tự #${prereqInProg.orderIndex}) phải có thứ tự học đứng trước môn "${subject.name}" [${subject.code}] (thứ tự #${targetOrder}). Học viên không thể học môn nâng cao trước môn nền tảng!`);
            error.statusCode = 400;
            error.code = "PREREQUISITE_ORDER_VIOLATION";
            throw error;
        }
    }

    if (existing) {
        existing.orderIndex = targetOrder;
        existing.prerequisiteSubjectId = prerequisiteId;
    } else {
        programSubjects.push({
            programId,
            subjectId,
            orderIndex: targetOrder,
            prerequisiteSubjectId: prerequisiteId
        });
    }

    // Kiểm tra chu kỳ
    if (hasPrerequisiteCycle(programId)) {
        if (!existing) {
            programSubjects = programSubjects.filter(ps => !(ps.programId === programId && ps.subjectId === subjectId));
        }
        const error = new Error("Phát hiện vòng lặp môn tiên quyết (Cyclic Dependency). Vui lòng chọn môn tiên quyết hợp lệ.");
        error.statusCode = 400;
        error.code = "PREREQUISITE_CYCLE_DETECTED";
        throw error;
    }

    return getSubjectById(subjectId);
}

/**
 * Gỡ môn học khỏi chương trình đào tạo (KN-70 & KN-71)
 * Ràng buộc: Không được gỡ môn đang làm tiên quyết cho môn khác trong cùng chương trình
 */
function removeSubjectFromProgram(programId, subjectId) {
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

    const existing = programSubjects.find(ps => ps.programId === programId && ps.subjectId === subjectId);
    if (!existing) {
        const error = new Error(`Môn học "${subject.name}" [${subject.code}] không thuộc chương trình "${program.name}".`);
        error.statusCode = 400;
        throw error;
    }

    // Kiểm tra môn có đang làm tiên quyết cho môn nào khác trong cùng chương trình không
    const dependents = programSubjects.filter(
        ps => ps.programId === programId && ps.prerequisiteSubjectId === subjectId
    );
    if (dependents.length > 0) {
        const depNames = dependents.map(d => {
            const sub = subjects.find(s => s.id === d.subjectId);
            return sub ? `"${sub.name}" [${sub.code}]` : d.subjectId;
        }).join(", ");
        const error = new Error(
            `Không thể gỡ môn học "${subject.name}" [${subject.code}] khỏi chương trình "${program.name}" vì đang là môn tiên quyết cho: ${depNames}. Vui lòng gỡ hoặc thay đổi môn tiên quyết của các môn này trước.`
        );
        error.statusCode = 400;
        error.code = "CANNOT_REMOVE_PREREQUISITE_SUBJECT";
        error.dependentSubjects = dependents;
        throw error;
    }

    // Xóa liên kết
    programSubjects = programSubjects.filter(
        ps => !(ps.programId === programId && ps.subjectId === subjectId)
    );

    // Chuẩn hóa lại thứ tự học (1, 2, 3...)
    const remaining = programSubjects.filter(ps => ps.programId === programId);
    remaining.sort((a, b) => (a.orderIndex || 1) - (b.orderIndex || 1));
    remaining.forEach((ps, idx) => {
        ps.orderIndex = idx + 1;
    });

    return getSubjectById(subjectId);
}

/**
 * Khai báo môn tiên quyết cho môn học trong chương trình (KN-71)
 */
function setPrerequisiteSubject(programId, subjectId, prerequisiteSubjectId) {
    const program = programs.find(p => p.id === programId);
    if (!program) {
        const error = new Error("Không tìm thấy chương trình đào tạo.");
        error.statusCode = 404;
        throw error;
    }

    const currentPs = programSubjects.find(ps => ps.programId === programId && ps.subjectId === subjectId);
    if (!currentPs) {
        const error = new Error("Môn học chưa thuộc chương trình đào tạo này.");
        error.statusCode = 404;
        throw error;
    }

    const currentSub = subjects.find(s => s.id === subjectId);

    // Gỡ bỏ môn tiên quyết (null hoặc rỗng)
    if (!prerequisiteSubjectId || prerequisiteSubjectId === "" || prerequisiteSubjectId === "none") {
        currentPs.prerequisiteSubjectId = null;
        return getProgramById(programId);
    }

    // Không được tự làm tiên quyết
    if (prerequisiteSubjectId === subjectId) {
        const error = new Error("Môn học không thể tự chọn chính mình làm môn tiên quyết.");
        error.statusCode = 400;
        error.code = "SELF_PREREQUISITE_NOT_ALLOWED";
        throw error;
    }

    // Môn tiên quyết phải thuộc cùng chương trình
    const prereqPs = programSubjects.find(ps => ps.programId === programId && ps.subjectId === prerequisiteSubjectId);
    if (!prereqPs) {
        const error = new Error("Môn tiên quyết phải thuộc cùng chương trình đào tạo.");
        error.statusCode = 400;
        error.code = "PREREQUISITE_NOT_IN_PROGRAM";
        throw error;
    }

    const prereqSub = subjects.find(s => s.id === prerequisiteSubjectId);

    // Thứ tự học môn tiên quyết phải đứng trước môn hiện tại
    if (prereqPs.orderIndex >= currentPs.orderIndex) {
        const error = new Error(
            `Thứ tự học không hợp lệ: Môn tiên quyết "${prereqSub ? prereqSub.name : prerequisiteSubjectId}" [${prereqSub ? prereqSub.code : ''}] (thứ tự #${prereqPs.orderIndex}) phải có thứ tự học đứng trước môn "${currentSub ? currentSub.name : subjectId}" [${currentSub ? currentSub.code : ''}] (thứ tự #${currentPs.orderIndex}). Học viên không thể học môn nâng cao trước môn nền tảng!`
        );
        error.statusCode = 400;
        error.code = "PREREQUISITE_ORDER_VIOLATION";
        throw error;
    }

    const oldPrereq = currentPs.prerequisiteSubjectId;
    currentPs.prerequisiteSubjectId = prerequisiteSubjectId;

    if (hasPrerequisiteCycle(programId)) {
        currentPs.prerequisiteSubjectId = oldPrereq;
        const error = new Error("Phát hiện vòng lặp môn tiên quyết (Cyclic Dependency). Vui lòng chọn môn tiên quyết khác.");
        error.statusCode = 400;
        error.code = "PREREQUISITE_CYCLE_DETECTED";
        throw error;
    }

    return getProgramById(programId);
}

/**
 * Sắp xếp lại thứ tự học các môn trong chương trình (Kéo thả reorder - KN-71)
 * Đảm bảo: Không môn nào được xếp đứng trước môn tiên quyết của nó
 */
function reorderProgramSubjects(programId, orders) {
    const program = programs.find(p => p.id === programId);
    if (!program) {
        const error = new Error("Không tìm thấy chương trình đào tạo.");
        error.statusCode = 404;
        throw error;
    }

    const currentList = programSubjects.filter(ps => ps.programId === programId);
    if (currentList.length === 0) {
        return getProgramById(programId);
    }

    let orderMap = new Map();
    if (Array.isArray(orders)) {
        if (orders.length > 0 && typeof orders[0] === "string") {
            orders.forEach((sId, idx) => {
                orderMap.set(sId, idx + 1);
            });
        } else if (orders.length > 0 && typeof orders[0] === "object") {
            orders.forEach(item => {
                if (item.subjectId && Number.isInteger(item.orderIndex)) {
                    orderMap.set(item.subjectId, item.orderIndex);
                }
            });
        }
    }

    if (orderMap.size === 0) {
        const error = new Error("Danh sách thứ tự môn học không hợp lệ.");
        error.statusCode = 400;
        throw error;
    }

    // Kiểm tra tất cả môn thuộc chương trình
    for (const [sId] of orderMap.entries()) {
        if (!currentList.some(ps => ps.subjectId === sId)) {
            const error = new Error(`Môn học "${sId}" không thuộc chương trình đào tạo này.`);
            error.statusCode = 400;
            throw error;
        }
    }

    // TIÊU CHÍ KN-71: Kiểm tra sau khi sắp xếp lại, môn tiên quyết PHẢI đứng trước môn hiện tại
    for (const ps of currentList) {
        if (ps.prerequisiteSubjectId) {
            const currentNewOrder = orderMap.has(ps.subjectId) ? orderMap.get(ps.subjectId) : ps.orderIndex;
            const prereqNewOrder = orderMap.has(ps.prerequisiteSubjectId) ? orderMap.get(ps.prerequisiteSubjectId) : (
                currentList.find(p => p.subjectId === ps.prerequisiteSubjectId)?.orderIndex
            );

            if (prereqNewOrder !== undefined && prereqNewOrder >= currentNewOrder) {
                const sub = subjects.find(s => s.id === ps.subjectId);
                const prereq = subjects.find(s => s.id === ps.prerequisiteSubjectId);
                const subName = sub ? sub.name : ps.subjectId;
                const subCode = sub ? sub.code : '';
                const prereqName = prereq ? prereq.name : ps.prerequisiteSubjectId;
                const prereqCode = prereq ? prereq.code : '';

                const error = new Error(
                    `Thứ tự học không hợp lệ: Môn "${subName}" [${subCode}] (thứ tự mới #${currentNewOrder}) không thể học trước hoặc cùng môn tiên quyết "${prereqName}" [${prereqCode}] (thứ tự mới #${prereqNewOrder}). Học viên không thể học môn nâng cao trước môn nền tảng!`
                );
                error.statusCode = 400;
                error.code = "PREREQUISITE_ORDER_VIOLATION";
                error.violatingSubjectId = ps.subjectId;
                error.prerequisiteSubjectId = ps.prerequisiteSubjectId;
                throw error;
            }
        }
    }

    // Cập nhật thứ tự mới
    currentList.forEach(ps => {
        if (orderMap.has(ps.subjectId)) {
            ps.orderIndex = orderMap.get(ps.subjectId);
        }
    });

    currentList.sort((a, b) => a.orderIndex - b.orderIndex);

    return getProgramById(programId);
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
    setPrerequisiteSubject,
    reorderProgramSubjects,
    hasPrerequisiteCycle,
    getClassesBySubjectId,
    addClassForSubject
};

module.exports.exportState=()=>({programs,subjects,programSubjects,classes});
module.exports.upsertSharedClass=cls=>{const index=classes.findIndex(c=>c.id===cls.id);if(index<0)classes.push({...cls});else Object.assign(classes[index],cls);};
require('./localDatabase').register('subjects',()=>({programs,subjects,programSubjects,classes}),v=>{programs=v.programs;subjects=v.subjects;programSubjects=v.programSubjects;classes=v.classes;});
