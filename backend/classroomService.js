
const classrooms = [];
let nextId = 1;

// Tạo phòng học mới
function createClassroom(data) {
    const {
        name,
        capacity,
        type,
        onlineUrl = ""
    } = data;

    if (!name || !String(name).trim()) {
        throw new Error("Vui lòng nhập tên phòng học.");
    }

    const parsedCapacity = Number(capacity);

    if (!Number.isInteger(parsedCapacity) || parsedCapacity <= 0) {
        throw new Error("Sức chứa phải là số nguyên lớn hơn 0.");
    }

    if (!["physical", "online"].includes(type)) {
        throw new Error("Loại phòng phải là physical hoặc online.");
    }

    if (type === "online" && !onlineUrl.trim()) {
        throw new Error("Vui lòng nhập liên kết phòng học trực tuyến.");
    }

    const classroom = {
        id: nextId++,
        name: String(name).trim(),
        capacity: parsedCapacity,
        type,
        onlineUrl: type === "online" ? onlineUrl.trim() : "",
        createdAt: new Date().toISOString()
    };

    classrooms.push(classroom);
    return classroom;
}

// Lấy danh sách phòng học
function getClassrooms() {
    return classrooms;
}

// Kiểm tra sĩ số lớp
function checkCapacity(classroomId, studentCount) {
    const classroom = classrooms.find(
        room => room.id === Number(classroomId)
    );

    if (!classroom) {
        throw new Error("Không tìm thấy phòng học.");
    }

    const count = Number(studentCount);

    if (!Number.isInteger(count) || count < 0) {
        throw new Error("Sĩ số phải là số nguyên không âm.");
    }

    return {
        classroomId: classroom.id,
        classroomName: classroom.name,
        capacity: classroom.capacity,
        studentCount: count,
        isOverCapacity: classroom.type === "physical"
            && count > classroom.capacity,
        message: classroom.type === "physical" && count > classroom.capacity
            ? `Cảnh báo: Lớp có ${count} học viên nhưng phòng chỉ chứa ${classroom.capacity} người.`
            : "Sĩ số phù hợp với phòng học."
    };
}

module.exports = {
    createClassroom,
    getClassrooms,
    checkCapacity
};
