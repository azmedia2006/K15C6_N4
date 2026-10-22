'use strict';

const database = require('./localDatabase');
const classrooms = [];
let nextId = 1;

function classroomError(message, status = 400) {
    return Object.assign(new Error(message), { status });
}

function validateRoom(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw classroomError('Thông tin phòng học không hợp lệ.');
    }

    const name = typeof data.name === 'string' ? data.name.trim() : '';
    if (!name || name.length > 120 || !['physical', 'online'].includes(data.type)) {
        throw classroomError('Tên phòng (tối đa 120 ký tự) hoặc loại phòng không hợp lệ.');
    }

    if (!Number.isInteger(data.capacity) || data.capacity < 1) {
        throw classroomError('Sức chứa phải là số nguyên lớn hơn 0.');
    }

    let onlineUrl = '';
    if (data.onlineUrl !== undefined && typeof data.onlineUrl !== 'string') {
        throw classroomError('Đường dẫn phòng học không hợp lệ.');
    }
    if (data.type === 'online') {
        onlineUrl = typeof data.onlineUrl === 'string' ? data.onlineUrl.trim() : '';
        if (!onlineUrl || onlineUrl.length > 2048) {
            throw classroomError('Phòng trực tuyến phải có đường dẫn hợp lệ.');
        }
        let parsedUrl;
        try {
            parsedUrl = new URL(onlineUrl);
        } catch {
            throw classroomError('Đường dẫn phòng trực tuyến không hợp lệ.');
        }
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
            throw classroomError('Đường dẫn phòng trực tuyến phải dùng HTTP hoặc HTTPS.');
        }
    }

    return { name, type: data.type, capacity: data.capacity, onlineUrl };
}

function getClassrooms() {
    return classrooms.map(room => ({ ...room }));
}

function getClassroomById(id) {
    const roomId = Number(id);
    if (!Number.isSafeInteger(roomId) || roomId < 1) return undefined;
    return classrooms.find(room => room.id === roomId);
}

function ensureUniqueName(name, exceptId) {
    if (classrooms.some(room =>
        room.id !== exceptId && room.name.toLowerCase() === name.toLowerCase()
    )) {
        throw classroomError('Tên phòng học đã tồn tại.', 409);
    }
}

function createClassroom(data) {
    const validated = validateRoom(data);
    ensureUniqueName(validated.name);

    const classroom = {
        id: nextId++,
        ...validated,
        status: 'active'
    };

    classrooms.push(classroom);
    return { ...classroom };
}

function checkCapacity(id, studentCount) {
    const room = getClassroomById(id);
    if (!room) {
        throw classroomError('Không tìm thấy phòng học.', 404);
    }
    if (!Number.isSafeInteger(studentCount) || studentCount < 1) {
        throw classroomError('Sĩ số phải là số nguyên lớn hơn 0.');
    }
    if (room.status !== 'active') {
        return {
            allowed: false,
            message: 'Phòng học hiện không hoạt động.',
            capacity: room.capacity,
            studentCount
        };
    }
    if (room.type === 'online') {
        return {
            allowed: true,
            message: 'Phòng trực tuyến không giới hạn sức chứa.',
            capacity: room.capacity,
            studentCount
        };
    }
    if (studentCount > room.capacity) {
        return {
            allowed: false,
            message: `Cảnh báo: Lớp có ${studentCount} học viên, vượt sức chứa ${room.capacity} người của phòng ${room.name}.`,
            capacity: room.capacity,
            studentCount
        };
    }

    return {
        allowed: true,
        message: 'Sức chứa phòng học hợp lệ.',
        capacity: room.capacity,
        studentCount
    };
}

function updateClassroom(id, data) {
    const room = getClassroomById(id);
    if (!room) {
        throw classroomError('Không tìm thấy phòng học.', 404);
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw classroomError('Thông tin phòng học không hợp lệ.');
    }
    const allowedFields = ['name', 'type', 'capacity', 'onlineUrl', 'status'];
    if (Object.keys(data).some(key => !allowedFields.includes(key))) {
        throw classroomError('Có trường thông tin phòng học không được hỗ trợ.');
    }

    const validated = validateRoom({ ...room, ...data });
    if (data.status !== undefined && !['active', 'inactive'].includes(data.status)) {
        throw classroomError('Trạng thái phòng học không hợp lệ.');
    }
    ensureUniqueName(validated.name, room.id);
    Object.assign(room, validated);
    if (data.status !== undefined) room.status = data.status;
    return { ...room };
}

function deleteClassroom(id) {
    const index = classrooms.findIndex(room => room.id === Number(id));
    if (index === -1) {
        throw classroomError('Không tìm thấy phòng học.', 404);
    }
    classrooms.splice(index, 1);
    return { message: 'Đã xóa phòng học thành công.' };
}

function validateRoomCapacity(classroomId, studentCount) {
    const result = checkCapacity(classroomId, studentCount);
    return {
        valid: result.allowed,
        message: result.message,
        capacity: result.capacity,
        studentCount: result.studentCount
    };
}

database.register('classrooms', () => ({ classrooms, nextId }), state => {
    if (!state || !Array.isArray(state.classrooms)) {
        throw new Error('Dữ liệu phòng học đã lưu không hợp lệ.');
    }
    classrooms.splice(0, classrooms.length, ...state.classrooms);
    nextId = Math.max(
        Number.isSafeInteger(state.nextId) && state.nextId > 0 ? state.nextId : 1,
        classrooms.reduce((max, room) => Math.max(max, Number(room.id) + 1), 1)
    );
});

module.exports = {
    createClassroom,
    getClassrooms,
    getClassroomById,
    checkCapacity,
    validateRoomCapacity,
    updateClassroom,
    deleteClassroom
};
