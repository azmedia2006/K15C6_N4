# KN-120 — Bảng test case KN-75

Tự động: `npm --prefix backend/kn75 test` (21 test API) và `npm --prefix backend/kn75 run test:ui` (13 kiểm tra UI).

| ID | Mô tả | Bước thực hiện | Kết quả mong đợi |
|---|---|---|---|
| TC01 | Phân công 1 lead | Manager `POST /api/kn75/assignments` `{lead_ids:[L1], tu_van_vien_id:A}` | 200, 1 thành công; 1 dòng phân công; lịch sử old=null, new=A, performed_by=manager |
| TC02 | Phân công nhiều lead | Gửi 3 lead cho B | 200, 3 thành công, B có 3 dòng phân công |
| TC03 | Lead không tồn tại + lead trùng | `[L1, "khong_ton_tai", L1, L2]` | 2 thành công; lỗi `LEAD_NOT_FOUND` (index 1), `DUPLICATE_LEAD` (index 2) |
| TC04 | Lead đã giao đúng người | Giao L1 cho A 2 lần | Lần 2: `ALREADY_ASSIGNED`, không thêm lịch sử, ngày giao không đổi |
| TC05 | Danh sách rỗng / sai dữ liệu | `lead_ids: []`, thiếu mảng, id số, lý do > 500 ký tự | 400 `EMPTY_LEAD_LIST` / `INVALID_PAYLOAD` / `INVALID_LEAD_ID` / `INVALID_REASON` |
| TC06 | Tư vấn viên không hợp lệ | id không tồn tại; user là học viên; tư vấn viên nghỉ việc | 400 `COUNSELOR_NOT_FOUND` / `INVALID_COUNSELOR` / `COUNSELOR_INACTIVE`; không lưu gì |
| TC07 | Tư vấn viên gọi API phân công | Token của A gọi `POST /assignments`, `GET /leads`, `GET /counselors` | 403, không lưu dữ liệu |
| TC08 | Không có token | Gọi API không có header Authorization | 401 |
| TC09 | A chỉ thấy lead của A | Giao 2 lead cho A, 1 cho B; A gọi `GET /my-leads` | total=2, mọi dòng assignedTo=A |
| TC10 | A gọi trực tiếp lead của B | A gọi `/my-leads/:idB`, `/my-leads/:idB/history`, `/leads/:idB/history` | 404/403, không trả dữ liệu; B gọi được (200) |
| TC11 | Đổi phạm vi qua query | A gọi `/my-leads?tu_van_vien_id=B` | 400 `SCOPE_OVERRIDE` |
| TC12 | Phân công lại tạo đúng lịch sử | Giao L2 cho A, sau đó cho B kèm lý do | `REASSIGNED`; lịch sử old=A, new=B, người thực hiện, lý do, thời gian = ngày giao; A mất quyền, B có quyền |
| TC13 | Tư vấn viên nghỉ việc | Giao 2 lead cho A, đặt A inactive, lọc `assignment=inactive_owner`, giao lại cho B | A bị 403 `ACCOUNT_INACTIVE`; bộ lọc trả 2 lead; chuyển thành công, `old_user_inactive=true` |
| TC14 | 1.000 lead cùng lúc | Gửi 1.000 lead; sau đó gửi 1.001 | 1.000 thành công + 1.000 lịch sử, < 10 giây; 1.001 → 400 `BATCH_TOO_LARGE` |
| TC15 | Rollback transaction | Lô chứa 1 lead làm lỗi ghi DB | 500 `TRANSACTION_FAILED`; 0 phân công, 0 lịch sử |
| TC16 | Phân công lại đồng thời | 2 request giao cùng lead cho B và C cùng lúc | Chuỗi lịch sử liên tục (old lần sau = new lần trước) |
| TC17 | Phân trang, tìm kiếm, lọc | `search`, `status`, `limit/page`; status sai; limit > 100 | Kết quả đúng; tham số sai → 400 |
| TC18 | Lịch sử chỉ được thêm | `UPDATE` bảng lịch sử | DB báo lỗi |
| TC19 | Migration chạy lại | Chạy `migrate` 2 lần | Không lỗi, 2 migration ghi nhận |
| TC20 | Không ảnh hưởng module khác | Gọi `/api/leads`, `/api/auth/me`, API không tồn tại | Hoạt động như trước |
| TC21 | Chưa cấu hình DB KN-75 | Khởi động server không có `KN75_DATABASE_URL` | Server vẫn chạy; `/api/leads` 200; `/api/kn75/*` 503 |
| UI01–UI05 | Giao diện phân công hàng loạt | Chọn checkbox qua 2 trang, chọn tư vấn viên, xác nhận/hủy, gửi, xem trên 390px | Nút khóa khi chưa chọn; hộp xác nhận; kết quả từng lead; không tràn ngang |
| UI06–UI09 | Giao diện tư vấn viên | B mở “Lead của tôi”, xem lịch sử; A mở cùng trang; tìm kiếm rỗng | B thấy 2 lead + trạng thái + ngày giao + lịch sử; A không thấy; trạng thái rỗng hiển thị đúng |
| UI10–UI13 | Phân quyền, XSS, lỗi | Tư vấn viên mở trang phân công; tên lead chứa HTML; giao lại đúng người | Bị từ chối; render dạng text; báo `ALREADY_ASSIGNED`; không lỗi JS |
