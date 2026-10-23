# TMS — Bản hợp nhất KN-156 và sửa lỗi ứng dụng

Bản bàn giao **2.0.0 — 18/10/2026**. Bao gồm yêu cầu quản lý buổi học theo hai ảnh, cùng các sửa lỗi phát hiện trong đợt rà soát. Đường chạy chính là **Express `backend/`**; trang làm việc thống nhất là `Workspace.html`.

## 1. Chạy nhanh

Cần **Node.js 20+ và npm**; bản bàn giao kiểm thử bằng Node.js 24 và Chromium trên Linux.

```bash
npm run setup
npm start
```

Mở **http://localhost:3000/Login.html**. Lần đầu có tài khoản mẫu để thử cục bộ:

| STT | Vai trò nghiệp vụ | Họ và tên | Tài khoản | Mật khẩu mẫu | Trang đích & Quyền hạn |
|:---:|:---|:---|:---|:---:|:---|
| 1 | **Quản trị hệ thống (Administrator)** | Nguyễn Văn Anh | `admin@tms.edu.vn` | `admin123` | Toàn quyền cấu hình, tài khoản, phân quyền, môn học, sinh lịch |
| 2 | **Quản trị hệ thống (Admin dự phòng)** | Đào tạo TMS | `daotaotms@tuoitre24h.com` | `Quan2006@` | Toàn quyền quản trị, nhận email hệ thống & SMTP |
| 3 | **Quản trị viên kỹ thuật** | Thạch Minh Quân | `dtc245200761@ictu.edu.vn` | `Quan2006@` | Toàn quyền kỹ thuật và quản trị vận hành |
| 4 | **Quản lý kỹ thuật & Mail (Technical Manager)** | Kỹ thuật & Mail TMS | `tech@tms.edu.vn` | `tech123` | Quản trị kỹ thuật hệ thống, cấu hình máy chủ, giám sát nhật ký gửi Mail SMTP |
| 5 | **Quản lý đào tạo (Training Manager)** | Đỗ Quốc Bảo | `manager@tms.edu.vn` | `manager123` | Quản lý khung đào tạo, môn học, lớp học, duyệt đề nghị |
| 6 | **Giảng viên (Instructor)** | ThS. Trần Minh | `teacher@tms.edu.vn` | `teacher123` | Xem lịch dạy, điểm danh học viên, chấm bài, gửi thông báo |
| 7 | **Trợ giảng (Teaching Assistant)** | Nguyễn Thu Hà | `ta@tms.edu.vn` | `ta123456` | Hỗ trợ điểm danh, chấm bài tập, trợ giảng lớp học phần |
| 8 | **Học viên (Student / Learner)** | Lê Minh Tuấn | `student@tms.edu.vn` *(hoặc `sv001`)* | `student123` | Xem thời khóa biểu, điểm chuyên cần, nộp bài, xem học phí |
| 9 | **Tư vấn tuyển sinh (Admissions)** | Vũ Hải Yến | `admissions@tms.edu.vn` | `admissions123` | Quản lý phễu Lead, nhật ký chăm sóc, đặt lịch gọi lại |
| 10 | **Kế toán đào tạo (Accountant)** | Phạm Thanh Mai | `accountant@tms.edu.vn` | `accountant123` | Quản lý công nợ, học phí, xuất biên lai thu tiền |
| 11 | **Khách tham quan (Visitor)** | Khách tham quan | `visitor@tms.edu.vn` | `visitor123` | Xem thông tin công khai và danh mục chương trình đào tạo |

Chỉ dùng tài khoản này để thử trên máy cá nhân. Không công khai máy chủ với mật khẩu mẫu. Server mặc định chỉ lắng nghe `127.0.0.1`. Cần Internet cho `npm run setup` để tải thư viện; ZIP không chứa `node_modules`.

