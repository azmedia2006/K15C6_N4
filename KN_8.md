# Báo cáo Triển khai Tính năng: Phân quyền theo Vai trò Toàn Hệ thống

- Người thực hiện: Minh Quân
- Chức năng: Kiểm soát truy cập dựa trên vai trò (Role-Based Access Control - RBAC) tại tầng máy chủ cho toàn hệ thống
- Trạng thái: Hoàn thành (Đạt toàn bộ tiêu chí kiểm thử)

---

## 1. Tiêu chí Nghiệm thu

Tính năng đáp ứng 4 tiêu chí cốt lõi:

| STT | Tiêu chí yêu cầu | Giải pháp kỹ thuật trong mã nguồn | Kết quả |
| :---: | :--- | :--- | :---: |
| 1 | Khai báo được quyền cho từng vai trò trong tầm vai trò nghiệp vụ | Xây dựng ma trận quyền hạn (RBAC Matrix) rõ ràng:<br>- Giảng viên (`instructor`): Được phép điểm danh, chấm bài, cập nhật điểm thi (`PUT /api/scores/:id`). Bị cấm hoàn toàn thao tác sửa học phí.<br>- Kế toán (`accountant`): Được phép lập biên lai, thu tiền, cập nhật trạng thái học phí (`PUT /api/tuition/:id`). Bị cấm hoàn toàn thao tác sửa điểm số.<br>- Học viên (`student`): Chỉ có quyền xem thời khóa biểu, điểm số và học phí của bản thân. Bị chặn mọi quyền chỉnh sửa.<br>- Quản trị viên (`administrator`): Toàn quyền vận hành, phân quyền và cấu hình hệ thống. | Đạt |
| 2 | Mọi chức năng đều kiểm quyền ở tầng server, mặc định là từ chối | Triển khai cơ chế kiểm soát truy cập thông qua Middleware Node.js Express tại tầng máy chủ (`backend/server.js`):<br>- Không dựa vào việc ẩn nút ở Frontend (vì người dùng có thể gửi request qua API).<br>- Mọi request đều phải vượt qua `authenticateToken` và `requireRole(...)`. Mặc định nếu không thuộc vai trò được phép sẽ bị từ chối ngay lập tức với mã lỗi HTTP 403 Forbidden (hoặc HTTP 401 Unauthorized nếu thiếu token). | Đạt |
| 3 | Truy cập thiếu quyền hiển thị thông báo tiếng Việt rõ ràng | Khi bị chặn quyền, server không trả về lỗi 500 hay thông báo kỹ thuật khó hiểu mà trả về JSON có thông điệp tiếng Việt cụ thể:<br>- Giảng viên gọi API học phí: *"Từ chối truy cập: Bạn không có quyền quản lý hoặc sửa học phí. Chức năng này chỉ dành cho Kế toán và Quản trị viên."*<br>- Kế toán gọi API điểm số: *"Từ chối truy cập: Bạn không có quyền nhập hoặc sửa điểm số. Chức năng này chỉ dành cho Giảng viên và Quản trị viên."*<br>- Người dùng thường vào API Admin: *"Từ chối truy cập: Thao tác này yêu cầu quyền Quản trị hệ thống (Administrator)."* | Đạt |
| 4 | Có kiểm thử tự động cho ít nhất ba vai trò | Xây dựng bộ kiểm thử tự động độc lập `backend/test/rbac_kn8.test.js` bao phủ cho 4 vai trò nghiệp vụ (Giảng viên, Kế toán, Học viên, Quản trị viên). Kết quả chạy lệnh `npm test` đạt 100% thành công. | Đạt |

---

## 2. Kiến trúc & Giải pháp Kỹ thuật

### 2.1 Backend (Node.js & Express)

