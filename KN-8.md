# Báo cáo Triển khai Tính năng KN-8: Phân quyền theo Vai trò Toàn Hệ thống

> **Jira Issue:** [KN-8] - Sprint 1  
> **Parent Epic:** KN-14 Tài khoản, Phân quyền & Hồ sơ  
> **Story Points:** 2  
> **Assignee:** Minh Quân  
> **User Story:** *"Là Quản trị hệ thống, tôi muốn phân quyền theo vai trò cho toàn hệ thống, để đảm bảo giảng viên không sửa được học phí và kế toán không sửa được điểm."*  
> **Nhánh Git:** `Develop` và `main`  
> **Môi trường Live:** [https://k15c6n4.vercel.app](https://k15c6n4.vercel.app)

---

## 1. Tiêu chí nghiệm thu (Acceptance Criteria)

Theo đặc tả của vé **KN-8** trên hệ thống Jira, tính năng phải thỏa mãn 4 tiêu chí cốt lõi:

| STT | Tiêu chí trên Jira | Hiện thực hóa kỹ thuật trong mã nguồn | Trạng thái |
| :---: | :--- | :--- | :---: |
| **1** | **Khai báo được quyền cho từng vai trò trong tầm vai trò nghiệp vụ** | Xây dựng ma trận quyền hạn (RBAC Matrix) rõ ràng:<br>• **Giảng viên (`instructor`)**: Được phép điểm danh, chấm bài, cập nhật điểm thi (`PUT /api/scores/:id`). **Bị cấm hoàn toàn thao tác sửa học phí**.<br>• **Kế toán (`accountant`)**: Được phép lập biên lai, thu tiền, cập nhật trạng thái học phí (`PUT /api/tuition/:id`). **Bị cấm hoàn toàn thao tác sửa điểm số**.<br>• **Học viên (`student`)**: Chỉ có quyền đọc (Read-only) thời khóa biểu, điểm số và học phí của bản thân. Bị chặn mọi quyền chỉnh sửa.<br>• **Quản trị viên (`administrator`)**: Toàn quyền vận hành, phân quyền và cấu hình hệ thống. | ✅ **ĐẠT** |
| **2** | **Mọi chức năng đều kiểm quyền ở tầng server, mặc định là từ chối** | Triển khai cơ chế kiểm soát truy cập thông qua Middleware Node.js Express tại tầng máy chủ (`backend/server.js`):<br>• Không dựa vào việc ẩn nút ở Frontend (vì người dùng có thể gửi request qua API).<br>• Mọi request đều phải vượt qua `authenticateToken` và `requireRole(...)`. Mặc định nếu không thuộc vai trò được phép sẽ bị từ chối ngay lập tức với mã lỗi **HTTP 403 Forbidden** (hoặc **HTTP 401 Unauthorized** nếu thiếu token). | ✅ **ĐẠT** |
| **3** | **Truy cập thiếu quyền hiển thị thông báo tiếng Việt rõ ràng thay vì lỗi kỹ thuật** | Khi bị chặn quyền, server không trả về lỗi sập hệ thống (500) hay biệt ngữ lập trình khó hiểu mà trả về JSON có thông điệp tiếng Việt cụ thể:<br>• Giảng viên gọi API học phí: *"Từ chối truy cập: Bạn không có quyền quản lý hoặc sửa học phí. Chức năng này chỉ dành cho Kế toán và Quản trị viên."*<br>• Kế toán gọi API điểm số: *"Từ chối truy cập: Bạn không có quyền nhập hoặc sửa điểm số. Chức năng này chỉ dành cho Giảng viên và Quản trị viên."*<br>• Người dùng thường vào API Admin: *"Từ chối truy cập: Thao tác này yêu cầu quyền Quản trị hệ thống (Administrator)."* | ✅ **ĐẠT** |
| **4** | **Có kiểm thử tự động cho ít nhất ba vai trò** | Xây dựng bộ kiểm thử tự động độc lập `backend/test/rbac_kn8.test.js` bao phủ cho **4 vai trò** nghiệp vụ (*Giảng viên, Kế toán, Học viên, Quản trị viên*). Kết quả chạy lệnh `npm test` đạt **100% PASS**. | ✅ **ĐẠT** |

---

## 2. Kiến trúc & Giải pháp Kỹ thuật

### 2.1 Backend (Node.js & Express)

1. **Middleware Kiểm soát Truy cập Phân quyền (`requireRole`)**:
   - Vị trí: `backend/server.js`
   - Nhiệm vụ: Trích xuất danh sách vai trò hiện tại của người dùng từ Token JWT đã xác thực, so khớp với danh mục vai trò được phép truy cập (`allowedRoles`).
   - Nếu không thỏa mãn, chặn ngay từ tầng Gateway với mã **HTTP 403** kèm phản hồi chi tiết:
     ```javascript
     function requireRole(...allowedRoles) {
         return (req, res, next) => {
             if (!req.user || !Array.isArray(req.user.roles)) {
                 return res.status(401).json({
                     success: false,
                     message: "Chưa xác thực người dùng. Vui lòng đăng nhập lại."
                 });
             }

             const userRoleCodes = req.user.roles.map(r => r.code || r.id);
             const hasPermission = allowedRoles.some(role =>
                 userRoleCodes.includes(role) || req.user.role === role
             );

             if (!hasPermission) {
                 let roleMsg = "Bạn không có quyền thực hiện thao tác này.";
                 if (allowedRoles.includes("accountant") && !allowedRoles.includes("instructor")) {
                     roleMsg = "Từ chối truy cập: Bạn không có quyền quản lý hoặc sửa học phí. Chức năng này chỉ dành cho Kế toán và Quản trị viên.";
                 } else if (allowedRoles.includes("instructor") && !allowedRoles.includes("accountant")) {
                     roleMsg = "Từ chối truy cập: Bạn không có quyền nhập hoặc sửa điểm số. Chức năng này chỉ dành cho Giảng viên và Quản trị viên.";
                 } else if (allowedRoles.includes("administrator")) {
                     roleMsg = "Từ chối truy cập: Thao tác này yêu cầu quyền Quản trị hệ thống (Administrator).";
                 }

                 return res.status(403).json({
                     success: false,
                     message: roleMsg,
                     requiredRoles: allowedRoles
                 });
             }
             next();
         };
     }
     ```

2. **Các RESTful Endpoint Nghiệp vụ Được Bảo vệ**:
   * **Quản lý Điểm số (Scores)**:
     - `PUT /api/scores/:scoreId`: Yêu cầu vai trò `instructor` hoặc `administrator`. Kế toán và Học viên gọi vào sẽ bị từ chối 403.
     - `GET /api/scores/:scoreId`: Cho phép Giảng viên, Học viên, Quản lý đào tạo và Admin xem.
   * **Quản lý Học phí (Tuition)**:
     - `PUT /api/tuition/:tuitionId`: Yêu cầu vai trò `accountant` hoặc `administrator`. Giảng viên và Học viên gọi vào sẽ bị từ chối 403.
     - `GET /api/tuition/:tuitionId`: Cho phép Kế toán, Học viên và Admin xem.

### 2.2 Frontend & Trải nghiệm Người dùng (RBAC UX)

- **Giao diện Menu Động (KN-14 RBAC Menu)**:
  - Khi Giảng viên đăng nhập: Menu thanh bên tự động ẩn mục *"Học phí & Biên lai thu"*, chỉ hiển thị các mục phục vụ giảng dạy (*Khóa học, Lớp học, Lịch dạy, Điểm danh, Bảng điểm*).
  - Khi Kế toán đăng nhập: Menu tự động ẩn mục *"Bảng điểm"* và *"Lịch học phòng máy"*, ưu tiên hiển thị mục *"Học viên, Học phí & Báo cáo công nợ"*.
  - Khi Học viên đăng nhập: Ẩn toàn bộ menu chức năng quản trị, chỉ giữ lại các tiện ích học tập cá nhân.
- **Tính năng Quick Role Switcher (🎭)**:
  - Tích hợp dropdown chuyển đổi nhanh vai trò ngay trên góc thanh Header của trang Dashboard giúp kiểm thử trực quan phân quyền 8 vai trò mà không cần đăng xuất liên tục.

---

## 3. Kết quả Kiểm thử Tự động (`backend/test/rbac_kn8.test.js`)

Lệnh thực thi kiểm thử:
```bash
npm run test:kn8
# hoặc kiểm thử toàn bộ hệ thống: npm test
```

### 📋 Kết quả chạy thực tế (100% PASS):

```text
=======================================================
   TMS RBAC SUITE - KIỂM THỬ TỰ ĐỘNG KN-8             
   Tiêu chí: Giảng viên không sửa được học phí &       
             Kế toán không sửa được điểm số           
=======================================================

=== 1. KIỂM THỬ VAI TRÒ GIẢNG VIÊN (INSTRUCTOR) ===
  ✔ PASS: Giảng viên sửa điểm thành công (HTTP 200)
  ✔ PASS: Giảng viên cố tình sửa học phí -> BỊ CHẶN 403 kèm thông báo tiếng Việt chuẩn

=== 2. KIỂM THỬ VAI TRÒ KẾ TOÁN (ACCOUNTANT) ===
  ✔ PASS: Kế toán cập nhật học phí thành công (HTTP 200)
  ✔ PASS: Kế toán cố tình sửa điểm số -> BỊ CHẶN 403 kèm thông báo tiếng Việt chuẩn

=== 3. KIỂM THỬ VAI TRÒ HỌC VIÊN (STUDENT) ===
  ✔ PASS: Học viên cố tình sửa điểm -> BỊ CHẶN 403
  ✔ PASS: Học viên cố tình sửa học phí -> BỊ CHẶN 403
  ✔ PASS: Học viên vào API Quản trị -> BỊ CHẶN 403 kèm thông báo yêu cầu Administrator

=== 4. KIỂM THỬ VAI TRÒ QUẢN TRỊ VIÊN (ADMINISTRATOR) ===
  ✔ PASS: Quản trị viên có toàn quyền sửa điểm số (HTTP 200)
  ✔ PASS: Quản trị viên có toàn quyền sửa học phí (HTTP 200)

=== 5. KIỂM THỬ BẢO MẬT TẦNG SERVER KHI THIẾU TOKEN (DEFAULT DENY) ===
  ✔ PASS: Mọi chức năng kiểm quyền ở tầng server, mặc định từ chối khi không có token (HTTP 401)

✔ TẤT CẢ CÁC TIÊU CHÍ NGHIỆM THU CỦA KN-8 ĐÃ VƯỢT QUA 100% THÀNH CÔNG!
```

---

## 4. Hướng dẫn Kiểm tra Nghiệp vụ (Demo)

Bạn có thể kiểm tra trực tiếp trên máy cục bộ hoặc môi trường Live Vercel:

### 4.1 Bảng Tài khoản Thử nghiệm:
| Vai trò | Email đăng nhập | Mật khẩu | Quyền hạn đối với Điểm & Học phí |
| :--- | :--- | :--- | :--- |
| **Giảng viên** | `teacher@tms.edu.vn` | `teacher123` | ✅ Sửa điểm (`/api/scores`)<br>❌ **Bị chặn học phí (`/api/tuition`)** |
| **Kế toán** | `accountant@tms.edu.vn` | `accountant123` | ✅ Sửa học phí (`/api/tuition`)<br>❌ **Bị chặn điểm số (`/api/scores`)** |
| **Học viên** | `student@tms.edu.vn` | `student123` | ❌ **Bị chặn sửa cả điểm và học phí** (Chỉ xem) |
| **Admin** | `admin@tms.edu.vn` | `admin123` | ✅ Toàn quyền sửa cả điểm và học phí |

### 4.2 Thử nghiệm nhanh bằng cURL / Postman:

**Kịch bản 1: Giảng viên cố tình sửa học phí của sinh viên:**
```bash
# 1. Đăng nhập lấy token Giảng viên:
curl -X POST "https://k15c6n4.vercel.app/api/auth/login" \
     -H "Content-Type: application/json" \
     -d '{"email":"teacher@tms.edu.vn","password":"teacher123"}'

# 2. Dùng token Giảng viên gọi API sửa học phí:
curl -X PUT "https://k15c6n4.vercel.app/api/tuition/tui_001" \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer <TOKEN_GIANG_VIEN>" \
     -d '{"amount": 0, "status": "exempt"}'

# Kết quả trả về:
# HTTP/1.1 403 Forbidden
# {"success":false,"message":"Từ chối truy cập: Bạn không có quyền quản lý hoặc sửa học phí. Chức năng này chỉ dành cho Kế toán và Quản trị viên."}
```

**Kịch bản 2: Kế toán cố tình sửa điểm thi của sinh viên:**
```bash
# 1. Đăng nhập lấy token Kế toán:
curl -X POST "https://k15c6n4.vercel.app/api/auth/login" \
     -H "Content-Type: application/json" \
     -d '{"email":"accountant@tms.edu.vn","password":"accountant123"}'

# 2. Dùng token Kế toán gọi API sửa điểm số:
curl -X PUT "https://k15c6n4.vercel.app/api/scores/scr_001" \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer <TOKEN_KE_TOAN>" \
     -d '{"score": 10.0}'

# Kết quả trả về:
# HTTP/1.1 403 Forbidden
# {"success":false,"message":"Từ chối truy cập: Bạn không có quyền nhập hoặc sửa điểm số. Chức năng này chỉ dành cho Giảng viên và Quản trị viên."}
```

---

## 5. Kết luận & Đề xuất Jira

- **Tình trạng nghiệm thu:** Toàn bộ 4 tiêu chí của **KN-8** đã được hiện thực hóa đầy đủ, an toàn ở tầng Server và vượt qua 100% các ca kiểm thử tự động.
- **Hành động đề xuất trên Jira:** Chuyển trạng thái thẻ **`KN-8`** từ **`To Do`** ➔ **`Done`** (hoặc `Ready for Review`).