Sau đăng nhập, dùng các nút trên Workspace để tạo lớp, ghi danh, giao bài, nhập điểm, lập học phí/biên lai và mở các màn quản lý chi tiết. Người dùng chỉ thấy thao tác và dữ liệu trong phạm vi vai trò. Thêm giảng viên bằng **Người dùng & giảng viên → tạo tài khoản vai trò Giảng viên**.

## 2. Quản lý buổi học KN-156

1. Mở **Sinh lịch · Sửa / dời / hủy buổi** (`ScheduleManagement.html`).
2. Phần **Quản lý buổi học đã lưu · KN-156** có lớp mẫu WD-2026-01 với 12 buổi.
3. **Sửa / dời**: ngày, giờ, phòng và giảng viên; server kiểm tra xung đột phòng/giảng viên. Khi thay giảng viên hãy chọn gợi ý tài khoản thật để liên kết đúng người nhận thông báo.
4. **Hủy buổi**: bắt buộc lý do; không xóa bản ghi buổi học.
5. **Lịch sử**: lưu người thao tác, thời điểm, trước/sau và lý do hủy.
6. **Điểm danh**: dùng danh sách ghi danh thật; khi lưu, buổi bị khóa sửa/hủy cả ở UI và API.
7. Đăng nhập học viên hoặc giảng viên tương ứng → **Thông báo lịch học** (`Notifications.html`) để xem/đánh dấu đã đọc. Hộp thư tự tải mỗi 30 giây, không lẫn tài khoản khác.
8. **Học viên nhận thông báo** thay đổi danh sách ghi danh của lớp, không phải danh sách gửi tạm. Xóa một học viên khỏi lớp sẽ thu hồi quyền xem lớp đó; không tự thêm lại khi restart.

Thông báo KN-156 là **trong ứng dụng**, không phải email/SMS/push. Tên giảng viên nhập tự do chưa liên kết tài khoản sẽ có cảnh báo và không được coi là người nhận đã xác định.

## 3. Quên/đổi mật khẩu và email

- Đổi mật khẩu kiểm tra mật khẩu hiện tại bằng API, không còn toast giả.
- Mật khẩu mới: 8–128 ký tự, có chữ hoa, chữ thường và số. Hash mới được lưu bền; đổi/reset/khóa tài khoản/đăng xuất thu hồi phiên tương ứng.
- Quên mật khẩu sử dụng token có thời hạn và dùng một lần; token và hash mới còn hiệu lực sau restart theo thời hạn của chúng.
- Mặc định **không gửi mail**. Khi chưa cấu hình, UI nói rõ không có mail được gửi; quản trị có thể đặt lại mật khẩu trong Workspace và cung cấp qua kênh an toàn.

Để bật SMTP: sao chép `.env.example` thành `.env`, điền thông tin của dịch vụ bạn được phép sử dụng, đặt `SMTP_ENABLED=true`, `FRONTEND_URL` thành địa chỉ thật người nhận có thể mở rồi khởi động lại server. Không đưa mật khẩu SMTP vào mã nguồn hoặc gửi qua chat thông thường.

```dotenv
SMTP_ENABLED=true
SMTP_HOST=your-smtp-host
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-smtp-user
SMTP_PASSWORD=your-smtp-password
SMTP_FROM_EMAIL=your-authorized-sender
FRONTEND_URL=http://localhost:3000
```

Cổng 465 dùng `SMTP_SECURE=true`. Xác minh chứng chỉ TLS được bật; không tắt để vượt lỗi kết nối. Trạng thái nhật ký: `NOT_CONFIGURED`, `QUEUED`, `ACCEPTED`, `FAILED`. **ACCEPTED chỉ là máy chủ SMTP chấp nhận thư, không khẳng định thư đã vào inbox.** Trước vận hành cần thử inbox/spam, DNS SPF/DKIM/DMARC và đường link reset trên môi trường của bạn.

## 4. Dữ liệu và sao lưu

