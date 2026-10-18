# TMS — Bản hợp nhất KN-156 và sửa lỗi ứng dụng

Bản bàn giao **2.0.0 — 18/10/2026**. Bao gồm yêu cầu quản lý buổi học theo hai ảnh, cùng các sửa lỗi phát hiện trong đợt rà soát. Đường chạy chính là **Express `backend/`**; trang làm việc thống nhất là `Workspace.html`.

## 1. Chạy nhanh

Cần **Node.js 20+ và npm**; bản bàn giao kiểm thử bằng Node.js 24 và Chromium trên Linux.

```bash
npm run setup
npm start
```

Mở **http://localhost:3000/Login.html**. Lần đầu có tài khoản mẫu để thử cục bộ:

| Vai trò | Tài khoản | Mật khẩu mẫu |
| --- | --- | --- |
| Quản trị | admin@tms.edu.vn | admin123 |
| Quản lý đào tạo | manager@tms.edu.vn | manager123 |
| Giảng viên | teacher@tms.edu.vn | teacher123 |
| Học viên | student@tms.edu.vn | student123 |

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
