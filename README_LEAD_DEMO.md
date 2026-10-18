> **Tài liệu lịch sử.** Bản hợp nhất mới nhất: xem `README.md` ở gốc và `docs/FINAL/BAO_CAO_BAN_GIAO.md`. Một số trạng thái và đường dẫn kho trong tài liệu này đã được thay thế.

# TMS Lead Conversion - bản chạy ngay

Bản demo này không cần PostgreSQL, Supabase, Postman hay Thunder Client. Dữ liệu được lưu tự động vào `data/db.json`.

## Cách chạy trên Windows + VS Code

1. Giải nén file ZIP.
2. Mở thư mục `tms-lead-conversion-ready` bằng VS Code.
3. Chọn Terminal -> New Terminal.
4. Nếu bản cũ đang chạy ở cổng 3000, quay lại terminal đó và nhấn `Ctrl + C`.
5. Chạy các lệnh:
   ```bash
   npm install
   npm start
   ```
6. Mở trình duyệt: http://localhost:3000

## Cách dùng
- Có sẵn 2 Lead mẫu để thử ngay.
- Có thể thêm Lead bằng form bên trái.
- Nhấn “Chốt tuyển sinh” ở một Lead chưa chuyển đổi.
- Hệ thống tạo mã học viên, tạo tài khoản nội bộ với mật khẩu ngẫu nhiên đã mã hóa, cập nhật Lead sang “Đã nhập học” và hiển thị hồ sơ học viên.
- Nếu nhấn chuyển đổi lần nữa, hệ thống chặn tạo hồ sơ trùng.

## Dữ liệu ở đâu?
Sau lần chạy đầu tiên, dữ liệu tự tạo tại `data/db.json`. Không xóa file này nếu muốn giữ dữ liệu thử nghiệm.

## Giới hạn bản demo
- Chưa gửi email thật; trang sẽ báo rõ đây là phần chưa cấu hình.
- Chưa có đăng nhập/xác thực/phân quyền.
- File JSON phù hợp để demo và học tập, không phù hợp nhiều người dùng đồng thời hoặc triển khai production.
- Trước khi tích hợp vào TMS hiện tại, cần nối với database và schema thực tế của dự án.
