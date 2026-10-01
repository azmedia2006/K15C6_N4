Hệ Thống Quản Lý Đào Tạo (Training Management System - TMS)

1. Giới thiệu tổng quan
Hệ thống Quản lý Đào tạo (TMS) là giải pháp phần mềm quản trị nội bộ trên nền tảng Web, được xây dựng nhằm số hóa và đồng nhất toàn diện chu trình vận hành đào tạo tại trung tâm. Hệ thống kết nối và phục vụ 8 nhóm người dùng nghiệp vụ (từ Khách truy cập, Học viên, Giảng viên, Trợ giảng đến Tư vấn tuyển sinh, Kế toán, Quản lý đào tạo và Quản trị hệ thống), cung cấp một nguồn dữ liệu tập trung duy nhất (Single Source of Truth) thay thế cho quy trình quản lý thủ công phân tán.

2. Bối cảnh & Vấn đề giải quyết
Trước khi triển khai dự án, trung tâm vận hành dựa trên các công cụ rời rạc: quản lý danh sách và điểm số qua Google Sheets, xếp lịch trên Google Calendar, giao nhận bài tập qua Zalo / GitHub và theo dõi công nợ thủ công tại sổ sách kế toán. Thực trạng này dẫn đến nhiều bất cập:
- Thiếu tính tức thời: Ban quản lý không thể nắm bắt nhanh tình trạng chuyên cần hay tỷ lệ nợ bài tập của từng lớp theo thời gian thực.
- Phát hiện trễ học viên có nguy cơ bỏ học: Các dấu hiệu cảnh báo (vắng học liên tiếp, chậm nộp bài tập, chậm đóng học phí) nằm rải rác ở các bộ phận khác nhau, khiến việc hỗ trợ học viên bị chậm trễ.
- Sai lệch số liệu công nợ: Bộ phận tuyển sinh và kế toán không dùng chung một nguồn dữ liệu về các đợt thanh toán học phí.
- Khó khăn lưu trữ & đánh giá: Dữ liệu khóa cũ khó tra cứu để cấp lại bảng điểm; khảo sát chất lượng giảng dạy không gắn định danh trực tiếp với từng giảng viên và môn học cụ thể.

3. Mục tiêu dự án
- Chuẩn hóa vòng đời học viên: Theo dõi xuyên suốt dữ liệu từ lúc tiếp nhận thông tin tư vấn (Lead), nhập học, xếp lớp, điểm danh, làm bài tập đến khi xét tốt nghiệp.
- Tối ưu hóa thao tác vận hành: Giảm thời gian điểm danh một buổi học xuống <= 60 giây và thời gian chấm bài tập xuống <= 3 phút.
- Tự động hóa cảnh báo rủi ro: Hệ thống chủ động phát hiện và gắn cờ cảnh báo các trường hợp học viên vắng học vượt ngưỡng hoặc nợ bài tập quá hạn.
- Minh bạch hóa tài chính: Đồng bộ bảng theo dõi công nợ học phí theo lớp khớp 100% với sổ kế toán thực tế.
- Khảo sát chất lượng thực chất: Tự động hóa quy trình khảo sát cuối khóa, đảm bảo tỷ lệ phản hồi >= 70% và quy chuẩn kết quả về từng giảng viên đứng lớp.

4. Phạm vi chức năng (Project Scope)
Phân hệ thực hiện (In-Scope):
- Tài khoản & Phân quyền (RBAC): Xác thực JWT, quản trị người dùng, phân quyền truy cập nghiêm ngặt ở tầng Server theo 8 vai trò và ghi nhật ký thao tác dữ liệu nhạy cảm (Audit Log).
- Danh mục đào tạo: Quản lý mô hình phân cấp: Chương trình đào tạo -> Môn học -> Buổi học.
- Tuyển sinh & Ghi danh: Tiếp nhận lead tư vấn từ Landing Page, quản lý phễu chăm sóc khách hàng và chuyển đổi thành hồ sơ học viên chính thức.
- Lớp học & Thời khóa biểu: Tự động sinh lịch học theo mẫu lặp, cơ chế phát hiện trùng lịch phòng/giảng viên, xử lý bảo lưu và chuyển lớp.
- Điểm danh & Chuyên cần: Giao diện điểm danh di động (Mobile-first từ 360px), tiếp nhận đơn xin nghỉ phép và thống kê tỷ lệ chuyên cần.
- Bài tập & Chấm điểm: Giao bài tập, nộp bài đa phiên bản, chấm điểm theo rubric chi tiết và cơ chế yêu cầu làm lại.
- Kết quả học tập & Tốt nghiệp: Thiết lập trọng số thành phần điểm, tự động tính điểm tổng kết môn học, xuất bảng điểm và xét điều kiện hoàn thành khóa.
- Học phí & Công nợ: Quản lý biểu phí, lập kế hoạch đóng theo đợt, ghi nhận thanh toán, xuất biên lai và báo cáo công nợ.
- Học liệu, Khảo sát & Báo cáo: Quản trị tài liệu theo buổi học, thông báo in-app kèm gửi email nhắc lịch, khảo sát đánh giá giảng viên và dashboard tổng quan.

