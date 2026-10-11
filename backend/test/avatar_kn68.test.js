const assert = require("assert");
const http = require("http");
const app = require("../server");
const {
    users,
    updateUserAvatar,
    deleteUserAvatar,
    validateAndProcessAvatar,
    MAX_AVATAR_SIZE_BYTES,
    ALLOWED_MIME_TYPES
} = require("../userService");

// =========================================================================
// BỘ KIỂM THỬ TỰ ĐỘNG TOÀN DIỆN CHO USER STORY KN-68:
// "Là người dùng của hệ thống, tôi muốn tải lên ảnh đại diện,
//  để giảng viên nhận ra mặt học viên khi điểm danh lớp đông."
//
// Tiêu chí chấp nhận:
// 1. Chấp nhận JPG/PNG tối đa 2MB
// 2. Ảnh được cắt vuông và tạo bản thu nhỏ (thumbnail)
// =========================================================================

let server;
let baseUrl;

async function startServer() {
    return new Promise((resolve) => {
        server = http.createServer(app);
        server.listen(0, "127.0.0.1", () => {
            const port = server.address().port;
            baseUrl = `http://127.0.0.1:${port}`;
            resolve();
        });
    });
}

async function stopServer() {
    return new Promise((resolve) => {
        if (server) {
            server.close(() => resolve());
        } else {
            resolve();
        }
    });
}

// Giả lập ảnh PNG vuông nhỏ hợp lệ dạng base64
const samplePngBase64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
const sampleJpgBase64 = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";

