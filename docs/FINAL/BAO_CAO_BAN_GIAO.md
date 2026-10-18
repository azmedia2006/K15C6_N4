# Báo cáo bàn giao TMS 2.0.0

**Ngày:** 18/10/2026.  
**Nguồn:** `K15C6_N4-Develop (2).zip`.  
**Bản chạy chính:** Express `backend/`, giao diện `Workspace.html`.  
**Hai yêu cầu hợp nhất:** (1) hoàn thiện quản lý buổi học KN-156 theo hai ảnh; (2) sửa các lỗi phát hiện qua đợt rà soát, đặc biệt quên/đổi mật khẩu và email.

## 1. Kết quả và cách hiểu phạm vi

Đã sửa các lỗi đã tái hiện trên đường chạy Express cục bộ, bổ sung lưu bền dùng chung và thay Dashboard mô phỏng bằng giao diện có API lưu dữ liệu. Các bộ kiểm thử cục bộ cuối đều đạt. **Không dùng kết quả này để khẳng định toàn bộ dự án không còn lỗi hoặc đã sẵn sàng production.**

Email đã kiểm tra cả phản hồi SMTP chấp nhận và từ chối bằng máy chủ thử cục bộ, đồng thời kiểm tra UI quên mật khẩu → thư SMTP thử → link reset → đổi mật khẩu → restart → đăng nhập. Chưa gửi email ra Internet hoặc xác nhận inbox thật. Những phần phụ thuộc nhà cung cấp và các backend Java/NestJS độc lập được nêu riêng ở cuối báo cáo, không gộp vào kết quả đạt của Express.

## 2. Đối chiếu yêu cầu hai ảnh KN-156

| Hạng mục | Bản bàn giao / bằng chứng |
| --- | --- |
| KN-169 — dữ liệu, trạng thái buổi | Buổi có trạng thái đã xếp lịch/đã hủy/đã điểm danh, version và thông tin khóa; lưu cùng kho chính |
| KN-168 — chi tiết, điều kiện chỉnh sửa | API chi tiết kiểm tra quyền, tồn tại, trạng thái và version; không chỉ chặn nút ở frontend |
| KN-170 — sửa/dời buổi | Đổi ngày, giờ, phòng, giảng viên cho đúng một buổi; không sửa cả chuỗi |
| KN-171 — xung đột | Chặn chồng giờ phòng hoặc giảng viên, kể cả với lớp khác; ca giáp giờ không bị coi là chồng lấn |
| KN-172 — hủy có lý do | Lý do bắt buộc; hủy mềm, không xóa buổi; giữ lịch sử |
| KN-173 — thông báo | Tạo thông báo riêng cho học viên ghi danh và giảng viên liên kết liên quan; hộp thư riêng, đánh dấu đã đọc, tải lại 30 giây |
| KN-174 — giao diện | Bảng buổi đã lưu, modal sửa/hủy, xem lịch sử, danh sách người nhận và điểm danh |
| KN-175 — khóa sau điểm danh | Hiện lý do khóa, vô hiệu nút; API sửa và hủy cũng trả lỗi xung đột trạng thái |
| KN-176 — kiểm thử | 25 ca KN-156, ca hồi quy bổ sung và kiểm thử thực tế qua Chromium |
| KN-177 — lịch sử | Lưu trước/sau, tác giả, thời điểm và lý do; lưu đồng thời lịch, lịch sử, inbox trong một snapshot cục bộ |

Thông báo là **in-app**. Nếu nhập tên giảng viên tự do không khớp tài khoản, ứng dụng cảnh báo chưa liên kết; không thể khẳng định người đó nhận thông báo. Nên chọn tài khoản giảng viên từ gợi ý. Học viên phải có tài khoản và bản ghi ghi danh thực tế.

## 3. Những lỗi audit đã xử lý

### 3.1. Xác thực, phân quyền, cấu hình

