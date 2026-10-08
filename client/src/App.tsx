import {useEffect,useState} from "react";
import {BookOpen,CalendarDays,CheckCircle2,ChevronDown,CircleUserRound,Clock3,GraduationCap,LayoutDashboard,MoreHorizontal,Pencil,Plus,Search,Settings,ShieldCheck,Trash2,X} from "lucide-react";

type Program={id:number;code:string;name:string;description:string;duration:number;fee:number;status:"ACTIVE"|"INACTIVE";activeClasses:number};
const API="http://localhost:3001/api";
const money=(n:number)=>new Intl.NumberFormat("vi-VN").format(n)+" ₫";

export default function App(){
 const [items,setItems]=useState<Program[]>([]),[search,setSearch]=useState(""),[status,setStatus]=useState("ALL"),[open,setOpen]=useState(false),[edit,setEdit]=useState<Program|null>(null),[menu,setMenu]=useState<number|null>(null),[toast,setToast]=useState("");
 const [form,setForm]=useState({code:"",name:"",description:"",duration:"",fee:"",status:"ACTIVE"});
 const load=async()=>{const r=await fetch(`${API}/programs?search=${encodeURIComponent(search)}&status=${status}`);setItems(await r.json())};
 useEffect(()=>{load()},[search,status]);
 const notify=(s:string)=>{setToast(s);setTimeout(()=>setToast(""),2500)};
 const create=()=>{setEdit(null);setForm({code:"",name:"",description:"",duration:"",fee:"",status:"ACTIVE"});setOpen(true)};
 const editItem=(p:Program)=>{setEdit(p);setForm({code:p.code,name:p.name,description:p.description,duration:String(p.duration),fee:String(p.fee),status:p.status});setMenu(null);setOpen(true)};
 const save=async(e:React.FormEvent)=>{e.preventDefault();const r=await fetch(edit?`${API}/programs/${edit.id}`:`${API}/programs`,{method:edit?"PUT":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...form,duration:Number(form.duration),fee:Number(form.fee)})});const d=await r.json().catch(()=>({}));if(!r.ok){notify(d.message||"Có lỗi xảy ra");return}setOpen(false);notify(edit?"Đã cập nhật chương trình.":"Đã tạo chương trình.");load()};
 const deactivate=async(p:Program)=>{setMenu(null);const r=await fetch(`${API}/programs/${p.id}/deactivate`,{method:"PATCH"});const d=await r.json();if(!r.ok){notify(d.message);return}notify("Đã ngừng áp dụng.");load()};
 const remove=async(p:Program)=>{setMenu(null);if(!confirm(`Xóa chương trình ${p.code}?`))return;const r=await fetch(`${API}/programs/${p.id}`,{method:"DELETE"});if(!r.ok){const d=await r.json();notify(d.message);return}notify("Đã xóa chương trình.");load()};
 return <div className="app" onClick={()=>menu!==null&&setMenu(null)}>
  <aside><div className="brand"><div className="logo"><GraduationCap/></div><div><b>TMS</b><small>Training Management</small></div></div><nav>
   <Nav icon={<LayoutDashboard/>} text="Tổng quan"/><Nav icon={<CircleUserRound/>} text="Học viên"/><Nav icon={<CalendarDays/>} text="Lớp học & Lịch"/><Nav icon={<BookOpen/>} text="Đào tạo" active/><Nav icon={<CheckCircle2/>} text="Điểm danh"/><Nav icon={<ShieldCheck/>} text="Bài tập & Điểm"/><Nav icon={<Clock3/>} text="Học phí & Công nợ"/><Nav icon={<Settings/>} text="Hệ thống"/>
  </nav><div className="profile"><div className="avatar">QT</div><div><b>Quản lý đào tạo</b><small>Manager</small></div></div></aside>
  <main><header><div><div className="crumb">Đào tạo / Chương trình đào tạo</div><h1>Chương trình đào tạo</h1><p>Quản lý danh mục chương trình và cấu hình lộ trình đào tạo.</p></div><button className="primary" onClick={create}><Plus/> Thêm chương trình</button></header>
  <div className="stats"><Stat t="Tổng chương trình" v={items.length}/><Stat t="Đang áp dụng" v={items.filter(x=>x.status==="ACTIVE").length}/><Stat t="Ngừng áp dụng" v={items.filter(x=>x.status==="INACTIVE").length}/><Stat t="Lớp đang chạy" v={items.reduce((a,x)=>a+x.activeClasses,0)}/></div>
  <section className="card"><div className="toolbar"><div className="search"><Search/><input placeholder="Tìm theo mã hoặc tên chương trình..." value={search} onChange={e=>setSearch(e.target.value)}/></div><div className="filter"><select value={status} onChange={e=>setStatus(e.target.value)}><option value="ALL">Tất cả trạng thái</option><option value="ACTIVE">Đang áp dụng</option><option value="INACTIVE">Ngừng áp dụng</option></select><ChevronDown/></div></div>
  <div className="table"><table><thead><tr><th>Mã chương trình</th><th>Tên chương trình</th><th>Thời lượng</th><th>Học phí</th><th>Lớp đang chạy</th><th>Trạng thái</th><th/></tr></thead><tbody>{items.map(p=><tr key={p.id}><td><span className="code">{p.code}</span></td><td><b>{p.name}</b><small>{p.description}</small></td><td>{p.duration} giờ</td><td>{money(p.fee)}</td><td>{p.activeClasses}</td><td><span className={"status "+p.status}>{p.status==="ACTIVE"?"● Đang áp dụng":"● Ngừng áp dụng"}</span></td><td className="actions"><button onClick={e=>{e.stopPropagation();setMenu(menu===p.id?null:p.id)}}><MoreHorizontal/></button>{menu===p.id&&<div className="menu" onClick={e=>e.stopPropagation()}><button onClick={()=>editItem(p)}><Pencil/> Chỉnh sửa</button>{p.status==="ACTIVE"&&<button onClick={()=>deactivate(p)}><ShieldCheck/> Ngừng áp dụng</button>}<button className="danger" onClick={()=>remove(p)}><Trash2/> Xóa</button></div>}</td></tr>)}</tbody></table>{items.length===0&&<div className="empty">Không tìm thấy chương trình.</div>}</div></section>
  <div className="hint"><ShieldCheck/> Chương trình đang có lớp hoạt động không thể xóa hoặc ngừng áp dụng.</div></main>
  {open&&<div className="backdrop" onMouseDown={()=>setOpen(false)}><div className="modal" onMouseDown={e=>e.stopPropagation()}><div className="modalhead"><div><h2>{edit?"Chỉnh sửa chương trình":"Thêm chương trình đào tạo"}</h2><p>Khai báo thông tin để sử dụng khi mở lớp mới.</p></div><button onClick={()=>setOpen(false)}><X/></button></div><form onSubmit={save}><div className="grid">
   <label>Mã chương trình *<input required value={form.code} onChange={e=>setForm({...form,code:e.target.value})}/></label><label>Tên chương trình *<input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label>
   <label className="full">Mô tả<textarea rows={3} value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></label>
   <label>Tổng thời lượng (giờ) *<input required type="number" min="1" value={form.duration} onChange={e=>setForm({...form,duration:e.target.value})}/></label><label>Học phí (VNĐ) *<input required type="number" min="0" value={form.fee} onChange={e=>setForm({...form,fee:e.target.value})}/></label>
   <label className="full">Trạng thái<select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option value="ACTIVE">Đang áp dụng</option><option value="INACTIVE">Ngừng áp dụng</option></select></label>
  </div><div className="modalactions"><button type="button" className="secondary" onClick={()=>setOpen(false)}>Hủy</button><button className="primary">Lưu chương trình</button></div></form></div></div>}
  {toast&&<div className="toast">{toast}</div>}
 </div>
}
function Nav({icon,text,active=false}:{icon:React.ReactNode;text:string;active?:boolean}){return <div className={"nav "+(active?"active":"")}>{icon}<span>{text}</span></div>}
function Stat({t,v}:{t:string;v:number}){return <div className="stat"><small>{t}</small><strong>{v}</strong></div>}