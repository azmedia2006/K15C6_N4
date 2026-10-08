import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataFile = path.join(__dirname, "../data/programs.json");

const app = express();
app.use(cors());
app.use(express.json());

const readPrograms = () => JSON.parse(fs.readFileSync(dataFile, "utf8"));
const writePrograms = (data) => fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));

app.get("/api/health", (_, res) => res.json({ ok: true, service: "TMS API" }));

app.get("/api/programs", (req, res) => {
  let programs = readPrograms();
  const q = String(req.query.search || "").toLowerCase().trim();
  const status = req.query.status || "ALL";
  if (q) programs = programs.filter(p => p.code.toLowerCase().includes(q) || p.name.toLowerCase().includes(q));
  if (status !== "ALL") programs = programs.filter(p => p.status === status);
  res.json(programs);
});

app.post("/api/programs", (req, res) => {
  const { code, name, description = "", duration, fee = 0, status = "ACTIVE" } = req.body;
  if (!code || !name || !duration || Number(duration) <= 0 || Number(fee) < 0)
    return res.status(400).json({ message: "Dữ liệu không hợp lệ." });

  const programs = readPrograms();
  const normalizedCode = String(code).trim().toUpperCase();
  if (programs.some(p => p.code === normalizedCode))
    return res.status(409).json({ message: "Mã chương trình đã tồn tại." });

  const item = {
    id: Math.max(0, ...programs.map(p => p.id)) + 1,
    code: normalizedCode,
    name: String(name).trim(),
    description: String(description).trim(),
    duration: Number(duration),
    fee: Number(fee),
    status: status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
    activeClasses: 0
  };
  programs.push(item);
  writePrograms(programs);
  res.status(201).json(item);
});

app.put("/api/programs/:id", (req, res) => {
  const id = Number(req.params.id);
  const programs = readPrograms();
  const index = programs.findIndex(p => p.id === id);
  if (index < 0) return res.status(404).json({ message: "Không tìm thấy chương trình." });

  const old = programs[index];
  const { code, name, description = "", duration, fee = 0, status = "ACTIVE" } = req.body;
  const normalizedCode = String(code || "").trim().toUpperCase();

  if (!normalizedCode || !name || !duration || Number(duration) <= 0 || Number(fee) < 0)
    return res.status(400).json({ message: "Dữ liệu không hợp lệ." });

  if (programs.some(p => p.code === normalizedCode && p.id !== id))
    return res.status(409).json({ message: "Mã chương trình đã tồn tại." });

  programs[index] = {
    ...old, code: normalizedCode, name: String(name).trim(),
    description: String(description).trim(), duration: Number(duration),
    fee: Number(fee), status: status === "INACTIVE" ? "INACTIVE" : "ACTIVE"
  };
  writePrograms(programs);
  res.json(programs[index]);
});

app.patch("/api/programs/:id/deactivate", (req, res) => {
  const id = Number(req.params.id);
  const programs = readPrograms();
  const item = programs.find(p => p.id === id);
  if (!item) return res.status(404).json({ message: "Không tìm thấy chương trình." });
  if (item.activeClasses > 0)
    return res.status(409).json({ message: "Không thể ngừng áp dụng vì chương trình đang có lớp hoạt động." });
  item.status = "INACTIVE";
  writePrograms(programs);
  res.json(item);
});

app.delete("/api/programs/:id", (req, res) => {
  const id = Number(req.params.id);
  const programs = readPrograms();
  const item = programs.find(p => p.id === id);
  if (!item) return res.status(404).json({ message: "Không tìm thấy chương trình." });
  if (item.activeClasses > 0)
    return res.status(409).json({ message: "Không thể xóa chương trình đang có lớp hoạt động." });
  writePrograms(programs.filter(p => p.id !== id));
  res.status(204).end();
});

app.listen(3001, () => {
  console.log("TMS API đang chạy: http://localhost:3001");
});