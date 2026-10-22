const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = path.join(__dirname, "backend", "data");
const DATA_FILE = path.join(DATA_DIR, "tms.json");

app.disable("x-powered-by");
app.use(express.json({ limit: "200kb" }));
app.use(express.urlencoded({ extended: false }));
app.use(session({
  name: "tms.sid",
  secret: process.env.SESSION_SECRET || "local-demo-only-change-this-secret",
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: "lax", secure: false, maxAge: 8 * 60 * 60 * 1000 }
}));

function makeSeed() {
  const users = [
    { id: "u-admin", name: "Quản trị viên", email: "admin@tms.edu.vn", role: "admin", passwordHash: bcrypt.hashSync("admin123", 10) },
    { id: "u-manager", name: "Quản lý đào tạo", email: "manager@tms.edu.vn", role: "manager", passwordHash: bcrypt.hashSync("manager123", 10) },
    { id: "u-teacher", name: "Giảng viên", email: "teacher@tms.edu.vn", role: "teacher", passwordHash: bcrypt.hashSync("teacher123", 10) },
    { id: "u-student", name: "Học viên", email: "student@tms.edu.vn", role: "student", passwordHash: bcrypt.hashSync("student123", 10) }
  ];
  return {
    users,
    classes: [
      { id: "class-wd-01", code: "WD-2026-01", name: "Lập trình Web cơ bản" },
      { id: "class-js-01", code: "JS-2026-01", name: "JavaScript thực hành" },
      { id: "class-java-01", code: "JAVA-2026-01", name: "Java nền tảng" }
    ],
    students: [
      { id: "st-001", code: "HV001", name: "Nguyễn Minh Anh", email: "minhanh@example.com", classId: "class-wd-01", status: "active", statusEffectiveDate: "2026-10-01", createdAt: new Date().toISOString() },
      { id: "st-002", code: "HV002", name: "Trần Quốc Bảo", email: "quocbao@example.com", classId: "class-wd-01", status: "active", statusEffectiveDate: "2026-10-01", createdAt: new Date().toISOString() },
      { id: "st-003", code: "HV003", name: "Lê Thu Hà", email: "thuha@example.com", classId: "class-wd-01", status: "active", statusEffectiveDate: "2026-10-01", createdAt: new Date().toISOString() },
      { id: "st-004", code: "HV004", name: "Phạm Đức Long", email: "duclong@example.com", classId: "class-js-01", status: "active", statusEffectiveDate: "2026-10-01", createdAt: new Date().toISOString() }
    ],
    statusHistory: [],
    attendance: []
  };
}

function ensureStore() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(makeSeed(), null, 2), { mode: 0o600 });
  }
}
function readStore() {
  ensureStore();
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}
function writeStore(data) {
  const tmp = DATA_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, DATA_FILE);
}
function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}
function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: "Vui lòng đăng nhập." });
  const db = readStore();
  const user = db.users.find(u => u.id === req.session.userId);
  if (!user) {
    req.session.destroy(() => {});
    return res.status(401).json({ error: "Phiên đăng nhập không còn hợp lệ." });
  }
  req.user = user;
  next();
}
function requireManager(req, res, next) {
  if (!["admin", "manager"].includes(req.user.role)) {
    return res.status(403).json({ error: "Chỉ Quản trị viên hoặc Quản lý đào tạo được thực hiện thao tác này." });
  }
  next();
}
function safeStudent(student, db) {
  const cls = db.classes.find(c => c.id === student.classId);
  return { ...student, classCode: cls ? cls.code : "Chưa xếp lớp", className: cls ? cls.name : "" };
}
function audit(db, req, student, action, before, after, reason, effectiveDate) {
  db.statusHistory.unshift({
    id: "hist-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
    studentId: student.id,
    studentCode: student.code,
    studentName: student.name,
    action,
    reason,
    effectiveDate,
    before,
    after,
    actorId: req.user.id,
    actorName: req.user.name,
    createdAt: new Date().toISOString()
  });
}

ensureStore();

app.post("/api/login", (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const db = readStore();
  const user = db.users.find(u => u.email.toLowerCase() === email);
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({ error: "Email hoặc mật khẩu không đúng." });
  }
  req.session.userId = user.id;
  res.json({ user: publicUser(user) });
});
app.post("/api/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("tms.sid");
    res.json({ ok: true });
  });
});
app.get("/api/me", requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));

