# Báo cáo Triển khai Tính năng KN-8: Phân quyền theo Vai trò cho Toàn Hệ thống (RBAC)

> **Jira Issue:** [KN-8] - Sprint 1  
> **Parent Epic:** KN-14 Tài khoản, Phân quyền & Hồ sơ  
> **Assignee:** ĐOÀN MINH QUÂN  
> **User Story:** *"Là Quản trị hệ thống, tôi muốn phân quyền theo vai trò cho toàn hệ thống, để đảm bảo giảng viên không sửa được học phí và kế toán không sửa được điểm."*  
> **Nhánh Git:** `minhquanmedia`  

---

## 1. Tiêu chí nghiệm thu (Jira Acceptance Criteria) & Mức độ hoàn thành

| STT | Tiêu chí nghiệm thu từ Jira | Kết quả thực hiện | Trạng thái |
|---|---|---|---|
| 1 | **Khai báo được quyền cho từng vai trò trong tám vai trò nghiệp vụ** | Khai báo bảng ma trận phân quyền chi tiết trong `backend/rbacService.js` cho đúng 8 vai trò TMS: `administrator`, `training_manager`, `instructor`, `teaching_assistant`, `student`, `admissions`, `accountant`, `visitor`. | **ĐẠT (100%)** |
| 2 | **Mọi chức năng đều kiểm quyền ở tầng server, mặc định là từ chối (Default Deny)** | Triển khai Middleware `authorizePermission(permission)`. Bất kỳ yêu cầu nào không có quyền hợp lệ đều bị chặn ở tầng Server với HTTP 403 Forbidden. | **ĐẠT (100%)** |
| 3 | **Đảm bảo Giảng viên không sửa được học phí và Kế toán không sửa được điểm** | - Giảng viên (`instructor`) được cấp quyền `grades:update` nhưng tuyệt đối không có `tuition:update`.<br>- Kế toán (`accountant`) được cấp quyền `tuition:update` nhưng tuyệt đối không có `grades:update`. | **ĐẠT (100%)** |
| 4 | **Truy cập thiếu quyền hiển thị thông báo tiếng Việt rõ ràng thay vì lỗi kỹ thuật** | Phản hồi JSON chuẩn hóa: `"Truy cập bị từ chối: Vai trò của bạn không có quyền thực hiện thao tác này. Vui lòng liên hệ Quản trị hệ thống để được cấp quyền."` (không văng lỗi kỹ thuật / stack trace). | **ĐẠT (100%)** |
| 5 | **Có kiểm thử tự động cho ít nhất ba vai trò** | Xây dựng bộ test tự động `backend/test/rbac.test.js` kiểm thử 4 vai trò: Giảng viên, Kế toán, Quản trị viên, Học viên với 12 test case vượt qua 100%. | **ĐẠT (100%)** |

---

## 2. Kiến trúc & Giải pháp Kỹ thuật Chi tiết

### 2.1 Backend (Node.js & Express)
- **Module dịch vụ `backend/rbacService.js`**:
  - Khai báo danh mục 8 vai trò nghiệp vụ chuẩn (`BUSINESS_ROLES`) và danh mục các quyền (`PERMISSIONS`).
  - Hàm kiểm quyền `hasPermission(role, permission)` tuân thủ nghiêm ngặt nguyên tắc **Default Deny**: Mọi truy cập mặc định là từ chối trừ khi được gán quyền rõ ràng hoặc là quyền quản trị tối cao (`*`).
  - Hỗ trợ API xem và cập nhật ma trận phân quyền linh hoạt theo thời gian thực.
  - Tích hợp nghiệp vụ mẫu: Cập nhật điểm số (`updateStudentGrade`) và Cập nhật học phí (`updateStudentTuition`).
- **Tầng Middleware Bảo mật (`backend/server.js`)**:
  - `authorizePermission(requiredPermission)`: Đánh chặn ở tầng Server trước khi request tới controller. Trả về mã HTTP 403 Forbidden kèm mã lỗi `FORBIDDEN_PERMISSION_DENIED` và thông điệp tiếng Việt thân thiện khi người dùng thiếu quyền.
- **Các API Endpoints nghiệp vụ**:
  - `GET /api/rbac/matrix`: Lấy ma trận phân quyền 8 vai trò.
  - `GET /api/rbac/my-permissions`: Lấy danh sách quyền của người dùng hiện tại theo Token.
  - `PUT /api/rbac/matrix/:role`: Cập nhật quyền cho vai trò cụ thể.
  - `GET /api/grades` & `PUT /api/grades/:studentId`: Quản lý điểm số (Giảng viên được phép sửa, Kế toán bị từ chối).
  - `GET /api/tuitions` & `PUT /api/tuitions/:studentId`: Quản lý học phí (Kế toán được phép sửa, Giảng viên bị từ chối).

### 2.2 Giao diện Frontend (`frontend/RoleManagement.html`)
- **Giao diện ma trận phân quyền hiện đại**:
  - Hiển thị trực quan 8 cột vai trò nghiệp vụ với badge nhận diện màu sắc chuyên nghiệp.
  - Nhóm chức năng rõ ràng: Điểm số & Khảo thí, Học phí & Tài chính, Đào tạo & Lớp học, Quản trị hệ thống.
  - Bảng điều khiển thử nghiệm tương tác trực tiếp (Live RBAC Test Panel): Cho phép đóng vai Giảng viên, Kế toán hoặc Học viên để thử nghiệm hành động sửa điểm / sửa học phí và nhận phản hồi tiếng Việt ngay trên giao diện.

---

## 3. Kết quả Kiểm thử Tự động (`backend/test/rbac.test.js`)

Toàn bộ **12 ca kiểm thử tự động** đã được thực thi và đạt **100% PASS**:

```text
--- Chay kiem thu he thong phan quyen RBAC (KN-8) ---
  [PASS] Case 1: Khai bao day du ma tran quyen cho 8 vai tro
  [PASS] Case 2: Giang vien co quyen grades:update va khong co quyen tuition:update
  [PASS] Case 3: Giang vien sua diem sinh vien thanh cong (HTTP 200)
  [PASS] Case 4: Chan giang vien sua hoc phi (HTTP 403 Forbidden)
  [PASS] Case 5: Ke toan cap nhat hoc phi thanh cong (HTTP 200)
  [PASS] Case 6: Chan ke toan sua diem (HTTP 403 Forbidden)
  [PASS] Case 7: Quan tri he thong duoc phep cap nhat ca diem va hoc phi
  [PASS] Case 8: Hoc vien bi chan khi co y sua diem hoac hoc phi
  [PASS] Case 9: Chan request khong co token (HTTP 401)
  [PASS] Case 10: Vai tro khong xac dinh bi tu choi mac dinh (Default Deny)
  [PASS] Case 11: Cap nhat ma tran phan quyen thanh cong
  [PASS] Case 12: Thong bao loi tieng Viet ro rang khi khong du quyen

Ket qua: 12/12 ca kiem thu KN-8 dat yeu cau.
```
