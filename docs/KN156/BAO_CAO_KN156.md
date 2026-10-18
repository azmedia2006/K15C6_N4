> **Tài liệu lịch sử.** Bản hợp nhất mới nhất: xem `README.md` ở gốc và `docs/FINAL/BAO_CAO_BAN_GIAO.md`. Một số trạng thái và đường dẫn kho trong tài liệu này đã được thay thế.

# Báo cáo bàn giao KN-156 — Quản lý buổi học đơn lẻ

**Ngày bàn giao:** 18/10/2026.  
**Đầu vào:** `K15C6_N4-Develop (2).zip` và hai ảnh user story/subtasks KN-156.  
**Phạm vi thực hiện:** backend Express đang phục vụ ứng dụng TMS, giao diện HTML/JavaScript hiện có; không chỉ tạo mockup.  
**Trạng thái:** đã triển khai và kiểm thử cục bộ. Chưa triển khai lên máy chủ, chưa cập nhật trạng thái ticket trên Jira.

## 1. Kết quả chính

- Sửa/dời riêng một buổi: ngày, giờ bắt đầu/kết thúc, phòng, giảng viên, chủ đề và ghi chú.
- Hủy mềm và bắt buộc lý do; giữ bản ghi, số buổi, số thứ tự và lịch sử. Không xóa vật lý.
- Kiểm tra trùng giờ lớp, phòng và giảng viên trên toàn bộ lịch đã lưu; hai buổi tiếp giáp giờ được chấp nhận; buổi hủy không giữ chỗ.
- Buổi đã điểm danh bị khóa ở cả giao diện và API. Không thể lách bằng cập nhật `status`, DELETE cũ, ghi đè cả lịch hoặc xóa lịch hàng loạt.
- Tạo thông báo in-app cho học viên thuộc lớp và giảng viên cũ/mới có tài khoản liên kết; khử trùng người nhận. Hộp thư chỉ trả thông báo của người đăng nhập, hỗ trợ đánh dấu đã đọc.
- Lưu trước/sau, người thao tác, thời điểm, hành động và lý do hủy.
- Lịch, lịch sử, điểm danh và hộp thông báo được ghi chung trong snapshot JSON; khôi phục được sau khi khởi động lại. Nếu ghi file thất bại, hoàn tác bộ nhớ, không tạo thông báo/lịch sử nửa chừng.

## 2. Đối chiếu đầy đủ subtasks trong ảnh

| Subtask | Nội dung triển khai | Bằng chứng / kiểm thử |
| --- | --- | --- |
| KN-169 | Mô hình buổi học với trạng thái `scheduled`, `completed`, `cancelled`; version; metadata hủy; bản ghi điểm danh, lịch sử và thông báo | `backend/scheduleService.js`; kiểm thử trạng thái, số thứ tự, khôi phục dữ liệu |
| KN-168 | API chi tiết trả `editable`, `lockReason`, `version`; kiểm tra quyền đọc theo vai trò/lớp | `GET /api/schedules/session/:id`; kiểm thử 200/403/404 |
| KN-170 | API sửa/dời riêng buổi, whitelist trường, kiểm tra ngày/giờ/phòng/giảng viên; không đổi số thứ tự các buổi khác | `PUT /api/schedules/session/:id`; kiểm thử sửa ngày/giờ/phòng, version, dữ liệu sai |
| KN-171 | Kiểm tra giao nhau khoảng giờ theo lớp, phòng và giảng viên; loại trừ chính buổi đang sửa và buổi đã hủy | Kiểm thử trùng phòng, trùng giảng viên khác lớp, trùng lớp, giờ liền kề, buổi hủy |
| KN-172 | API hủy mềm yêu cầu lý do 1–1000 ký tự; lưu người/thời điểm hủy | `POST /api/schedules/session/:id/cancel`; kiểm thử lý do trống, quá dài, hủy lặp |
| KN-173 | Tạo hộp thông báo cho từng tài khoản học viên/giảng viên liên kết, gồm lịch cũ/mới hoặc lý do hủy; giảng viên thay thế cũng nhận | Kiểm thử đủ học viên, GV cũ/mới, khử trùng; kiểm thử riêng tư hộp thư và đánh dấu đã đọc |
| KN-174 | Bảng lịch đã lưu, sửa/dời bằng modal, hủy kèm lý do, xem lịch sử; quản lý liên kết học viên | `ScheduleManagement.html`, `session-management.js`; kiểm thử trình duyệt |
| KN-175 | Cảnh báo và vô hiệu nút khi đã điểm danh; chặn trên server và các đường API cũ | Kiểm thử điểm danh rồi PUT/cancel/DELETE đều 409; giao diện kiểm tra nút disabled |
| KN-176 | Bộ 25 ca tự động KN-156; chạy hồi quy KN-154 và bộ `npm test` hiện có; kiểm tra giao diện thực | Log ở `test-results/`; ảnh ở `screenshots/` |
| KN-177 | Nhật ký theo từng buổi có bản trước/sau, actor, thời điểm, hành động, lý do | `GET /api/schedules/session/:id/history`; kiểm thử dữ liệu và xem modal |

