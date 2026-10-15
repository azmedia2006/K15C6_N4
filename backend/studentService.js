const { users } = require("./authService");

const seededProfiles = {
    usr_student: {
        entryQualification: "Tốt nghiệp THPT",
        notes: "",
        currentClasses: [
            {
                className: "K15-PM01",
                courseName: "Lập trình Web Fullstack (NodeJS & React)",
                status: "Đang học"
            }
        ],
        courseHistory: [
            {
                className: "K14-CB01",
                courseName: "Tin học cơ bản",
                status: "Hoàn thành",
                completedAt: "2025-12-20"
            }
        ]
    },
    usr_student2: {
        entryQualification: "Tốt nghiệp THPT",
        notes: "",
        currentClasses: [
            {
                className: "K15-PM01",
                courseName: "Lập trình Web Fullstack (NodeJS & React)",
                status: "Đang học"
            }
        ],
        courseHistory: [
            {
                className: "K14-JS02",
                courseName: "JavaScript căn bản",
                status: "Hoàn thành",
                completedAt: "2025-11-15"
            }
        ]
    }
};

function ensureStudentProfiles() {
    const students = users.filter(user => user.role === "student");
    const usedCodes = new Set(students.map(user => user.studentCode).filter(Boolean));
    let nextNumber = 1;

    for (const student of students) {
        const seeded = seededProfiles[student.id] || {};
        if (!student.studentCode) {
            while (usedCodes.has(`SV${String(nextNumber).padStart(3, "0")}`)) {
                nextNumber += 1;
            }
            student.studentCode = `SV${String(nextNumber).padStart(3, "0")}`;
            usedCodes.add(student.studentCode);
            nextNumber += 1;
        }
        if (student.entryQualification === undefined) {
            student.entryQualification = seeded.entryQualification || "";
        }
        if (student.notes === undefined) {
            student.notes = seeded.notes || "";
        }
        if (!Array.isArray(student.currentClasses)) {
            student.currentClasses = seeded.currentClasses || [];
        }
        if (!Array.isArray(student.courseHistory)) {
            student.courseHistory = seeded.courseHistory || [];
        }
    }

    return students;
}

function toStudentProfile(user) {
    return {
        id: user.id,
        studentCode: user.studentCode,
        name: user.name,
        email: user.email,
        phone: user.phone || "",
        status: user.status || "active",
        entryQualification: user.entryQualification || "",
        notes: user.notes || "",
        currentClasses: user.currentClasses.map(item => ({ ...item })),
        courseHistory: user.courseHistory.map(item => ({ ...item })),
        updatedAt: user.updatedAt
    };
}

function getStudentProfiles(search = "") {
    const students = ensureStudentProfiles();
    const query = String(search || "").trim().toLocaleLowerCase("vi-VN");
    const normalizedPhoneQuery = query.replace(/\D/g, "");
    const filteredStudents = query
        ? students.filter(student => {
            const searchable = [
                student.studentCode,
                student.name
            ].some(value => String(value || "").toLocaleLowerCase("vi-VN").includes(query));
            const phoneMatches = normalizedPhoneQuery &&
                String(student.phone || "").replace(/\D/g, "").includes(normalizedPhoneQuery);
            return searchable || phoneMatches;
        })
        : students;

    return filteredStudents.map(toStudentProfile);
}

function getStudentProfile(idOrCode) {
    const student = ensureStudentProfiles().find(user =>
        user.id === idOrCode || user.studentCode.toLowerCase() === String(idOrCode).toLowerCase()
    );
    return student ? toStudentProfile(student) : null;
}

function updateStudentProfile(idOrCode, profile = {}) {
    const student = ensureStudentProfiles().find(user =>
        user.id === idOrCode || user.studentCode.toLowerCase() === String(idOrCode).toLowerCase()
    );
    if (!student) {
        throw { status: 404, message: "Không tìm thấy hồ sơ học viên." };
    }

    const { name, email, phone, entryQualification, notes } = profile;
    const updates = {};
    if (name !== undefined) {
        const value = String(name).trim();
        if (value.length < 2 || value.length > 100) {
            throw { status: 400, message: "Họ và tên phải từ 2 đến 100 ký tự." };
        }
        updates.name = value;
    }

    if (email !== undefined) {
        const value = String(email).trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || value.length > 254) {
            throw { status: 400, message: "Địa chỉ email không hợp lệ." };
        }
        const duplicate = users.find(user =>
            user.id !== student.id && user.email.toLowerCase() === value
        );
        if (duplicate) {
            throw { status: 409, message: "Email này đã được sử dụng bởi tài khoản khác." };
        }
        updates.email = value;
    }

    if (phone !== undefined) {
        const value = String(phone).trim();
        if (value.length > 30) {
            throw { status: 400, message: "Số điện thoại không được vượt quá 30 ký tự." };
        }
        updates.phone = value;
    }

    if (entryQualification !== undefined) {
        const value = String(entryQualification).trim();
        if (value.length > 2000) {
            throw { status: 400, message: "Trình độ đầu vào không được vượt quá 2000 ký tự." };
        }
        updates.entryQualification = value;
    }

    if (notes !== undefined) {
        const value = String(notes).trim();
        if (value.length > 5000) {
            throw { status: 400, message: "Ghi chú không được vượt quá 5000 ký tự." };
        }
        updates.notes = value;
    }

    Object.assign(student, updates);
    student.updatedAt = new Date().toISOString();
    return toStudentProfile(student);
}

module.exports = {
    getStudentProfiles,
    getStudentProfile,
    updateStudentProfile
};