Giới hạn hệ thống (Out-of-Scope):
- Ứng dụng di động native (hệ thống tập trung tối ưu Web Responsive).
- Cổng thanh toán trực tuyến tự động (chỉ ghi nhận khoản nộp thủ công qua kế toán).
- Hệ thống học trực tuyến LMS phức tạp (không phát video trực tuyến, không chấm code tự động).
- Chat trực tiếp thời gian thực, tích hợp SSO doanh nghiệp (LDAP) và xuất hóa đơn điện tử VAT.

5. Kiến trúc kỹ thuật & Công nghệ sử dụng
- Frontend: HTML5, CSS3 hiện đại, Vanilla JavaScript tối ưu hiệu năng.
- Backend: Node.js & Express, kiến trúc phân lớp chuẩn RESTful APIs.
- Cơ sở dữ liệu: In-memory store kết hợp cấu trúc dữ liệu chuẩn cho RBAC và người dùng.
- Bảo mật & Phiên làm việc: JSON Web Tokens (Access Token), mật khẩu mã hóa an toàn, kiểm soát truy cập phân tầng (Role-Based Access Control) tại Server Endpoint theo nguyên tắc Default Deny.
- Quy trình phát triển: Agile/Scrum (8 tuần, 8 Sprints) quản lý qua Jira và mã nguồn kiểm soát theo Git Flow trên GitHub.

---

## 6. Danh sách Tài khoản & Mật khẩu thử nghiệm (Demo Accounts)

Dưới đây là danh sách tài khoản được phân quyền theo 8 vai trò nghiệp vụ trong hệ thống để phục vụ kiểm thử đăng nhập và vận hành giao diện:

| STT | Vai trò nghiệp vụ (Role) | Email / Tên đăng nhập | Mật khẩu | Trang đích sau đăng nhập |
|:---:|:---|:---|:---:|:---|
| 1 | **Quản trị hệ thống (Administrator)** | `admin@tms.edu.vn` | `admin123` | `frontend/Index.html?role=administrator` |
| 2 | **Quản lý đào tạo (Training Manager)** | `manager@tms.edu.vn` | `manager123` | `frontend/Index.html?role=training_manager` |
| 3 | **Giảng viên (Instructor)** | `teacher@tms.edu.vn` | `teacher123` | `frontend/Index.html?role=instructor` |
| 4 | **Trợ giảng (Teaching Assistant)** | `ta@tms.edu.vn` | `ta123456` | `frontend/Index.html?role=teaching_assistant` |
| 5 | **Học viên (Student / Learner)** | `student@tms.edu.vn` *(hoặc `sv001`)* | `student123` | `frontend/Index.html?role=student` |
| 6 | **Tư vấn tuyển sinh (Admissions Counselor)** | `admissions@tms.edu.vn` | `admissions123` | `frontend/Index.html?role=admissions` |
| 7 | **Kế toán đào tạo (Accountant)** | `accountant@tms.edu.vn` | `accountant123` | `frontend/Index.html?role=accountant` |
| 8 | **Khách truy cập (Visitor)** | `visitor@tms.edu.vn` | `visitor123` | `frontend/Index.html?role=visitor` |