app.get("/api/classes", requireAuth, (req, res) => {
  res.json({ classes: readStore().classes });
});
app.get("/api/students", requireAuth, (req, res) => {
  const db = readStore();
  const q = String(req.query.q || "").trim().toLowerCase();
  const status = String(req.query.status || "");
  const classId = String(req.query.classId || "");
  let students = db.students.map(s => safeStudent(s, db));
  if (q) students = students.filter(s => [s.code, s.name, s.email, s.classCode].some(v => String(v || "").toLowerCase().includes(q)));
  if (status) students = students.filter(s => s.status === status);
  if (classId) students = students.filter(s => s.classId === classId);
  res.json({ students });
});

// The attendance roster includes only students currently active in the selected class.
app.get("/api/attendance/roster", requireAuth, (req, res) => {
  const classId = String(req.query.classId || "");
  if (!classId) return res.status(400).json({ error: "Vui lòng chọn lớp." });
  const db = readStore();
  const cls = db.classes.find(c => c.id === classId);
  if (!cls) return res.status(404).json({ error: "Không tìm thấy lớp." });
  const students = db.students
    .filter(s => s.classId === classId && s.status === "active")
    .map(s => ({ id: s.id, code: s.code, name: s.name, status: s.status }));
  res.json({ class: cls, students, count: students.length });
});

app.post("/api/students/:id/status", requireAuth, requireManager, (req, res) => {
  const action = String(req.body.action || "");
  const reason = String(req.body.reason || "").trim();
  const effectiveDate = String(req.body.effectiveDate || "").trim();
  const targetClassId = String(req.body.targetClassId || "").trim();
  if (!["defer", "transfer", "dropout", "resume"].includes(action)) {
    return res.status(400).json({ error: "Thao tác không hợp lệ." });
  }
  if (!reason) return res.status(400).json({ error: "Vui lòng nhập lý do." });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate) || Number.isNaN(Date.parse(effectiveDate))) {
    return res.status(400).json({ error: "Ngày hiệu lực không hợp lệ." });
  }
  const db = readStore();
  const student = db.students.find(s => s.id === req.params.id);
  if (!student) return res.status(404).json({ error: "Không tìm thấy học viên." });
  const before = { status: student.status, classId: student.classId, statusEffectiveDate: student.statusEffectiveDate };
  let afterStatus = student.status;
  if (action === "defer") {
    if (student.status === "dropout") return res.status(400).json({ error: "Học viên đã thôi học. Không thể bảo lưu trực tiếp." });
    afterStatus = "deferred";
  } else if (action === "dropout") {
    afterStatus = "dropout";
  } else if (action === "resume") {
    if (student.status !== "deferred") return res.status(400).json({ error: "Chỉ học viên đang bảo lưu mới có thể học lại." });
    afterStatus = "active";
  } else if (action === "transfer") {
    if (student.status !== "active") return res.status(400).json({ error: "Chỉ học viên đang học mới có thể chuyển lớp." });
    const target = db.classes.find(c => c.id === targetClassId);
    if (!target) return res.status(400).json({ error: "Vui lòng chọn lớp đích hợp lệ." });
    if (target.id === student.classId) return res.status(400).json({ error: "Lớp đích phải khác lớp hiện tại." });
    student.classId = target.id;
    afterStatus = "active";
  }
  student.status = afterStatus;
  student.statusEffectiveDate = effectiveDate;
  student.updatedAt = new Date().toISOString();
  const after = { status: student.status, classId: student.classId, statusEffectiveDate: student.statusEffectiveDate };
  audit(db, req, student, action, before, after, reason, effectiveDate);
  writeStore(db);
  res.json({ message: "Đã cập nhật hồ sơ học viên.", student: safeStudent(student, db) });
});

app.get("/api/history", requireAuth, (req, res) => {
  const db = readStore();
  const studentId = String(req.query.studentId || "");
  let history = db.statusHistory;
  if (studentId) history = history.filter(h => h.studentId === studentId);
  res.json({ history: history.slice(0, 300) });
});

app.use(express.static(path.join(__dirname, "public")));
app.get("/", (req, res) => res.redirect("/Login.html"));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Lỗi máy chủ. Hãy kiểm tra cửa sổ terminal." });
});
app.listen(PORT, "127.0.0.1", () => {
  console.log(`TMS đang chạy: http://localhost:${PORT}/Login.html`);
  console.log("Kho dữ liệu:", DATA_FILE);
});