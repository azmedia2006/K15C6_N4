# Kế hoạch Triển khai: Gán và Thu hồi Vai trò cho Người dùng

## 1. Bối cảnh kỹ thuật hiện tại của dự án
- **Backend:** Node.js (Express 5.x), cấu trúc mô đun hóa dịch vụ xác thực (`authService.js`, `server.js`).
- **Frontend:** Vanilla JS + HTML5/CSS3 tương thích responsive TMS (`Index.html`, `RoleManagement.html`, `Login.html`).
- **Data Layer:** In-memory relational store mô phỏng có cấu trúc quan hệ chặt chẽ, hỗ trợ các ràng buộc toàn vẹn dữ liệu và cơ chế migration script.
- **Cơ chế xác thực:** Bearer Token (phiên làm việc mã hóa Base64 chứa định danh người dùng).
- **Mô hình vai trò hiện tại:** Cột đơn `role` trong entity `user` (8 vai trò: `administrator`, `training_manager`, `instructor`, `teaching_assistant`, `student`, `admissions`, `accountant`, `visitor`).

---

## 2. Cơ chế cập nhật quyền có hiệu lực ngay lập tức
**Lựa chọn:** Phương án Middleware phân quyền tra cứu vai trò trực tiếp từ kho dữ liệu kết hợp trường `roles_version`.
- **Lý do chọn:**
  - Token hiện tại chỉ cần mang định danh người dùng (`userId`) và tính xác thực của phiên làm việc.
  - Mỗi khi có thao tác gán hoặc thu hồi vai trò (`POST / DELETE`), kho dữ liệu `user_roles` được cập nhật tức thì.
  - Middleware kiểm tra quyền (`authorizeRoles`) sẽ tra cứu danh sách vai trò mới nhất của `userId` từ `user_roles` (O(1) lookup), đảm bảo thao tác kế tiếp của người dùng được áp dụng vai trò mới ngay lập tức mà không cần đăng nhập lại và không làm gián đoạn trải nghiệm người dùng.
  - Frontend cung cấp endpoint `GET /api/auth/me` để cập nhật trạng thái vai trò trên giao diện ngay khi có thay đổi.

---

## 3. Chi tiết kế hoạch thực hiện theo từng hạng mục

### 3.1. Thiết kế mô hình dữ liệu nhiều-nhiều (N-N)
- Xây dựng bảng/tập hợp danh mục vai trò `roles` (id, code, name, description).
- Xây dựng bảng/tập hợp liên kết `user_roles`:
  - `user_id`: Khóa ngoại trỏ đến `users`
  - `role_id`: Khóa ngoại trỏ đến `roles`
  - `assigned_by`: ID người thực hiện gán
  - `assigned_at`: Thời điểm gán vai trò
  - Ràng buộc: `UNIQUE(user_id, role_id)`.
- Viết file chuyển đổi dữ liệu (`migrations/migrate_roles_n_n.js`): chuyển toàn bộ `user.role` hiện tại sang các bản ghi tương ứng trong `user_roles`, đảm bảo không mất dữ liệu quyền của bất kỳ tài khoản nào.
- Đảm bảo tính tương thích ngược: các truy vấn cũ đọc `user.role` vẫn nhận vai trò chính (primary role), đồng thời bổ sung thuộc tính `user.roles` chứa danh sách đầy đủ.

### 3.2. Xây dựng API gán vai trò cho người dùng
- Endpoint: `POST /api/admin/users/:userId/roles`.
- Input: `{ roleId }` hoặc `{ roleIds: [...] }`.
- Middleware: Yêu cầu quyền `administrator`.
- Validation:
  - Kiểm tra `userId` tồn tại.
  - Kiểm tra `roleId` tồn tại trong danh mục `roles`.
- Tính lũy đẳng (Idempotent): Nếu người dùng đã sở hữu vai trò đó, xử lý thành công và không ghi bản ghi trùng lặp.
- Trả về danh sách vai trò hiện tại của người dùng sau khi gán.

### 3.3. Xây dựng API thu hồi vai trò của người dùng
- Endpoint: `DELETE /api/admin/users/:userId/roles/:roleId`.
- Middleware: Yêu cầu quyền `administrator`.
- Tính lũy đẳng & nghiệp vụ:
  - Nếu người dùng không có vai trò cần thu hồi, trả về phản hồi thích hợp hoặc bỏ qua an toàn.
  - Ràng buộc an toàn: Không cho phép thu hồi vai trò cuối cùng nếu hệ thống yêu cầu mỗi tài khoản phải có ít nhất 1 vai trò hợp lệ.