- **SEC-01:** bỏ token Base64 có thể tự tạo; dùng phiên ngẫu nhiên do server quản lý, chỉ lưu digest token phiên.
- **SEC-02:** xác thực lại trạng thái tài khoản mỗi request; khóa, đổi/reset mật khẩu và đăng xuất thu hồi phiên tương ứng. Mở khóa không làm token cũ sống lại.
- **SEC-03:** avatar bắt buộc đăng nhập; chỉ chủ tài khoản hoặc quản trị được sửa/xóa. Sửa cả trường hợp DELETE không có request body.
- **SEC-04:** endpoint Supabase chỉ cho quản trị, trả thất bại khi chưa cấu hình/offline; đường tích hợp thực hiện sao lưu snapshot có kiểm kết quả, không tự nhận là đồng bộ bảng hai chiều.
- **SEC-05:** gỡ thông tin bí mật hard-code đã nhận diện khỏi bản bàn giao; cấu hình SMTP/Supabase qua môi trường. Bật kiểm tra chứng chỉ TLS trong Express, adapter KN-75 và cấu hình email NestJS. **Việc thu hồi khóa cũ ở nhà cung cấp vẫn phải do chủ tài khoản thực hiện.**
- **SEC-06:** lọc lớp/lịch/điểm/học phí theo phạm vi người dùng; kiểm quyền sở hữu bản ghi, không chỉ dựa vào role của trình duyệt.
- Bỏ fallback đăng nhập phía client không kiểm chứng mật khẩu; đăng ký chỉ ghi qua backend.
- Chặn tải source, cấu hình và datastore qua static hosting, có test đường dẫn mã hóa; không phát hành `.env` thực hoặc kho dữ liệu chạy thử.

### 3.2. Tài khoản, mật khẩu, email

- **FUN-01:** ChangePassword gọi API thực, kiểm mật khẩu cũ, validation mật khẩu mới, lưu hash và thu hồi phiên.
- **FUN-02:** đăng ký trùng trả và hiển thị lỗi thật 409; không còn dùng `allSettled` để báo thành công bất kể lỗi.
- **FUN-05:** mật khẩu và token reset không mất khi restart; reset một lần, hạn dùng, thu hồi phiên cũ.
- **FUN-06:** hồ sơ cá nhân lưu được bằng kho cục bộ, không bắt buộc Supabase.
- **MAIL-01:** trạng thái email `NOT_CONFIGURED`/`QUEUED`/`ACCEPTED`/`FAILED`; chỉ ghi ACCEPTED sau phản hồi chấp nhận SMTP. SMTP test chờ kết quả, không trả thành công khi chưa thực hiện.
- Thông điệp quên mật khẩu chống tiết lộ tài khoản; khi chưa cấu hình nói rõ chưa có mail gửi. Nhật ký quản trị chỉ chứa metadata, không chứa nội dung email/reset token/mật khẩu.
- Quản trị có thao tác đặt lại mật khẩu kèm lý do và nhật ký, dùng khi chưa cấu hình mail. Cung cấp mật khẩu mới qua kênh an toàn.

**ACCEPTED không đồng nghĩa DELIVERED.** Mail có thể bị nhà cung cấp trả lại, lọc thư rác hoặc bị chặn sau khi SMTP nhận. Bản này chưa có webhook bounce/delivery, hàng đợi gửi bền hoặc retry tự động; không tự gửi lại thư sau restart.

### 3.3. Liên thông dữ liệu và nghiệp vụ