- Kho chính: **`backend/data/tms.json`**, tự tạo ở lần chạy đầu; gồm tài khoản, phiên, reset, quyền, lớp/môn/ghi danh, lead, lịch, điểm danh, lịch sử/thông báo, phân công, bài tập/điểm, học phí/biên lai/đề nghị và metadata email.
- Có thể đặt `TMS_DATA_FILE` trong `.env` thành đường dẫn tuyệt đối. Thư mục phải có quyền ghi.
- Ghi file tạm rồi đổi tên, mặc định mode `0600`. Một file `.lock` ngăn hai tiến trình của launcher cục bộ dùng chung kho.
- **Tắt server trước khi sao lưu/khôi phục toàn bộ file.** Không xóa dữ liệu khi thay phiên bản. ZIP bàn giao không kèm dữ liệu chạy thử hoặc token.
- `npm start` dùng kho cục bộ, không cần Supabase/PostgreSQL/MySQL. SMTP là lựa chọn bật độc lập.
- Đây là kho **một tiến trình**, không phải database dùng chung nhiều worker. Không dùng trực tiếp cho Vercel/serverless/đa máy. Cần database giao dịch, HTTPS, secret manager, backup/monitoring và kiểm thử tải trước production.
- Bootstrap mới với `NODE_ENV=production` yêu cầu `ADMIN_EMAIL` và `ADMIN_PASSWORD`, không tạo các tài khoản mẫu. Không biến kho demo hiện có thành dữ liệu thật mà chưa loại bỏ tài khoản và đổi mật khẩu mẫu.

## 5. Kiểm thử

```bash
npm test                 # Toàn bộ 20 tệp test cục bộ, mỗi tệp dùng kho tạm riêng
npm run test:final       # Hồi quy bảo mật, liên thông nghiệp vụ, restart và validation
npm run test:kn156       # 25 ca chuyên biệt KN-156
```

SMTP test dùng máy chủ thử cục bộ, không gửi email ra ngoài. Test Supabase thật được tách riêng: `npm run test:legacy-supabase --prefix backend`; cần môi trường thử và quyền dịch vụ do bạn cấu hình. Không chạy với DB sản xuất.

Bằng chứng mới nhất: **`docs/FINAL/BAO_CAO_BAN_GIAO.md`**, `docs/FINAL/test-results/`, `docs/FINAL/screenshots/`. Tài liệu KN156/KN75 và README lead demo cũ được giữ để tham khảo lịch sử; nội dung trạng thái/cấu hình cũ không thay thế báo cáo FINAL.

## 6. Phạm vi không được ngầm coi là hoàn thành production

- Phiếu thu chỉ ghi nhận tiền đã thực nhận; không tự chuyển khoản hoặc kết nối cổng thanh toán.
- Đề nghị chứng chỉ/bảo lưu/dạy thay có lưu và duyệt nội bộ; không tự cấp chứng chỉ có chữ ký, tự chuyển học phí hoặc tự thay lịch. Thay lịch dùng KN-156.
- Nút đồng bộ Supabase là sao lưu snapshot có kiểm kết quả khi được cấu hình, không phải đồng bộ quan hệ hai chiều.
- Ứng dụng NestJS `BE/`, Java `src/`, `kn72/` và backend lead cũ là các đường chạy riêng từ ZIP gốc, không được `npm start` khởi động và chưa được nghiệm thu tích hợp ở bản này. Các bí mật hard-code được gỡ khỏi bản bàn giao; **chủ dịch vụ vẫn cần thu hồi/đổi các khóa đã từng lộ**.

## 7. Ma trận Phân quyền 8 Vai trò Nghiệp vụ (RBAC Matrix)

Hệ thống triển khai cơ chế kiểm soát truy cập dựa trên vai trò (Role-Based Access Control) nghiêm ngặt từ tầng xác thực Gateway tới từng API Endpoint và giao diện:

