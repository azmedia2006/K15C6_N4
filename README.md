# Hệ Thống Quản Lý Đào Tạo (Training Management System - TMS)

[![Sprint](https://img.shields.io/badge/Sprint-KN%20Sprint%202-blue.svg)](https://github.com/azmedia2006/K15C6_N4)
[![Story](https://img.shields.io/badge/User%20Story-KN--76-success.svg)](https://github.com/azmedia2006/K15C6_N4/tree/feature/KN_76)
[![Assignee](https://img.shields.io/badge/Assignee-minhquan247-orange.svg)](https://github.com/minhquan247)
[![Tests](https://img.shields.io/badge/Tests-10%2F10%20PASS-brightgreen.svg)](file:///c:/Users/Administrator/Downloads/minhquan_ttcs/backend/test/lead_filter_kn76.test.js)

---

## 1. Giới thiệu tổng quan
**Hệ thống Quản lý Đào tạo (TMS)** là giải pháp phần mềm quản trị nội bộ trên nền tảng Web, được xây dựng nhằm số hóa và đồng nhất toàn diện chu trình vận hành đào tạo tại trung tâm. Hệ thống kết nối và phục vụ 8 nhóm người dùng nghiệp vụ (từ Khách truy cập, Học viên, Giảng viên, Trợ giảng đến Tư vấn tuyển sinh, Kế toán, Quản lý đào tạo và Quản trị hệ thống), cung cấp một nguồn dữ liệu tập trung duy nhất (**Single Source of Truth**) thay thế cho quy trình quản lý thủ công phân tán.

---

## 2. Tính Năng Trọng Tâm Nhánh `feature/KN_76`: Quản Lý & Lọc Lead Tuyển Sinh (KN-76)

Nhánh phát triển **`feature/KN_76`** triển khai đầy đủ User Story **KN-76** (Jira Sprint 2) dành cho phân hệ **Tư vấn tuyển sinh (Admissions)** do **`minhquan247`** phụ trách.

### 2.1. User Story
> *"Là Tư vấn tuyển sinh, tôi muốn tìm kiếm và lọc lead theo nhiều điều kiện, để tìm lại được cuộc trao đổi từ tháng trước khi khách gọi lại."*

### 2.2. Các Chức Năng Nổi Bật Đã Triển Khai
1. 🔍 **Tìm nhanh theo Tên hoặc Số điện thoại (Quick Search):**
   - Hỗ trợ gõ tiếng Việt không dấu (ví dụ: gõ `hoang nam` tìm thấy ngay `Nguyễn Hoàng Nam`).
   - Chuẩn hóa chuỗi số điện thoại linh hoạt (ví dụ: gõ `0977 889 900` khớp chính xác `0977889900`).
   - Hỗ trợ tìm kiếm theo đuôi số điện thoại khi khách dùng số lạ gọi lại.

2. 🎯 **Lọc Lead Đa Tiêu Chí Thời Gian Thực (Multi-criteria Filtering):**
   - **Trạng thái:** Mới tiếp nhận (`new`), Đang tư vấn (`contacted`), Tiềm năng cao (`qualified`), Hẹn gặp/Test (`meeting_scheduled`), Đã ghi danh (`enrolled`), Tạm dừng (`lost`).
   - **Nguồn tiếp cận:** Hotline Trực tiếp, Facebook Ads/Fanpage, Website Form, Giới thiệu (Referral), Zalo OA, Sự kiện trường học.
   - **Tư vấn viên phụ trách:** Lọc theo từng nhân viên (`usr_admissions`, `minhquan247`, Hoàng Thị Lan...) hoặc hồ sơ chưa phân công (`unassigned`).

3. 📅 **Lọc Theo Khoảng Thời Gian & Tra Cứu Cuộc Trao Đổi Từ Tháng Trước (`last_month`):**
   - Mốc thời gian linh hoạt: Hôm nay, Hôm qua, 7 ngày gần nhất, 30 ngày gần nhất, Tháng này, và đặc biệt **Tháng trước (Last Month)**.
   - Cơ chế đối chiếu thông minh: Quét cả ngày tạo lead lẫn mốc thời gian của từng cuộc gọi trong lịch sử tư vấn (`consultationHistory.timestamp`).
   - Hỗ trợ chọn khoảng ngày tùy chỉnh (`startDate` đến `endDate`).

4. 📞 **Tra Cứu Lịch Sử & Ghi Nhận Cuộc Trao Đổi Khi Khách Gọi Lại:**
   - Hộp thoại Modal xem dòng thời gian (Timeline) chi tiết toàn bộ các cuộc trao đổi trong quá khứ.
   - Cuộc trao đổi từ tháng trước được gắn nhãn nổi bật (`⭐ Cuộc trao đổi từ tháng trước`) giúp tư vấn viên nắm bắt ngay ngữ cảnh khi khách gọi lại.
   - Tích hợp biểu mẫu ghi nhận nhanh: Loại cuộc gọi (Inbound/Outbound/Zalo), tóm tắt thảo luận và cập nhật trạng thái mới.

5. 📊 **Giao Diện Quản Trị Chuyên Biệt ([`LeadManagement.html`](file:///c:/Users/Administrator/Downloads/minhquan_ttcs/LeadManagement.html)):**
   - Thiết kế chuẩn TMS Design System, hỗ trợ Dark / Light Mode.
   - 4 Thẻ KPI thống kê trực quan: Tổng lead, Trao đổi tháng trước, Đang tư vấn, Đã chốt nhập học.
   - Tính năng xuất báo cáo danh sách khách hàng ra file CSV định dạng UTF-8 chuẩn.

---

## 3. Kiến Trúc Kỹ Thuật & Công Nghệ Sử Dụng

- **Frontend:** HTML5, Vanilla CSS3 (Custom Design System, Dark/Light Mode, Glassmorphism, Micro-interactions), JavaScript ES6+.
- **Backend:** Node.js, Express.js RESTful API architecture.
- **Xác thực & Bảo mật:** JSON Web Token (JWT), kiểm soát phân quyền dựa trên vai trò (RBAC) chặt chẽ ở tầng Server Middleware.
- **Cơ sở dữ liệu:** PostgreSQL / Supabase, schema chuẩn hóa quan hệ khóa ngoại (Foreign Keys, Indexes).
- **Kiểm thử tự động:** Node.js Assert Test Runner, tích hợp kiểm thử API HTTP khép kín.
- **Quy trình phát triển:** Agile/Scrum theo chuẩn Git Flow (`Develop`, `feature/KN_76`, `main`).

---

## 4. Danh Sách Tài Khoản Thử Nghiệm Hệ Thống (Demo Accounts)

Hệ thống phân quyền truy cập theo 8 vai trò nghiệp vụ. Bạn có thể sử dụng các tài khoản sau để đăng nhập kiểm thử:

| STT | Vai trò nghiệp vụ (Role) | Email / Tài khoản | Mật khẩu | Trang kiểm thử & Trải nghiệm |
|:---:|:---|:---|:---:|:---|
| 1 | **Tư vấn tuyển sinh (Admissions Counselor)** | `admissions@tms.edu.vn` *(usr_admissions)* | `admissions123` | **[`/LeadManagement.html`](file:///c:/Users/Administrator/Downloads/minhquan_ttcs/LeadManagement.html)** *(Trang trọng tâm KN-76)* |
| 2 | **Quản trị hệ thống (Administrator)** | `admin@tms.edu.vn` | `admin123` | [`/UserManagement.html`](file:///c:/Users/Administrator/Downloads/minhquan_ttcs/UserManagement.html) |
| 3 | **Quản lý đào tạo (Training Manager)** | `manager@tms.edu.vn` | `manager123` | [`/SubjectManagement.html`](file:///c:/Users/Administrator/Downloads/minhquan_ttcs/SubjectManagement.html) |
| 4 | **Giảng viên (Instructor)** | `teacher@tms.edu.vn` | `teacher123` | [`/Dashboard.html`](file:///c:/Users/Administrator/Downloads/minhquan_ttcs/Dashboard.html) |
| 5 | **Trợ giảng (Teaching Assistant)** | `ta@tms.edu.vn` | `ta123456` | [`/Dashboard.html`](file:///c:/Users/Administrator/Downloads/minhquan_ttcs/Dashboard.html) |
| 6 | **Học viên (Student / Learner)** | `student@tms.edu.vn` | `student123` | [`/Dashboard.html`](file:///c:/Users/Administrator/Downloads/minhquan_ttcs/Dashboard.html) |
| 7 | **Kế toán đào tạo (Accountant)** | `accountant@tms.edu.vn` | `accountant123` | [`/Dashboard.html`](file:///c:/Users/Administrator/Downloads/minhquan_ttcs/Dashboard.html) |
| 8 | **Khách truy cập (Visitor)** | `visitor@tms.edu.vn` | `visitor123` | [`/LeadForm.html`](file:///c:/Users/Administrator/Downloads/minhquan_ttcs/LeadForm.html) |

---

## 5. Hướng Dẫn Cài Đặt & Chạy Thử Nghiệm

### 5.1. Khởi chạy ứng dụng
```bash
# 1. Cài đặt các gói phụ thuộc (nếu chưa cài)
npm install

# 2. Khởi động máy chủ TMS
npm start
# Server chạy tại: http://localhost:3000
```

### 5.2. Chạy bộ kiểm thử tự động tính năng KN-76
```bash
npm run test:kn76
```

Kết quả kiểm thử tự động:
```
=======================================================
   TMS LEAD SEARCH & MULTI-FILTER SUITE - KN-76        
=======================================================
=== 1. TÌM NHANH THEO TÊN HỌC VIÊN / KHÁCH HÀNG ===
  ✔ PASS: Tìm nhanh theo Tên chính xác có dấu: "Nguyễn Hoàng Nam"
  ✔ PASS: Tìm nhanh không dấu tiếng Việt: "hoang nam" -> Khớp "Nguyễn Hoàng Nam"
  ✔ PASS: Tìm kiếm một phần tên: "Yến" -> Khớp "Lê Hoàng Yến"

=== 2. TÌM NHANH THEO SỐ ĐIỆN THOẠI ===
  ✔ PASS: Tìm theo số điện thoại chuẩn: "0977889900"
  ✔ PASS: Chuẩn hóa chuỗi số điện thoại: "0977 889 900" -> Khớp chính xác
  ✔ PASS: Tìm kiếm theo đuôi số điện thoại: "889900"

=== 3. LỌC THEO TRẠNG THÁI (STATUS FILTER) ===
  ✔ PASS: Lọc trạng thái "Mới", "Đang tư vấn", "Đã ghi danh", "Không liên lạc được"

=== 4. LỌC THEO NGUỒN LEAD (SOURCE FILTER) ===
  ✔ PASS: Lọc theo nguồn "Hotline", "Facebook", "Giới thiệu"

=== 5. LỌC THEO NGƯỜI PHỤ TRÁCH ===
  ✔ PASS: Lọc theo tư vấn viên (usr_admissions) & Lead "Chưa phân công"

=== 6. LỌC THEO KHOẢNG THỜI GIAN (DATE RANGE & TIME PRESET) ===
  ✔ PASS: Lọc nhanh "Tháng trước" (timePreset=last_month): Tìm lại cuộc trao đổi cũ khi khách gọi lại
  ✔ PASS: Lọc theo khoảng ngày tùy chỉnh

=== 7. KẾT HỢP NHIỀU ĐIỀU KIỆN LỌC CÙNG LÚC ===
  ✔ PASS: Kết hợp SĐT + Trạng thái + Nguồn + Tháng trước -> Tìm thấy đúng 1 lead mục tiêu

=== 8. XEM LỊCH SỬ TRAO ĐỔI & GHI NHẬN CUỘC GỌI MỚI ===
  ✔ PASS: Tra cứu cuộc trao đổi từ tháng trước & Ghi nhận tương tác mới cập nhật trạng thái "Đã ghi danh"

=== 9. DANH MỤC NGUỒN LEAD & TƯ VẤN VIÊN ===
  ✔ PASS: GET /api/leads/sources & GET /api/leads/counselors

=== 10. BẢO MẬT & PHÂN QUYỀN RBAC ===
  ✔ PASS: Chặn không token (401), chặn học viên (403), cấp quyền tư vấn viên & admin

=======================================================
✔ TẤT CẢ 10 TIÊU CHÍ NGHIỆM THU KN-76 ĐÃ ĐẠT 100% PASS!
=======================================================
```

---

## 6. Tài Liệu Kỹ Thuật Chi Tiết
- Chi tiết báo cáo nghiệm thu tính năng KN-76: [`KN_76.md`](file:///c:/Users/Administrator/Downloads/minhquan_ttcs/KN_76.md)
- Mô hình cơ sở dữ liệu Supabase / PostgreSQL: [`supabase_schema.sql`](file:///c:/Users/Administrator/Downloads/minhquan_ttcs/supabase_schema.sql)
- Phân hệ quản lý & lọc lead chuyên biệt: [`LeadManagement.html`](file:///c:/Users/Administrator/Downloads/minhquan_ttcs/LeadManagement.html)