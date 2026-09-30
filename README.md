# K15C6_N4
<h1 align="center">HỆ THỐNG QUẢN LÝ ĐÀO TẠO (TMS)</h1>

<p align="center">
  <i>Single Source of Truth - Nguồn dữ liệu tập trung duy nhất thay thế quy trình quản lý thủ công</i>
</p>

---

<details open>
  <summary><b>NỘI DUNG (Table of Contents)</b></summary>
  <ol>
    <li><a href="#1-gioi-thieu-tong-quan">Giới thiệu tổng quan</a></li>
    <li><a href="#2-boi-canh--van-de-giai-quyet">Bối cảnh & Vấn đề giải quyết</a></li>
    <li><a href="#3-muc-tieu-du-an">Mục tiêu dự án</a></li>
    <li><a href="#4-pham-vi-chuc-nang">Phạm vi chức năng</a></li>
    <li><a href="#5-kien-truc-ky-thuat--cong-nghe">Kiến trúc kỹ thuật & Công nghệ</a></li>
  </ol>
</details>

---

<h2 id="1-gioi-thieu-tong-quan">1. Giới thiệu tổng quan</h2>

Hệ thống Quản lý Đào tạo (Training Management System - TMS) là giải pháp phần mềm quản trị nội bộ trên nền tảng Web, được xây dựng nhằm số hóa và đồng nhất toàn diện chu trình vận hành đào tạo tại trung tâm. 

Hệ thống kết nối và cung cấp giao diện nghiệp vụ chuyên biệt cho 8 nhóm người dùng:
1. Khách truy cập
2. Học viên
3. Giảng viên
4. Trợ giảng
5. Tư vấn tuyển sinh
6. Kế toán
7. Quản lý đào tạo
8. Quản trị hệ thống

---

<h2 id="2-boi-canh--van-de-giai-quyet">2. Bối cảnh & Vấn đề giải quyết</h2>

Trước khi triển khai dự án, trung tâm vận hành dựa trên các công cụ rời rạc (Google Sheets, Google Calendar, Zalo, GitHub, sổ sách kế toán). Thực trạng này được TMS giải quyết triệt để thông qua các góc độ:

| Thực trạng trước đây | Giải pháp của TMS |
| :--- | :--- |
| **Thiếu tính tức thời:** Ban quản lý không thể nắm bắt nhanh tình trạng chuyên cần hay tỷ lệ nợ bài tập của từng lớp theo thời gian thực. | **Dữ liệu tập trung (Single Source of Truth):** Dashboard cập nhật trạng thái lớp học, chuyên cần và bài tập theo thời gian thực. |
| **Phát hiện trễ:** Các dấu hiệu cảnh báo (vắng học, chậm nộp bài, chậm học phí) rải rác ở nhiều bộ phận, khiến việc hỗ trợ học viên bị trễ. | **Tự động hóa cảnh báo rủi ro:** Hệ thống tự động đánh dấu và gửi cảnh báo khi học viên vượt ngưỡng vắng học hoặc nợ bài. |
| **Sai lệch công nợ:** Bộ phận tuyển sinh và kế toán không dùng chung một nguồn dữ liệu về các đợt thanh toán. | **Minh bạch hóa tài chính:** Đồng bộ bảng theo dõi công nợ học phí theo lớp, khớp 100% với sổ kế toán. |
| **Lưu trữ & Đánh giá thủ công:** Dữ liệu cũ khó tra cứu để cấp lại bảng điểm; khảo sát chất lượng không gắn định danh giảng viên. | **Lưu vết và quy chuẩn dữ liệu:** Dễ dàng tra cứu lịch sử học tập. Khảo sát cuối khóa được tự động hóa và phân tích đích danh giảng viên. |

---

<h2 id="3-muc-tieu-du-an">3. Mục tiêu dự án</h2>

*   **Chuẩn hóa vòng đời học viên:** Theo dõi xuyên suốt dữ liệu từ lúc tiếp nhận thông tin tư vấn (Lead) -> Nhập học -> Xếp lớp -> Điểm danh -> Làm bài tập -> Xét tốt nghiệp.
*   **Tối ưu hóa thao tác vận hành:** Giảm thời gian điểm danh một buổi học xuống <= 60 giây và thời gian chấm bài tập xuống <= 3 phút.
*   **Tự động hóa cảnh báo rủi ro:** Hệ thống chủ động phát hiện và gắn cờ cảnh báo các trường hợp học viên vắng học vượt ngưỡng hoặc nợ bài tập quá hạn.
*   **Minh bạch hóa tài chính:** Đồng bộ bảng theo dõi công nợ học phí theo lớp khớp 100% với sổ kế toán thực tế.
*   **Khảo sát chất lượng thực chất:** Tự động hóa quy trình khảo sát cuối khóa, đảm bảo tỷ lệ phản hồi >= 70% và quy chuẩn kết quả về từng giảng viên đứng lớp.