> **Ghi chú trải nghiệm:**
> - Trang đăng nhập: `frontend/Login.html`
> - Trang đăng ký: `frontend/Register.html` (hoặc `frontend/Login.html#register`)
> - Dashboard tổng quan: `frontend/Index.html`
> - Quản trị vai trò & phân quyền: `frontend/RoleManagement.html`

---

## 7. Tính năng Triển khai trên Nhánh `minhquanmedia` (KN-8: Hệ Thống Phân Quyền Theo Vai Trò - RBAC)

Nhánh **`minhquanmedia`** thực hiện toàn diện tính năng **KN-8: Phân quyền theo vai trò cho toàn hệ thống (RBAC)** thuộc Sprint 1 - Epic KN-14:

- **Thành viên thực hiện:** ĐOÀN MINH QUÂN
- **Mã sinh viên:** `dtc245200761@ictu.edu.vn`
- **Tài khoản GitHub:** `azmedia247` (`doanminhquan3322@gmail.com`)
- **Vai trò trong nhóm:** Backend Developer
- **User Story:** *"Là Quản trị hệ thống, tôi muốn phân quyền theo vai trò cho toàn hệ thống, để đảm bảo giảng viên không sửa được học phí và kế toán không sửa được điểm."*

### 7.1 Chi tiết các hạng mục đã hoàn thành trên nhánh

#### 1. Dịch vụ Phân quyền Hệ thống (`backend/rbacService.js`)
- **Khai báo đầy đủ 8 vai trò nghiệp vụ chuẩn TMS:**
  `administrator` (Quản trị hệ thống), `training_manager` (Quản lý đào tạo), `instructor` (Giảng viên), `teaching_assistant` (Trợ giảng), `student` (Học viên), `admissions` (Tư vấn tuyển sinh), `accountant` (Kế toán), `visitor` (Khách tham quan).
- **Khai báo 11 mã quyền hệ thống:** Phân chia theo 4 nhóm chức năng (Khảo thí & Điểm số, Tài chính & Học phí, Đào tạo & Lớp học, Quản trị hệ thống).
- **Cơ chế kiểm soát truy cập Default Deny:** Hàm `hasPermission(role, permission)` mặc định từ chối mọi yêu cầu nếu vai trò không có quyền rõ ràng hoặc chưa xác thực.
- **Middleware bảo vệ ở tầng Server:** `authorizePermission(permission)` đánh chặn các request trước khi tới handler nghiệp vụ. Khi thiếu quyền, trả về mã **HTTP 403 Forbidden** kèm thông báo tiếng Việt thân thiện, không làm lộ stack trace kỹ thuật.
- **Cô lập quyền hạn tuyệt đối:**
  - Giảng viên (`instructor`): Có quyền `grades:update` (nhập/sửa điểm), **không có quyền `tuition:update`** (sửa học phí).
  - Kế toán (`accountant`): Có quyền `tuition:update` (cập nhật học phí), **không có quyền `grades:update`** (sửa điểm).
- **Hỗ trợ cập nhật phân quyền linh hoạt:** Cung cấp các hàm `updateRolePermissions`, `updateAllRolePermissions` và `resetRolePermissions`.

#### 2. Tầng API Endpoints (`backend/server.js`)
- `GET /api/rbac/matrix`: Lấy toàn bộ ma trận phân quyền 8 vai trò.
- `PUT /api/rbac/matrix`: Cập nhật toàn bộ ma trận phân quyền trong một yêu cầu duy nhất.
- `PUT /api/rbac/matrix/:role`: Cập nhật danh sách quyền cho vai trò cụ thể.
- `POST /api/rbac/matrix/reset`: Khôi phục ma trận phân quyền về mặc định ban đầu.
- `GET /api/rbac/my-permissions`: Lấy danh sách quyền của tài khoản hiện tại qua token.
- `GET /api/rbac/demo-token/:role`: Cấp Token mô phỏng theo vai trò phục vụ kiểm thử nhanh trực tiếp trên giao diện.
- `GET /api/grades` & `PUT /api/grades/:studentId`: Nghiệp vụ quản lý điểm số (yêu cầu `grades:view` / `grades:update`).
- `GET /api/tuitions` & `PUT /api/tuitions/:studentId`: Nghiệp vụ quản lý học phí (yêu cầu `tuition:view` / `tuition:update`).
- Phục vụ file tĩnh frontend: Cấu hình `express.static` phục vụ toàn bộ thư mục `../frontend`.

