# 🎓 Hệ Thống Quản Lý Đào Tạo (Training Management System - TMS)

> **Giải pháp phần mềm quản trị nội bộ trên nền tảng Web**, số hóa toàn diện chu trình vận hành đào tạo tại trung tâm với một nguồn dữ liệu tập trung duy nhất (**Single Source of Truth**).

---

## 🛠️ Công Nghệ Sử Dụng (Fullstack JavaScript)

* **Backend**: Node.js, Express.js, JWT (Access + Refresh Token), bcryptjs.
* **ORM & Database**: Prisma ORM, PostgreSQL (kết nối trực tiếp **Supabase Cloud**, không cần cài CSDL cục bộ).
* **Frontend**: React (Vite), Tailwind CSS, Lucide Icons, Axios.
* **Kiến trúc**: RESTful APIs, Role-Based Access Control (RBAC 8 vai trò), Server-side Session Revocation, Silent Refresh (Sliding session).

---

## 🚀 Hướng Dẫn Cài Đặt & Khởi Chạy (Sau Khi Clone Về)

Dự án đã kết nối sẵn với **Database Supabase Cloud**. Máy tính chỉ cần có **Node.js (v18 trở lên)** là chạy được ngay!

### Bước 1: Khởi chạy Backend (Port 5000)
Mở một cửa sổ Terminal / CMD:
```bash
# 1. Đi vào thư mục backend
cd backend

# 2. Cài đặt các gói thư viện (nếu chưa cài)
npm install

# 3. Tạo file .env từ file mẫu (nếu chưa có)
# Trên Windows CMD: copy .env.example .env
# Trên PowerShell / Linux: cp .env.example .env

# 4. Khởi chạy máy chủ API
npm start
```
> Server Backend sẽ hoạt động tại: **`d**

---

### Bước 2: Khởi chạy Frontend (Port 3000)
Mở thêm **một cửa sổ Terminal / CMD thứ 2**:
```bash
# 1. Đi vào thư mục frontend
cd frontend

# 2. Cài đặt thư viện (nếu chưa cài)
npm install

# 3. Khởi chạy giao diện Web
npm run dev
```
> Giao diện người dùng sẽ chạy tại: **`http://localhost:3000`**

---

## 🔑 Danh Sách Tài Khoản Thử Nghiệm (8 Vai Trò)

Mật khẩu mặc định cho toàn bộ tài khoản: **`123456`**

| Vai trò (Role) | Email đăng nhập | Mô tả quyền hạn |
| :--- | :--- | :--- |
| **Giảng viên (LECTURER)** | `teacher@tms.edu.vn` | Điểm danh lớp học, giao bài tập, chấm điểm rubric. |
| **Quản lý Đào tạo (ACADEMIC_MANAGER)** | `manager@tms.edu.vn` | Theo dõi chuyên cần, giám sát cảnh báo rủi ro học viên. |
| **Kế toán (ACCOUNTANT)** | `accountant@tms.edu.vn` | Quản lý biểu phí, công nợ, thu học phí & xuất biên lai. |
| **Tư vấn Tuyển sinh (ADMISSIONS)** | `admissions@tms.edu.vn` | Quản lý phễu Lead, chuyển đổi thành học viên chính thức. |
| **Quản trị viên (ADMIN)** | `admin@tms.edu.vn` | Toàn quyền cấu hình hệ thống, xem Audit Log thao tác. |
| **Trợ giảng (TA)** | `ta@tms.edu.vn` | Hỗ trợ giảng viên điểm danh, quản lý học liệu. |
| **Học viên (STUDENT)** | `student1@tms.edu.vn` | Xem lịch học, nộp bài tập đa phiên bản, làm khảo sát. |

*(Tại màn hình đăng nhập `http://localhost:3000`, bạn chỉ cần bấm vào nút chọn nhanh vai trò tương ứng để vào thẳng hệ thống).*

---

## 🌟 Các Phân Hệ Cốt Lõi Đã Nghiệm Thu

### 1. Quản lý Phiên Đăng nhập & Bảo mật (User Story)
* **Gia hạn tự động (Sliding Session)**: Axios Interceptor tự động ngầm gửi `Refresh Token` để lấy `Access Token` mới khi người dùng còn thao tác, không bị gián đoạn giữa chừng khi đang điểm danh.
* **Đăng xuất an toàn phía Server**: Đăng xuất đánh dấu `isRevoked = true` trong Supabase Database, vô hiệu hóa ngay lập tức token (an toàn khi dùng máy công cộng).
* **Không mất dữ liệu đang nhập dở**: Tự động lưu nháp (`Draft auto-save`) vào LocalStorage khi đang chấm điểm/điểm danh, kèm **Re-auth Modal** đăng nhập tại chỗ khi hết phiên.

### 2. Điểm danh & Chuyên cần (Mobile-first ≤ 60 giây)
* Giao diện tối ưu chuẩn màn hình di động từ **360px** trở lên với các nút chạm cảm ứng to, dễ bấm.
* Nút **"Có mặt tất cả"** hỗ trợ hoàn tất điểm danh cả lớp trong **dưới 15 giây**.

### 3. Tự động hóa Cảnh báo Rủi ro (Early Warning System)
* Chủ động quét và gắn cờ đỏ học viên vắng học **≥ 2 buổi liên tiếp** (nguy cơ bỏ học).
* Cảnh báo các khoản nợ học phí quá hạn và bài tập bị yêu cầu làm lại.

### 4. Minh bạch Tài chính & Khớp Công nợ 100%
* Dùng chung một nguồn dữ liệu duy nhất giữa bộ phận Tuyển sinh và Kế toán.
* Thao tác **"Thu tiền & Xuất biên lai"** cập nhật số liệu công nợ thời gian thực.

### 5. Bài tập & Chấm điểm Rubric (≤ 3 phút)
* Hỗ trợ học viên nộp bài nhiều phiên bản (v1, v2) qua link GitHub/bài làm.
* Giảng viên chấm điểm chi tiết theo rubric tiêu chí và gửi phản hồi yêu cầu làm lại.

### 6. Khảo sát Chất lượng Giảng viên (≥ 70% Phản hồi)
* Khảo sát gắn định danh trực tiếp với từng giảng viên đứng lớp.
* Tự động thống kê tỷ lệ phản hồi thực tế (hiện đạt **75%**) và điểm sao trung bình.

### 7. Nhật ký Thao tác (Audit Log)
* Ghi lại chi tiết mọi hành vi đăng nhập, đăng xuất, điểm danh, nộp học phí kèm địa chỉ IP vào bảng `AuditLog` trên Supabase.

---

## 📁 Cấu Trúc Thư Mục Dự Án

```
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma      # Lược đồ CSDL 14 bảng quan hệ & 8 Roles
│   │   └── seed.js            # Kịch bản nạp dữ liệu mẫu toàn diện
│   ├── src/
│   │   └── server.js          # RESTful API Server Express + RBAC Guards
│   ├── .env.example           # File cấu hình mẫu chứa chuỗi kết nối Supabase
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx            # Giao diện chính đầy đủ các phân hệ & Mobile UI
│   │   ├── api.js             # Cấu hình Axios với Silent Refresh Interceptor
│   │   └── main.jsx
│   ├── index.html             # Tích hợp Tailwind CSS CDN & Responsive viewport
│   └── package.json
│
├── .gitignore
└── README.md                  # Hướng dẫn chi tiết dự án
```