| Nghiệp vụ / Quyền hạn | Admin | Quản lý ĐT | Giảng viên | Trợ giảng | Học viên | Tuyển sinh | Kế toán | Khách |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Quản trị người dùng & Phân quyền (KN-11, KN-8)** | ✅ Toàn quyền | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Quản lý Môn học & CTĐT (KN-70)** | ✅ Tạo/Sửa/Xóa | ✅ Xem/Sửa | 👁️ Chỉ xem | 👁️ Chỉ xem | 👁️ Chỉ xem | 👁️ Chỉ xem | ❌ | 👁️ Chỉ xem |
| **Sinh Thời khóa biểu tự động (KN-154)** | ✅ Toàn quyền | ✅ Toàn quyền | 👁️ Xem lịch | 👁️ Xem lịch | 👁️ Xem lịch | ❌ | ❌ | ❌ |
| **Điều chỉnh, dời, hủy buổi học (KN-156)** | ✅ Toàn quyền | ✅ Toàn quyền | 📝 Đề xuất | ❌ | 👁️ Nhận thông báo | ❌ | ❌ | ❌ |
| **Điểm danh & Theo dõi chuyên cần (KN-156)** | ✅ | ✅ | ✅ Điểm danh | ✅ Điểm danh | 👁️ Xem kết quả | ❌ | ❌ | ❌ |
| **Tiếp nhận & Chăm sóc Lead (KN-74, KN-76, KN-122)** | ✅ Quản lý | 👁️ Giám sát | ❌ | ❌ | ❌ | ✅ Chăm sóc | ❌ | 📝 Gửi form |
| **Quản lý Học phí & Công nợ** | ✅ | 👁️ Xem báo cáo | ❌ | ❌ | 👁️ Xem biên lai | ❌ | ✅ Toàn quyền | ❌ |
| **Nộp bài tập & Xem điểm số** | ✅ Quản lý | 👁️ Giám sát | ✅ Chấm điểm | ✅ Chấm điểm | ✅ Nộp bài | ❌ | ❌ | ❌ |

## 8. Hướng dẫn Nghiệp vụ & Các Phân hệ Trọng tâm

### 8.1. Quản lý Môn học & Chương trình Đào tạo (`SubjectManagement.html` - KN-70)
- **Tạo & Cập nhật môn học:** Mã môn chuẩn hóa tự động viết hoa (VD: `JAV-01`, `WEB-02`), định nghĩa số tín chỉ, số tiết học và mô tả.
- **Tái sử dụng môn học đa chương trình:** Một môn học có thể được phân bổ cho nhiều chương trình đào tạo khác nhau (`Web Frontend`, `Fullstack Node.js`, `Mobile App`).
- **Khóa an toàn môn học đang hoạt động:** Khi môn học đã có lớp học liên kết đang giảng dạy, hệ thống tự động khóa tính năng xóa để bảo vệ toàn vẹn dữ liệu.
- **Tra cứu & Bộ lọc nâng cao:** Hỗ trợ tìm kiếm thời gian thực theo tên, mã môn và lọc theo danh mục chương trình.

### 8.2. Sinh Thời Khóa Biểu Tự Động (`ScheduleManagement.html` - KN-154)
- **Cơ chế xếp lịch tự động:** Chỉ định ngày bắt đầu, số buổi học, ca học (Sáng / Chiều / Tối) và các ngày trong tuần (2-4-6, 3-5-7 hoặc tùy chọn).
- **Thuật toán tránh ngày nghỉ lễ:** Tự động tra cứu danh sách ngày lễ quốc gia và lịch nghỉ riêng của trung tâm để nhảy lịch an toàn.
- **Phát hiện & Ngăn chặn xung đột:** Kiểm tra trùng lịch phòng học và trùng lịch giảng viên theo thời gian thực (Atomic Transaction).

