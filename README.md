# Hệ Thống Quản Lý Đào Tạo (TMS - Training Management System)

**Nền tảng quản trị đào tạo nội bộ toàn diện — số hóa vòng đời học viên từ tuyển sinh đến tốt nghiệp.**

| Công nghệ | Stack |
|:---|:---|
| Frontend | HTML5, CSS3, JavaScript ES6+ |
| Backend | Node.js, Express v5 |
| Database | Supabase (PostgreSQL) |
| Email | Nodemailer SMTP |
| File Processing | SheetJS (xlsx) |
| Deploy | Vercel |
| Quản lý dự án | Jira — Agile/Scrum |

---

## Mục lục

1. [Giới thiệu](#1-giới-thiệu)
2. [Kiến trúc hệ thống](#2-kiến-trúc-hệ-thống)
3. [Sơ đồ cơ sở dữ liệu](#3-sơ-đồ-cơ-sở-dữ-liệu)
4. [Cấu trúc thư mục](#4-cấu-trúc-thư-mục)
5. [Tính năng đã triển khai](#5-tính-năng-đã-triển-khai)
6. [KN-66: Nhập người dùng hàng loạt từ Excel](#6-kn-66-nhập-người-dùng-hàng-loạt-từ-excel)
7. [Danh mục API](#7-danh-mục-api)
8. [Cài đặt và khởi chạy](#8-cài-đặt-và-khởi-chạy)
9. [Kiểm thử](#9-kiểm-thử)
10. [Tài khoản demo](#10-tài-khoản-demo)
11. [Thành viên nhóm](#11-thành-viên-nhóm)

---

## 1. Giới thiệu

TMS là giải pháp phần mềm quản trị nội bộ trên nền tảng Web, số hóa toàn diện chu trình vận hành đào tạo tại trung tâm. Hệ thống phục vụ 8 nhóm người dùng nghiệp vụ, cung cấp một nguồn dữ liệu tập trung duy nhất (Single Source of Truth) thay thế quy trình quản lý thủ công phân tán.

### Bối cảnh và vấn đề

Trước khi triển khai, trung tâm vận hành dựa trên các công cụ rời rạc (Google Sheets, Google Calendar, Zalo, sổ sách thủ công). Thực trạng này dẫn đến:

- Thiếu tính tức thời: Ban quản lý không nắm bắt nhanh tình trạng chuyên cần, nợ bài tập theo thời gian thực.
- Phát hiện trễ học viên có nguy cơ bỏ học do dấu hiệu cảnh báo nằm rải rác ở nhiều bộ phận.
- Sai lệch số liệu công nợ giữa tuyển sinh và kế toán vì không dùng chung nguồn dữ liệu.
- Dữ liệu khóa cũ khó tra cứu, khảo sát chất lượng giảng dạy không gắn định danh cụ thể.

### Mục tiêu

- Chuẩn hóa vòng đời học viên từ lead tư vấn, nhập học, xếp lớp, điểm danh đến xét tốt nghiệp.
- Giảm thời gian điểm danh xuống <= 60 giây, chấm bài tập <= 3 phút.
- Tự động phát hiện và cảnh báo học viên vắng vượt ngưỡng, nợ bài tập quá hạn.
- Đồng bộ công nợ học phí 100% giữa các bộ phận.

---

## 2. Kiến trúc hệ thống

```
+-------------------------------------------------------------+
|                      CLIENT (Browser)                       |
|           HTML5 / CSS3 / Vanilla JS                         |
|           Responsive tu 360px                               |
+--------------------------+----------------------------------+
                           |
                      HTTPS / REST API
                           |
+--------------------------v----------------------------------+
|                BACKEND (Node.js + Express 5)                |
|                                                             |
|   +-------------+  +-------------+  +------------------+   |
|   | authService |  | userService |  | roleService      |   |
|   | - JWT Auth  |  | - CRUD User |  | - RBAC N:N       |   |
|   | - Lockout   |  | - Import XL |  | - Audit Log      |   |
|   | - Reset PW  |  | - Avatar    |  | - Permission     |   |
|   +-------------+  +-------------+  +------------------+   |
|                                                             |
|   +-------------+  +-------------+  +------------------+   |
|   | leadService |  | emailSvc    |  | supabaseService  |   |
|   | - Lead CRM  |  | - SMTP Mail |  | - PG Client      |   |
|   +-------------+  +-------------+  +------------------+   |
+--------------------------+----------------------------------+
                           |
+--------------------------v----------------------------------+
|               DATABASE (Supabase / PostgreSQL)              |
|   users, roles, user_roles, leads, audit_logs,              |
|   scores, tuition                                           |
+-------------------------------------------------------------+
```

### Luong xu ly request

```
Browser ---> Express Router ---> authenticateToken (JWT)
                                       |
                                 requireRole(...)
                                       |
                              Service Layer (Logic)
                                       |
                              Supabase PostgreSQL
                                       |
                              JSON Response <--- Browser
```

---

## 3. Sơ đồ cơ sở dữ liệu

```
+-------------------+        +-------------------+        +-------------------+
|      users        |        |    user_roles     |        |      roles        |
+-------------------+        +-------------------+        +-------------------+
| id (PK)           |<------o| user_id (FK)      |o------>| id (PK)           |
| email (UNIQUE)    |        | role_id (FK)      |        | code (UNIQUE)     |
| name              |        | assigned_by       |        | name              |
| role              |        | assigned_at       |        | description       |
| phone             |        +-------------------+        +-------------------+
| status            |
| password_hash     |
| salt              |        +-------------------+
| created_at        |        |    audit_logs     |
| updated_at        |        +-------------------+
+-------------------+        | id (PK)           |
                              | timestamp         |
+-------------------+        | action            |
|      leads        |        | performed_by      |
+-------------------+        | target_user_id    |
| id (PK)           |        | role_id           |
| code              |        | status            |
| full_name         |        | reason            |
| phone             |        +-------------------+
| email             |
| course            |        +-------------------+        +-------------------+
| notes             |        |      scores       |        |     tuition       |
| status            |        +-------------------+        +-------------------+
| source            |        | id (PK)           |        | id (PK)           |
| ip                |        | student_id        |        | student_id        |
| created_at        |        | student_name      |        | student_name      |
| updated_at        |        | course            |        | amount            |
+-------------------+        | score             |        | status            |
                              | updated_at        |        | updated_at        |
                              | updated_by        |        | updated_by        |
                              +-------------------+        +-------------------+

Quan he:
  users  ---< user_roles >---  roles      (N:N - Mot user co nhieu role)
  users  ---< audit_logs                  (1:N - Ghi nhat ky thao tac)
  users  ---< scores                      (1:N - Diem hoc vien)
  users  ---< tuition                     (1:N - Cong no hoc phi)
```

### 8 vai tro nghiep vu

| Ma vai tro | Ten tieng Viet | Pham vi quyen han |
|:---|:---|:---|
| administrator | Quan tri he thong | Toan quyen: tai khoan, phan quyen, cau hinh |
| training_manager | Quan ly dao tao | Chuong trinh, mon hoc, lop hoc, tien do |
| instructor | Giang vien | Lop phu trach, diem danh, cham bai |
| teaching_assistant | Tro giang | Ho tro giang vien, diem danh |
| student | Hoc vien | Hoc tap, nop bai, xem ket qua |
| admissions | Tu van tuyen sinh | Lead, tu van, ghi danh |
| accountant | Ke toan dao tao | Hoc phi, bien lai, doi soat |
| visitor | Khach truy cap | Xem thong tin cong khai |

---

## 4. Cấu trúc thư mục

```
K15C6_N4/
|
|-- backend/                          # Server-side (Node.js + Express)
|   |-- server.js                     #   Entry point, API routes
|   |-- authService.js                #   Xac thuc JWT, lockout, reset password
|   |-- userService.js                #   CRUD user, import Excel, avatar
|   |-- roleService.js                #   RBAC N:N, audit log
|   |-- leadService.js                #   Quan ly lead tuyen sinh
|   |-- emailService.js               #   Gui email SMTP
|   |-- supabaseService.js            #   Ket noi Supabase PostgreSQL
|   |-- package.json                  #   Dependencies + test scripts
|   |-- migrations/
|   |   |-- migrate_roles_n_n.js      #   Migration RBAC N:N
|   |-- test/
|       |-- auth.test.js              #   Test dang nhap/dang ky
|       |-- user_management.test.js   #   Test CRUD tai khoan
|       |-- user_import_kn66.test.js  #   Test nhap Excel (KN-66)
|       |-- role_management.test.js   #   Test phan quyen
|       |-- rbac_kn8.test.js          #   Test RBAC 8 vai tro
|       |-- error_handling_kn10.test.js  # Test trang loi
|       |-- lead_consultation.test.js #   Test form tu van
|       |-- avatar_kn68.test.js       #   Test upload avatar
|       |-- forgot_password.test.js   #   Test quen mat khau
|
|-- frontend/                         # Client-side
|   |-- Login.html                    #   Dang nhap
|   |-- Index.html                    #   Dashboard theo vai tro
|   |-- UserManagement.html           #   Quan ly tai khoan + Import Excel
|   |-- RoleManagement.html           #   Phan quyen vai tro
|   |-- LeadForm.html                 #   Form tu van tuyen sinh (public)
|   |-- ChangePassword.html           #   Doi mat khau
|   |-- ResetPassword.html            #   Dat lai mat khau
|   |-- Error.html                    #   Trang loi phan quyen (403/404/500)
|   |-- authGuard.js                  #   Client-side access guard
|
|-- docs/                             # Tai lieu du an
|-- KN_66.md                          # Bao cao nghiem thu KN-66
|-- KN_8.md                           # Bao cao KN-8 (RBAC)
|-- KN_10.md                          # Bao cao KN-10 (Error Pages)
|-- KN_12.md                          # Bao cao KN-12 (Gan vai tro)
|-- LEAD_CONSULTATION.md              # Bao cao Lead tu van
|-- supabase_schema.sql               # Schema co so du lieu
|-- vercel.json                       # Cau hinh deploy Vercel
|-- .env.example                      # Mau bien moi truong
|-- README.md
```

---

## 5. Tính năng đã triển khai

| Sprint | Jira Key | Tinh nang | Mo ta ngan | Trang thai |
|:------:|:--------:|:----------|:-----------|:----------:|
| 3 | KN-5 | Dang nhap / Dang ky | JWT Auth, phan quyen token | Done |
| 3 | KN-7 | Quan ly tai khoan | CRUD nguoi dung, phan trang, loc | Done |
| 3 | KN-8 | Phan quyen RBAC | 8 vai tro, kiem quyen tung endpoint | Done |
| 4 | KN-10 | Trang loi truy cap | 403, 404, 500, dieu huong tu dong | Done |
| 4 | KN-11 | Email kich hoat | Gui mail SMTP khi tao tai khoan | Done |
| 4 | KN-12 | Gan / Thu hoi vai tro | RBAC N:N, audit log | Done |
| 4 | KN-13 | Khoa / Mo khoa tai khoan | Lockout sau 5 lan sai mat khau | Done |
| 4 | KN-14 | Menu sidebar theo vai tro | Hien thi menu phu hop quyen | Done |
| 5 | KN-39 | Quen mat khau | Rate limit 5 lan/gio, gui link reset | Done |
| 5 | KN-43 | Dat lai mat khau | Verify token, doi mat khau moi | Done |
| 5 | KN-66 | Nhap nguoi dung tu Excel | Upload, preview, import batch | Done |
| 5 | KN-68 | Upload anh dai dien | JPG/PNG, max 2MB, crop vuong | Done |
| 6 | KN-75 | Phan cong lead | Gan lead cho tu van vien | Done |
| -- | Lead | Form tu van cong khai | Anti-spam, trang thai "Moi" | Done |

---

## 6. KN-66: Nhập người dùng hàng loạt từ Excel

**Jira**: [KN-66](https://thaidasdiasdsa.atlassian.net/browse/KN-66)
**Nguoi thuc hien**: Doan Minh Quan
**Bao cao chi tiet**: [KN_66.md](./KN_66.md)

### Mo ta

Cho phep Quan tri vien nhap danh sach nguoi dung hang loat tu file Excel (.xlsx) hoac CSV (.csv) de khoi tao tai khoan nhanh cho khoa hoc vien moi.

### Tieu chi nghiem thu

| # | Tieu chi | Giai phap ky thuat | Ket qua |
|:-:|:---------|:-------------------|:-------:|
| 1 | Tai duoc tep mau | Ho tro 2 dinh dang: Excel (.xlsx) va CSV (.csv) co BOM UTF-8 | Dat |
| 2 | Xem truoc va bao loi tung dong | Phan tich tung dong: thieu truong, sai email, trung email, sai vai tro | Dat |
| 3 | Dong loi bi bo qua, dong hop le van nhap | Tu dong bo qua dong loi, sinh mat khau tam TMS@... | Dat |
| 4 | Co bao cao tong ket | So dong thanh cong, bi bo qua, danh sach tai khoan + mat khau tam | Dat |
| 5 | Bao mat phan quyen + Audit log | Chi admin duoc nhap, ghi nhat ky IMPORT_USERS_BATCH | Dat |

### Luong hoat dong

```
[1. Tai file mau]          Quan tri vien tai file mau Excel/CSV co cot chuan
        |
        v
[2. Upload file]           Keo tha hoac chon file tu may tinh (.xlsx, .xls, .csv)
        |
        v
[3. Preview & Validate]    He thong phan tich tung dong:
        |                    - Dong xanh: hop le, san sang tao tai khoan
        |                    - Dong do: co loi (thieu ten, sai email, trung...)
        |                  Bo loc: Tat ca | Chi hop le | Chi loi
        |
        v
[4. Xac nhan nhap]         Bam "Xac nhan nhap" de tao tai khoan cho dong hop le
        |
        v
[5. Tao tai khoan batch]   He thong tao tai khoan, sinh mat khau tam TMS@...
        |                  Bam mat khau theo chuan PBKDF2
        |
        v
[6. Bao cao tong ket]      Hien thi:
                             - So luong thanh cong / bo qua
                             - Danh sach tai khoan + mat khau tam
                             - Nut sao chep / xuat file ket qua
```

### API Endpoints (KN-66)

| Method | Endpoint | Mo ta |
|:------:|:---------|:------|
| GET | /api/admin/users/import/template?format=xlsx | Tai file mau Excel |
| GET | /api/admin/users/import/template?format=csv | Tai file mau CSV |
| POST | /api/admin/users/import/preview | Xem truoc va validate tung dong |
| POST | /api/admin/users/import | Thuc thi nhap hang loat |

### Cac ham xu ly trong userService.js

| Ham | Chuc nang |
|:----|:----------|
| normalizeRole(inputRole) | Chuan hoa vai tro (tieng Viet/Anh -> ma code) |
| extractRowFields(row) | Nhan dien cot thong minh (ho ten, email, SDT, vai tro) |
| validateImportRow(row, ...) | Kiem tra hop le: thieu truong, sai email, trung lap |
| previewImportUsers(rows) | Phan tich toan bo file, tra ve ket qua tung dong |
| importUsersBatch(rows, opts) | Tao tai khoan batch, sinh mat khau tam, ghi audit log |
| parseExcelBuffer(buffer) | Doc file Excel tu buffer nhi phan |
| generateUsersTemplate(format) | Sinh file mau Excel/CSV |

### Kiem thu: 10/10 PASS

Chi tiet tai [backend/test/user_import_kn66.test.js](./backend/test/user_import_kn66.test.js)

```
npm run test:kn66
```

| # | Ca kiem thu | Ket qua |
|:-:|:-----------|:-------:|
| 1 | Tai file mau Excel (.xlsx) voi tieu de cot chuan | PASS |
| 2 | Tai file mau CSV UTF-8 co BOM chong loi font tieng Viet | PASS |
| 3 | Xem truoc chinh xac tung dong hop le va dong loi | PASS |
| 4 | Phat hien trung lap email trong cung file | PASS |
| 5 | Dong loi bo qua, dong hop le nhap thanh cong + bao cao | PASS |
| 6 | Hoc vien moi dang nhap bang mat khau tam | PASS |
| 7 | Chan truy cap khong co quyen Admin (HTTP 403) | PASS |
| 8 | Chan request khong co token (HTTP 401) | PASS |
| 9 | Ghi nhan Audit Log day du | PASS |
| 10 | Dong bo phan quyen nhat quan sau import | PASS |

---

## 7. Danh mục API

### Authentication

| Method | Endpoint | Mo ta | Auth |
|:------:|:---------|:------|:----:|
| POST | /api/auth/login | Dang nhap | -- |
| POST | /api/auth/register | Dang ky | -- |
| GET | /api/auth/me | Thong tin user hien tai | JWT |
| POST | /api/auth/change-password | Doi mat khau | JWT |
| POST | /api/auth/forgot-password | Yeu cau reset mat khau | -- |
| POST | /api/auth/reset-password | Dat lai mat khau bang token | -- |
| POST | /api/auth/verify-reset-token | Kiem tra token reset | -- |

### User Management

| Method | Endpoint | Mo ta | Auth |
|:------:|:---------|:------|:----:|
| GET | /api/admin/users | Danh sach nguoi dung (phan trang, loc, tim kiem) | JWT + Admin |
| GET | /api/admin/users/:id | Chi tiet nguoi dung | JWT + Admin |
| POST | /api/admin/users | Tao tai khoan moi | JWT + Admin |
| PUT | /api/admin/users/:id | Cap nhat thong tin | JWT + Admin |
| DELETE | /api/admin/users/:id | Xoa tai khoan | JWT + Admin |
| GET | /api/admin/users/import/template | Tai file mau import | JWT + Admin |
| POST | /api/admin/users/import/preview | Xem truoc import | JWT + Admin |
| POST | /api/admin/users/import | Nhap hang loat tu Excel | JWT + Admin |
| PUT | /api/admin/users/:id/avatar | Upload anh dai dien | JWT |
| DELETE | /api/admin/users/:id/avatar | Xoa anh dai dien | JWT |

### Role Management

| Method | Endpoint | Mo ta | Auth |
|:------:|:---------|:------|:----:|
| GET | /api/admin/roles | Danh sach vai tro | JWT + Admin |
| PUT | /api/admin/users/:id/roles | Gan vai tro cho user | JWT + Admin |
| GET | /api/admin/audit-logs | Nhat ky thao tac | JWT + Admin |

### Lead Management

| Method | Endpoint | Mo ta | Auth |
|:------:|:---------|:------|:----:|
| POST | /api/leads | Gui form tu van (public) | -- |
| GET | /api/admin/leads | Danh sach leads | JWT + Admissions |

---

## 8. Cài đặt và khởi chạy

### Yeu cau

- Node.js >= 18.x
- npm >= 9.x
- Tai khoan Supabase (hoac PostgreSQL local)

### Cai dat

```bash
# Clone repo
git clone https://github.com/azmedia2006/K15C6_N4.git
cd K15C6_N4

# Cai dependencies backend
cd backend
npm install

# Cau hinh moi truong
cp ../.env.example .env
```

### Cau hinh file .env

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=your_publishable_key
SUPABASE_SECRET_KEY=your_secret_key
PORT=3000
```

### Khoi tao database

Chay file `supabase_schema.sql` trong Supabase SQL Editor de tao cac bang:
users, roles, user_roles, audit_logs, scores, tuition, leads.

### Khoi chay

```bash
cd backend
npm start
# Server chay tai http://localhost:3000
```

### Truy cap

- Frontend: Mo `frontend/Login.html` tren trinh duyet
- API: http://localhost:3000/api/
- Deploy: Cau hinh san trong `vercel.json`

### URL routing (Vercel)

| URL | Trang |
|:----|:------|
| / | Login (index.html) |
| /dashboard | Dashboard.html |
| /users | UserManagement.html |
| /roles | RoleManagement.html |
| /tu-van | LeadForm.html (public) |
| /403, /404, /500 | Error.html |

---

## 9. Kiểm thử

```bash
cd backend

# Chay toan bo test suite
npm test

# Chay tung module rieng le
npm run test:auth          # Xac thuc dang nhap
npm run test:user          # Quan ly tai khoan
npm run test:role          # Phan quyen vai tro
npm run test:kn8           # RBAC toan he thong
npm run test:kn10          # Trang loi & dieu huong
npm run test:kn66          # Import Excel (10 tests)
npm run test:kn68          # Upload avatar
npm run test:lead          # Form tu van tuyen sinh
npm run test:forgot        # Quen mat khau
```

---

## 10. Tài khoản demo

| # | Vai tro | Email | Mat khau |
|:-:|:--------|:------|:--------:|
| 1 | Quan tri he thong | admin@tms.edu.vn | admin123 |
| 2 | Quan ly dao tao | manager@tms.edu.vn | manager123 |
| 3 | Giang vien | teacher@tms.edu.vn | teacher123 |
| 4 | Tro giang | ta@tms.edu.vn | ta123456 |
| 5 | Hoc vien | student@tms.edu.vn | student123 |
| 6 | Tu van tuyen sinh | admissions@tms.edu.vn | admissions123 |
| 7 | Ke toan dao tao | accountant@tms.edu.vn | accountant123 |
| 8 | Khach truy cap | visitor@tms.edu.vn | visitor123 |

---

## 11. Thành viên nhóm

**Nhom K15C6_N4** — Mon Thuc chien co so

| Thanh vien | Nhiem vu chinh |
|:-----------|:---------------|
| Doan Minh Quan | KN-66 (Import Excel), KN-8 (RBAC), KN-10 (Error Pages), KN-11 (Email SMTP), KN-12 (Gan vai tro), KN-68 (Avatar) |

---

Du an phuc vu muc dich hoc tap tai Truong Dai hoc Cong nghe Thong tin va Truyen thong — Dai hoc Thai Nguyen (ICTU).
