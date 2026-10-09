# TÀI LIỆU HỆ THỐNG BACKEND & TỔNG HỢP API ENDPOINTS - TMS

Hệ thống Quản lý Đào tạo (**TMS - Training Management System**).

---

## 1. TỔNG QUAN KIẾN TRÚC BACKEND

Dự án hiện có 2 phần backend trong cấu trúc thư mục:

### 1.1. Backend Chính thức (`backend/`) - Đang hoạt động
* **Công nghệ:** Node.js, Express.js.
* **Tệp khởi chạy chính:** [`backend/server.js`](file:///c:/Users/Admin/Downloads/lyphithnag_ttcs/backend/server.js).
* **Cổng dịch vụ mặc định:** `PORT=3000`.
* **Tích hợp:**
  * **Vercel Serverless:** Điều hướng thông qua [`vercel.json`](file:///c:/Users/Admin/Downloads/lyphithnag_ttcs/vercel.json) và [`api/index.js`](file:///c:/Users/Admin/Downloads/lyphithnag_ttcs/api/index.js) (map `/api/(.*)` về `backend/server.js`).
  * **Database Cloud:** Kết nối trực tiếp tới **Supabase** (PostgreSQL, Supabase Auth, Storage Snapshot).
  * **Dịch vụ Email:** Gửi qua máy chủ SMTP thực tế của BKNS.

### 1.2. Backend Thứ cấp (`BE/`) - Nhánh NestJS độc lập
* **Công nghệ:** TypeScript, NestJS, Prisma ORM.
* **Cung cấp:** Module xác thực nâng cao, Rate limiter và chức năng Quên / Đặt lại mật khẩu (`/auth/forgot-password`, `/auth/reset-password`).

---

## 2. HẠ TẦNG KẾT NỐI & DỊCH VỤ BÊN NGOÀI

### 2.1. Đám mây Supabase (Database & Storage)
* **Project URL:** `https://fljbbgqfgyyhvxhpflhg.supabase.co`
* **Cơ chế hoạt động:**
  * **Auth & JWKS:** Đồng bộ tài khoản, kiểm tra chữ ký token qua endpoint JWKS.
  * **Storage Bucket (`tms-database`):** Lưu trữ snapshot dữ liệu `users.json`, `roles.json`, `leads.json`, `business.json`.
  * **PostgREST Tables:** Đồng bộ bảng dữ liệu quan hệ (`users`, `roles`, `user_roles`, `audit_logs`, `scores`, `tuitions`, `leads`).
* **Trạng thái:** Đã kết nối và kiểm thử tự động đạt 100%.

### 2.2. Máy chủ Email SMTP (Gửi mail thật)
* **Máy chủ SMTP:** `smtp81196.bkns.com.vn:587` (TLS kích hoạt).
* **Tài khoản gửi:** `support_it@quanit206.id.vn`.
* **Mục đích:** Tự động gửi email kích hoạt và mật khẩu tạm cho nhân sự/học viên mới tạo.

### 2.3. Luồng kết nối Frontend -> Backend
* **Frontend:** Các trang HTML ([`Login.html`](file:///c:/Users/Admin/Downloads/lyphithnag_ttcs/Login.html), [`Dashboard.html`](file:///c:/Users/Admin/Downloads/lyphithnag_ttcs/Dashboard.html), [`UserManagement.html`](file:///c:/Users/Admin/Downloads/lyphithnag_ttcs/UserManagement.html), [`RoleManagement.html`](file:///c:/Users/Admin/Downloads/lyphithnag_ttcs/RoleManagement.html), [`LeadForm.html`](file:///c:/Users/Admin/Downloads/lyphithnag_ttcs/LeadForm.html)).
* **Cơ chế gọi:**
  1. Gọi qua REST API nội bộ `API_BASE_URL` (`http://localhost:3000/api/...` hoặc domain Vercel).
  2. Dự phòng (Client-side sync): Một số form người dùng gọi song song REST Supabase để đảm bảo dữ liệu không bị thất thoát.

---

## 3. DANH MỤC CHI TIẾT CÁC API ENDPOINTS

### 3.1. Phân hệ Xác thực & Phiên làm việc (Authentication)

| STT | Phương thức | Endpoint | Quyền hạn | Mô tả chi tiết |
|:---:|:---:|:---|:---:|:---|
| 1 | `POST` | `/api/auth/login` | Public | Đăng nhập bằng email/mật khẩu. Khóa tạm 15 phút sau 5 lần sai. Trả về JWT Token + danh sách Roles. |
| 2 | `POST` | `/api/auth/register` | Public | Đăng ký tài khoản mới (vai trò mặc định: `student`). Tự động đồng bộ lên Supabase. |
| 3 | `GET` | `/api/auth/me` | Bearer Token | Lấy hồ sơ tài khoản và quyền hạn tức thời của phiên làm việc hiện tại. |

---

### 3.2. Phân hệ Quản trị Người dùng & Vai trò (Users & Roles - Admin)

| STT | Phương thức | Endpoint | Quyền hạn | Mô tả chi tiết |
|:---:|:---:|:---|:---:|:---|
| 4 | `GET` | `/api/admin/roles` | `administrator` | Lấy danh mục 8 vai trò chuẩn của hệ thống TMS. |
| 5 | `GET` | `/api/admin/users`<br>*(alias: `/api/users`)* | `administrator` | Danh sách người dùng: Phân trang (`page`, `limit`), tìm kiếm (`search`), lọc theo vai trò (`roleId`) và trạng thái (`status`). |
| 6 | `GET` | `/api/admin/users/:userId` | `administrator` | Xem chi tiết thông tin và các vai trò của người dùng theo ID. |
| 7 | `POST` | `/api/admin/users` | `administrator` | Tạo tài khoản người dùng mới: sinh mật khẩu ngẫu nhiên tạm thời, tự động gửi email kích hoạt qua SMTP và đồng bộ sang Supabase. |
| 8 | `PUT` | `/api/admin/users/:id` | `administrator` | Cập nhật thông tin tài khoản (Họ tên, SĐT, Vai trò, Trạng thái hoạt động, Mật khẩu mới). |
| 9 | `DELETE` | `/api/admin/users/:id` | `administrator` | Xóa tài khoản người dùng khỏi hệ thống và xóa trên Supabase (chặn tự xóa chính mình). |
| 10 | `POST` | `/api/admin/users/:userId/roles` | `administrator` | Gán thêm một hoặc nhiều vai trò cho người dùng (quan hệ nhiều - nhiều N-N). |
| 11 | `DELETE` | `/api/admin/users/:userId/roles/:roleId` | `administrator` | Thu hồi một vai trò của người dùng (chặn thu hồi nếu chỉ còn 1 vai trò cuối cùng). |
| 12 | `GET` | `/api/admin/audit-logs` | `administrator` | Tra cứu lịch sử nhật ký thao tác phân quyền (Audit Logs). |

---

### 3.3. Phân hệ Nhập tài khoản hàng loạt (Excel/CSV Batch Import - KN-66)

| STT | Phương thức | Endpoint | Quyền hạn | Mô tả chi tiết |
|:---:|:---:|:---|:---:|:---|
| 13 | `GET` | `/api/admin/users/import/template`<br>*(alias: `.../template`)* | Public / Admin | Tải file mẫu (`?format=xlsx` hoặc `?format=csv`) có sẵn hướng dẫn và dữ liệu mẫu. |
| 14 | `POST` | `/api/admin/users/import/preview`<br>*(alias: `.../preview-import`)* | `administrator` | Phân tích tệp tải lên (dạng Base64 hoặc mảng JSON), kiểm tra hợp lệ từng dòng trước khi nhập. |
| 15 | `POST` | `/api/admin/users/import`<br>*(alias: `.../batch-import`)* | `administrator` | Thực thi nhập danh sách: tự động bỏ qua dòng lỗi, nhập các dòng hợp lệ, tạo mật khẩu tạm, gửi mail và ghi nhận Audit Log. |

---

### 3.4. Phân hệ Tuyển sinh & Quản lý Lead (Admissions & Leads)

| STT | Phương thức | Endpoint | Quyền hạn | Mô tả chi tiết |
|:---:|:---:|:---|:---:|:---|
| 16 | `GET` | `/api/leads/challenge` | Public | Tạo phép tính chống spam bot và cấp token xác thực một lần. |
| 17 | `POST` | `/api/leads`<br>*(alias: `/api/admissions/leads`, `/api/public/leads`)* | Public | Tiếp nhận biểu mẫu đăng ký tư vấn tuyển sinh. Tích hợp 5 lớp chống spam (Honeypot, Speed Limit, Rate Limit, Duplicate check, Math Challenge). |
| 18 | `GET` | `/api/leads/stats` | `admissions`<br>`training_manager`<br>`administrator` | Thống kê số lượng Lead theo trạng thái (Mới, Đang tư vấn, Đã ghi danh, Hủy). |
| 19 | `GET` | `/api/leads` | `admissions`<br>`training_manager`<br>`administrator` | Danh sách Lead có phân trang, tìm kiếm và bộ lọc trạng thái, khóa học. |
| 20 | `GET` | `/api/leads/:id` | `admissions`<br>`training_manager`<br>`administrator` | Xem hồ sơ chi tiết của một Lead. |
| 21 | `PUT` | `/api/leads/:id/status` | `admissions`<br>`administrator` | Cập nhật trạng thái xử lý Lead, ghi chú tư vấn, phân công nhân viên tư vấn phụ trách. |
| 22 | `DELETE` | `/api/leads/:id` | `administrator` | Xóa hồ sơ Lead khỏi hệ thống. |

---

### 3.5. Phân hệ Điểm số & Học phí (Ma trận kiểm soát RBAC - KN-8)

| STT | Phương thức | Endpoint | Quyền hạn | Ghi chú an toàn nghiệp vụ |
|:---:|:---:|:---|:---:|:---|
| 23 | `GET` | `/api/scores/:scoreId` | `instructor`, `student`, `training_manager`, `administrator` | Xem điểm thi/học tập. |
| 24 | `PUT` | `/api/scores/:scoreId` | **Chỉ** `instructor`, `administrator` | Cập nhật điểm số. **Kế toán (`accountant`) bị chặn 403**. |
| 25 | `GET` | `/api/tuition/:tuitionId` | `accountant`, `student`, `administrator` | Xem hóa đơn, học phí. |
| 26 | `PUT` | `/api/tuition/:tuitionId` | **Chỉ** `accountant`, `administrator` | Cập nhật học phí. **Giảng viên (`instructor`) bị chặn 403**. |

---

### 3.6. Phân hệ Giám sát Supabase Cloud & Hệ thống Mail

| STT | Phương thức | Endpoint | Quyền hạn | Mô tả chi tiết |
|:---:|:---:|:---|:---:|:---|
| 27 | `GET` | `/api/supabase/status` | Public / Monitor | Kiểm tra tình trạng kết nối Auth Admin, Storage Bucket và JWKS của Supabase. |
| 28 | `POST` | `/api/supabase/sync` | Admin / System | Kích hoạt đồng bộ thủ công toàn bộ dữ liệu hệ thống lên đám mây Supabase. |
| 29 | `GET` | `/api/health` | Public | Kiểm tra tình trạng sống (Health check) của toàn bộ Backend, SMTP và Supabase. |
| 30 | `GET` | `/api/admin/smtp/status` | `administrator` | Kiểm tra kết nối tới máy chủ gửi mail SMTP BKNS. |
| 31 | `POST` | `/api/admin/smtp/test` | `administrator` | Gửi thử email kích hoạt tài khoản kiểm tra chức năng giao thư. |

---

### 3.7. Phân hệ Quên & Đặt lại mật khẩu (Nhánh NestJS `BE/`)

| STT | Phương thức | Endpoint | Quyền hạn | Mô tả chi tiết |
|:---:|:---:|:---|:---:|:---|
| 32 | `POST` | `/auth/forgot-password` | Public | Yêu cầu quên mật khẩu, gửi email chứa token đặt lại (Rate limit: 5 lần/giờ). |
| 33 | `GET` | `/auth/verify-reset-token` | Public | Kiểm tra tính hợp lệ và thời hạn của token đặt lại mật khẩu. |
| 34 | `POST` | `/auth/reset-password` | Public | Thiết lập mật khẩu mới bằng token đã xác nhận. |

---

## 4. MA TRẬN PHÂN QUYỀN TRUY CẬP (RBAC MATRIX)

| Vai trò (Role Code) | Tên vai trò | Quyền hạn chính | Giới hạn / Cấm |
|:---|:---|:---|:---|
| `administrator` | Quản trị viên | Toàn quyền quản trị tài khoản, phân quyền, cấu hình hệ thống, sửa điểm & học phí. | Không |
| `training_manager` | Quản lý đào tạo | Quản lý lớp, chương trình học, xem danh sách người dùng, xem thống kê tuyển sinh. | Không sửa học phí |
| `instructor` | Giảng viên | Nhập điểm, sửa điểm thi, xem danh sách sinh viên lớp mình phụ trách. | **Cấm sửa học phí** |
| `accountant` | Kế toán | Lập biên lai, theo dõi công nợ, cập nhật trạng thái học phí. | **Cấm sửa điểm số** |
| `admissions` | Tuyển sinh | Tiếp nhận lead, xem danh sách và cập nhật tiến trình tư vấn tuyển sinh. | Không can thiệp học vụ/điểm |
| `student` | Học viên | Xem điểm số, thời khóa biểu, lịch học, học phí của chính bản thân. | Chỉ xem (Read-only) |

---

## 5. HƯỚNG DẪN VẬN HÀNH & KIỂM THỬ

### 5.1. Khởi chạy Backend Express (Server chính)
```bash
# Khởi động server tại http://localhost:3000
npm start
```

### 5.2. Chạy toàn bộ bộ kiểm thử tự động
```bash
# Kiểm thử xác thực & tài khoản
npm run test:auth

# Kiểm thử phân quyền & người dùng
npm run test:user
npm run test:role
npm run test:kn8

# Kiểm thử kết nối Supabase Cloud
npm run test:supabase

# Kiểm thử phân hệ tuyển sinh (Lead)
npm run test:lead

# Kiểm thử nhập Excel hàng loạt
npm run test:import

# Chạy tất cả test cùng lúc
npm test
```
