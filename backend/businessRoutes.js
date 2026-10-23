'use strict';
const {randomUUID}=require('crypto');
const db=require('./localDatabase'),auth=require('./authService'),roles=require('./roleService'),enrollment=require('./enrollmentService'),subjects=require('./subjectService');
const schedule=()=>require('./scheduleService');
let state={courses:[],assignments:[],scores:[],invoices:[],receipts:[],requests:[],leadAssignments:[],leadHistory:[]};
db.register('business',()=>state,v=>state={...state,...v});
const role=(u,...codes)=>codes.some(code=>u.role===code||(u.roles||[]).some(r=>(r.code||r.id)===code));
const manager=u=>role(u,'administrator','training_manager');
const studentIds=id=>[...new Set([...(schedule().getRoster(id)||[]).map(u=>u.id),...enrollment.getEnrollmentsList().filter(e=>e.classId===id).map(e=>e.studentId)])];
function canSeeClass(u, id) {
    if (manager(u) || role(u, 'admissions', 'accountant')) {
        return true;
    }

    const cls = schedule()
        .getClassesWithScheduleStatus()
        .find(c => c.id === id) || enrollment.findClass(id);

    if (!cls) return false;

    const belongsToClass = studentIds(id).includes(u.id);

    // KN-252: Học viên chỉ xem lớp mình đang tham gia.
    if (role(u, 'student')) {
        return belongsToClass;
    }

    if (belongsToClass) return true;

    // Giữ quyền xem lớp của giảng viên phụ trách.
    if (
        cls.instructorId === u.id ||
        cls.instructor === u.name ||
        cls.instructorName === u.name
    ) {
        return true;
    }

    return schedule().getClassSchedule(id).some(s =>
        s.instructorId === u.id ||
        s.instructor === u.name
    );
}
function canSeeSession(u, s) {
    if (manager(u)) return true;

    const belongsToClass = studentIds(s.classId).includes(u.id);

    // KN-252: Học viên chỉ xem lịch của lớp mình tham gia.
    if (role(u, 'student')) {
        return belongsToClass;
    }

    // Giữ cơ chế xem lịch hiện có cho các vai trò khác.
    return belongsToClass ||
        s.instructorId === u.id ||
        s.instructor === u.name;
}
function must(ok,message,status=400){if(!ok)throw Object.assign(new Error(message),{status});}
const text=(value,label,max=255)=>{must(typeof value==='string'&&value.trim()&&value.trim().length<=max,label+' không hợp lệ.');return value.trim()};
function classExists(id){const cls=schedule().getClassesWithScheduleStatus().find(c=>c.id===id)||enrollment.findClass(id);must(cls,'Không tìm thấy lớp.',404);return cls;}
function student(id){const u=auth.users.find(u=>u.id===id&&(u.role==='student'||roles.userHasRole(u.id,'student')));must(u,'Không tìm thấy học viên.',404);return u;}
function seesRow(u,row,kind){if(manager(u)||role(u,kind==='invoice'?'accountant':'instructor')){if(kind==='score'&&role(u,'instructor')&&!manager(u))return canSeeClass(u,row.classId);return true;}return row.studentId===u.id;}
function safeUser(u){return{id:u.id,name:u.name,email:u.email,role:u.role,status:u.status||'active'}}
function mergeClasses(){const all=new Map();for(const c of [...enrollment.exportState().classes,...subjects.exportState().classes,...db.snapshot().schedules.activeClasses]){all.set(c.id,{...(all.get(c.id)||{}),...c});}for(const c of all.values()){c.maxCapacity=c.maxCapacity||35;c.instructorName=c.instructorName||c.instructor||'';schedule().upsertSharedClass(c);subjects.upsertSharedClass(c);enrollment.upsertSharedClass(c);if(!db.hasPersisted('enrollments')&&c.studentIds)enrollment.syncLinkedRoster(c.id,c.studentIds);}}
function workspace(user){const all=schedule().getClassesWithScheduleStatus().filter(c=>canSeeClass(user,c.id));const ids=new Set(all.map(c=>c.id));return {success:true,mode:'local',classes:all,people:auth.users.filter(u=>role(user,'administrator','training_manager','admissions','accountant')||u.id===user.id||all.some(c=>studentIds(c.id).includes(u.id))||(u.role==='instructor'&&ids.size)).map(safeUser),courses:[...subjects.getAllPrograms(),...state.courses],sessions:schedule().getSchedules().filter(s=>canSeeSession(user,s)),assignments:state.assignments.filter(a=>manager(user)||a.teacherId===user.id||ids.has(a.classId)),scores:state.scores.filter(r=>seesRow(user,r,'score')),invoices:state.invoices.filter(r=>seesRow(user,r,'invoice')),receipts:state.receipts.filter(r=>manager(user)||role(user,'accountant')||r.studentId===user.id),requests:state.requests.filter(r=>manager(user)||r.actorId===user.id),instructors:auth.users.filter(u=>u.role==='instructor'||roles.userHasRole(u.id,'instructor')).map(safeUser)};}
function mount(app,{authenticateToken,requireRole}){
    enrollment.pruneOrphanedRoster();
    mergeClasses();
    const wrap=fn=>(req,res)=>{try{res.json(fn(req))}catch(e){res.status(e.status||400).json({success:false,message:e.message})}};
    const guard=(...codes)=>[authenticateToken,requireRole(...codes)];
    app.post('/api/admin/users/:id/reset-password',...guard('administrator'),wrap(req=>{const user=auth.users.find(u=>u.id===req.params.id);must(user,'Không tìm thấy tài khoản.',404);auth.validatePassword(req.body.newPassword);const reason=text(req.body.reason,'Lý do',1000);user.salt=auth.generateSalt();user.passwordHash=auth.hashPassword(req.body.newPassword,user.salt);auth.revokeUserSessions(user.id);roles.recordAuditLog({adminId:req.user.id,targetUserId:user.id,action:'ADMIN_PASSWORD_RESET',reason});return{success:true,message:'Đã đặt lại mật khẩu và thu hồi phiên cũ. Hãy cung cấp mật khẩu qua kênh an toàn.'}}));
    app.get('/api/attendance/students',...guard('administrator','training_manager','instructor','teaching_assistant'),wrap(req=>{require('./studentService').ensureStudentProfiles();const records=db.snapshot().schedules.attendanceRecords||[];const ids=new Set(schedule().getClassesWithScheduleStatus().filter(c=>canSeeClass(req.user,c.id)).flatMap(c=>studentIds(c.id)));return{success:true,data:auth.users.filter(u=>ids.has(u.id)).map(u=>{const rows=records.flatMap(r=>r.students).filter(x=>x.studentId===u.id);return{id:u.id,name:u.name,email:u.email,studentCode:u.studentCode||u.id,avatar:u.avatar||'',thumbnail:u.thumbnail||'',attendanceRate:rows.length?Math.round(rows.filter(r=>['present','late'].includes(r.status)).length/rows.length*100):null,status:rows.at(-1)?.status||'not_recorded'};})}}));
    app.get('/api/workspace',authenticateToken,wrap(req=>workspace(req.user)));
    app.get('/api/classes',authenticateToken,wrap(req=>{const data=enrollment.getAllClasses(req.query).filter(c=>canSeeClass(req.user,c.id));return{success:true,total:data.length,data,classes:data}}));
    app.get('/api/courses',authenticateToken,wrap(req=>({success:true,data:workspace(req.user).courses})));
    app.post('/api/courses',...guard('administrator','training_manager'),wrap(req=>{const b=req.body;const code=text(b.code,'Mã khóa',32);must(![...subjects.getAllPrograms(),...state.courses].some(c=>c.code===code),'Mã khóa đã tồn tại.',409);const value={id:randomUUID(),code,name:text(b.name,'Tên khóa'),description:String(b.description||'').slice(0,2000),createdAt:new Date().toISOString()};state.courses.push(value);return{success:true,data:value}}));
    app.post('/api/classes',...guard('administrator','training_manager'),wrap(req=>{const b=req.body;must(subjects.getSubjectById(b.subjectId),'Môn học không hợp lệ.');must(auth.users.some(u=>u.id===b.instructorId&&(u.role==='instructor'||roles.userHasRole(u.id,'instructor'))),'Phải chọn tài khoản giảng viên.');must(Number.isInteger(Number(b.maxCapacity||35))&&Number(b.maxCapacity||35)>0&&Number(b.maxCapacity||35)<=500,'Sĩ số phải từ 1 đến 500.');const user=auth.users.find(u=>u.id===b.instructorId);const cls=schedule().createClass({...b,name:text(b.name,'Tên lớp'),code:text(b.code,'Mã lớp'),instructor:user.name});Object.assign(cls,{instructorId:user.id,maxCapacity:Number(b.maxCapacity)||35});must(Number.isInteger(cls.maxCapacity)&&cls.maxCapacity>0&&cls.maxCapacity<=500,'Sĩ số phải từ 1 đến 500.');schedule().upsertSharedClass(cls);enrollment.upsertSharedClass(cls);subjects.upsertSharedClass(cls);return{success:true,data:cls}}));
    app.get('/api/scores',authenticateToken,wrap(req=>({success:true,data:state.scores.filter(r=>seesRow(req.user,r,'score'))})));
    app.get('/api/scores/:id',authenticateToken,wrap(req=>{const row=state.scores.find(r=>r.id===req.params.id);must(row&&seesRow(req.user,row,'score'),'Không tìm thấy điểm trong phạm vi được xem.',404);return{success:true,data:row}}));
    app.put('/api/scores/:id',...guard('administrator','instructor'),wrap(req=>{const row=state.scores.find(r=>r.id===req.params.id);must(row,'Không tìm thấy điểm.',404);must(seesRow(req.user,row,'score'),'Không có quyền sửa điểm.',403);must(typeof req.body.score==='number'&&Number.isFinite(req.body.score)&&req.body.score>=0&&req.body.score<=10,'Điểm phải từ 0 đến 10.');Object.assign(row,{score:req.body.score,updatedBy:req.user.id,updatedAt:new Date().toISOString()});return{success:true,data:row}}));
    app.post('/api/assignments',...guard('administrator','instructor'),wrap(req=>{const b=req.body;classExists(b.classId);must(canSeeClass(req.user,b.classId),'Không phụ trách lớp này.',403);must(/^\d{4}-\d{2}-\d{2}$/.test(b.dueDate)&&!isNaN(Date.parse(b.dueDate))&&new Date(b.dueDate).toISOString().slice(0,10)===b.dueDate,'Hạn nộp không hợp lệ.');const a={id:randomUUID(),classId:b.classId,title:text(b.title,'Tiêu đề'),dueDate:b.dueDate,rubric:text(b.rubric,'Tiêu chí chấm',2000),teacherId:req.user.id,createdAt:new Date().toISOString()};state.assignments.push(a);return{success:true,data:a}}));
    app.post('/api/scores',...guard('administrator','instructor'),wrap(req=>{const b=req.body;student(b.studentId);const assignment=state.assignments.find(a=>a.id===b.assignmentId);must(assignment,'Không tìm thấy bài tập.',404);must(canSeeClass(req.user,assignment.classId),'Không phụ trách lớp này.',403);must(studentIds(assignment.classId).includes(b.studentId),'Học viên không thuộc lớp.');must(typeof b.score==='number'&&Number.isFinite(b.score)&&b.score>=0&&b.score<=10,'Điểm phải từ 0 đến 10.');let row=state.scores.find(s=>s.assignmentId===b.assignmentId&&s.studentId===b.studentId);if(!row){row={id:randomUUID(),assignmentId:b.assignmentId,studentId:b.studentId,classId:assignment.classId};state.scores.push(row)}Object.assign(row,{score:b.score,comment:String(b.comment||'').slice(0,2000),updatedBy:req.user.id,updatedAt:new Date().toISOString()});return{success:true,data:row}}));
    app.get('/api/tuition',authenticateToken,wrap(req=>({success:true,data:state.invoices.filter(r=>seesRow(req.user,r,'invoice'))})));
    app.get('/api/tuition/:id',authenticateToken,wrap(req=>{const row=state.invoices.find(r=>r.id===req.params.id);must(row&&seesRow(req.user,row,'invoice'),'Không tìm thấy học phí trong phạm vi được xem.',404);return{success:true,data:row}}));
    app.post('/api/tuition',...guard('administrator','accountant'),wrap(req=>{const b=req.body;student(b.studentId);classExists(b.classId);must(studentIds(b.classId).includes(b.studentId),'Học viên không thuộc lớp.');must(Number.isSafeInteger(b.amount)&&b.amount>0,'Học phí phải là số nguyên dương (VND).');must(!state.invoices.some(i=>i.studentId===b.studentId&&i.classId===b.classId),'Học viên đã có khoản học phí của lớp này.',409);const row={id:randomUUID(),studentId:b.studentId,classId:b.classId,amount:b.amount,paid:0,status:'unpaid',createdAt:new Date().toISOString()};state.invoices.push(row);return{success:true,data:row}}));
    app.put('/api/tuition/:id',...guard('administrator','accountant'),wrap(req=>{const row=state.invoices.find(r=>r.id===req.params.id);must(row,'Không tìm thấy khoản học phí.',404);must(Number.isSafeInteger(req.body.amount)&&req.body.amount>=row.paid&&req.body.amount>0,'Tổng học phí không được thấp hơn số đã thu.');row.amount=req.body.amount;row.status=row.paid===row.amount?'paid':row.paid?'partial':'unpaid';return{success:true,data:row}}));
    app.post('/api/receipts',...guard('administrator','accountant'),wrap(req=>{const b=req.body,row=state.invoices.find(r=>r.id===b.invoiceId);must(row,'Không tìm thấy học phí.',404);must(Number.isSafeInteger(b.amount)&&b.amount>0&&b.amount<=row.amount-row.paid,'Số tiền thu phải dương và không vượt công nợ.');must(['cash','bank'].includes(b.method),'Phương thức phải là cash hoặc bank.');const receipt={id:randomUUID(),code:'PT-'+Date.now(),invoiceId:row.id,studentId:row.studentId,classId:row.classId,amount:b.amount,method:b.method,actorId:req.user.id,createdAt:new Date().toISOString()};state.receipts.push(receipt);row.paid+=b.amount;row.status=row.paid===row.amount?'paid':'partial';return{success:true,data:receipt}}));
    app.post('/api/workflow-requests',...guard('administrator','training_manager'),wrap(req=>{const b=req.body;must(['certificate','fee_reservation','substitute'].includes(b.type),'Loại đề nghị không hợp lệ.');classExists(b.classId);if(b.studentId){student(b.studentId);must(studentIds(b.classId).includes(b.studentId),'Học viên không thuộc lớp.');}const row={id:randomUUID(),type:b.type,classId:b.classId,studentId:b.studentId||null,reason:text(b.reason,'Nội dung',2000),status:'pending',actorId:req.user.id,createdAt:new Date().toISOString()};state.requests.push(row);return{success:true,data:row,message:'Đã ghi nhận đề nghị chờ duyệt; chưa cấp chứng chỉ hoặc chuyển học phí.'}}));
    app.patch('/api/workflow-requests/:id',...guard('administrator','training_manager'),wrap(req=>{const row=state.requests.find(r=>r.id===req.params.id);must(row,'Không tìm thấy đề nghị.',404);must(row.status==='pending','Đề nghị đã được xử lý.',409);must(['approved','rejected'].includes(req.body.status),'Trạng thái duyệt không hợp lệ.');const reviewNote=text(req.body.note,'Ghi chú duyệt',2000);row.status=req.body.status;row.reviewedBy=req.user.id;row.reviewNote=reviewNote;return{success:true,data:row,message:'Đã lưu kết quả duyệt. Đây là bản ghi phê duyệt nội bộ, không phải chứng chỉ/phát sinh chuyển tiền tự động.'}}));
    app.get('/api/admin/mail',...guard('administrator','technical_manager'),wrap(()=>({success:true,configured:require('./emailService').isConfigured(),data:require('./emailService').sentEmails})));
    app.get('/api/reports/summary',authenticateToken,wrap(req=>{const w=workspace(req.user);return{success:true,generatedAt:new Date().toISOString(),scope:'Dữ liệu trong phạm vi tài khoản',classes:w.classes.length,students:new Set(w.classes.flatMap(c=>studentIds(c.id))).size,sessions:w.sessions.length,assignments:w.assignments.length,invoiced:w.invoices.reduce((a,r)=>a+r.amount,0),collected:w.receipts.reduce((a,r)=>a+r.amount,0),debt:w.invoices.reduce((a,r)=>a+r.amount-r.paid,0)}}));
    // Local, persistent KN-75 adapter. Existing Postgres router remains available in integrated mode.
    if(process.env.TMS_OFFLINE==='true'){
        app.get('/api/kn75/counselors',...guard('administrator','training_manager'),wrap(()=>({success:true,data:auth.users.filter(u=>u.role==='admissions'&&(u.status||'active')==='active').map(safeUser)})));
        app.get(['/api/kn75/leads','/api/kn75/my-leads'],...guard('administrator','training_manager','admissions'),wrap(req=>{const all=require('./leadService').getLeads({limit:100}).data;return{success:true,data:all.filter(l=>manager(req.user)||state.leadAssignments.some(a=>a.leadId===l.id&&a.userId===req.user.id)).map(l=>({...l,assignedTo:state.leadAssignments.find(a=>a.leadId===l.id)?.userId||null}))}}));
        app.post('/api/kn75/assignments',...guard('administrator','training_manager'),wrap(req=>{const {lead_ids:ids,tu_van_vien_id:id,reason}=req.body;must(Array.isArray(ids)&&ids.length&&ids.length<=1000,'Danh sách lead không hợp lệ.');must(auth.users.some(u=>u.id===id&&u.role==='admissions'&&(u.status||'active')==='active'),'Tư vấn viên không hợp lệ.');const ok=[],failed=[],seen=new Set();for(const leadId of ids){const lead=require('./leadService').getLeadById(leadId);let old=state.leadAssignments.find(a=>a.leadId===leadId);if(seen.has(leadId)||!lead||old?.userId===id){failed.push({lead_id:leadId,code:'INVALID_OR_DUPLICATE'});continue;}seen.add(leadId);state.leadHistory.push({id:randomUUID(),leadId,from:old?.userId||null,to:id,reason:String(reason||'').slice(0,500),actorId:req.user.id,at:new Date().toISOString()});if(old)old.userId=id;else state.leadAssignments.push({leadId,userId:id});lead.assignedTo=id;ok.push({lead_id:leadId})}return{success:true,successful:ok,failed,summary:{requested:ids.length,successful:ok.length,failed:failed.length}}}));
        app.get(['/api/kn75/leads/:id/history','/api/kn75/my-leads/:id/history'],...guard('administrator','training_manager','admissions'),wrap(req=>{must(manager(req.user)||state.leadAssignments.some(a=>a.leadId===req.params.id&&a.userId===req.user.id),'Không tìm thấy lead.',404);return{success:true,data:state.leadHistory.filter(a=>a.leadId===req.params.id)}}));
    }
}
module.exports=mount;Object.assign(module.exports,{canSeeClass,canSeeSession,studentIds,mergeClasses,workspace,role});
