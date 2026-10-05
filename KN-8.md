Dưới đây là phần tóm tắt ngắn gọn, dễ hiểu về bối cảnh và 4 yêu cầu cốt lõi của User Story KN-8 trên Jira:

1. Mục tiêu cốt lõi của KN-8 (Vì sao cần làm?)
Trong hệ thống Quản lý Đào tạo (TMS), có nhiều đối tượng người dùng cùng truy cập (Học viên, Giảng viên, Kế toán, Quản trị viên...).

Nếu chỉ ẩn nút bấm trên giao diện Web (Frontend), người dùng am hiểu kỹ thuật vẫn có thể dùng công cụ như Postman / F12 để gọi thẳng API ngầm bên dưới nhằm thay đổi dữ liệu nhạy cảm.
Mục tiêu của KN-8: Thiết lập cơ chế Phân quyền dựa trên vai trò (RBAC - Role-Based Access Control) tại tầng Server (Backend) nhằm phân định ranh giới nghiệp vụ tuyệt đối:
❌ Giảng viên tuyệt đối không được phép chỉnh sửa, miễn giảm hay can thiệp vào học phí.
❌ Kế toán tuyệt đối không được phép nhập, sửa hay nâng điểm số.
❌ Học viên chỉ được xem thông tin cá nhân, không thể tự sửa điểm hoặc học phí của mình.
2. Bốn (04) tiêu chí nghiệm thu (Acceptance Criteria) của KN-8:
🔹 Tiêu chí 1: Khai báo ma trận quyền cho từng vai trò nghiệp vụ
Hệ thống phải định nghĩa rõ phạm vi quyền hạn của từng đối tượng:

Giảng viên (instructor): Được phép điểm danh, chấm bài, cập nhật điểm thi (PUT /api/scores/:id). Bị cấm hoàn toàn chức năng học phí.
Kế toán (accountant): Được phép lập biên lai, xác nhận đóng tiền, sửa trạng thái học phí (PUT /api/tuition/:id). Bị cấm hoàn toàn chức năng điểm số.
Học viên (student): Chỉ có quyền đọc (Read-only) xem điểm và học phí của chính mình.
Quản trị viên (administrator): Có quyền tối cao quản trị toàn bộ hệ thống.
🔹 Tiêu chí 2: Kiểm soát ở tầng Server & Mặc định từ chối (Default Deny)
Việc kiểm tra quyền bắt buộc phải thực thi tại tầng Server (thông qua Middleware của Node.js Express).
Mọi yêu cầu gửi lên nếu:
Không có Token xác thực ➔ Trả về 401 Unauthorized.
Có Token nhưng không đúng vai trò được cấp phép ➔ Mặc định bị từ chối ngay với 403 Forbidden.
🔹 Tiêu chí 3: Thông báo tiếng Việt rõ ràng, không lộ lỗi kỹ thuật
Khi một người dùng cố tình thực hiện thao tác vượt quyền, hệ thống không được trả về các lỗi kỹ thuật khó hiểu (như lỗi sập máy chủ 500, lộ bảng CSDL hay mã lỗi tiếng Anh).
Thay vào đó, phải hiển thị câu thông báo tiếng Việt chính xác theo ngữ cảnh nghiệp vụ:
Giảng viên gọi API học phí: "Từ chối truy cập: Bạn không có quyền quản lý hoặc sửa học phí. Chức năng này chỉ dành cho Kế toán và Quản trị viên."
Kế toán gọi API sửa điểm: "Từ chối truy cập: Bạn không có quyền nhập hoặc sửa điểm số. Chức năng này chỉ dành cho Giảng viên và Quản trị viên."
🔹 Tiêu chí 4: Bắt buộc có kiểm thử tự động (Automated Tests) cho ít nhất 3 vai trò
Phải xây dựng kịch bản kiểm thử tự động (chạy qua lệnh npm test hoặc framework test) để chứng minh tính đúng đắn khi:
Giảng viên: Gọi API sửa điểm thành công (200), nhưng gọi API sửa học phí bị chặn (403).
Kế toán: Gọi API sửa học phí thành công (200), nhưng gọi API sửa điểm bị chặn (403).
Học viên: Gọi API sửa điểm hoặc học phí đều bị chặn (403).
3. Tình trạng thực tế trong dự án của bạn hiện tại:
Mã nguồn đã được hiện thực hóa đầy đủ tại 

backend/server.js
.
Bộ test tự động 

backend/test/rbac_kn8.test.js
 đã kiểm thử thực tế cho cả 4 vai trò (Giảng viên, Kế toán, Học viên, Admin) và đạt kết quả 100% PASS.