### 8.3. Tiếp nhận Tư vấn & Quản lý Phễu Khách hàng (`LeadManagement.html` & `LeadForm.html` - KN-76, KN-122)
- **Biểu mẫu đăng ký tư vấn công khai:** Tích hợp câu hỏi chống spam thông minh, honeypot chống bot và xác thực số điện thoại.
- **Phễu chăm sóc khách hàng:** Phân loại trạng thái (`Mới`, `Đang tư vấn`, `Hẹn gọi lại`, `Đã đăng ký`, `Không có nhu cầu`).
- **Nhật ký chăm sóc & Nhắc lịch gọi lại:** Ghi lại chi tiết từng cuộc gọi, tin nhắn trao đổi; tự động thông báo các cuộc hẹn gọi lại đến hạn trong ngày.

### 8.4. Quản trị Tài khoản & Nhập liệu Hàng loạt (`UserManagement.html` - KN-11, KN-66)
- **Quản lý danh sách nhân sự & học viên:** Tìm kiếm đa điều kiện, phân trang chuẩn 20 bản ghi/trang.
- **Nhập dữ liệu bằng Excel (.xlsx) / CSV UTF-8:** Hỗ trợ tải tệp mẫu chuẩn, xem trước dữ liệu, phát hiện dòng lỗi chi tiết theo từng dòng và nhập an toàn các dòng hợp lệ.

### 8.5. Cách ly Không gian Làm việc & Giao diện Bảng điều khiển theo Vai trò (Dashboard RBAC Isolation)
- **8 Bảng điều khiển chuyên biệt:** Mỗi vai trò (`administrator`, `training_manager`, `instructor`, `teaching_assistant`, `student`, `admissions`, `accountant`, `visitor`) sở hữu tiêu đề cổng riêng, thống kê KPI phù hợp, phím tắt nhanh và danh sách việc cần làm (To-Do List) tương ứng.
- **Bảo mật giao diện & Điều hướng:** Ngăn chặn tuyệt đối việc người dùng không phải Quản trị viên nhìn thấy giao diện hoặc phím tắt dành cho Admin. Tự động kiểm tra quyền hạn khi chuyển đổi màn hình (`switchView`) và chặn truy cập trái phép với mã lỗi 403 Forbidden.
- **Cá nhân hóa theo tài khoản thực tế:** Hiển thị chính xác tên người dùng, avatar viết tắt và huy hiệu chức danh từ dữ liệu tài khoản đăng nhập (`currentUser.name`), không dùng tên cứng gán trước.

## 9. Triển khai Đám mây Vercel (Production Live Deployment)

- **Địa chỉ truy cập ứng dụng chính thức:** [https://k15c6n4.vercel.app](https://k15c6n4.vercel.app)
- **Điểm vào trực tiếp:** Tự động điều hướng từ trang chủ `/` sang bảng điều khiển thống nhất [Dashboard.html](https://k15c6n4.vercel.app/Dashboard.html).
- **Cơ chế lưu trữ bền vững & Tự phục hồi phiên (Self-Healing Storage):**
  - Hệ thống tích hợp kho lưu trữ đa tầng kết hợp `/tmp/tms_registered_users.json`, `localDatabase.commit()` và đồng bộ an toàn qua `localStorage` phía client.
  - Khi container serverless khởi động lạnh (Cold Start), tài khoản đăng ký mới tự động đồng bộ và đăng nhập thông suốt mà không làm mất dữ liệu người dùng.
- **Tối ưu hóa đa thiết bị (Mobile-First Responsive):** Toàn bộ giao diện bảng điều khiển, biểu mẫu tạo mới/chỉnh sửa, thanh điều hướng 3 gạch (Hamburger Drawer) và bảng dữ liệu được căn chỉnh tối ưu cho màn hình điện thoại từ 360px trở lên.
- **Hệ thống Thông báo & Điều hướng Trực tiếp (KN-156):** Tự động điều hướng `/notifications` và `/Notifications.html`, phân tách hộp thư thông báo thay đổi lịch học in-app theo đúng tài khoản đăng nhập, hỗ trợ phiên quản trị demo trực quan và đồng bộ đầy đủ các phân hệ.
