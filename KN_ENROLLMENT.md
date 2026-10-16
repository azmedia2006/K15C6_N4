# Báo cáo Triển khai Tính năng: Ghi danh Học viên & Kiểm soát Sĩ số Lớp học

- **Phân hệ**: Quản lý Đào tạo & Tuyển sinh (Training & Admissions)
- **Chức năng**:
  1. Chọn nhiều học viên để ghi danh cùng lúc (Batch Enrollment).
  2. Chặn ghi danh khi lớp đã đủ sĩ số hoặc học viên đã ở trong lớp (Capacity & Duplicate Protection).
  3. Ghi nhận ngày ghi danh và người thực hiện (Audit Tracking).
- **Trạng thái**: Hoàn thành (Đạt 100% tiêu chí kiểm thử tự động).

---

## 1. Tiêu chí Nghiệm thu & Kết quả Hiện thực hóa

| STT | Yêu cầu Nghiệp vụ | Giải pháp Kỹ thuật trong Hệ thống | Kết quả |
| :---: | :--- | :--- | :---: |
| 1 | **Chọn nhiều học viên để ghi danh cùng lúc** | - Giao diện danh sách học viên hỗ trợ checkbox từng dòng và checkbox "Chọn tất cả" ở tiêu đề bảng.<br>- Thanh tác vụ hiển thị số lượng học viên đã chọn và nút *"Ghi danh vào lớp học"*, tự động kích hoạt khi có $\ge 1$ học viên.<br>- Hộp thoại ghi danh hiển thị danh sách các thẻ chip học viên được chọn, cho phép xóa nhanh từng học viên.<br>- API `POST /api/enrollments` (và alias `POST /api/classes/:classId/enrollments`) tiếp nhận danh sách mảng `studentIds` để xử lý ghi danh đồng thời. | **ĐẠT (PASS)** |
| 2 | **Chặn ghi danh khi lớp đã đủ sĩ số** | - Mỗi lớp học khai báo sĩ số tối đa (`maxCapacity`) và sĩ số thực tế (`enrolledCount`).<br>- Nếu lớp đã đạt sĩ số tối đa ($current \ge maxCapacity$), hệ thống từ chối với mã lỗi `CLASS_FULL` (HTTP 400): *"Lớp học đã đủ sĩ số tối đa (X/X). Không thể ghi danh thêm học viên."*<br>- Nếu số học viên được chọn vượt quá số chỗ trống còn lại ($count > remainingSlots$), hệ thống từ chối với mã lỗi `CLASS_CAPACITY_EXCEEDED` (HTTP 400): *"Lớp học chỉ còn lại X chỗ trống, không đủ cho Y học viên đã chọn."*<br>- Trên giao diện, lớp đã đầy được gắn nhãn đỏ *"ĐÃ ĐỦ SĨ SỐ"*, vô hiệu hóa lựa chọn và nút xác nhận. | **ĐẠT (PASS)** |
| 3 | **Chặn ghi danh khi học viên đã ở trong lớp** | - Hệ thống kiểm tra trong danh sách ghi danh (`enrollments`) và hồ sơ học viên (`currentClasses`).<br>- Nếu học viên đã có tên trong lớp học, hệ thống từ chối với mã lỗi `STUDENT_ALREADY_ENROLLED` (HTTP 400): *"Học viên [Họ tên] [Mã SV] đã ở trong lớp này rồi. Không thể ghi danh trùng lặp."*<br>- Hộp thoại ghi danh tự động phát hiện và cảnh báo học viên trùng lặp ngay khi chọn lớp học, ngăn chặn thao tác gửi yêu cầu lỗi lên server. | **ĐẠT (PASS)** |
| 4 | **Ghi nhận ngày ghi danh và người thực hiện** | - Mỗi bản ghi ghi danh lưu trữ thời gian thực `enrolledAt` (chuỗi chuẩn ISO 8601).<br>- Lưu trữ định danh `enrolledBy` và họ tên `enrolledByName` của tài khoản đăng nhập (từ Bearer token).<br>- Đồng bộ cập nhật vào mảng `currentClasses` trong hồ sơ học viên để hiển thị khi xem chi tiết.<br>- Tự động ghi nhật ký hệ thống `audit_logs` với hành động `ENROLL_STUDENT`, lưu vết minh bạch phục vụ công tác thanh tra đào tạo. | **ĐẠT (PASS)** |
| 5 | **Xem danh sách học viên trong lớp & Hủy ghi danh** | - Bảng danh sách lớp học cung cấp nút *"Xem danh sách"* hiển thị toàn bộ học viên trong lớp kèm ngày ghi danh và người thực hiện.<br>- Hỗ trợ nút *"Hủy ghi danh"* (`DELETE /api/classes/:classId/students/:studentId`), tự động giải phóng sĩ số lớp học tức thì. | **ĐẠT (PASS)** |
| 6 | **Kiểm soát Phân quyền (RBAC)** | - Chỉ các vai trò có thẩm quyền (`administrator`, `training_manager`, `admissions`) mới được phép thực hiện ghi danh.<br>- Các vai trò khác (`student`, `instructor`, `accountant`, `visitor`) bị chặn với HTTP 403 Forbidden. Yêu cầu không có token bị chặn HTTP 401 Unauthorized. | **ĐẠT (PASS)** |
| 7 | **Kiểm thử tự động toàn diện** | - Xây dựng bộ test suite tự động `backend/test/batch_enrollment.test.js` kiểm tra toàn bộ 7 nhóm kịch bản nghiệp vụ, đạt 100% PASS. | **ĐẠT (PASS)** |

