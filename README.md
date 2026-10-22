# TMS Node.js — KN-178

Ứng dụng mẫu chạy cục bộ bằng Node.js + Express, tập trung vào yêu cầu trong ảnh KN-178:

- Quản lý đào tạo thực hiện **bảo lưu**, **chuyển lớp**, **thôi học** và **cho học lại**.
- Mỗi thao tác bắt buộc có **lý do** và **ngày hiệu lực**.
- Lưu lịch sử gồm người thao tác, thời điểm, dữ liệu trước/sau và lý do.
- Danh sách điểm danh chỉ lấy học viên có trạng thái `active` của đúng lớp. Học viên bảo lưu/thôi học không xuất hiện trong danh sách điểm danh; chuyển lớp sẽ đưa học viên sang lớp mới.
- Dữ liệu được lưu tại `backend/data/tms.json` và giữ lại khi khởi động lại ứng dụng.

## Yêu cầu

- Node.js 20 trở lên
- npm
- VS Code (khuyến nghị)

## Chạy trên Windows / VS Code

1. Giải nén ZIP.
2. Mở VS Code → **File → Open Folder...** → chọn thư mục `TMS_NodeJS_KN178`.
3. Mở **Terminal → New Terminal**.
4. Chạy lần lượt:

   ```bash
   npm install
   npm start
   ```

5. Mở trình duyệt tại <http://localhost:3000/Login.html>.

Không mở `Workspace.html` bằng Live Server. Ứng dụng cần chạy qua Express để API và đăng nhập hoạt động.

## Tài khoản mẫu (chỉ dùng cục bộ)

| Vai trò | Email | Mật khẩu |
|---|---|---|
| Quản trị | admin@tms.edu.vn | admin123 |
| Quản lý đào tạo | manager@tms.edu.vn | manager123 |
| Giảng viên xem thử | teacher@tms.edu.vn | teacher123 |
| Học viên xem thử | student@tms.edu.vn | student123 |

Các tài khoản trên chỉ phục vụ demo trên máy cá nhân. Không mở server ra Internet hoặc dùng dữ liệu thật với mật khẩu mẫu.

## Cách thử KN-178

1. Đăng nhập bằng tài khoản Quản lý đào tạo.
2. Trong danh sách học viên, thử **Bảo lưu** một học viên. Nhập ngày hiệu lực và lý do.
3. Mở danh sách điểm danh: học viên bảo lưu sẽ không còn trong danh sách của lớp.
4. Thử **Học lại** để đưa học viên về trạng thái đang học.
5. Thử **Chuyển lớp** và chọn lớp đích. Học viên sẽ xuất hiện trong danh sách điểm danh của lớp mới.
6. Thử **Thôi học**: học viên sẽ không còn trong danh sách điểm danh.
7. Kiểm tra phần **Lịch sử thay đổi**.
8. Dừng server bằng `Ctrl+C`, chạy `npm start` lại; dữ liệu nghiệp vụ vẫn còn trong `backend/data/tms.json`.

## Cấu trúc

```text
TMS_NodeJS_KN178/
├── backend/
│   └── data/             # TMS JSON store tự tạo khi chạy
├── public/
│   ├── Login.html
│   ├── Workspace.html
│   ├── app.js
│   └── style.css
├── server.js
├── package.json
└── README.md
```

## Lưu ý kỹ thuật

Đây là bản demo học tập chạy một tiến trình, dùng JSON làm kho dữ liệu và session store mặc định trong bộ nhớ. Không phù hợp cho production, nhiều máy chủ hoặc dữ liệu học viên thật. Trước khi triển khai thật cần database giao dịch, session store bền, HTTPS, quản lý bí mật, phân quyền/kiểm thử bổ sung và quy trình sao lưu. `SESSION_SECRET` mặc định chỉ dành cho demo; cấu hình biến môi trường riêng khi dùng thử nhóm.
