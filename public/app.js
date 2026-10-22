const $ = s => document.querySelector(s);
let currentUser = null, classes = [], students = [], activeAction = null;

const statusLabels = { active: "Đang học", deferred: "Bảo lưu", dropout: "Thôi học" };
const actionLabels = { defer: "Bảo lưu", transfer: "Chuyển lớp", dropout: "Thôi học", resume: "Học lại" };
function esc(value) { return String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
async function api(url, options={}) {
  const response = await fetch(url, { credentials:"same-origin", ...options, headers: { "Content-Type":"application/json", ...(options.headers||{}) } });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) { location.href = "/Login.html"; throw new Error("Phiên đăng nhập hết hạn."); }
  if (!response.ok) throw new Error(data.error || "Có lỗi xảy ra.");
  return data;
}
function showNotice(message, type="success") { const el=$("#notice"); el.textContent=message; el.className="notice "+type; window.scrollTo({top:0,behavior:"smooth"}); setTimeout(()=>el.classList.add("hidden"),4500); }
function dateToday() { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function statusPill(status) { return `<span class="status status-${status}">${statusLabels[status] || esc(status)}</span>`; }

async function init() {
  try {
    const me = await api("/api/me"); currentUser = me.user;
    $("#whoami").textContent = `${currentUser.name} · ${currentUser.role}`;
    if (!["admin","manager"].includes(currentUser.role)) {
      showNotice("Tài khoản này chỉ xem dữ liệu. Đăng nhập bằng Quản lý hoặc Quản trị để thay đổi hồ sơ.", "failure");
    }
    const c = await api("/api/classes"); classes = c.classes;
    $("#attendanceClass").innerHTML = classes.map(x=>`<option value="${esc(x.id)}">${esc(x.code)} — ${esc(x.name)}</option>`).join("");
    $("#targetClass").innerHTML = `<option value="">-- Chọn lớp --</option>` + classes.map(x=>`<option value="${esc(x.id)}">${esc(x.code)} — ${esc(x.name)}</option>`).join("");
    await refreshAll();
  } catch (e) { if (!String(e.message).includes("Phiên")) showNotice(e.message,"failure"); }
}
async function refreshAll() { await loadStudents(); await loadRoster(); await loadHistory(); }
async function loadStudents() {
  const params = new URLSearchParams();
  if ($("#search").value.trim()) params.set("q",$("#search").value.trim());
  if ($("#statusFilter").value) params.set("status",$("#statusFilter").value);
  const data = await api("/api/students?"+params.toString()); students = data.students;
  const body=$("#studentsBody");
  if (!students.length) { body.innerHTML='<tr><td colspan="6">Không tìm thấy học viên phù hợp.</td></tr>'; return; }
  body.innerHTML=students.map(s=>{
    let actions="";
    if (["admin","manager"].includes(currentUser.role)) {
      if (s.status==="active") actions=`<button class="secondary" data-action="defer" data-id="${esc(s.id)}">Bảo lưu</button><button class="secondary" data-action="transfer" data-id="${esc(s.id)}">Chuyển lớp</button><button class="secondary" data-action="dropout" data-id="${esc(s.id)}">Thôi học</button>`;
      if (s.status==="deferred") actions=`<button class="secondary" data-action="resume" data-id="${esc(s.id)}">Học lại</button><button class="secondary" data-action="dropout" data-id="${esc(s.id)}">Thôi học</button>`;
    }
    return `<tr><td><b>${esc(s.code)}</b></td><td><div class="student-name">${esc(s.name)}</div><div class="subline">${esc(s.email)}</div></td><td><div>${esc(s.classCode)}</div><div class="subline">${esc(s.className)}</div></td><td>${statusPill(s.status)}</td><td>${esc(s.statusEffectiveDate||"—")}</td><td><div class="action-buttons">${actions||"—"}</div></td></tr>`;
  }).join("");
}
async function loadRoster() {
  const classId=$("#attendanceClass").value; if(!classId) return;
  const data=await api("/api/attendance/roster?classId="+encodeURIComponent(classId));
  $("#rosterSummary").textContent=`${data.class.code}: ${data.count} học viên đang học`;
  $("#roster").innerHTML=data.students.length ? data.students.map(s=>`<li><b>${esc(s.code)}</b> — ${esc(s.name)} ${statusPill(s.status)}</li>`).join("") : '<li class="empty">Không có học viên đang học trong lớp này.</li>';
}
async function loadHistory() {
  const data=await api("/api/history");
  $("#historyList").innerHTML=data.history.length ? data.history.map(h=>`<div class="history-item"><div class="history-title">${esc(h.studentCode)} · ${esc(h.studentName)} — ${esc(actionLabels[h.action]||h.action)}</div><div class="history-meta">${esc(h.actorName)} · ${new Date(h.createdAt).toLocaleString("vi-VN")} · Hiệu lực ${esc(h.effectiveDate)}</div><div class="history-reason">Lý do: ${esc(h.reason)}<br>Trạng thái: ${esc(statusLabels[h.before.status])} → ${esc(statusLabels[h.after.status])}${h.before.classId!==h.after.classId ? " · Lớp đã thay đổi":""}</div></div>`).join("") : '<p class="muted">Chưa có lịch sử thao tác.</p>';
}
function openAction(id, action) {
  const student=students.find(s=>s.id===id); if(!student) return;
  activeAction=action; $("#studentId").value=id; $("#dialogTitle").textContent=actionLabels[action];
  $("#selectedStudent").textContent=`${student.code} — ${student.name} · Lớp hiện tại: ${student.classCode}`;
  $("#effectiveDate").value=dateToday(); $("#reason").value=""; $("#dialogError").textContent="";
  $("#targetWrap").classList.toggle("hidden",action!=="transfer");
  $("#targetClass").value="";
  $("#actionDialog").showModal();
}
async function submitAction(e) {
  e.preventDefault(); $("#dialogError").textContent="";
  const body={action:activeAction,effectiveDate:$("#effectiveDate").value,reason:$("#reason").value.trim(),targetClassId:$("#targetClass").value};
  try {
    const data=await api("/api/students/"+encodeURIComponent($("#studentId").value)+"/status",{method:"POST",body:JSON.stringify(body)});
    $("#actionDialog").close(); showNotice(data.message); await refreshAll();
  } catch(err) { $("#dialogError").textContent=err.message; }
}
$("#studentsBody").addEventListener("click",e=>{const b=e.target.closest("button[data-action]");if(b)openAction(b.dataset.id,b.dataset.action);});
$("#actionForm").addEventListener("submit",submitAction);
$("#closeDialog").addEventListener("click",()=>$("#actionDialog").close());
$("#cancelAction").addEventListener("click",()=>$("#actionDialog").close());
$("#refresh").addEventListener("click",()=>refreshAll().catch(e=>showNotice(e.message,"failure")));
$("#historyRefresh").addEventListener("click",()=>loadHistory().catch(e=>showNotice(e.message,"failure")));
$("#attendanceClass").addEventListener("change",()=>loadRoster().catch(e=>showNotice(e.message,"failure")));
$("#search").addEventListener("input",()=>loadStudents().catch(e=>showNotice(e.message,"failure")));
$("#statusFilter").addEventListener("change",()=>loadStudents().catch(e=>showNotice(e.message,"failure")));
$("#logout").addEventListener("click",async()=>{try{await api("/api/logout",{method:"POST"});}finally{location.href="/Login.html";}});
init();