- **DATA-01:** thống nhất ID lớp giữa môn, ghi danh, lịch và phân công. Tạo lớp mới xuất hiện ở các module liên quan.
- **DATA-02:** bỏ điểm/học phí giả cho ID không tồn tại; trả 404. Cập nhật điểm giữ liên kết học viên/lớp/bài tập.
- **DATA-03:** tài khoản, quyền, môn, lead, ghi danh, lịch, phân công và nghiệp vụ mới đăng ký vào kho chung, khôi phục ở tiến trình mới.
- **FUN-03/04:** tạo lớp, ghi danh và điểm danh trên Workspace dùng API thật. Điểm danh theo đúng buổi, không còn nút lưu chỉ toast.
- **FUN-07:** phân công giảng viên/trợ giảng có lưu cục bộ, đồng bộ liên kết lớp.
- **FUN-08:** KN-75 có adapter cục bộ cho phân công lead, tư vấn viên hợp lệ, lịch sử và phạm vi lead của người được giao; không bắt buộc PostgreSQL khi chạy `npm start`.
- Hủy ghi danh thu hồi quyền xem lớp; không tự khôi phục học viên đã xóa khi restart. Loại các bản ghi học viên seed không có tài khoản tương ứng.
- Chặn hạn nộp không có thật như 30/02; phê duyệt thiếu ghi chú không làm thay đổi trạng thái một phần.

### 3.4. Dashboard, báo cáo, thao tác nghiệp vụ

- **UI-01:** có form tạo khóa, tạo lớp, ghi danh, giao bài với tiêu chí chấm, nhập điểm, học phí, biên lai, tạo/duyệt đề nghị và đặt lại mật khẩu. Thêm giảng viên qua quản lý người dùng; không còn thao tác “mời” giả.
- Điểm 0–10; học viên phải thuộc lớp; giảng viên không sửa lớp ngoài phạm vi. Tiêu chí chấm là nội dung rubric; không phải bộ tính điểm đa tiêu chí tự động hay hệ thống nộp bài/LMS đầy đủ.
- Học phí/biên lai dùng số nguyên VND, không âm và không thu quá công nợ; báo cáo tính theo bản ghi thật. Phiếu thu là chứng từ nội bộ ghi nhận tiền đã thực nhận, không phải cổng thanh toán.
- Chứng chỉ, bảo lưu học phí, đề nghị dạy thay: có hồ sơ chờ duyệt/kết quả duyệt; giao diện nói rõ **chưa tự cấp chứng chỉ, chuyển tiền hoặc đổi lịch**. Đây là phần hỗ trợ quy trình nội bộ, không phải hoàn thiện mọi nghiệp vụ chứng chỉ/tài chính.
- **UI-02:** KPI và CSV lấy dữ liệu API trong phạm vi tài khoản; in/lưu PDF qua trình duyệt, không dùng KPI hard-code.
- **UI-03/04:** trang đích đăng nhập thống nhất Workspace, có link hộp thông báo thật; bỏ dropdown thông báo mẫu thay bằng hộp thư thực.
- **UI-05/06:** Index/Dashboard và các điểm đăng nhập chính điều hướng thống nhất; bỏ đăng nhập giả phía trình duyệt. Một số màn legacy vẫn giữ các bản HTML tại root/frontend/FE để tương thích, chưa có pipeline build frontend hợp nhất.
- **TEST-01:** runner chạy tất cả 20 tệp test Express cục bộ, gồm forgot/import/hồi quy/SMTP; test dịch vụ Supabase thật tách riêng, không được tính là đã đạt offline.

## 4. Kết quả kiểm thử cuối

| Nhóm | Kết quả |
| --- | --- |
| `npm test` — runner cục bộ | **20/20 tệp exit code 0** |
| `final-regression.test.js` | **38/38 ca đạt** — token giả/thu hồi, ownership, reset/restart, liên thông, điểm/học phí, quyền lớp, xung đột, hủy, điểm danh, source protection và validation |
| `session_management_kn156.test.js` | **25/25 ca đạt** |
| `smtp-local.test.js` | **2/2 ca đạt** — SMTP nhận DATA và từ chối DATA, không thư thật |
| Chromium — nghiệp vụ | **13 checkpoint đạt**: đăng nhập; tạo khóa/lớp; ghi danh nhiều người; bài tập/điểm; học phí/biên lai/công nợ; CSV; đề nghị/duyệt; sửa/hủy/khóa điểm danh; sai mật khẩu cũ; trùng email; học viên xem và đọc inbox; không lỗi JavaScript ở luồng thử |
| Chromium — quên mật khẩu qua SMTP thử | **6 checkpoint đạt**: form gọi API; SMTP fixture có link; link reset đặt mật khẩu; thu hồi phiên/dùng lại link bị chặn; mật khẩu mới đăng nhập sau restart; mật khẩu cũ bị từ chối |
| SMTP/Supabase thật, PostgreSQL/MySQL, NestJS/Java | **Chưa nghiệm thu tích hợp**, không tính vào kết quả đạt trên |

