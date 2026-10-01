# Báo cáo Triển khai Tính năng KN-11: Quản trị Tài khoản Người dùng

> **Jira Issue:** [KN-11] - Sprint 1  
> **Parent Epic:** KN-14 Tài khoản, Phân quyền & Hồ sơ  
> **Story Points:** 8  
> **Assignee:** LY PHI THANG  
> **User Story:** *"Là Quản trị hệ thống, tôi muốn tạo, sửa và tìm kiếm tài khoản người dùng, để cấp quyền truy cập cho nhân sự mới trong ngày đầu họ đi làm."*  
> **Nhánh Git:** `Develop` (và `feature/KN-11`)  

---

## 1. Tiêu chí nghiệm thu (Jira Description Acceptance Criteria)
1. **Tạo tài khoản gửi email kích hoạt kèm mật khẩu tạm:**
   - Hệ thống tự sinh mật khẩu tạm thời an toàn (`TMS@...`).
   - Tự động kích hoạt luồng gửi email bàn giao thông tin kích hoạt tới địa chỉ email của nhân sự mới.
   - Giao diện Admin hiển thị modal bàn giao thông tin kèm nút sao chép nhanh (copy clipboard).
2. **Email trùng bị từ chối kèm thông báo cụ thể:**
   - Kiểm tra tính duy nhất (unique) của email trước khi tạo.
   - Trả về mã lỗi HTTP 409 Conflict với thông báo tiếng Việt: *"Email này đã được sử dụng bởi một tài khoản khác trong hệ thống."*
3. **Tìm theo tên, email, số điện thoại; lọc theo vai trò và trạng thái:**
   - Tìm kiếm tức thời (live debounce) không phân biệt hoa/thường theo họ tên, email hoặc số điện thoại.
   - Dropdown lọc danh sách linh hoạt theo 8 vai trò TMS và 3 trạng thái (`active`, `locked`, `inactive`).
4. **Danh sách phân trang, mặc định 20 dòng:**
   - API và Giao diện hỗ trợ phân trang chuẩn, mặc định hiển thị 20 dòng / trang.
   - Cho phép tùy chọn chuyển đổi linh hoạt (20, 50, 100 dòng / trang) cùng các nút điều hướng trang.

---

## 2. Kiến trúc & Giải pháp Kỹ thuật

### 2.1 Backend (Node.js & Express)
- **Module dịch vụ `userService.js`**:
  - Quản lý danh mục 8 vai trò TMS: `administrator`, `training_manager`, `instructor`, `teaching_assistant`, `student`, `admissions`, `accountant`, `visitor`.
  - Cơ chế tìm kiếm không phân biệt chữ hoa/thường theo họ tên, email và số điện thoại.
  - Bộ lọc theo vai trò (`role`) và trạng thái hoạt động (`status`).
  - Tự động sinh mật khẩu tạm thời an toàn (`TMS@...`) khi cấp tài khoản mới cho nhân sự.
  - Mã hóa mật khẩu chuẩn PBKDF2 với salt ngẫu nhiên tương thích tuyệt đối với dịch vụ xác thực `authService.js`.
  - Kiểm tra tính duy nhất (Unique) của email, ngăn chặn trùng lặp tài khoản.
  - Bảo vệ quản trị viên: Chặn tự xóa tài khoản của chính mình và ngăn xóa Quản trị viên duy nhất của hệ thống.

- **Các RESTful Endpoint (`server.js`)**:
  - `GET /api/admin/roles`: Lấy danh mục vai trò hợp lệ.
  - `GET /api/admin/users`: Tìm kiếm, lọc và phân trang danh sách người dùng.
  - `GET /api/admin/users/:id`: Xem chi tiết hồ sơ tài khoản.
  - `POST /api/admin/users`: Tạo mới tài khoản nhân sự và cấp mật khẩu tạm (HTTP 201).
  - `PUT /api/admin/users/:id`: Chỉnh sửa thông tin họ tên, vai trò, SĐT, trạng thái hoặc đổi mật khẩu mới.
  - `DELETE /api/admin/users/:id`: Xóa hoặc vô hiệu hóa tài khoản.
  - Middleware bảo mật: `authenticateToken` và `requireAdmin` (chặn 401 Unauthorized và 403 Forbidden).

### 2.2 Frontend (`frontend/UserManagement.html`)
- **Giao diện chuẩn TMS Responsive**:
  - Hỗ trợ hiển thị tối ưu từ điện thoại di động (360px) đến màn hình desktop lớn.
  - Hệ thống thẻ thống kê tổng quan (Metrics): Tổng tài khoản, Giảng viên, Nhân sự quản lý, Tài khoản hoạt động.
  - Thanh công cụ tìm kiếm tức thời (Live search debounce) kết hợp bộ lọc đa tiêu chí (Vai trò, Trạng thái).
  - Bảng danh sách người dùng trực quan với Avatar chữ cái đầu, Badge màu nhận diện vai trò và trạng thái.
  - **Modal Cấp tài khoản mới**: Form xác thực dữ liệu thời gian thực; khi tạo xong hiển thị hộp thông tin bàn giao với nút *"Sao chép thông tin"* (gồm Tên, Email, Mật khẩu tạm và URL đăng nhập) để gửi ngay cho nhân viên mới.
  - **Modal Chỉnh sửa thông tin**: Cập nhật nhanh hồ sơ hoặc cấp lại mật khẩu.
  - Tích hợp điều hướng đồng bộ giữa `Index.html`, `UserManagement.html` và `RoleManagement.html`.

---

## 3. Kết quả Kiểm thử Tự động (`backend/test/user_management.test.js`)
Toàn bộ 12 ca kiểm thử tự động đã được thực thi và đạt **100% PASS**:
1. `✔ PASS:` Tìm kiếm chính xác theo họ và tên người dùng.
2. `✔ PASS:` Tìm kiếm không phân biệt chữ hoa/thường theo email.
3. `✔ PASS:` Lọc danh sách người dùng theo vai trò (`instructor`).
4. `✔ PASS:` Lấy danh mục 8 vai trò hợp lệ trong hệ thống TMS.
5. `✔ PASS:` Tạo tài khoản nhân sự mới thành công và sinh mật khẩu tạm an toàn.
6. `✔ PASS:` Nhân sự mới đăng nhập thành công vào hệ thống bằng mật khẩu tạm vừa được cấp.
7. `✔ PASS:` Chặn tạo tài khoản trùng email với thông báo lỗi HTTP 409 rõ ràng.
8. `✔ PASS:` Validate chặt chẽ định dạng email, độ dài họ tên và danh mục vai trò (HTTP 400).
9. `✔ PASS:` Cập nhật thành công thông tin hồ sơ và vai trò của tài khoản.
10. `✔ PASS:` Admin cấp lại mật khẩu mới cho nhân sự thành công, đăng nhập ăn khớp.
11. `✔ PASS:` Chặn người dùng không có vai trò Administrator (HTTP 403 Forbidden).
12. `✔ PASS:` Chặn yêu cầu không có Bearer token (HTTP 401 Unauthorized), chặn Admin tự xóa chính mình và xóa tài khoản thành công.