- Trả về danh sách vai trò còn lại của người dùng.

### 3.4. Bổ sung kiểm tra không cho tự thu hồi vai trò quản trị của chính mình
- Kiểm tra nghiêm ngặt ở tầng Service (`roleService`):
  - Chặn thao tác nếu `userId` bị thu hồi trùng với `currentAdminId` đăng nhập và vai trò là `administrator` -> Trả về HTTP 403 với thông điệp: *"Bạn không thể tự thu hồi vai trò Quản trị hệ thống của chính mình."*
  - Chặn thu hồi nếu đây là quản trị viên cuối cùng của toàn hệ thống -> Trả về HTTP 403 với thông điệp: *"Hệ thống phải có ít nhất một Quản trị viên hoạt động."*
- Phía Frontend: Tự động vô hiệu hóa nút xóa vai trò quản trị trên dòng của chính mình kèm tooltip thông báo.

### 3.5. Xác thực cập nhật quyền tức thì
- Cập nhật middleware `authenticateToken` và `authorizeRoles` trong `server.js` / `middleware/auth.js`.
- Bổ sung endpoint `GET /api/auth/me` để frontend có thể đồng bộ vai trò mới nhất của phiên hiện tại.
- Đồng bộ hiển thị menu và các quyền hạn tương ứng theo danh sách vai trò mới nhất.

### 3.6. Hiển thị danh sách vai trò trong màn hình quản trị
- Endpoint: `GET /api/admin/users` hỗ trợ phân trang (`page`, `limit`), lọc theo `roleId`, trả về kèm mảng `roles` của từng user (tối ưu truy vấn tránh N+1).
- Frontend: Cập nhật bảng danh sách hiển thị các thẻ vai trò đa dạng, trạng thái loading, dữ liệu rỗng và xử lý lỗi.

### 3.7. Xây dựng màn hình quản trị gán và thu hồi vai trò
- Nâng cấp `RoleManagement.html` thành giao diện quản trị vai trò người dùng chuẩn TMS:
  - Xem danh sách người dùng và danh sách vai trò hiện có.
  - Hộp thoại chi tiết người dùng: chọn vai trò để gán thêm, danh sách vai trò đang có kèm nút "Thu hồi".
  - Hộp thoại xác nhận trước khi thu hồi.
  - Vô hiệu hóa nút thu hồi vai trò Admin của chính tài khoản đang đăng nhập kèm tooltip giải thích.
  - Thông báo tiếng Việt thân thiện, cập nhật DOM ngay lập tức không cần tải lại trang.

### 3.8. Ghi nhận nhật ký thao tác (Audit Log)
- Thiết kế kho lưu trữ `audit_logs` (id, timestamp, admin_id, target_user_id, action: `ASSIGN_ROLE` | `REVOKE_ROLE`, role_id, ip, status: `SUCCESS` | `FORBIDDEN` | `FAILED`, reason).
- Ghi log cho cả trường hợp thành công và trường hợp bị chặn (như tự thu hồi quyền admin).
- Đảm bảo tính toàn vẹn: không thể thay đổi vai trò mà thiếu bản ghi log tương ứng.
- Không ghi thông tin nhạy cảm.

### 3.9. Kiểm thử toàn diện tự động
- Xây dựng kịch bản kiểm thử tự động tại `backend/test/role_management.test.js`:
  1. Gán nhiều vai trò cùng lúc (vừa giảng viên vừa quản lý đào tạo).
  2. Gán trùng vai trò (idempotency - không nhân bản dữ liệu).
  3. Thu hồi vai trò thành công, danh sách vai trò còn lại chính xác.
  4. Hiệu lực tức thì ở request kế tiếp mà không cần đăng nhập lại.
  5. Admin tự thu hồi quyền quản trị của chính mình bị chặn (403).
  6. Chặn thu hồi quản trị viên duy nhất còn lại trong hệ thống.
  7. Người dùng không phải admin gọi API bị từ chối (403).
  8. Bản ghi audit log được lưu đầy đủ cho cả ca thành công và ca bị chặn.
  9. Kiểm thử migration script đảm bảo toàn vẹn dữ liệu người dùng cũ.