1. **Middleware Kiểm soát Truy cập Phân quyền (`requireRole`)**:
   - Vị trí: `backend/server.js`
   - Nhiệm vụ: Trích xuất danh sách vai trò hiện tại của người dùng từ Token JWT đã xác thực, so khớp với danh mục vai trò được phép truy cập (`allowedRoles`).
   - Nếu không thỏa mãn, chặn ngay từ tầng Gateway với mã HTTP 403 kèm phản hồi chi tiết:
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
                     code: 403,
                     message: roleMsg
                 });
             }

             next();
         };
     }
     ```

2. **Bảo vệ các Endpoint Nghiệp vụ cốt lõi**:
   - `PUT /api/scores/:id`: Chỉ cho phép `instructor` và `administrator`.
   - `PUT /api/tuition/:id`: Chỉ cho phép `accountant` và `administrator`.
   - `POST /api/admin/*`: Chỉ cho phép `administrator`.

### 2.2 Frontend (HTML / JavaScript)
- Giao diện Menu Động:
  - Tùy biến thanh điều hướng theo đúng vai trò đang đăng nhập.
  - Ẩn các nút hành động vượt quyền để tối ưu trải nghiệm người dùng, nhưng toàn bộ bảo mật được thực thi chặt chẽ ở máy chủ.

---

## 3. Bằng chứng Kiểm thử Tự động

Kết quả chạy bộ kiểm thử tự động tại `backend/test/rbac_kn8.test.js`:

```text
=======================================================
   TMS RBAC SUITE - KIỂM THỬ TỰ ĐỘNG PHÂN QUYỀN VAI TRÒ
=======================================================

=== 1. KIỂM THỬ VAI TRÒ GIẢNG VIÊN (INSTRUCTOR) ===
  [PASS] Giảng viên sửa được điểm số (HTTP 200)
  [PASS] Giảng viên bị chặn khi sửa học phí (HTTP 403 với thông điệp từ chối rõ ràng)

=== 2. KIỂM THỬ VAI TRÒ KẾ TOÁN (ACCOUNTANT) ===
  [PASS] Kế toán sửa được học phí (HTTP 200)
  [PASS] Kế toán bị chặn khi sửa điểm số (HTTP 403 với thông điệp từ chối rõ ràng)

=== 3. KIỂM THỬ VAI TRÒ HỌC VIÊN (STUDENT) ===
  [PASS] Học viên bị chặn sửa điểm số (HTTP 403)
  [PASS] Học viên bị chặn sửa học phí (HTTP 403)

=== 4. KIỂM THỬ VAI TRÒ QUẢN TRỊ VIÊN (ADMINISTRATOR) ===
  [PASS] Quản trị viên có toàn quyền sửa điểm số (HTTP 200)
  [PASS] Quản trị viên có toàn quyền sửa học phí (HTTP 200)

=== 5. KIỂM THỬ BẢO MẬT TẦNG SERVER KHI THIẾU TOKEN (DEFAULT DENY) ===
  [PASS] Mọi chức năng kiểm quyền ở tầng server, mặc định từ chối khi không có token (HTTP 401)

=======================================================
Tất cả các tiêu chí nghiệm thu đã hoàn thành 100%.
=======================================================
```

---

## 4. Bảng Tài khoản Thử nghiệm Nghiệp vụ

| Vai trò | Email đăng nhập | Mật khẩu | Quyền hạn đối với Điểm & Học phí |
| :--- | :--- | :--- | :--- |
| **Giảng viên** | `teacher@tms.edu.vn` | `teacher123` | Được sửa điểm (`/api/scores`), Bị chặn học phí (`/api/tuition`) |
| **Kế toán** | `accountant@tms.edu.vn` | `accountant123` | Được sửa học phí (`/api/tuition`), Bị chặn điểm số (`/api/scores`) |
| **Học viên** | `student@tms.edu.vn` | `student123` | Bị chặn sửa cả điểm và học phí (Chỉ xem) |
| **Admin** | `admin@tms.edu.vn` | `admin123` | Toàn quyền sửa cả điểm và học phí |

---

## 5. Kết luận

- Toàn bộ các tiêu chí phân quyền vai trò đã được hiện thực hóa đầy đủ, an toàn ở tầng Server và vượt qua 100% các ca kiểm thử tự động.
- Hệ thống ngăn chặn hoàn toàn việc can thiệp trái phép vào dữ liệu giữa các bộ phận nghiệp vụ.
