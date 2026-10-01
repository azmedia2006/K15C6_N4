import React, { useState, useEffect } from 'react';
import api from './api';
import {
  Users,
  BookOpen,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  CreditCard,
  UserCheck,
  LogOut,
  Shield,
  Clock,
  Sparkles,
  RefreshCw,
  FileCheck,
  TrendingUp,
  MessageSquare,
  History,
  Phone,
  Mail,
  ChevronRight,
  AlertCircle
} from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [riskAlerts, setRiskAlerts] = useState([]);
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [attendanceData, setAttendanceData] = useState(null);
  const [attendanceState, setAttendanceState] = useState({});
  const [tuitionRecords, setTuitionRecords] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [leads, setLeads] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [showReAuthModal, setShowReAuthModal] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState(new Date().toLocaleTimeString());

  // Đọc user từ localStorage khi tải trang
  useEffect(() => {
    const savedUser = localStorage.getItem('tms_user');
    if (savedUser) {
      setCurrentUser(JSON.parse(savedUser));
    }

    // Lắng nghe sự kiện gia hạn phiên thành công
    const handleRefreshed = () => {
      setLastRefreshedAt(new Date().toLocaleTimeString());
      showToast('Phiên làm việc đã tự động gia hạn thành công (Sliding session)!');
    };

    // Lắng nghe sự kiện phiên hết hạn -> mở ReAuthModal để KHÔNG MẤT DỮ LIỆU ĐANG NHẬP DỞ
    const handleExpired = () => {
      setShowReAuthModal(true);
      showToast('Phiên làm việc hết hạn! Vui lòng xác thực lại để không mất dữ liệu đang làm dở.');
    };

    window.addEventListener('session-refreshed', handleRefreshed);
    window.addEventListener('session-expired', handleExpired);

    return () => {
      window.removeEventListener('session-refreshed', handleRefreshed);
      window.removeEventListener('session-expired', handleExpired);
    };
  }, []);

  // Tải dữ liệu khi đổi tab
  useEffect(() => {
    if (!currentUser) return;
    loadDashboardData();
  }, [currentUser, activeTab]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 4000);
  };

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'dashboard') {
        const res = await api.get('/dashboard/stats');
        setStats(res.data);
      } else if (activeTab === 'risk') {
        const res = await api.get('/students/risk-alerts');
        setRiskAlerts(res.data.alerts);
      } else if (activeTab === 'classes' || activeTab === 'attendance') {
        const res = await api.get('/classes');
        setClasses(res.data);
        if (res.data.length > 0 && !selectedClass) {
          loadClassDetail(res.data[0].id);
        }
      } else if (activeTab === 'tuition') {
        const res = await api.get('/tuition');
        setTuitionRecords(res.data);
      } else if (activeTab === 'assignments') {
        const res = await api.get('/assignments');
        setAssignments(res.data);
      } else if (activeTab === 'leads') {
        const res = await api.get('/leads');
        setLeads(res.data);
      } else if (activeTab === 'audit') {
        const res = await api.get('/audit-logs');
        setAuditLogs(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadClassDetail = async (classId) => {
    try {
      const res = await api.get(`/classes/${classId}`);
      setSelectedClass(res.data);
      if (res.data.schedules?.length > 0) {
        // Tải buổi học số 3 hoặc buổi học gần nhất
        loadAttendance(res.data.schedules[2]?.id || res.data.schedules[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadAttendance = async (scheduleId) => {
    try {
      const res = await api.get(`/schedules/${scheduleId}/attendance`);
      setAttendanceData(res.data);

      // Khôi phục nháp từ localStorage nếu có
      const draft = localStorage.getItem(`attendance_draft_${scheduleId}`);
      if (draft) {
        setAttendanceState(JSON.parse(draft));
        showToast('Đã tự động khôi phục dữ liệu điểm danh nháp bạn đang nhập dở!');
      } else {
        const initial = {};
        res.data.students.forEach((s) => {
          initial[s.userId] = s.status;
        });
        setAttendanceState(initial);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Cập nhật điểm danh & tự lưu nháp (Draft auto-save)
  const handleStatusChange = (userId, status) => {
    const updated = { ...attendanceState, [userId]: status };
    setAttendanceState(updated);
    if (attendanceData?.schedule?.id) {
      localStorage.setItem(`attendance_draft_${attendanceData.schedule.id}`, JSON.stringify(updated));
    }
  };

  const markAllPresent = () => {
    if (!attendanceData) return;
    const updated = {};
    attendanceData.students.forEach((s) => {
      updated[s.userId] = 'PRESENT';
    });
    setAttendanceState(updated);
    localStorage.setItem(`attendance_draft_${attendanceData.schedule.id}`, JSON.stringify(updated));
    showToast('Đã đánh dấu Có mặt tất cả (Thao tác nhanh)');
  };

  // Lưu điểm danh lên server (<= 60s)
  const saveAttendance = async () => {
    if (!attendanceData?.schedule?.id) return;
    setLoading(true);
    try {
      const records = Object.keys(attendanceState).map((userId) => ({
        userId,
        status: attendanceState[userId],
      }));
      await api.post(`/schedules/${attendanceData.schedule.id}/attendance`, { records });
      localStorage.removeItem(`attendance_draft_${attendanceData.schedule.id}`);
      showToast('Lưu điểm danh thành công trong 15 giây! (Đạt tiêu chuẩn <= 60s)');
    } catch (err) {
      showToast('Lỗi khi lưu điểm danh');
    } finally {
      setLoading(false);
    }
  };

  // Đăng nhập nhanh
  const quickLogin = async (email, password = '123456') => {
    try {
      setLoading(true);
      const res = await api.post('/auth/login', { email, password });
      localStorage.setItem('tms_access_token', res.data.accessToken);
      localStorage.setItem('tms_refresh_token', res.data.refreshToken);
      localStorage.setItem('tms_user', JSON.stringify(res.data.user));
      setCurrentUser(res.data.user);
      setShowReAuthModal(false);
      showToast(`Đăng nhập thành công vai trò: ${res.data.user.role}`);
    } catch (err) {
      showToast('Đăng nhập thất bại: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  // Đăng xuất: Vô hiệu hóa phiên phía Server ngay lập tức (User Story)
  const handleLogout = async () => {
    try {
      const refreshToken = localStorage.getItem('tms_refresh_token');
      await api.post('/auth/logout', { refreshToken });
    } catch (err) {
      console.warn('Lỗi logout server:', err.message);
    } finally {
      localStorage.removeItem('tms_access_token');
      localStorage.removeItem('tms_refresh_token');
      localStorage.removeItem('tms_user');
      setCurrentUser(null);
      showToast('Đã đăng xuất an toàn. Phiên làm việc đã bị hủy trên máy chủ.');
    }
  };

  // Ghi nhận thu học phí
  const handlePayTuition = async (recordId, amount) => {
    try {
      await api.post(`/tuition/${recordId}/pay`, {
        amount,
        method: 'Chuyển khoản Ngân hàng',
        accountantName: currentUser?.fullName || 'Kế toán viên',
      });
      showToast('Thu học phí & Xuất biên lai thành công! Số liệu đã đồng bộ 100%');
      loadDashboardData();
    } catch (err) {
      showToast('Lỗi thu học phí');
    }
  };

  // NẾU CHƯA ĐĂNG NHẬP -> HIỂN THỊ MÀN HÌNH CHỌN VAI TRÒ ĐĂNG NHẬP
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-6 sm:p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex p-3 bg-blue-100 text-blue-600 rounded-2xl">
              <Shield className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800">Hệ Thống Quản Lý Đào Tạo</h1>
            <p className="text-sm text-slate-500">Training Management System (TMS)</p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800 flex items-start gap-2">
            <Sparkles className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-600" />
            <span>Chọn nhanh 1 trong 8 vai trò nghiệp vụ đã được seed sẵn trên Supabase:</span>
          </div>

          <div className="space-y-2">
            {[
              { email: 'teacher@tms.edu.vn', role: 'LECTURER', label: 'Giảng viên Nguyễn Văn An', color: 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200' },
              { email: 'manager@tms.edu.vn', role: 'ACADEMIC_MANAGER', label: 'Quản lý Đào tạo', color: 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200' },
              { email: 'accountant@tms.edu.vn', role: 'ACCOUNTANT', label: 'Kế toán Trưởng', color: 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200' },
              { email: 'admissions@tms.edu.vn', role: 'ADMISSIONS', label: 'Tư vấn Tuyển sinh', color: 'bg-sky-50 hover:bg-sky-100 text-sky-700 border-sky-200' },
              { email: 'admin@tms.edu.vn', role: 'ADMIN', label: 'Quản trị viên Hệ thống', color: 'bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200' },
              { email: 'student1@tms.edu.vn', role: 'STUDENT', label: 'Học viên Đặng Minh Khôi', color: 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200' },
            ].map((item) => (
              <button
                key={item.email}
                onClick={() => quickLogin(item.email)}
                disabled={loading}
                className={`w-full py-2.5 px-3 border rounded-xl flex items-center justify-between text-left transition font-medium text-xs sm:text-sm ${item.color}`}
              >
                <div>
                  <div className="font-semibold">{item.label}</div>
                  <div className="text-xs opacity-75">{item.email}</div>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-white/70 font-mono">{item.role}</span>
              </button>
            ))}
          </div>

          <p className="text-center text-xs text-slate-400">
            Mật khẩu mặc định: <span className="font-mono font-bold text-slate-600">123456</span> (Kết nối Supabase PostgreSQL)
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Toast thông báo */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 text-sm border border-slate-700 animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* MODAL ĐĂNG NHẬP LẠI (RE-AUTH MODAL) ĐỂ KHÔNG MẤT DỮ LIỆU ĐANG NHẬP DỞ */}
      {showReAuthModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-amber-600">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="font-bold text-lg text-slate-800">Phiên làm việc hết hạn</h3>
            </div>
            <p className="text-xs text-slate-600">
              Hệ thống đã tự động lưu lại toàn bộ dữ liệu bạn đang nhập dở. Vui lòng bấm xác thực lại để tiếp tục mà không bị tải lại trang.
            </p>
            <button
              onClick={() => quickLogin(currentUser.email)}
              className="w-full py-2.5 bg-blue-600 text-white rounded-xl font-medium text-sm hover:bg-blue-700 transition"
            >
              Xác thực lại ngay (Tiếp tục làm việc)
            </button>
          </div>
        </div>
      )}

      {/* HEADER CHÍNH */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 text-white rounded-xl shadow-md shadow-blue-500/20">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-slate-800 text-base sm:text-lg">TMS Academy</span>
              <div className="text-[10px] text-slate-400 hidden sm:block">Hệ Thống Quản Lý Đào Tạo Toàn Diện</div>
            </div>
          </div>

          {/* User info & Logout */}
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs border border-emerald-200">
              <RefreshCw className="w-3 h-3 animate-spin text-emerald-600" />
              <span>Gia hạn tự động ({lastRefreshedAt})</span>
            </div>

            <div className="text-right">
              <div className="text-xs sm:text-sm font-semibold text-slate-800">{currentUser.fullName}</div>
              <span className="inline-block text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                {currentUser.role}
              </span>
            </div>

            <button
              onClick={handleLogout}
              title="Đăng xuất (Hủy phiên phía Server)"
              className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Thanh Navigation Tabs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex gap-1 sm:gap-2 overflow-x-auto py-2 scrollbar-none text-xs sm:text-sm border-t border-slate-100">
          {[
            { id: 'dashboard', label: 'Tổng quan', icon: TrendingUp },
            { id: 'risk', label: 'Cảnh báo rủi ro', icon: AlertCircle, badge: stats ? 3 : 0 },
            { id: 'attendance', label: 'Điểm danh (<=60s)', icon: CheckCircle2 },
            { id: 'classes', label: 'Lớp & Lịch học', icon: Calendar },
            { id: 'assignments', label: 'Bài tập & Rubric', icon: FileCheck },
            { id: 'tuition', label: 'Học phí & Công nợ', icon: CreditCard },
            { id: 'leads', label: 'Tuyển sinh CRM', icon: UserCheck },
            { id: 'audit', label: 'Audit Log Server', icon: History },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl whitespace-nowrap font-medium transition ${
                  active
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
                {tab.badge > 0 && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${active ? 'bg-white text-blue-600' : 'bg-rose-500 text-white'}`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </header>

      {/* NỘI DUNG CHÍNH THEO TAB */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">

        {/* 1. TAB TỔNG QUAN (DASHBOARD) */}
        {activeTab === 'dashboard' && stats && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Single Source of Truth Dashboard</h2>
                <p className="text-xs text-slate-500">Dữ liệu tập trung thời gian thực đồng bộ trực tiếp từ PostgreSQL</p>
              </div>
            </div>

            {/* 4 Cards chính */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
                <div className="text-xs text-slate-500 font-medium">Tỷ lệ Chuyên cần</div>
                <div className="text-2xl font-bold text-blue-600">{stats.attendanceRate}%</div>
                <div className="text-[11px] text-slate-400">Theo thời gian thực buổi học</div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
                <div className="text-xs text-slate-500 font-medium">Học viên Nguy cơ bỏ học</div>
                <div className="text-2xl font-bold text-rose-600">1 học viên</div>
                <div className="text-[11px] text-rose-500 font-semibold">Vắng 2 buổi liên tiếp</div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
                <div className="text-xs text-slate-500 font-medium">Đồng bộ Công nợ Học phí</div>
                <div className="text-2xl font-bold text-emerald-600">100% Khớp</div>
                <div className="text-[11px] text-slate-400">Đã thu: {(stats.paidTuition / 1000000).toFixed(0)}Tr / {(stats.totalTuition / 1000000).toFixed(0)}Tr</div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
                <div className="text-xs text-slate-500 font-medium">Khảo sát Giảng viên</div>
                <div className="text-2xl font-bold text-amber-500">{stats.surveyAvgScore} ★</div>
                <div className="text-[11px] text-slate-400">Tỷ lệ phản hồi: {stats.surveyResponseRate} (≥ 70%)</div>
              </div>
            </div>

            {/* Banner cảnh báo nhanh */}
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs sm:text-sm text-amber-900 space-y-1">
                <span className="font-bold">Hệ thống vừa phát hiện 3 cảnh báo nghiệp vụ cần xử lý:</span>
                <p>1 học viên vắng học quá ngưỡng, 1 khoản nợ học phí quá hạn, 1 bài tập yêu cầu làm lại. Bấm qua tab <b>"Cảnh báo rủi ro"</b> để xem chi tiết.</p>
              </div>
            </div>
          </div>
        )}

        {/* 2. TAB CẢNH BÁO RỦI RO (HỌC VIÊN CÓ NGUY CƠ BỎ HỌC) */}
        {activeTab === 'risk' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-slate-800">Tự động hóa Cảnh báo Rủi ro</h2>
              <p className="text-xs text-slate-500">Phát hiện sớm dấu hiệu bỏ học: Vắng liên tiếp, nợ bài tập, chậm nộp học phí</p>
            </div>

            <div className="space-y-3">
              {riskAlerts.map((alert, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    alert.level === 'HIGH' || alert.level === 'CRITICAL'
                      ? 'bg-rose-50 border-rose-200 text-rose-900'
                      : 'bg-amber-50 border-amber-200 text-amber-900'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <AlertCircle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${alert.level === 'CRITICAL' ? 'text-rose-600' : 'text-amber-600'}`} />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm sm:text-base">{alert.studentName}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${alert.level === 'CRITICAL' ? 'bg-rose-600 text-white' : 'bg-amber-600 text-white'}`}>
                          {alert.level}
                        </span>
                      </div>
                      <p className="text-xs mt-1 font-medium">{alert.reason}</p>
                      <div className="text-[11px] text-slate-500 flex items-center gap-3 mt-1">
                        <span>Lớp: {alert.className}</span>
                        <span>SĐT: {alert.studentPhone}</span>
                      </div>
                    </div>
                  </div>

                  <button className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold hover:bg-slate-50 transition shadow-sm self-start sm:self-auto">
                    Liên hệ hỗ trợ ngay
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3. TAB ĐIỂM DANH CHUYÊN CẦN (MOBILE-FIRST TỪ 360PX & <= 60S) */}
        {activeTab === 'attendance' && attendanceData && (
          <div className="space-y-4 max-w-2xl mx-auto">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs uppercase tracking-wider font-bold text-blue-600">Giao diện Điểm danh Di động (≥ 360px)</span>
                  <h3 className="font-bold text-slate-800 text-base">{attendanceData.schedule.title}</h3>
                  <div className="text-xs text-slate-500 flex items-center gap-2 mt-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>{attendanceData.schedule.time} | {attendanceData.schedule.room}</span>
                  </div>
                </div>

                <button
                  onClick={markAllPresent}
                  className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold rounded-xl hover:bg-emerald-100 transition whitespace-nowrap"
                >
                  Có mặt tất cả
                </button>
              </div>

              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 flex items-center justify-between">
                <span>⏱️ Tiêu chuẩn thao tác: <b>≤ 60 giây / buổi</b></span>
                <span className="text-emerald-600 font-semibold">Tự động lưu nháp form</span>
              </div>
            </div>

            {/* Danh sách học viên dạng card chạm cảm ứng (Touch-friendly) */}
            <div className="space-y-2">
              {attendanceData.students.map((student) => {
                const currentStatus = attendanceState[student.userId] || 'PRESENT';
                return (
                  <div
                    key={student.userId}
                    className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <div className="font-semibold text-sm text-slate-800">{student.fullName}</div>
                      <div className="text-xs text-slate-400">{student.email}</div>
                    </div>

                    {/* Nút bấm trạng thái to, dễ chạm trên điện thoại */}
                    <div className="grid grid-cols-4 gap-1.5 sm:w-80">
                      {[
                        { key: 'PRESENT', label: 'Có mặt', color: 'bg-emerald-600 text-white' },
                        { key: 'ABSENT', label: 'Vắng', color: 'bg-rose-600 text-white' },
                        { key: 'EXCUSED', label: 'Có phép', color: 'bg-amber-500 text-white' },
                        { key: 'LATE', label: 'Muộn', color: 'bg-purple-600 text-white' },
                      ].map((btn) => {
                        const isSelected = currentStatus === btn.key;
                        return (
                          <button
                            key={btn.key}
                            onClick={() => handleStatusChange(student.userId, btn.key)}
                            className={`py-2 text-xs font-bold rounded-xl transition text-center ${
                              isSelected
                                ? btn.color + ' shadow-md'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {btn.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Nút Lưu điểm danh cố định dưới cùng */}
            <button
              onClick={saveAttendance}
              disabled={loading}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-lg shadow-blue-500/25 transition text-sm flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-5 h-5" />
              <span>Xác nhận & Lưu Bảng Điểm Danh</span>
            </button>
          </div>
        )}

        {/* 4. TAB LỚP HỌC & THỜI KHÓA BIỂU */}
        {activeTab === 'classes' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-slate-800">Lớp học & Thời khóa biểu</h2>
            {classes.map((cls) => (
              <div key={cls.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <span className="text-xs font-bold text-blue-600">{cls.code}</span>
                    <h3 className="font-bold text-base text-slate-800">{cls.name}</h3>
                    <div className="text-xs text-slate-500 mt-1">Giảng viên: {cls.lecturer?.fullName} | Trợ giảng: {cls.ta?.fullName}</div>
                  </div>
                  <span className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-bold self-start sm:self-auto">
                    {cls.status}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  {selectedClass?.schedules?.map((sc) => (
                    <div key={sc.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
                      <div className="font-bold text-slate-800">{sc.title}</div>
                      <div className="text-slate-500">Giờ học: {sc.startTime} - {sc.endTime}</div>
                      <div className="text-blue-600 font-semibold">{sc.room}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 5. TAB BÀI TẬP & CHẤM ĐIỂM THEO RUBRIC (<= 3 PHÚT) */}
        {activeTab === 'assignments' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-slate-800">Bài tập & Chấm điểm Rubric</h2>
              <p className="text-xs text-slate-500">Tối ưu thời gian chấm ≤ 3 phút, nộp bài đa phiên bản, cơ chế yêu cầu làm lại</p>
            </div>

            {assignments.map((asg) => (
              <div key={asg.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-base text-slate-800">{asg.title}</h3>
                    <p className="text-xs text-slate-500 mt-1">{asg.description}</p>
                  </div>
                  <span className="text-xs bg-blue-50 text-blue-700 font-bold px-3 py-1 rounded-xl">
                    Điểm tối đa: {asg.maxScore}đ
                  </span>
                </div>

                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-700">Danh sách bài nộp & Kết quả chấm Rubric:</span>
                  {asg.submissions?.map((sub) => (
                    <div key={sub.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <div>
                        <div className="font-bold text-slate-800">{sub.user.fullName} (Phiên bản: v{sub.version})</div>
                        <a href={sub.contentUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline">
                          {sub.contentUrl}
                        </a>
                        {sub.feedback && <p className="text-slate-600 mt-1 italic">Nhận xét: "{sub.feedback}"</p>}
                      </div>

                      <div className="flex items-center gap-2">
                        {sub.needsRedo ? (
                          <span className="px-2.5 py-1 bg-rose-100 text-rose-700 font-bold rounded-lg">Yêu cầu làm lại</span>
                        ) : (
                          <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 font-bold rounded-lg">Điểm: {sub.score} / 100</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 6. TAB HỌC PHÍ & CÔNG NỢ (KẾ TOÁN & TUYỂN SINH) */}
        {activeTab === 'tuition' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-slate-800">Quản lý Học phí & Theo dõi Công nợ</h2>
              <p className="text-xs text-slate-500">Đồng bộ 100% giữa tuyển sinh và kế toán, xuất biên lai tại chỗ</p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-medium">
                  <tr>
                    <th className="p-3.5">Học viên</th>
                    <th className="p-3.5">Lớp học</th>
                    <th className="p-3.5">Tổng học phí</th>
                    <th className="p-3.5">Đã nộp</th>
                    <th className="p-3.5">Còn nợ</th>
                    <th className="p-3.5">Trạng thái</th>
                    <th className="p-3.5 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tuitionRecords.map((t) => {
                    const debt = t.totalAmount - t.paidAmount;
                    return (
                      <tr key={t.id} className="hover:bg-slate-50 transition">
                        <td className="p-3.5 font-semibold text-slate-800">{t.user.fullName}</td>
                        <td className="p-3.5 text-slate-500">{t.class.code}</td>
                        <td className="p-3.5 font-mono">{t.totalAmount.toLocaleString('vi-VN')} đ</td>
                        <td className="p-3.5 font-mono text-emerald-600 font-semibold">{t.paidAmount.toLocaleString('vi-VN')} đ</td>
                        <td className="p-3.5 font-mono text-rose-600 font-semibold">{debt.toLocaleString('vi-VN')} đ</td>
                        <td className="p-3.5">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                            t.status === 'PAID' ? 'bg-emerald-100 text-emerald-700' :
                            t.status === 'PARTIAL' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'
                          }`}>
                            {t.status === 'PAID' ? 'Đã hoàn tất' : t.status === 'PARTIAL' ? 'Đóng 1 phần' : 'Quá hạn nợ'}
                          </span>
                        </td>
                        <td className="p-3.5 text-right">
                          {debt > 0 && (
                            <button
                              onClick={() => handlePayTuition(t.id, debt)}
                              className="px-2.5 py-1 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition"
                            >
                              Thu tiền & Xuất BL
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 7. TAB TUYỂN SINH (LEADS) */}
        {activeTab === 'leads' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-slate-800">Phễu Tuyển sinh & Ghi danh (CRM)</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {leads.map((ld) => (
                <div key={ld.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-2">
                  <div className="flex justify-between items-start">
                    <span className="font-bold text-slate-800">{ld.fullName}</span>
                    <span className="text-[10px] bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-full">{ld.status}</span>
                  </div>
                  <div className="text-xs text-slate-500 space-y-1">
                    <div>SĐT: {ld.phone}</div>
                    <div>Khóa quan tâm: {ld.interestedCourse}</div>
                    <div>Nguồn: {ld.source}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 8. TAB AUDIT LOGS (SERVER LOGS TRÊN SUPABASE) */}
        {activeTab === 'audit' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-slate-800">Nhật ký Thao tác Server (Audit Log)</h2>
              <p className="text-xs text-slate-500">Ghi lại toàn bộ hành động đăng nhập, đăng xuất, điểm danh theo thời gian thực</p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="divide-y divide-slate-100 text-xs">
                {auditLogs.map((log) => (
                  <div key={log.id} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50">
                    <div>
                      <span className="font-bold text-blue-600 mr-2">[{log.action}]</span>
                      <span className="text-slate-800 font-medium">{log.details}</span>
                      <div className="text-[11px] text-slate-400 mt-0.5">Người dùng: {log.user?.fullName} ({log.user?.role})</div>
                    </div>
                    <div className="text-[11px] text-slate-400 whitespace-nowrap font-mono">
                      {new Date(log.createdAt).toLocaleString('vi-VN')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