#### 3. Giao diện Quản trị Phân quyền (`frontend/RoleManagement.html`)
- **Thiết kế chuẩn hệ thống TMS 2026:**
  - Bo góc mềm mại hiện đại (`10px` - `14px`), bảng màu Emerald Green (`#10b981`), thanh điều hướng Sidebar Dark (`#0f172a`), hỗ trợ chế độ Sáng / Tối.
  - Sử dụng 100% icon SVG vector thanh mảnh, không sử dụng emoji.
- **Ma trận quyền hạn trực quan:**
  - Bảng ma trận 8 cột vai trò và 11 hàng quyền hạn phân theo 4 nhóm nghiệp vụ rõ ràng.
  - Bộ đếm quyền động cho từng vai trò (ví dụ: `4/11 quyền`).
  - Thanh tìm kiếm quyền (live search) và bộ lọc phân hệ nghiệp vụ.
  - Checkbox tương tác thời gian thực, có banner cảnh báo khi có thay đổi chưa lưu.
- **Bảng Thử nghiệm Thực thi Quyền tầng Server (Live RBAC Test):**
  - 4 thẻ kịch bản kiểm tra nhanh cho Giảng viên, Kế toán, Học viên, Quản trị viên.
  - Trình giả lập tương tác tự do (Custom Interactive Simulator): Cho phép chọn vai trò bất kỳ và hành động bất kỳ để gửi request HTTP thật tới Server, hiển thị mã trạng thái, độ trễ và JSON response chi tiết.
- **Danh mục 8 tài khoản mẫu chuẩn TMS:** Bảng tra cứu tài khoản kèm nút kiểm tra quyền tức thời.

#### 4. Bộ Kiểm thử Tự động Toàn diện (`backend/test/rbac.test.js`)
Xây dựng bộ kiểm thử tự động kiểm tra 4 vai trò với 12 ca kiểm thử đạt kết quả **100% PASS**:
- Case 1: Khai báo đầy đủ ma trận quyền cho 8 vai trò.
- Case 2: Giảng viên có quyền `grades:update` và không có quyền `tuition:update`.
- Case 3: Giảng viên sửa điểm sinh viên thành công (HTTP 200).
- Case 4: Chặn giảng viên sửa học phí (HTTP 403 Forbidden).
- Case 5: Kế toán cập nhật học phí thành công (HTTP 200).
- Case 6: Chặn kế toán sửa điểm (HTTP 403 Forbidden).
- Case 7: Quản trị hệ thống được phép cập nhật cả điểm và học phí.
- Case 8: Học viên bị chặn khi cố ý sửa điểm hoặc học phí.
- Case 9: Chặn request không có token xác thực (HTTP 401).
- Case 10: Vai trò không xác định bị từ chối mặc định (Default Deny).
- Case 11: Cập nhật ma trận phân quyền thành công qua API.
- Case 12: Thông báo lỗi tiếng Việt rõ ràng khi không đủ quyền.

#### 5. Báo cáo Chi tiết Tiến độ (`plan_KN8.md`)
Tài liệu hóa chi tiết quá trình phân tích, thiết kế, triển khai và kết quả kiểm thử của tính năng KN-8 theo đúng đặc tả của đề bài.

---

### 7.2 Hướng dẫn Chạy & Kiểm thử Tính năng

#### Bước 1: Khởi động Backend Server
```bash
cd backend
npm start
```
Server sẽ chạy tại: `http://localhost:3000`

#### Bước 2: Chạy Bộ Kiểm thử Tự động
```bash
cd backend
npm test
# hoặc
npm run test:rbac
```

#### Bước 3: Trải nghiệm Giao diện Quản trị Phân quyền
Mở trình duyệt và truy cập: `http://localhost:3000/RoleManagement.html`
- Thử nghiệm các nút kiểm tra quyền của Giảng viên và Kế toán trong bảng Live RBAC Test.
- Thử nghiệm tích chọn/bỏ chọn quyền trong bảng ma trận và bấm "Lưu thay đổi".
- Bấm "Khôi phục mặc định" để đưa ma trận về cấu hình ban đầu.