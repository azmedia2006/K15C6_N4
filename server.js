const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "db.json");

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

function ensureDatabase() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    const initial = {
      leads: [
        {
          id: 1,
          full_name: "Nguyen Van A",
          email: "nguyenvana@example.com",
          phone: "0900000000",
          status: "New",
          student_id: null,
          created_at: new Date().toISOString()
        },
        {
          id: 2,
          full_name: "Tran Thi B",
          email: "tranthib@example.com",
          phone: "0911111111",
          status: "Contacted",
          student_id: null,
          created_at: new Date().toISOString()
        }
      ],
      students: [],
      users: [],
      nextLeadId: 3,
      nextStudentId: 1,
      nextUserId: 1
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2), "utf8");
  }
}

function readDb() {
  ensureDatabase();
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

function writeDb(db) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), "utf8");
}

function makePasswordHash(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, message: "TMS Lead Conversion API is running." });
});

app.get("/api/leads", (_req, res) => {
  const db = readDb();
  res.json(db.leads.slice().sort((a, b) => b.id - a.id));
});

app.get("/api/students", (_req, res) => {
  const db = readDb();
  res.json(db.students.slice().sort((a, b) => b.id - a.id));
});

app.post("/api/leads", (req, res) => {
  const full_name = String(req.body.full_name || "").trim();
  const email = String(req.body.email || "").trim().toLowerCase();
  const phone = String(req.body.phone || "").trim();

  if (!full_name || !email) {
    return res.status(400).json({ message: "Vui lòng nhập họ tên và email." });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ message: "Email chưa đúng định dạng." });
  }

  const db = readDb();
  const duplicate = db.leads.some(x => x.email.toLowerCase() === email) ||
    db.students.some(x => x.email.toLowerCase() === email);
  if (duplicate) {
    return res.status(409).json({ message: "Email này đã tồn tại trong hệ thống." });
  }

  const lead = {
    id: db.nextLeadId++,
    full_name,
    email,
    phone: phone || null,
    status: "New",
    student_id: null,
    created_at: new Date().toISOString()
  };
  db.leads.push(lead);
  writeDb(db);
  res.status(201).json({ message: "Đã tạo Lead.", lead });
});

app.post("/api/leads/:id/convert", (req, res) => {
  const leadId = Number(req.params.id);
  if (!Number.isInteger(leadId) || leadId < 1) {
    return res.status(400).json({ message: "Mã Lead không hợp lệ." });
  }

  const db = readDb();
  const lead = db.leads.find(x => x.id === leadId);
  if (!lead) return res.status(404).json({ message: "Không tìm thấy Lead." });
  if (lead.student_id || lead.status === "Enrolled") {
    return res.status(409).json({ message: "Lead này đã được chuyển thành học viên." });
  }

  const emailUsed = db.students.some(x => x.email.toLowerCase() === lead.email.toLowerCase());
  if (emailUsed) {
    return res.status(409).json({ message: "Email đã được dùng cho hồ sơ học viên khác." });
  }

  // Demo account: generate a random initial password and store only its hash.
  // A real deployment should send an activation/reset-password link by email.
  const temporaryPassword = crypto.randomBytes(12).toString("base64url");
  const student = {
    id: db.nextStudentId++,
    student_code: "HV" + String(Date.now()).slice(-8) + String(crypto.randomInt(10, 99)),
    full_name: lead.full_name,
    email: lead.email,
    phone: lead.phone,
    created_at: new Date().toISOString()
  };
  const user = {
    id: db.nextUserId++,
    student_id: student.id,
    email: student.email,
    password_hash: makePasswordHash(temporaryPassword),
    role: "student",
    created_at: new Date().toISOString()
  };

  db.students.push(student);
  db.users.push(user);
  lead.status = "Enrolled";
  lead.student_id = student.id;
  lead.converted_at = new Date().toISOString();
  writeDb(db);

  res.status(201).json({
    message: "Chuyển Lead thành hồ sơ học viên thành công.",
    student,
    account: { email: student.email, status: "created" },
    emailDelivery: "not_configured",
    note: "Bản chạy thử chưa gửi email thật. Mật khẩu ban đầu đã được tạo ngẫu nhiên và chỉ lưu dạng mã hóa."
  });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: "Lỗi máy chủ." });
});

ensureDatabase();
app.listen(PORT, () => {
  console.log(`TMS đang chạy tại http://localhost:${PORT}`);
  console.log(`Dữ liệu thử nghiệm được lưu tại: ${DATA_FILE}`);
});
