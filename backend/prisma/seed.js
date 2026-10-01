const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('=== KHỞI TẠO TOÀN DIỆN DỮ LIỆU TMS TRÊN SUPABASE ===');

  const defaultPassword = await bcrypt.hash('123456', 10);

  // 1. NGƯỜI DÙNG & VAI TRÒ
  const usersData = [
    { email: 'admin@tms.edu.vn', fullName: 'Quản trị viên Hệ thống', role: 'ADMIN', phone: '0901111111' },
    { email: 'manager@tms.edu.vn', fullName: 'Quản lý Đào tạo Phạm Hoàng', role: 'ACADEMIC_MANAGER', phone: '0902222222' },
    { email: 'teacher@tms.edu.vn', fullName: 'Thầy Nguyễn Văn An', role: 'LECTURER', phone: '0903333333' },
    { email: 'ta@tms.edu.vn', fullName: 'Trợ giảng Trần Thị Bích', role: 'TA', phone: '0904444444' },
    { email: 'admissions@tms.edu.vn', fullName: 'Tư vấn Lê Hồng Phúc', role: 'ADMISSIONS', phone: '0905555555' },
    { email: 'accountant@tms.edu.vn', fullName: 'Kế toán Hoàng Thu Trang', role: 'ACCOUNTANT', phone: '0906666666' },
    { email: 'student1@tms.edu.vn', fullName: 'Học viên Đặng Minh Khôi', role: 'STUDENT', phone: '0907777771' },
    { email: 'student2@tms.edu.vn', fullName: 'Học viên Vũ Hải Đăng', role: 'STUDENT', phone: '0907777772' },
    { email: 'student3@tms.edu.vn', fullName: 'Học viên Phạm Ngọc Mai', role: 'STUDENT', phone: '0907777773' },
    { email: 'student4@tms.edu.vn', fullName: 'Học viên Bùi Tuấn Kiệt', role: 'STUDENT', phone: '0907777774' },
  ];

  const userMap = {};
  for (const u of usersData) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { fullName: u.fullName, role: u.role, phone: u.phone },
      create: { ...u, password: defaultPassword },
    });
    userMap[u.email] = user;
    console.log(`- Tài khoản: ${u.email} [${u.role}]`);
  }

  // 2. CHƯƠNG TRÌNH & MÔN HỌC & BUỔI HỌC MẪU
  const program = await prisma.program.upsert({
    where: { code: 'FS-JS' },
    update: {},
    create: {
      code: 'FS-JS',
      name: 'Chuyên gia Lập trình Web Fullstack JavaScript & TypeScript',
      description: 'Chương trình đào tạo từ cơ bản đến nâng cao: React, Node.js, PostgreSQL và DevOps.',
    },
  });

  const courseReact = await prisma.course.upsert({
    where: { code: 'JS-REACT' },
    update: {},
    create: {
      programId: program.id,
      code: 'JS-REACT',
      name: 'Lập trình Frontend Hiện đại với React & Tailwind CSS',
      credits: 3,
    },
  });

  // Tạo buổi học mẫu cho môn React
  const sessionTemplates = [
    { sessionNo: 1, title: 'Tổng quan React, JSX & Component Architecture' },
    { sessionNo: 2, title: 'State Management: useState, useEffect & Custom Hooks' },
    { sessionNo: 3, title: 'Routing, Data Fetching & Axios Interceptor' },
    { sessionNo: 4, title: 'Xây dựng UI Responsive Mobile-first với Tailwind' },
    { sessionNo: 5, title: 'Đồ án cuối môn & Đánh giá năng lực' },
  ];

  for (const s of sessionTemplates) {
    const existing = await prisma.courseSessionTemplate.findFirst({
      where: { courseId: courseReact.id, sessionNo: s.sessionNo },
    });
    if (!existing) {
      await prisma.courseSessionTemplate.create({
        data: { courseId: courseReact.id, ...s },
      });
    }
  }

  // 3. LỚP HỌC & LỊCH HỌC
  const classObj = await prisma.class.upsert({
    where: { code: 'FS-K24-01' },
    update: {},
    create: {
      code: 'FS-K24-01',
      name: 'Fullstack JS K24 - Lớp Tối 2-4-6',
      programId: program.id,
      courseId: courseReact.id,
      lecturerId: userMap['teacher@tms.edu.vn'].id,
      taId: userMap['ta@tms.edu.vn'].id,
      room: 'Phòng Lab 204',
      startDate: new Date('2026-09-15T00:00:00Z'),
      status: 'IN_PROGRESS',
    },
  });

  // Tạo 4 buổi học cụ thể trong lịch
  const schedulesData = [
    { sessionNo: 1, title: 'Buổi 1: Tổng quan React & Cài đặt môi trường', date: new Date('2026-09-16T18:30:00Z'), startTime: '18:30', endTime: '21:00' },
    { sessionNo: 2, title: 'Buổi 2: State, Hooks & Life Cycle', date: new Date('2026-09-18T18:30:00Z'), startTime: '18:30', endTime: '21:00' },
    { sessionNo: 3, title: 'Buổi 3: Axios Interceptor, Session Auth & Form UX', date: new Date('2026-09-21T18:30:00Z'), startTime: '18:30', endTime: '21:00' },
    { sessionNo: 4, title: 'Buổi 4: Mobile-first Responsive & Chấm điểm Rubric', date: new Date('2026-09-23T18:30:00Z'), startTime: '18:30', endTime: '21:00' },
  ];

  const scheduleList = [];
  for (const sc of schedulesData) {
    let sched = await prisma.classSchedule.findFirst({
      where: { classId: classObj.id, sessionNo: sc.sessionNo },
    });
    if (!sched) {
      sched = await prisma.classSchedule.create({
        data: { classId: classObj.id, room: 'Phòng Lab 204', ...sc },
      });
    }
    scheduleList.push(sched);
  }

  // 4. GHI DANH HỌC VIÊN
  const students = [
    userMap['student1@tms.edu.vn'],
    userMap['student2@tms.edu.vn'],
    userMap['student3@tms.edu.vn'],
    userMap['student4@tms.edu.vn'],
  ];

  for (const st of students) {
    await prisma.enrollment.upsert({
      where: { userId_classId: { userId: st.id, classId: classObj.id } },
      update: {},
      create: {
        userId: st.id,
        classId: classObj.id,
        status: 'ENROLLED',
      },
    });
  }

  // 5. ĐIỂM DANH (ATTENDANCE) CHO BUỔI 1 & BUỔI 2
  // Cố tình tạo kịch bản: student4 vắng 2 buổi liên tiếp -> Kích hoạt cảnh báo nguy cơ bỏ học!
  const attendanceScenarios = [
    { schedule: scheduleList[0], results: [
      { userId: students[0].id, status: 'PRESENT' },
      { userId: students[1].id, status: 'PRESENT' },
      { userId: students[2].id, status: 'PRESENT' },
      { userId: students[3].id, status: 'ABSENT', note: 'Vắng không phép buổi 1' },
    ]},
    { schedule: scheduleList[1], results: [
      { userId: students[0].id, status: 'PRESENT' },
      { userId: students[1].id, status: 'PRESENT' },
      { userId: students[2].id, status: 'EXCUSED', note: 'Có đơn xin phép bận việc gia đình' },
      { userId: students[3].id, status: 'ABSENT', note: 'Tiếp tục vắng không phép buổi 2' },
    ]},
  ];

  for (const item of attendanceScenarios) {
    for (const r of item.results) {
      await prisma.attendance.upsert({
        where: { scheduleId_userId: { scheduleId: item.schedule.id, userId: r.userId } },
        update: { status: r.status, note: r.note },
        create: { scheduleId: item.schedule.id, userId: r.userId, status: r.status, note: r.note },
      });
    }
  }

  // 6. BÀI TẬP & CHẤM ĐIỂM THEO RUBRIC
  const assignment = await prisma.assignment.create({
    data: {
      courseId: courseReact.id,
      title: 'Lab 01: Thiết kế giao diện Điểm danh Mobile-first & Silent Refresh',
      description: 'Xây dựng giao diện điểm danh tối ưu màn hình từ 360px, tốc độ thao tác <= 60s, có cơ chế Re-login khi hết phiên.',
      deadline: new Date('2026-10-10T23:59:59Z'),
      maxScore: 100,
      rubricJson: JSON.stringify([
        { criterion: 'Giao diện Mobile Responsive (>= 360px)', maxPoints: 30 },
        { criterion: 'Xử lý gia hạn phiên tự động (Sliding session)', maxPoints: 35 },
        { criterion: 'Cơ chế lưu nháp form khi mất phiên (Draft save)', maxPoints: 35 },
      ]),
    },
  });

  // Bài nộp mẫu
  await prisma.submission.create({
    data: {
      assignmentId: assignment.id,
      userId: students[0].id,
      version: 1,
      contentUrl: 'https://github.com/khoi-dang/tms-mobile-attendance',
      score: 95,
      rubricScore: JSON.stringify({ 'Giao diện Mobile': 28, 'Sliding session': 35, 'Draft save': 32 }),
      feedback: 'Làm rất tốt! Giao diện trên điện thoại bấm mượt mà, lưu nháp hoàn hảo.',
      needsRedo: false,
      gradedAt: new Date(),
    },
  });

  await prisma.submission.create({
    data: {
      assignmentId: assignment.id,
      userId: students[1].id,
      version: 1,
      contentUrl: 'https://github.com/haidang/tms-lab1',
      score: 60,
      feedback: 'Chưa hỗ trợ kích thước màn hình nhỏ 360px, yêu cầu tối ưu lại CSS.',
      needsRedo: true, // Yêu cầu làm lại
    },
  });

  // 7. HỌC PHÍ & CÔNG NỢ (100% khớp thực tế)
  // student1: Đã đóng đủ
  await prisma.tuitionRecord.upsert({
    where: { userId_classId: { userId: students[0].id, classId: classObj.id } },
    update: {},
    create: {
      userId: students[0].id,
      classId: classObj.id,
      totalAmount: 12000000,
      paidAmount: 12000000,
      status: 'PAID',
      receipts: {
        create: [
          { receiptNumber: 'BL-2026-0001', amount: 12000000, method: 'Chuyển khoản VCB', accountantName: 'Kế toán Hoàng Thu Trang' }
        ]
      }
    },
  });

  // student2: Đóng 1 phần
  await prisma.tuitionRecord.upsert({
    where: { userId_classId: { userId: students[1].id, classId: classObj.id } },
    update: {},
    create: {
      userId: students[1].id,
      classId: classObj.id,
      totalAmount: 12000000,
      paidAmount: 6000000,
      status: 'PARTIAL',
      receipts: {
        create: [
          { receiptNumber: 'BL-2026-0002', amount: 6000000, method: 'Chuyển khoản MB', accountantName: 'Kế toán Hoàng Thu Trang' }
        ]
      }
    },
  });

  // student4: Nợ học phí quá hạn -> Kích hoạt cảnh báo nợ!
  await prisma.tuitionRecord.upsert({
    where: { userId_classId: { userId: students[3].id, classId: classObj.id } },
    update: {},
    create: {
      userId: students[3].id,
      classId: classObj.id,
      totalAmount: 12000000,
      paidAmount: 0,
      status: 'OVERDUE',
    },
  });

  // 8. TUYỂN SINH (LEADS)
  const leadsData = [
    { fullName: 'Ngô Thanh Tùng', phone: '0912345678', email: 'tung.ngo@gmail.com', interestedCourse: 'Fullstack JS', status: 'NEW' },
    { fullName: 'Lê Diệu Linh', phone: '0987654321', email: 'linh.le@gmail.com', interestedCourse: 'React & Node.js', status: 'CONTACTED' },
    { fullName: 'Trần Văn Nam', phone: '0977889900', email: 'nam.tran@gmail.com', interestedCourse: 'Fullstack JS', status: 'CONSIDERING' },
  ];

  for (const ld of leadsData) {
    await prisma.lead.create({ data: ld });
  }

  // 9. KHẢO SÁT CHẤT LƯỢNG GIẢNG VIÊN (Đảm bảo tỷ lệ phản hồi >= 70%)
  const survey = await prisma.survey.create({
    data: {
      title: 'Khảo sát chất lượng giảng dạy giữa khóa - Môn React',
      classCode: classObj.code,
      lecturerName: 'Thầy Nguyễn Văn An',
      description: 'Đánh giá mức độ hài lòng về phương pháp giảng dạy, bài tập và sự hỗ trợ của trợ giảng.',
      responses: {
        create: [
          { userId: students[0].id, ratingScore: 5, feedbackText: 'Thầy dạy rất thực tế, bài tập sát với công việc.' },
          { userId: students[1].id, ratingScore: 5, feedbackText: 'Giảng viên nhiệt tình, hỗ trợ sửa bài chi tiết.' },
          { userId: students[2].id, ratingScore: 4, feedbackText: 'Khóa học hay, mong muốn có thêm video ghi hình lại.' },
        ]
      }
    }
  });

  console.log('=== KHỞI TẠO DỮ LIỆU THÀNH CÔNG RỰC RỠ TRÊN SUPABASE! ===');
}

main()
  .catch((e) => {
    console.error('Lỗi khi seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
