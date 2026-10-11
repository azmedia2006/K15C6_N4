# KN-75 — Phân công lead cho tư vấn viên

Module **độc lập**. Không sửa code, dependency hay lockfile của module khác.

## Phạm vi thay đổi trong repo

| Loại | Đường dẫn |
|---|---|
| Sửa (thêm 2 dòng) | `backend/server.js` — mount router `/api/kn75` trước bộ xử lý 404 |
| Mới | `backend/kn75/**` (API, migration, test, package.json riêng) |
| Mới | `frontend/kn75/**` (2 màn hình) |
| Mới | `docs/KN75/**` |

Không đổi: `package.json`, `package-lock.json`, `authService.js`, `leadService.js`, các route `/api/leads`, `Index.html`, `.env.example`.

## Cài đặt và chạy

```bash
# 1. Dependency gốc (--no-package-lock: không làm thay đổi package-lock.json của nhóm)
npm install --no-package-lock
# 2. Dependency riêng của KN-75 (pg; playwright chỉ để test UI)
npm --prefix backend/kn75 install
# 3. Cấu hình DB: thêm vào .env gốc (đã được .gitignore)
#    KN75_DATABASE_URL=postgresql://...   (Supabase: Settings > Database > Connection string)
#    KN75_PGSSL=true                      (khi dùng Supabase)
# 4. Tạo bảng (chạy lại nhiều lần vẫn an toàn)
node backend/kn75/migrate.js
# 5. Chạy server như cũ
npm start
```

- Quản lý đào tạo: `manager@tms.edu.vn` / `manager123` → `http://localhost:3000/frontend/kn75/LeadAssignment.html`
- Tư vấn viên: `admissions@tms.edu.vn` / `admissions123` → `http://localhost:3000/frontend/kn75/MyLeads.html`
- Thêm tư vấn viên thứ 2: tạo user vai trò `admissions` ở màn hình Quản lý người dùng có sẵn.

Nếu chưa cấu hình `KN75_DATABASE_URL` hoặc chưa cài `pg`, server vẫn chạy bình thường; chỉ `/api/kn75/*` trả 503.

## PostgreSQL local (tùy chọn)

```bash
docker compose -f backend/kn75/docker-compose.yml up -d
# KN75_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/tms
```

## Kiểm thử

```bash
# Chỉ dùng DB local riêng, tên kết thúc _test — test sẽ xóa dữ liệu trong DB này.
export KN75_TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/tms_kn75_test
npm --prefix backend/kn75 test         # 21 test API
npm --prefix backend/kn75 run test:ui  # 13 kiểm tra UI (cần Chromium)
```

## API

| Method | Path | Vai trò | Mô tả |
|---|---|---|---|
| GET | `/api/kn75/counselors` | training_manager | Tư vấn viên đang hoạt động |
| GET | `/api/kn75/leads?page&limit&search&status&assignment` | training_manager | Toàn bộ lead + người phụ trách. `assignment`: all, assigned, unassigned, inactive_owner |
| POST | `/api/kn75/assignments` | training_manager | Body `{lead_ids[], tu_van_vien_id, reason?}` (1–1.000 lead) |
| GET | `/api/kn75/leads/:id/history` | training_manager | Lịch sử chuyển giao |
| GET | `/api/kn75/my-leads?page&limit&search&status` | admissions | Chỉ lead được giao cho chính mình |
| GET | `/api/kn75/my-leads/:id` | admissions | 404 nếu không phải lead của mình |
| GET | `/api/kn75/my-leads/:id/history` | admissions | Lịch sử lead của mình |

## Lưu ý cho nhóm (không sửa trong KN-75)

1. Route cũ `GET /api/leads` (module tư vấn) vẫn cho vai trò `admissions` xem toàn bộ lead. Để giới hạn tuyệt đối, chủ module lead cần bỏ `admissions` khỏi route đó hoặc dùng `/api/kn75/my-leads`. Việc này cần thống nhất với nhóm.
2. Token hiện tại (`authService.generateToken`) là Base64 không chữ ký, có thể bị giả mạo. Nên tạo ticket riêng để chuyển sang JWT có chữ ký.
3. `npm ci` ở thư mục gốc đang lỗi sẵn vì `package-lock.json` lệch với `package.json` (dotenv, nodemailer). Dùng `npm install --no-package-lock` để không phát sinh thay đổi lockfile.

## Đẩy lên GitHub an toàn

```bash
git checkout -b feature/KN-75-phan-cong-lead
git add backend/server.js backend/kn75 frontend/kn75 docs/KN75
git status            # chỉ thấy các đường dẫn trên; không có package-lock.json, .env
git diff --cached --stat
git commit -m "KN-75: Phân công lead cho tư vấn viên"
git push -u origin feature/KN-75-phan-cong-lead
```

Nếu `git status` có file khác (ví dụ `package-lock.json`), chạy `git checkout -- <file>` trước khi commit.