**Điều kiện của KN-173:** ứng dụng chỉ có thể tạo thông báo cá nhân cho tài khoản đã liên kết. Lớp mẫu WD-2026-01 được liên kết sẵn học viên và giảng viên để thử đầy đủ; các tên giảng viên mẫu khác chưa có tài khoản tương ứng được cảnh báo rõ. Cần cấu hình roster và tài khoản đúng khi đưa dữ liệu thật vào. Kênh triển khai là in-app, không phải email/SMS.

## 3. Mô hình dữ liệu thực thi

Kho mặc định: `backend/data/schedules-kn156.json`.

- `classSchedules`: danh sách buổi theo lớp. Buổi chứa ngày, giờ, phòng, giảng viên/tài khoản giảng viên, `status`, `version`, `updatedAt`, `updatedBy`; sau hủy có `cancelReason`, `cancelledAt`, `cancelledBy`; sau điểm danh có `attendanceTaken`, `attendanceAt`.
- `activeClasses`: dữ liệu lớp và `studentIds` liên kết bổ sung. Ghi danh từ module cũ chỉ hợp nhất khi trùng ID hoặc mã lớp.
- `attendanceRecords`: session, người điểm danh, thời điểm và trạng thái từng học viên. Phải điểm danh đủ roster, không chấp nhận học viên ngoài lớp hoặc trùng ID.
- `sessionHistory`: session/lớp, action, actor, thời điểm, before/after, reason.
- `notifications`: event/session/lớp, userId nhận, nội dung, createdAt, readAt.
- `holidays`: giữ nguyên danh mục ngày nghỉ từ chức năng sinh lịch cũ.

Buổi chuyển `scheduled → cancelled` khi hủy, hoặc `scheduled → completed` khi điểm danh. Hai trạng thái cuối không cho sửa/hủy tiếp trong phạm vi story. Không thêm chức năng mở khóa điểm danh ngoài yêu cầu.

Cơ chế ghi là đồng bộ, file tạm + rename trong một tiến trình. Đây không phải transaction của database và không cung cấp khóa giữa nhiều tiến trình. Kiểm tra version khi client gửi version; giao diện mới luôn gửi version khi thao tác buổi đã lưu.

## 4. API chính

| Method | Endpoint | Quyền / mục đích |
| --- | --- | --- |
| GET | `/api/schedules/session/:id` | Quản lý/admin, GV được phân công hoặc học viên của lớp; xem chi tiết và điều kiện sửa |
| PUT | `/api/schedules/session/:id` | Quản lý đào tạo/admin; sửa hoặc dời lịch |
| POST | `/api/schedules/session/:id/cancel` | Quản lý đào tạo/admin; body `{reason, version}` |
| GET | `/api/schedules/session/:id/history` | Quản lý đào tạo/admin; lịch sử trước/sau |
| POST | `/api/schedules/session/:id/attendance` | Quản lý/admin hoặc GV được phân công; body `{students:[{studentId,status}], version}` |
| GET | `/api/schedules/people` | Quản lý/admin; tài khoản học viên/giảng viên để liên kết |
| GET / PUT | `/api/schedules/classes/:classId/members` | Quản lý/admin; xem/cập nhật liên kết học viên bổ sung |
| GET | `/api/schedule-notifications` | Người đăng nhập; chỉ hộp thư của chính mình |
| PATCH | `/api/schedule-notifications/:id/read` | Chủ thông báo; đánh dấu đã đọc |

