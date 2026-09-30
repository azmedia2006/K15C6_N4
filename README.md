Hệ Thống Quản Lý Đào Tạo (Training Management System - TMS)
1. Giới thiệu tổng quan
Hệ thống Quản lý Đào tạo (TMS) là giải pháp phần mềm quản trị nội bộ trên nền tảng Web, được xây dựng nhằm số hóa và đồng nhất toàn diện chu trình vận hành đào tạo tại trung tâm. Hệ thống kết nối và phục vụ 8 nhóm người dùng nghiệp vụ (từ Khách truy cập, Học viên, Giảng viên, Trợ giảng đến Tư vấn tuyển sinh, Kế toán, Quản lý đào tạo và Quản trị hệ thống), cung cấp một nguồn dữ liệu tập trung duy nhất (Single Source of Truth) thay thế cho quy trình quản lý thủ công phân tán.
2. Bối cảnh & Vấn đề giải quyết
Trước khi triển khai dự án, trung tâm vận hành dựa trên các công cụ rời rạc: quản lý danh sách và điểm số qua Google Sheets, xếp lịch trên Google Calendar, giao nhận bài tập qua Zalo / GitHub và theo dõi công nợ thủ công tại sổ sách kế toán. Thực trạng này dẫn đến nhiều bất cập:
Thiếu tính tức thời: Ban quản lý không thể nắm bắt nhanh tình trạng chuyên cần hay tỷ lệ nợ bài tập của từng lớp theo thời gian thực.
Phát hiện trễ học viên có nguy cơ bỏ học: Các dấu hiệu cảnh báo (vắng học liên tiếp, chậm nộp bài tập, chậm đóng học phí) nằm rải rác ở các bộ phận khác nhau, khiến việc hỗ trợ học viên bị chậm trễ.
Sai lệch số liệu công nợ: Bộ phận tuyển sinh và kế toán không dùng chung một nguồn dữ liệu về các đợt thanh toán học phí.
Khó khăn lưu trữ & đánh giá: Dữ liệu khóa cũ khó tra cứu để cấp lại bảng điểm; khảo sát chất lượng giảng dạy không gắn định danh trực tiếp với từng giảng viên và môn học cụ thể.
3. Mục tiêu dự án
Chuẩn hóa vòng đời học viên: Theo dõi xuyên suốt dữ liệu từ lúc tiếp nhận thông tin tư vấn (Lead), nhập học, xếp lớp, điểm danh, làm bài tập đến khi xét tốt nghiệp.
Tối ưu hóa thao tác vận hành: Giảm thời gian điểm danh một buổi học xuống $\le$ 60 giây và thời gian chấm bài tập xuống $\le$ 3 phút.
Tự động hóa cảnh báo rủi ro: Hệ thống chủ động phát hiện và gắn cờ cảnh báo các trường hợp học viên vắng học vượt ngưỡng hoặc nợ bài tập quá hạn.
Minh bạch hóa tài chính: Đồng bộ bảng theo dõi công nợ học phí theo lớp khớp 100% với sổ kế toán thực tế.
Khảo sát chất lượng thực chất: Tự động hóa quy trình khảo sát cuối khóa, đảm bảo tỷ lệ phản hồi $\ge$ 70% và quy chuẩn kết quả về từng giảng viên đứng lớp.
4. Phạm vi chức năng (Project Scope)
Phân hệ thực hiện (In-Scope)
Tài khoản & Phân quyền (RBAC): Xác thực JWT, quản trị người dùng, phân quyền truy cập nghiêm ngặt ở tầng Server theo 8 vai trò và ghi nhật ký thao tác dữ liệu nhạy cảm (Audit Log).
Danh mục đào tạo: Quản lý mô hình phân cấp: Chương trình đào tạo $\rightarrow$ Môn học $\rightarrow$ Buổi học.
Tuyển sinh & Ghi danh: Tiếp nhận lead tư vấn từ Landing Page, quản lý phễu chăm sóc khách hàng và chuyển đổi thành hồ sơ học viên chính thức.
Lớp học & Thời khóa biểu: Tự động sinh lịch học theo mẫu lặp, cơ chế phát hiện trùng lịch phòng/giảng viên, xử lý bảo lưu và chuyển lớp.
Điểm danh & Chuyên cần: Giao diện điểm danh di động (Mobile-first từ 360px), tiếp nhận đơn xin nghỉ phép và thống kê tỷ lệ chuyên cần.
Bài tập & Chấm điểm: Giao bài tập, nộp bài đa phiên bản, chấm điểm theo rubric chi tiết và cơ chế yêu cầu làm lại.
Kết quả học tập & Tốt nghiệp: Thiết lập trọng số thành phần điểm, tự động tính điểm tổng kết môn học, xuất bảng điểm và xét điều kiện hoàn thành khóa.
Học phí & Công nợ: Quản lý biểu phí, lập kế hoạch đóng theo đợt, ghi nhận thanh toán, xuất biên lai và báo cáo công nợ.
Học liệu, Khảo sát & Báo cáo: Quản trị tài liệu theo buổi học, thông báo in-app kèm gửi email nhắc lịch, khảo sát đánh giá giảng viên và dashboard tổng quan.
Giới hạn hệ thống (Out-of-Scope)
Ứng dụng di động native (hệ thống tập trung tối ưu Web Responsive).
Cổng thanh toán trực tuyến tự động (chỉ ghi nhận khoản nộp thủ công qua kế toán).
Hệ thống học trực tuyến LMS phức tạp (không phát video trực tuyến, không chấm code tự động).
Chat trực tiếp thời gian thực, tích hợp SSO doanh nghiệp (LDAP) và xuất hóa đơn điện tử VAT.
5. Kiến trúc kỹ thuật & Công nghệ sử dụng
Frontend: React, TypeScript, Tailwind CSS (giao diện tối ưu đa thiết bị, hỗ trợ hiển thị di động từ 360px).
Backend: Spring Boot (Java) hoặc NestJS (TypeScript), kiến trúc phân lớp chuẩn RESTful APIs.
Cơ sở dữ liệu: PostgreSQL (đảm bảo tính toàn vẹn dữ liệu, giao dịch ACID và các ràng buộc khóa ngoại chặt chẽ).
Bảo mật & Phiên làm việc: JSON Web Tokens (Access Token + Refresh Token), mật khẩu mã hóa chuẩn bcrypt, kiểm soát truy cập phân tầng (Role-Based Access Control) tại Server Endpoint.
Lưu trữ & Dịch vụ ngoài: Hệ thống lưu trữ đối tượng (S3-compatible) cho bài tập và slide bài giảng; hàng đợi gửi mail bất đồng bộ qua SMTP.
Quản lý dự án & Quy trình phát triển: Agile/Scrum (8 tuần, 8 Sprints, 75 User Stories, 350 Story Points) quản lý qua Jira và mã nguồn kiểm soát theo Git Flow.