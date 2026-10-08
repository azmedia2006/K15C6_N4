# TMS - Node.js + React

Bản này chạy bằng **Node.js** gồm:
- Backend: Node.js + Express, port 3001
- Frontend: React + TypeScript + Vite, port 5173
- Dữ liệu: `server/data/programs.json`

## Chạy

Mở 2 terminal trong VS Code.

### Terminal 1 - Backend
```bash
cd server
npm install
npm run dev
```

### Terminal 2 - Frontend
```bash
cd client
npm install
npm run dev
```

Mở:
http://localhost:5173

API:
http://localhost:3001/api/programs

## Chức năng
- GET danh sách
- Tìm kiếm/lọc
- POST tạo chương trình
- PUT sửa chương trình
- PATCH ngừng áp dụng
- DELETE xóa chương trình
- Không cho xóa/ngừng áp dụng nếu đang có lớp hoạt động
- Lưu dữ liệu thật vào JSON nên restart server vẫn còn dữ liệu.

## Nếu muốn dùng Java
Có thể thay backend Express bằng Spring Boot + PostgreSQL ở bước tiếp theo. Frontend giữ nguyên, chỉ đổi API base URL.