Ví dụ body sửa buổi:

```json
{
  "date": "2026-11-03",
  "startTime": "09:00",
  "endTime": "11:00",
  "room": "Phòng Lab B2",
  "instructor": "ThS. Trần Minh",
  "instructorId": "usr_teacher",
  "version": 1
}
```

Mã phản hồi: 400 dữ liệu sai, 401 chưa xác thực, 403 thiếu quyền, 404 không tìm thấy/không phải chủ thông báo, 409 trùng lịch/khóa buổi/version cũ/lịch đã có, 500 lỗi ghi dữ liệu.

### Thay đổi tương thích có chủ đích

- `DELETE /api/schedules/session/:id` cũ vẫn tồn tại nhưng chuyển thành hủy mềm và phải có body chứa `reason`.
- Xóa cả lịch đã lưu bị chặn; ghi đè lịch đã có bị chặn. Đây là cách ngăn bỏ qua khóa điểm danh và làm mất nhật ký. Cần dùng thao tác đơn lẻ.
- Số thứ tự buổi được giữ ổn định sau sửa/hủy, thay vì đánh lại tất cả.
- Bộ test KN-154 được cập nhật đúng chính sách hủy mềm. Phòng trong dữ liệu fixture được đổi để không trùng lịch mẫu — trước đây hệ thống chưa chặn trường hợp này. Không bỏ kiểm tra xung đột để làm test cũ vượt qua.

## 5. Kết quả kiểm thử đã thực hiện

**Môi trường:** Linux, Node.js 24, Express theo lockfile gốc; Chromium headless cho giao diện.

| Kiểm thử | Kết quả thực tế |
| --- | --- |
| `cd backend && npm run test:kn156` | **25/25 ca đạt**, không lỗi, không skip |
| `cd backend && npm run test:kn154` | **10 nhóm kiểm thử đạt** sau cập nhật fixture/chính sách hủy mềm |
| `cd backend && npm test` | Chuỗi kiểm thử hiện có chạy xong, **exit code 0** |
| Giao diện sửa buổi đã lưu | Đạt: mở modal, lưu qua API, bảng hiển thị giá trị mới |
| Giao diện hủy | Đạt: nhập lý do, xác nhận, trạng thái hủy hiện trên bảng |
| Giao diện điểm danh | Đạt: điểm danh, nút sửa/hủy disabled |
| Giao diện lịch sử | Đạt: modal hiển thị trước/sau |
| Giao diện roster | Đạt: mở danh sách học viên liên kết |
| Hộp thư học viên | Đạt: thấy thông báo sửa/hủy, đánh dấu đã đọc |
| Hộp thư màn hình rộng 390px | Đạt: không tràn ngang |
| Lỗi JavaScript trong các luồng giao diện trên | Không ghi nhận page error |
| Lệnh `npm start` mới | Khởi động local thành công, trang Login trả HTTP 200 |
| Smoke test offline | Không có fetch cho storage/health; email mang `SKIPPED_OFFLINE` |

Bộ test mới có ca khởi chạy **một tiến trình Node khác** để xác nhận khôi phục lịch, điểm danh, lịch sử và thông báo; có mô phỏng lỗi rename để xác nhận rollback; có hai request đồng thời cùng version để xác nhận một request thành công, một request bị 409.

**Ghi chú về hồi quy:** các bài test email cũ có cảnh báo SMTP “Greeting never received”. Lệnh vẫn kết thúc thành công theo assertions hiện có, nhưng kết quả này **không chứng minh gửi email thật thành công**. Chức năng thông báo mới không phụ thuộc SMTP.

Ảnh minh chứng:

- `screenshots/kn156-sessions.png`: bảng lịch có buổi sửa, buổi hủy có lý do, buổi điểm danh khóa.
- `screenshots/kn156-history.png`: lịch sử trước/sau.
- `screenshots/kn156-inbox.png`: hộp thông báo học viên.
- `screenshots/kn156-inbox-mobile.png`: hộp thông báo trên màn hình nhỏ.

## 6. Các tệp chính được thay đổi/thêm

