
"use strict";

// KN-128: Phân công giảng viên và trợ giảng theo môn trong lớp
const { users } = require("./authService");
const { userHasRole } = require("./roleService");

const {
    loadKN128AssignmentsSnapshot,
    saveKN128AssignmentsSnapshot
} = require("./supabaseService");

const {
    getClassesBySubjectId,
    getSubjectById
} = require("./subjectService");

const STAFF_ROLES = {
    INSTRUCTOR: "instructor",
    ASSISTANT: "teaching_assistant"
};

// Kiểm tra vai trò, hỗ trợ cả tài khoản có nhiều vai trò
function hasStaffRole(user, role) {
    return userHasRole(user.id, role) || user.role === role;
}

// Lấy danh sách tài khoản đủ điều kiện phân công
function getEligibleStaff(role) {
    if (!Object.values(STAFF_ROLES).includes(role)) {
        throw new Error("Vai trò không hợp lệ.");
    }

    return users
        .filter(user =>
            (!user.status || user.status === "active") &&
            hasStaffRole(user, role)
        )
        .map(user => ({
            id: user.id,
            name: user.name,
            email: user.email
        }));
}

// Kiểm tra giảng viên chính và danh sách trợ giảng
function validateTeachingStaff(instructorId, assistantIds = []) {
    if (!instructorId || typeof instructorId !== "string") {
        throw new Error("Phải chọn một giảng viên chính.");
    }

    if (!Array.isArray(assistantIds)) {
        throw new Error("Danh sách trợ giảng phải là một mảng.");
    }

    if (new Set(assistantIds).size !== assistantIds.length) {
        throw new Error("Danh sách trợ giảng bị trùng.");
    }

    const instructors = getEligibleStaff(STAFF_ROLES.INSTRUCTOR);
    const assistants = getEligibleStaff(STAFF_ROLES.ASSISTANT);

    if (!instructors.some(user => user.id === instructorId)) {
        throw new Error("Giảng viên chính không có vai trò phù hợp.");
    }

    if (assistantIds.includes(instructorId)) {
        throw new Error("Giảng viên chính không được đồng thời là trợ giảng.");
    }

    for (const assistantId of assistantIds) {
        if (!assistants.some(user => user.id === assistantId)) {
            throw new Error("Trợ giảng không có vai trò phù hợp.");
        }
    }

    return true;
}

// KN-128: Bộ nhớ phân công giảng dạy tạm thời
const teachingAssignments = new Map();

/**
 * KN-128: Xếp hàng các lần ghi để tránh hai yêu cầu
 * trong cùng một server ghi đè nhau.
 */
let assignmentWriteQueue = Promise.resolve();

/**
 * KN-128: Khôi phục danh sách phân công từ Supabase Storage.
 * Chỉ thay dữ liệu trong RAM sau khi đọc và kiểm tra thành công.
 */
async function hydrateTeachingAssignments() {
    const savedAssignments = await loadKN128AssignmentsSnapshot();
    const restored = new Map();

    for (const item of savedAssignments) {
        if (
            !item ||
            typeof item.classId !== "string" ||
            typeof item.subjectId !== "string" ||
            typeof item.instructorId !== "string" ||
            !Array.isArray(item.assistantIds) ||
            !item.assistantIds.every(id => typeof id === "string")
        ) {
            throw new Error(
                "Dữ liệu phân công KN-128 trong Storage không hợp lệ."
            );
        }

        const key = `${item.classId}:${item.subjectId}`;

        if (restored.has(key)) {
            throw new Error("Dữ liệu phân công KN-128 bị trùng.");
        }

        restored.set(key, {
            ...item,
            assistantIds: [...item.assistantIds]
        });
    }

    teachingAssignments.clear();

    for (const [key, assignment] of restored) {
        teachingAssignments.set(key, assignment);
    }

    return teachingAssignments.size;
}


// Tạo hoặc cập nhật phân công giảng dạy
function saveTeachingAssignment({
    classId,
    subjectId,
    instructorId,
    assistantIds = []
} = {}) {
    const doSave = async () => {
        // Kiểm tra môn học tồn tại
        const subject = getSubjectById(subjectId);

        if (!subject) {
            throw new Error("Môn học không tồn tại.");
        }

        // Kiểm tra lớp thuộc đúng môn
        const classItem = getClassesBySubjectId(subjectId)
            .find(cls => cls.id === classId);

        if (!classItem) {
            throw new Error(
                "Lớp học không tồn tại hoặc không thuộc môn này."
            );
        }

        // Kiểm tra vai trò giảng viên và trợ giảng
        validateTeachingStaff(instructorId, assistantIds);

        const assignment = {
            classId,
            subjectId,
            instructorId,
            assistantIds: [...assistantIds],
            updatedAt: new Date().toISOString()
        };

        const key = `${classId}:${subjectId}`;

        // Đọc bản mới nhất trước khi cập nhật
        let remoteAssignments;

        try {
            remoteAssignments =
                await loadKN128AssignmentsSnapshot();
        } catch (error) {
            error.statusCode = 503;
            throw error;
        }

        const nextAssignments = new Map();

        for (const item of remoteAssignments) {
            if (
                !item ||
                typeof item.classId !== "string" ||
                typeof item.subjectId !== "string" ||
                !Array.isArray(item.assistantIds)
            ) {
                const error = new Error(
                    "Dữ liệu phân công trên Storage không hợp lệ."
                );
                error.statusCode = 503;
                throw error;
            }

            nextAssignments.set(
                `${item.classId}:${item.subjectId}`,
                item
            );
        }

        // Cập nhật đúng cặp lớp - môn
        nextAssignments.set(key, assignment);

        // Phải lưu Storage thành công trước
        try {
            await saveKN128AssignmentsSnapshot(
                [...nextAssignments.values()]
            );
        } catch (error) {
            error.statusCode = 503;
            throw error;
        }

        // Chỉ cập nhật RAM sau khi lưu thành công
        teachingAssignments.clear();

        for (const [savedKey, savedItem] of nextAssignments) {
            teachingAssignments.set(savedKey, savedItem);
        }

        return {
            ...assignment,
            assistantIds: [...assignment.assistantIds]
        };
    };

    const pending = assignmentWriteQueue.then(doSave);

    // Một lần ghi thất bại không làm kẹt các lần ghi sau
    assignmentWriteQueue = pending.catch(() => {});

    return pending;
}

// Xem phân công của một môn trong một lớp
function getTeachingAssignment(classId, subjectId) {
    const key = `${classId}:${subjectId}`;
    const assignment = teachingAssignments.get(key);

    if (!assignment) return null;

    return {
        ...assignment,
        assistantIds: [...assignment.assistantIds]
    };
}

// Lấy các lớp mà giảng viên chính được phân công
function getInstructorClasses(instructorId) {
    return [...teachingAssignments.values()]
        .filter(item => item.instructorId === instructorId)
        .map(item => {
            const cls = getClassesBySubjectId(item.subjectId)
                .find(c => c.id === item.classId);

            const subject = getSubjectById(item.subjectId);

            return {
                classId: item.classId,
                className: cls?.name || "",
                classCode: cls?.code || "",
                subjectId: item.subjectId,
                subjectName: subject?.name || "",
                instructorId: item.instructorId,
                assistantIds: [...item.assistantIds]
            };
        });
}

module.exports = {
    STAFF_ROLES,
    getEligibleStaff,
    validateTeachingStaff,
    saveTeachingAssignment,
    getTeachingAssignment,
    getInstructorClasses,
    hydrateTeachingAssignments
};