Lưu ý: 20 là **số tệp test**, không phải tổng số assertions; nhiều test legacy dùng runner/assertions riêng. 38/25/2 là các nhóm nằm trong 20 tệp, không cộng thêm vào số tệp. Một số assertions cũ được cập nhật để phản ánh hợp đồng an toàn mới (avatar cần token, không có mail cấu hình thì không được nói đã gửi, không dựa vào dữ liệu điểm/học phí mock).

Bằng chứng: `test-results/all-tests-final.log`, `test-results/summary.json`, `test-results/ui-final.log`, `test-results/recovery-ui.log`, `screenshots/`. Ảnh thể hiện dữ liệu thử; dữ liệu này không được kèm vào kho runtime của ZIP.

## 5. Khởi chạy và sao lưu

```bash
npm run setup
npm start
```

Mở `http://localhost:3000/Login.html`. Tài khoản mẫu và cấu hình ở README gốc. Đổi mật khẩu/loại bỏ demo trước khi vận hành thật.

Kho chính `backend/data/tms.json`, có thể đổi bằng `TMS_DATA_FILE`. Launcher mặc định chỉ bind `127.0.0.1`, kiểm tra khóa một tiến trình, khởi tạo và lưu trạng thái. Ghi file tạm rồi rename, mode mặc định 0600. Tắt server rồi sao lưu toàn file. Không dùng cùng file cho nhiều tiến trình, nhiều máy hoặc serverless.

## 6. Phần vẫn cần xác nhận trước khi vận hành thật

1. **Email thực:** điền SMTP của bạn vào `.env`, bật `SMTP_ENABLED=true`, đặt `FRONTEND_URL` người nhận truy cập được; dùng hộp thư thử được phép để xác nhận inbox/spam và reset. Không tắt xác minh TLS để vượt lỗi chứng chỉ.
2. **Dịch vụ ngoài:** Supabase online/backup snapshot, KN-75 PostgreSQL, MySQL và các backend độc lập cần tài khoản, DB, migration và test riêng. Không có bằng chứng tích hợp thật trong bản này.
3. **Bảo mật thông tin đã lộ:** gỡ khỏi mã không thể thu hồi những bản ZIP/commit cũ. Chủ dịch vụ cần đổi/thu hồi bí mật gốc, rà lịch sử truy cập và cấu hình quyền tối thiểu.
4. **Production:** cần DB giao dịch, HTTPS, secret manager, quản lý phiên phù hợp triển khai, backup/restore định kỳ, log/monitoring, tải/concurrency, kiểm thử thêm trình duyệt và quy trình riêng của đơn vị. Datastore hiện tại chứa thông tin nhạy cảm, phải bảo vệ file và bản sao lưu.
5. **Quy trình mở rộng:** cấp chứng chỉ có chữ ký, chuyển/bảo lưu học phí tự động, cổng thanh toán, nộp bài/đính kèm và rubric nhiều tiêu chí tự tính điểm chưa nằm trong triển khai nghiệp vụ đầy đủ; chỉ có các thao tác nội bộ được mô tả rõ ở trên.

Không còn lỗi thất bại trong bộ kiểm thử cục bộ cuối; điều này không bảo đảm “mọi chức năng của mọi backend đều hoàn thiện” hoặc “không thể còn lỗi chưa được kiểm thử”.