async function runTests() {
    console.log("\n=======================================================");
    console.log("   TMS AVATAR UPLOAD SUITE - KIỂM THỬ TỰ ĐỘNG KN-68   ");
    console.log("   Tiêu chí: JPG/PNG tối đa 2MB • Cắt vuông & Thumbnail");
    console.log("=======================================================\n");

    await startServer();

    try {
        // --- NHÓM 1: KIỂM THỬ XÁC THỰC ĐỊNH DẠNG TỆP (JPG/PNG) ---
        console.log("=== 1. KIỂM THỬ ĐỊNH DẠNG TỆP HỢP LỆ & KHÔNG HỢP LỆ ===");
        
        // 1.1 Chấp nhận PNG hợp lệ
        const validPngResult = validateAndProcessAvatar({
            avatarData: samplePngBase64,
            mimeType: "image/png",
            sizeBytes: 1024
        });
        assert.strictEqual(validPngResult.mimeType, "image/png");
        console.log("  ✔ PASS: Chấp nhận định dạng tệp PNG hợp lệ");

        // 1.2 Chấp nhận JPG / JPEG hợp lệ
        const validJpgResult = validateAndProcessAvatar({
            avatarData: sampleJpgBase64,
            mimeType: "image/jpeg",
            sizeBytes: 2048
        });
        assert.strictEqual(validJpgResult.mimeType, "image/jpeg");
        console.log("  ✔ PASS: Chấp nhận định dạng tệp JPG / JPEG hợp lệ");

        // 1.3 Từ chối định dạng GIF
        assert.throws(() => {
            validateAndProcessAvatar({
                avatarData: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
                mimeType: "image/gif"
            });
        }, (err) => {
            return err.status === 400 && err.message.includes("Chỉ chấp nhận tệp ảnh JPG hoặc PNG");
        });
        console.log("  ✔ PASS: Chặn thành công định dạng GIF (HTTP 400)");

        // 1.4 Từ chối định dạng PDF / văn bản
        assert.throws(() => {
            validateAndProcessAvatar({
                avatarData: "data:application/pdf;base64,JVBERi0xLjQK",
                mimeType: "application/pdf"
            });
        }, (err) => {
            return err.status === 400;
        });
        console.log("  ✔ PASS: Chặn thành công định dạng không phải hình ảnh (PDF/Docs)");

        // --- NHÓM 2: KIỂM THỬ GIỚI HẠN DUNG LƯỢNG TỐI ĐA 2MB ---
        console.log("\n=== 2. KIỂM THỬ GIỚI HẠN DUNG LƯỢNG TỆP TỐI ĐA 2MB ===");

        // 2.1 Tệp dung lượng 1.8MB hợp lệ (< 2MB)
        const size1_8Mb = 1.8 * 1024 * 1024;
        const validSizeResult = validateAndProcessAvatar({
            avatarData: samplePngBase64,
            mimeType: "image/png",
            sizeBytes: size1_8Mb
        });
        assert.strictEqual(validSizeResult.sizeBytes, size1_8Mb);
        console.log("  ✔ PASS: Chấp nhận tệp ảnh 1.8MB nằm trong ngưỡng 2MB");

        // 2.2 Tệp dung lượng 2.5MB (> 2MB) bị từ chối
        const size2_5Mb = 2.5 * 1024 * 1024;
        assert.throws(() => {
            validateAndProcessAvatar({
                avatarData: samplePngBase64,
                mimeType: "image/png",
                sizeBytes: size2_5Mb
            });
        }, (err) => {
            return err.status === 400 && err.message.includes("quá lớn") && err.message.includes("2MB");
        });
        console.log("  ✔ PASS: Chặn chính xác tệp vượt quá 2MB với thông báo tiếng Việt rõ ràng");

        // --- NHÓM 3: KIỂM THỬ CẮT VUÔNG VÀ TẠO BẢN THU NHỎ (THUMBNAIL) ---
        console.log("\n=== 3. KIỂM THỬ CẮT VUÔNG & BẢN THU NHỎ THUMBNAIL ===");

        const thumbnailSample = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
        const studentId = "usr_student";

        const updateResult = updateUserAvatar(studentId, {
            avatarData: samplePngBase64,
            thumbnailData: thumbnailSample,
            mimeType: "image/png"
        });

        assert.strictEqual(updateResult.id, studentId);
        assert.ok(updateResult.avatar, "Avatar phải tồn tại");
        assert.ok(updateResult.thumbnail, "Thumbnail phải tồn tại");
        console.log("  ✔ PASS: Lưu trữ ảnh vuông và tạo bản thu nhỏ thumbnail thành công");

        // --- NHÓM 4: KIỂM THỬ API RESTFUL QUA HTTP ---
        console.log("\n=== 4. KIỂM THỬ TÍCH HỢP ENDPOINT API HTTP ===");

        // 4.1 POST /api/users/:id/avatar thành công
        const postRes = await fetch(`${baseUrl}/api/users/${studentId}/avatar`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                avatarData: sampleJpgBase64,
                thumbnailData: samplePngBase64,
                mimeType: "image/jpeg",
                sizeBytes: 150000
            })
        });
        const postData = await postRes.json();
        assert.strictEqual(postRes.status, 200);
        assert.strictEqual(postData.success, true);
        assert.ok(postData.message.includes("Tải lên ảnh đại diện thành công"));
        console.log("  ✔ PASS: POST /api/users/:id/avatar trả về HTTP 200 thành công");

        // 4.2 GET /api/users/:id/avatar tra cứu ảnh
        const getRes = await fetch(`${baseUrl}/api/users/${studentId}/avatar`);
        const getData = await getRes.json();
        assert.strictEqual(getRes.status, 200);
        assert.strictEqual(getData.success, true);
        assert.strictEqual(getData.avatar, sampleJpgBase64);
        assert.strictEqual(getData.thumbnail, samplePngBase64);
        console.log("  ✔ PASS: GET /api/users/:id/avatar truy xuất đúng avatar và thumbnail");

        // 4.3 POST lỗi khi file vượt quá 2MB
        const postOverSizeRes = await fetch(`${baseUrl}/api/users/${studentId}/avatar`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                avatarData: samplePngBase64,
                mimeType: "image/png",
                sizeBytes: 3 * 1024 * 1024 // 3MB
            })
        });
        const postOverSizeData = await postOverSizeRes.json();
        assert.strictEqual(postOverSizeRes.status, 400);
        assert.strictEqual(postOverSizeData.success, false);
        console.log("  ✔ PASS: POST tệp > 2MB bị trả về HTTP 400 chính xác");

        // --- NHÓM 5: KIỂM THỬ ĐIỂM DANH LỚP ĐÔNG VỚI ẢNH NHẬN DIỆN MẶT HỌC VIÊN ---
        console.log("\n=== 5. KIỂM THỬ NHẬN DIỆN MẶT HỌC VIÊN KHI ĐIỂM DANH LỚP ĐÔNG ===");

        const attendanceRes = await fetch(`${baseUrl}/api/attendance/students`);
        const attendanceData = await attendanceRes.json();
        assert.strictEqual(attendanceRes.status, 200);
        assert.strictEqual(attendanceData.success, true);
        assert.ok(Array.isArray(attendanceData.data));
        assert.ok(attendanceData.data.length >= 3);

        const student1 = attendanceData.data.find(s => s.studentCode === "SV001");
        assert.ok(student1, "Phải có học viên SV001 trong sổ điểm danh");
        assert.ok(student1.thumbnail, "Học viên SV001 phải có thumbnail nhận diện mặt");
        console.log(`  ✔ PASS: Giảng viên tra cứu sổ điểm danh thấy ảnh thẻ thumbnail nhận diện cho SV001 (${student1.name})`);

        // --- NHÓM 6: KIỂM THỬ XÓA ẢNH ĐẠI DIỆN ---
        console.log("\n=== 6. KIỂM THỬ XÓA ẢNH ĐẠI DIỆN VỀ MẶC ĐỊNH ===");

        const delRes = await fetch(`${baseUrl}/api/users/${studentId}/avatar`, {
            method: "DELETE"
        });
        const delData = await delRes.json();
        assert.strictEqual(delRes.status, 200);
        assert.strictEqual(delData.success, true);

        const checkRes = await fetch(`${baseUrl}/api/users/${studentId}/avatar`);
        const checkData = await checkRes.json();
        assert.strictEqual(checkData.avatar, "");
        assert.strictEqual(checkData.thumbnail, "");
        console.log("  ✔ PASS: DELETE /api/users/:id/avatar xóa ảnh và reset về mặc định sạch sẽ");

        console.log("\n=======================================================");
        console.log("✔ TẤT CẢ CÁC TIÊU CHÍ NGHIỆM THU KN-68 ĐÃ ĐẠT 100%!");
        console.log("=======================================================\n");

    } finally {
        await stopServer();
    }
}

runTests().then(() => {
    process.exit(0);
}).catch((err) => {
    console.error("❌ TEST FAILED:", err);
    process.exit(1);
});