---

## 2. Danh mục RESTful API Endpoint

| Phương thức | Endpoint | Quyền hạn | Mô tả chức năng |
| :---: | :--- | :---: | :--- |
| `GET` | `/api/classes` | Authenticated | Lấy danh sách toàn bộ lớp học kèm sĩ số hiện tại, sĩ số tối đa, số chỗ còn lại và trạng thái đầy. |
| `GET` | `/api/classes/:id` | Authenticated | Xem chi tiết lớp học và danh sách học viên đã ghi danh kèm ngày & người thực hiện. |
| `POST` | `/api/enrollments`<br>*(alias: `/api/classes/:classId/enrollments`)* | `administrator`<br>`training_manager`<br>`admissions` | Ghi danh học viên (đơn lẻ hoặc hàng loạt). Tự động kiểm tra sĩ số, chặn trùng và lưu vết người thực hiện. |
| `GET` | `/api/enrollments` | `administrator`<br>`training_manager`<br>`admissions`<br>`accountant` | Tra cứu lịch sử các bản ghi ghi danh (hỗ trợ lọc theo `classId`, `studentId`, `search`). |
| `DELETE` | `/api/classes/:classId/students/:studentId` | `administrator`<br>`training_manager` | Hủy ghi danh học viên khỏi lớp học, tự động giải phóng sĩ số lớp học. |

---

## 3. Cấu trúc Bản ghi Dữ liệu Ghi danh (Enrollment Schema)

```json
{
  "id": "enr_1773752000000_abc123",
  "classId": "cls_pmp_01",
  "classCode": "K15-PM01",
  "className": "Quản trị dự án PMP",
  "courseName": "Quản trị dự án Chuyên nghiệp (PMP)",
  "studentId": "usr_student",
  "studentCode": "SV001",
  "studentName": "Lê Minh Tuấn",
  "studentEmail": "student@tms.edu.vn",
  "enrolledAt": "2026-10-16T14:26:46.191Z",
  "enrolledBy": "usr_admissions",
  "enrolledByName": "Vũ Hải Yến",
  "notes": "Ghi danh nhập học đợt 1",
  "status": "Đang học"
}
```

---

## 4. Hướng dẫn Chạy Kiểm thử Tự động

Chạy lệnh kiểm thử độc lập tính năng ghi danh:
```bash
npm run test:enrollment
```

Hoặc chạy toàn bộ test suite của hệ thống:
```bash
npm test
```