- Backend: `backend/scheduleService.js`, `backend/sessionRoutes.js`, `backend/server.js`, `backend/startLocal.js`, `backend/package.json`; thêm cờ offline cho lời gọi Supabase và SMTP trong hai service tương ứng.
- Tests: `backend/test/session_management_kn156.test.js`, cập nhật `backend/test/schedule_auto_generate_kn154.test.js`.
- Giao diện: `ScheduleManagement.html` và bản trong `frontend/`, `session-management.js`, `Notifications.html`, lối vào thông báo trên Dashboard và bản sao frontend tương ứng.
- Vận hành/tài liệu: root `package.json`, `.gitignore`, `README.md`, `README_LEAD_DEMO.md`, thư mục `docs/KN156/`.
- Chặn phục vụ tĩnh các thư mục backend, dữ liệu và dependencies để không tải được hộp thư riêng qua URL file.

ZIP không chứa `node_modules`, dữ liệu buổi học do kiểm thử sinh ra hay file `.env` thật. Cài dependencies bằng hướng dẫn README trước khi chạy.

### Chế độ khởi động mặc định mới

`npm start` chạy bản demo offline, không hydrate dữ liệu từ Supabase và không gửi SMTP. Thêm guard offline ở tầng request Supabase/khởi tạo SMTP để thao tác demo không vô tình sử dụng cấu hình dịch vụ ngoài hard-code của mã gốc. Bản ghi email trong chế độ này được ghi `SKIPPED_OFFLINE`, không gắn nhãn gửi thành công. Các module phụ thuộc dịch vụ ngoài không được coi là đã hoạt động online trong chế độ demo. Lệnh `backend/npm run start:integrated` giữ đường khởi động tích hợp cũ, chỉ dùng sau khi cấu hình lại dịch vụ.

## 7. Giới hạn và việc cần làm trước production

1. **Chưa deploy:** không có máy chủ/tài khoản triển khai được cung cấp; đây là bản mã nguồn đã chạy và kiểm thử cục bộ.
2. **Lưu trữ local:** chưa tích hợp các bảng mới vào PostgreSQL/Supabase. JSON chỉ phù hợp demo một tiến trình có ổ đĩa bền vững. Cấu hình Vercel cũ chưa đáp ứng lưu trạng thái mới và không được coi là đã kiểm thử triển khai.
3. **Danh tính người nhận:** phải liên kết tài khoản học viên và giảng viên; các tên cũ không có tài khoản không thể nhận hộp thư cá nhân. UI/API trả cảnh báo cho giảng viên chưa liên kết.
4. **Kênh thông báo:** chỉ thông báo in-app có polling 30 giây; chưa email/SMS/web push, chưa xác nhận người nhận đã đọc ngoài thao tác đánh dấu trong ứng dụng.
5. **Xác thực gốc:** backend hiện vẫn dùng cơ chế token demo Base64 không có chữ ký của dự án gốc. Chưa đủ an toàn để công khai Internet; cần thay bằng phiên/token có chữ ký, khóa tài khoản và cấu hình bảo mật phù hợp. Các ca RBAC mới xác nhận hành vi với tài khoản/token do ứng dụng cấp, không phải chứng nhận an toàn toàn hệ thống.
6. **Cấu hình bí mật gốc:** dự án đầu vào chứa thông tin SMTP và khóa dịch vụ hard-code. Không đưa ZIP lên kho công khai; cần thu hồi/đổi khóa và chuyển sang biến môi trường trước khi dùng thật. Không liệt kê giá trị bí mật trong báo cáo.
7. **Kiểm thử:** đã kiểm thử các luồng nêu trên; chưa kiểm thử tải lớn, nhiều tiến trình, triển khai thật hoặc tương thích mọi trình duyệt. Ảnh mobile kiểm tra hộp thư, không phải cam kết toàn bộ dashboard responsive.
8. **Không cập nhật Jira:** không có thao tác đánh dấu subtasks trên hệ thống bên ngoài; bảng trên là đối chiếu mã nguồn đã bàn giao trong phạm vi demo.

## 8. Cách chạy nhanh

Tại thư mục gốc:

```bash
npm run setup
npm start
```

Mở `http://localhost:3000/Login.html`. Tài khoản quản lý mẫu: `manager@tms.edu.vn` / `manager123`. Mở trang `ScheduleManagement.html`, cuộn tới **Quản lý buổi học đã lưu · KN-156**, chọn WD-2026-01. Thông tin đầy đủ và tài khoản mẫu khác nằm trong README mới.
