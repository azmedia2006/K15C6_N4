
const classrooms = [];
let nextId = 1;

// Thêm phòng học
function createClassroom(data) {
    const {
        name,
        type,
        capacity,
        onlineUrl = ""
    } = data;

    if (!name || !["physical", "online"].includes(type)) {
        throw new Error("Tên phòng hoặc loại phòng không hợp lệ.");
    }

    if (!Number.isInteger(capacity) || capacity < 1) {
        throw new Error("Sức chứa phải là số nguyên lớn hơn 0.");
    }

    if (type === "online" && !onlineUrl.trim()) {
        throw new Error("Phòng trực tuyến phải có đường dẫn.");
    }

    const classroom = {
        id: nextId++,
        name,
        type,
        capacity,
        onlineUrl,
        status: "active"
    };

    classrooms.push(classroom);
    return classroom;
}

// Lấy danh sách phòng học
function getClassrooms() {
    return classrooms;
}

// Tìm phòng theo mã
function getClassroomById(id) {
    return classrooms.find(room => room.id === Number(id));
}

// Kiểm tra sức chứa phòng
function checkCapacity(id, studentCount) {
    const room = getClassroomById(id);

    if (!room) {
        throw new Error("Không tìm thấy phòng học.");
    }

    if (!Number.isInteger(studentCount) || studentCount < 1) {
        throw new Error("Sĩ số phải là số nguyên lớn hơn 0.");
    }

    if (room.status !== "active") {
        return {
            allowed: false,
            message: "Phòng học hiện không hoạt động."
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
        message: "Sức chứa phòng học hợp lệ.",
        capacity: room.capacity,
        studentCount
    };
}

// Sửa thông tin phòng học
function updateClassroom(id, data) {
    const room = getClassroomById(id);

    if (!room) {
        throw new Error("Không tìm thấy phòng học.");
    }

    const updated = {
        ...room,
        ...data,
        id: room.id
    };

    if (!updated.name ||
        !["physical", "online"].includes(updated.type)) {
        throw new Error("Tên phòng hoặc loại phòng không hợp lệ.");
    }

    if (!Number.isInteger(updated.capacity) || updated.capacity < 1) {
        throw new Error("Sức chứa phải là số nguyên lớn hơn 0.");
    }

    if (updated.type === "online" &&
        (!updated.onlineUrl || !updated.onlineUrl.trim())) {
        throw new Error("Phòng trực tuyến phải có đường dẫn.");
    }

    Object.assign(room, updated);
    return room;
}

// Xóa phòng học
function deleteClassroom(id) {
    const index = classrooms.findIndex(
        room => room.id === Number(id)
    );

    if (index === -1) {
        throw new Error("Không tìm thấy phòng học.");
    }

    classrooms.splice(index, 1);
    return { message: "Đã xóa phòng học thành công." };
}
// Kiểm tra sức chứa phòng học so với sĩ số lớp
function validateRoomCapacity(classroomId, studentCount) {
    const classroom = classrooms.find(c => c.id === Number(classroomId));
    
    // Nếu chưa có/không tìm thấy phòng
    if (!classroom) {
        return {
            valid: false,
            message: "Phòng học không tồn tại hoặc chưa được khởi tạo."
        };
    }

    // Nếu là phòng online thì không giới hạn
    if (classroom.type === "online") {
        return { valid: true };
    }

    // Kiểm tra sức chứa phòng vật lý
    if (studentCount > classroom.capacity) {
        return {
            valid: false,
            message: `Sĩ số lớp (${studentCount} học viên) vượt quá sức chứa của phòng ${classroom.name} (${classroom.capacity} chỗ).`
        };
    }

    return { valid: true };
}
module.exports = {
    createClassroom,
    getClassrooms,
    getClassroomById,
    checkCapacity,
    validateRoomCapacity, // Đã thêm vào export
    updateClassroom,
    deleteClassroom
};