---

<h2 id="4-pham-vi-chuc-nang">4. Phạm vi chức năng (Project Scope)</h2>

### Phân hệ thực hiện (In-Scope)

<details>
  <summary><b>Tài khoản & Phân quyền (RBAC)</b></summary>
  Xác thực JWT, quản trị người dùng, phân quyền truy cập nghiêm ngặt ở tầng Server theo 8 vai trò và ghi nhật ký thao tác dữ liệu nhạy cảm (Audit Log).
</details>

<details>
  <summary><b>Danh mục đào tạo</b></summary>
  Quản lý mô hình phân cấp: Chương trình đào tạo -> Môn học -> Buổi học.
</details>

<details>
  <summary><b>Tuyển sinh & Ghi danh</b></summary>
  Tiếp nhận lead tư vấn từ Landing Page, quản lý phễu chăm sóc khách hàng và chuyển đổi thành hồ sơ học viên chính thức.
</details>

<details>
  <summary><b>Lớp học & Thời khóa biểu</b></summary>
  Tự động sinh lịch học theo mẫu lặp, cơ chế phát hiện trùng lịch phòng/giảng viên, xử lý bảo lưu và chuyển lớp.
</details>

<details>
  <summary><b>Điểm danh & Chuyên cần</b></summary>
  Giao diện điểm danh di động (Mobile-first từ 360px), tiếp nhận đơn xin nghỉ phép và thống kê tỷ lệ chuyên cần.
</details>

<details>
  <summary><b>Bài tập & Chấm điểm</b></summary>
  Giao bài tập, nộp bài đa phiên bản, chấm điểm theo rubric chi tiết và cơ chế yêu cầu làm lại.
</details>

<details>
  <summary><b>Kết quả học tập & Tốt nghiệp</b></summary>
  Thiết lập trọng số thành phần điểm, tự động tính điểm tổng kết môn học, xuất bảng điểm và xét điều kiện hoàn thành khóa.
</details>

<details>
  <summary><b>Học phí, Khảo sát & Báo cáo</b></summary>
  Quản lý biểu phí, lập kế hoạch đóng theo đợt, ghi nhận thanh toán, báo cáo công nợ. Quản trị tài liệu, thông báo in-app kèm email nhắc lịch, khảo sát giảng viên và dashboard tổng quan.
</details>

<br>

### Giới hạn hệ thống (Out-of-Scope)
*   Ứng dụng di động native (hệ thống tập trung tối ưu Web Responsive).
*   Cổng thanh toán trực tuyến tự động (chỉ ghi nhận khoản nộp thủ công qua kế toán).
*   Hệ thống học trực tuyến LMS phức tạp (không phát video trực tuyến, không chấm code tự động).
*   Chat trực tiếp thời gian thực, tích hợp SSO doanh nghiệp (LDAP) và xuất hóa đơn điện tử VAT.

---

<h2 id="5-kien-truc-ky-thuat--cong-nghe">5. Kiến trúc kỹ thuật & Công nghệ sử dụng</h2>

**Frontend**
*   **Ngôn ngữ & Thư viện:** React, TypeScript.
*   **Giao diện:** Tailwind CSS (tối ưu đa thiết bị, hỗ trợ hiển thị di động từ 360px).

**Backend**
*   **Framework:** Spring Boot (Java) hoặc NestJS (TypeScript).
*   **Kiến trúc:** Phân lớp chuẩn RESTful APIs.
*   **Bảo mật & Phiên làm việc:** JSON Web Tokens (Access/Refresh Token), mật khẩu mã hóa chuẩn bcrypt, kiểm soát truy cập phân tầng (Role-Based Access Control) tại Server Endpoint.

**Cơ sở dữ liệu & Lưu trữ**
*   **Hệ quản trị CSDL:** PostgreSQL (đảm bảo tính toàn vẹn dữ liệu, giao dịch ACID và các ràng buộc khóa ngoại chặt chẽ).
*   **Lưu trữ đám mây:** Hệ thống lưu trữ đối tượng (S3-compatible) cho bài tập và slide bài giảng.
*   **Tác vụ nền:** Hàng đợi gửi mail bất đồng bộ qua SMTP.

**Quy trình phát triển & Quản lý**
*   **Phương pháp luận:** Agile/Scrum (8 tuần, 8 Sprints, 75 User Stories, 350 Story Points).
*   **Công cụ:** Quản lý dự án qua Jira.
*   **Quản lý mã nguồn:** Git Flow.
