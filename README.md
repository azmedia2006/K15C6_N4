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
- **Vai trò trong nhóm:** Backend Developer
- **User Story:** *"Là Quản trị hệ thống, tôi muốn phân quyền theo vai trò cho toàn hệ thống, để đảm bảo giảng viên không sửa được học phí và kế toán không sửa được điểm."*

---

### 7.1 Cấu trúc Mã nguồn trên Nhánh `minhquanmedia` (Code Structure)

Toàn bộ cấu trúc thư mục của dự án trên nhánh `minhquanmedia` được chuẩn hóa, phân tách rõ ràng giữa tầng dịch vụ Backend, giao diện Frontend và bộ kiểm thử tự động:

```text
minhquan_thuctapcaso/
├── backend/
│   ├── test/
│   │   ├── auth.test.js              # Kiểm thử xác thực & đăng nhập (KN-38)
│   │   ├── rbac.test.js              # [MỚI - KN-8] Bộ 12 ca kiểm thử tự động phân quyền RBAC
│   │   └── user_management.test.js   # Kiểm thử quản lý người dùng
│   ├── authService.js                # Dịch vụ xác thực, băm mật khẩu PBKDF2 & JWT token
│   ├── package.json                  # [CẬP NHẬT] Cấu hình npm test chạy rbac.test.js
│   ├── rbacService.js                # [MỚI - KN-8] Dịch vụ phân quyền 8 vai trò, Default Deny & nghiệp vụ
│   ├── server.js                     # [CẬP NHẬT - KN-8] Express server, middleware kiểm quyền & API RBAC
│   └── userService.js                # Dịch vụ quản trị thông tin người dùng
├── frontend/
│   ├── ChangePassword.html           # Giao diện đổi mật khẩu
│   ├── Index.html                    # Dashboard tổng quan hệ thống TMS
│   ├── Login.html                    # Giao diện đăng nhập tài khoản
│   ├── Register.html                 # Giao diện đăng ký
│   ├── RoleManagement.html           # [MỚI - KN-8] Giao diện ma trận phân quyền & Live RBAC Test
│   └── UserManagement.html           # Giao diện quản lý người dùng
├── plan_KN8.md                       # [MỚI - KN-8] Báo cáo chi tiết nghiệm thu tính năng KN-8
└── README.md                         # [CẬP NHẬT] Tài liệu dự án & đặc tả kỹ thuật nhánh minhquanmedia
```

---

### 7.2 Chi tiết Các Hạng mục và Tính năng Mới của KN-8

Bảng tổng hợp chi tiết các file mới và cập nhật riêng cho tính năng **KN-8**:

| STT | Tên File / Thành phần | Loại thay đổi | Nội dung và Chức năng mới |
|:---:|---|:---:|---|
| 1 | `backend/rbacService.js` | **TẠO MỚI** | • Định nghĩa 8 vai trò nghiệp vụ chuẩn (`BUSINESS_ROLES`) và 11 mã quyền hệ thống (`PERMISSIONS`).<br>• Khai báo ma trận phân quyền mặc định (`defaultRolePermissions`) và quản lý bộ nhớ động (`currentRolePermissions`).<br>• Triển khai hàm kiểm quyền `hasPermission(role, permission)` tuân thủ nguyên tắc **Default Deny**.<br>• Xây dựng Middleware `authorizePermission(permission)` đánh chặn ở tầng Server, trả về mã HTTP 403 Forbidden kèm thông báo tiếng Việt.<br>• Cung cấp nghiệp vụ mẫu: Sửa điểm (`updateStudentGrade`) và Sửa học phí (`updateStudentTuition`).<br>• Hàm cập nhật ma trận (`updateRolePermissions`, `updateAllRolePermissions`) và khôi phục mặc định (`resetRolePermissions`). |
| 2 | `backend/server.js` | **CẬP NHẬT** | • Đăng ký các API quản trị phân quyền: `GET /api/rbac/matrix`, `PUT /api/rbac/matrix`, `PUT /api/rbac/matrix/:role`, `POST /api/rbac/matrix/reset`, `GET /api/rbac/my-permissions`.<br>• Bổ sung API `GET /api/rbac/demo-token/:role` cấp token nhanh cho 8 vai trò để phục vụ kiểm thử.<br>• Áp dụng Middleware `authorizePermission` vào các Endpoint nhạy cảm: `GET /api/grades`, `PUT /api/grades/:studentId`, `GET /api/tuitions`, `PUT /api/tuitions/:studentId`.<br>• Cấu hình phục vụ file tĩnh giao diện web qua `express.static`. |
| 3 | `frontend/RoleManagement.html` | **TẠO MỚI & HOÀN THIỆN** | • Giao diện chuẩn TMS 2026: Bo góc mềm mại (`10px` - `14px`), màu xanh ngọc lục bảo (`#10b981`), Dark sidebar (`#0f172a`), hỗ trợ Dark/Light mode, 100% SVG vector sạch AI.<br>• Bảng ma trận phân quyền động 8 vai trò x 11 quyền hạn, tích hợp bộ đếm quyền thời gian thực (`count_role`).<br>• Thanh công cụ tìm kiếm quyền tức thời (live search) và bộ lọc phân hệ nghiệp vụ.<br>• Bảng kiểm tra thực thi quyền tầng Server (Live RBAC Test): 4 kịch bản nhanh cho Giảng viên, Kế toán, Học viên, Quản trị viên và Trình giả lập tự do (Custom Interactive Simulator) gửi HTTP request thật lên Server.<br>• Kết nối trực tiếp Backend: Nút "Lưu thay đổi" (`PUT /api/rbac/matrix`) và "Khôi phục mặc định" (`POST /api/rbac/matrix/reset`).<br>• Bảng tham chiếu 8 tài khoản mẫu chuẩn TMS theo mục 6 `README.md`. |
| 4 | `backend/test/rbac.test.js` | **TẠO MỚI** | • Bộ 12 ca kiểm thử tự động toàn diện kiểm tra 4 vai trò (Quản trị viên, Giảng viên, Kế toán, Học viên).<br>• Kiểm thử cô lập: Giảng viên sửa điểm (HTTP 200), Giảng viên sửa học phí (HTTP 403).<br>• Kiểm thử cô lập: Kế toán sửa học phí (HTTP 200), Kế toán sửa điểm (HTTP 403).<br>• Kiểm thử Default Deny, chặn thiếu token (HTTP 401), kiểm tra thông báo tiếng Việt.<br>• Đạt tỷ lệ **100% PASS (12/12 ca kiểm thử)**. |
| 5 | `plan_KN8.md` | **TẠO MỚI** | • Báo cáo chi tiết tiến độ triển khai, kiến trúc giải pháp, tiêu chí nghiệm thu Jira và kết quả kiểm thử tự động của tính năng KN-8. |
| 6 | `backend/package.json` | **CẬP NHẬT** | • Bổ sung kịch bản chạy kiểm thử `test:rbac` (`node test/rbac.test.js`).<br>• Cấu hình lệnh `npm test` chuyên biệt cho tính năng KN-8. |

---

### 7.3 Hướng dẫn Chạy & Kiểm thử Tính năng

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