/**
 * TMS SCHEDULE CALENDAR COMPONENT
 * • Chuyển đổi giữa chế độ tuần và tháng (Week / Month view switch)
 * • Lọc theo lớp, giảng viên hoặc phòng (Filter by class, lecturer or room)
 * • Bấm vào một buổi mở được chi tiết buổi học (Click to view session details modal)
 * • Hiển thị tối ưu trên màn hình điện thoại (Mobile responsive design)
 */

(function (global) {
    'use strict';

    // Helpers
    const formatISO = d => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const getMonday = (d) => {
        const date = new Date(d);
        const day = date.getDay();
        const diff = date.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(date.setDate(diff));
        monday.setHours(0, 0, 0, 0);
        return monday;
    };

    const addDays = (d, days) => {
        const result = new Date(d);
        result.setDate(result.getDate() + days);
        return result;
    };

    const DOW_NAMES_VI = ['Chủ Nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
    const DOW_SHORT_VI = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

    // Default rich demo sessions to guarantee seamless experience in all environments
    const DEFAULT_DEMO_SESSIONS = [
        {
            id: 'demo_ses_01',
            classId: 'cls_fs_01',
            className: 'Lớp Fullstack Web K15',
            classCode: 'WD-2026-01',
            subjectName: 'Lập trình JavaScript Nâng cao & ES6+',
            sessionNumber: 12,
            totalSessions: 60,
            date: formatISO(new Date()), // Today
            startTime: '08:00',
            endTime: '11:30',
            shift: 'morning',
            room: 'Phòng Lab A1',
            instructor: 'Minh Quân',
            instructorEmail: 'quan.tm@tms.edu.vn',
            lessonNumber: 12,
            lessonTopic: 'Xử lý Bất đồng bộ với Async/Await, Promise & Fetch API',
            note: 'Học viên chuẩn bị sẵn môi trường Node.js 20+ và VS Code.',
            status: 'scheduled'
        },
        {
            id: 'demo_ses_02',
            classId: 'cls_pmp_60',
            className: 'Quản Lý Dự Án Chuẩn PMP K15',
            classCode: 'PMP-2026-01',
            subjectName: 'Quản trị Dự án Thực chiến PMP',
            sessionNumber: 15,
            totalSessions: 60,
            date: formatISO(addDays(new Date(), 1)), // Tomorrow
            startTime: '13:30',
            endTime: '17:00',
            shift: 'afternoon',
            room: 'Phòng A2',
            instructor: 'Trần Minh',
            instructorEmail: 'minh.tran@tms.edu.vn',
            lessonNumber: 15,
            lessonTopic: 'Quản lý Tiến độ Dự án & Xây dựng Sơ đồ PERT/CPM',
            note: 'Mang theo tài liệu PMBOK 7th Edition.',
            status: 'scheduled'
        },
        {
            id: 'demo_ses_03',
            classId: 'cls_bi_01',
            className: 'Phân Tích Dữ Liệu Data BI K15',
            classCode: 'BI-2026-02',
            subjectName: 'Power BI & SQL Nâng cao cho Phân tích Dữ liệu',
            sessionNumber: 8,
            totalSessions: 48,
            date: formatISO(addDays(new Date(), -1)), // Yesterday
            startTime: '08:00',
            endTime: '11:30',
            shift: 'morning',
            room: 'Phòng B1',
            instructor: 'Lê Hoa',
            instructorEmail: 'hoa.le@tms.edu.vn',
            lessonNumber: 8,
            lessonTopic: 'Mô hình hóa dữ liệu Star Schema & Thiết kế DAX Measures',
            note: 'Hoàn thành bài tập thực hành số 2 trước giờ lên lớp.',
            status: 'completed'
        },
        {
            id: 'demo_ses_04',
            classId: 'cls_fs_01',
            className: 'Lớp Fullstack Web K15',
            classCode: 'WD-2026-01',
            subjectName: 'Lập trình JavaScript Nâng cao & ES6+',
            sessionNumber: 13,
            totalSessions: 60,
            date: formatISO(addDays(new Date(), 2)),
            startTime: '13:30',
            endTime: '17:00',
            shift: 'afternoon',
            room: 'Phòng Lab A1',
            instructor: 'Phạm Quân',
            instructorEmail: 'quan.pham@tms.edu.vn',
            lessonNumber: 13,
            lessonTopic: 'Tích hợp RESTful API & Xử lý Xác thực JWT trên Frontend',
            note: 'Kiểm tra token và xử lý refresh token tự động.',
            status: 'scheduled'
        },
        {
            id: 'demo_ses_05',
            classId: 'cls_eng_01',
            className: 'Tiếng Anh Giao Tiếp IT K15',
            classCode: 'ENG-2026-01',
            subjectName: 'Tiếng Anh Chuyên ngành Công nghệ Thông tin',
            sessionNumber: 6,
            totalSessions: 30,
            date: formatISO(addDays(new Date(), 3)),
            startTime: '18:00',
            endTime: '21:00',
            shift: 'evening',
            room: 'Online Zoom',
            instructor: 'Thu Hà',
            instructorEmail: 'ha.thu@tms.edu.vn',
            lessonNumber: 6,
            lessonTopic: 'Kỹ năng Phỏng vấn Kỹ thuật & Thuyết trình Dự án bằng Tiếng Anh',
            note: 'Link Zoom được gửi qua email trước 30 phút.',
            status: 'scheduled'
        },
        {
            id: 'demo_ses_06',
            classId: 'cls_ai_01',
            className: 'Trí Tuệ Nhân Tạo & Machine Learning K15',
            classCode: 'AI-2026-01',
            subjectName: 'Machine Learning & Deep Learning căn bản',
            sessionNumber: 20,
            totalSessions: 45,
            date: formatISO(addDays(new Date(), 4)),
            startTime: '18:00',
            endTime: '21:00',
            shift: 'evening',
            room: 'Phòng Lab C1',
            instructor: 'Đỗ Hải',
            instructorEmail: 'hai.do@tms.edu.vn',
            lessonNumber: 20,
            lessonTopic: 'Huấn luyện Mạng Nơ-ron Tích chập (CNN) cho Phân loại Ảnh',
            note: 'Yêu cầu tài khoản Google Colab Pro hoặc GPU cá nhân.',
            status: 'scheduled'
        },
        {
            id: 'demo_ses_07',
            classId: 'cls_pmp_60',
            className: 'Quản Lý Dự Án Chuẩn PMP K15',
            classCode: 'PMP-2026-01',
            subjectName: 'Quản trị Dự án Thực chiến PMP',
            sessionNumber: 16,
            totalSessions: 60,
            date: formatISO(addDays(new Date(), -3)),
            startTime: '08:00',
            endTime: '11:30',
            shift: 'morning',
            room: 'Phòng A2',
            instructor: 'Trần Minh',
            instructorEmail: 'minh.tran@tms.edu.vn',
            lessonNumber: 16,
            lessonTopic: 'Quản lý Chi phí Dự án & Phương pháp Earned Value Management (EVM)',
            note: 'Làm bài kiểm tra ngắn 30 phút đầu giờ.',
            status: 'completed'
        },
        {
            id: 'demo_ses_08',
            classId: 'cls_soft_01',
            className: 'Kỹ Năng Mềm Doanh Nghiệp K15',
            classCode: 'SOFT-2026-01',
            subjectName: 'Kỹ năng Giao tiếp & Làm việc Nhóm Agile',
            sessionNumber: 4,
            totalSessions: 12,
            date: formatISO(addDays(new Date(), -2)),
            startTime: '13:30',
            endTime: '17:00',
            shift: 'afternoon',
            room: 'Hội trường 1',
            instructor: 'Lê Hoa',
            instructorEmail: 'hoa.le@tms.edu.vn',
            lessonNumber: 4,
            lessonTopic: 'Thực hành Scrum Workshop: Sprint Planning & Retrospective',
            note: 'Chia nhóm 5 học viên tham gia đóng vai role-play.',
            status: 'completed'
        }
    ];

    class ScheduleCalendar {
        constructor(container, options = {}) {
            this.container = typeof container === 'string' ? document.querySelector(container) : container;
            if (!this.container) return;

            this.options = Object.assign({
                defaultView: localStorage.getItem('tms_schedule_view_mode') || 'week', // 'week' | 'month'
                apiEndpoint: '/api/schedules',
                classesEndpoint: '/api/schedules/classes',
                onSessionClick: null
            }, options);

            this.currentDate = new Date();
            this.viewMode = this.options.defaultView;
            this.mobileSelectedDayIndex = 0; // 0 (Mon) to 6 (Sun)
            this.sessions = [];
            this.classes = [];
            this.filters = {
                classId: '',
                instructor: '',
                room: '',
                search: ''
            };

            this.init();
        }

        async init() {
            this.buildDOM();
            this.attachEvents();
            await this.loadData();
            this.render();
        }

        buildDOM() {
            const isStudentSchedule = String(
                localStorage.getItem('tms_current_role') || ''
            ).trim().toLowerCase() === 'student';

            this.container.innerHTML = `
                <div class="schedule-calendar-container" id="sched-calendar-app">
                    <!-- Top Toolbar -->
                    <div class="sched-toolbar">
                        <div class="sched-toolbar-left">
                            <div class="sched-title-wrap">
                                <h3>
                                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                        <line x1="16" y1="2" x2="16" y2="6"></line>
                                        <line x1="8" y1="2" x2="8" y2="6"></line>
                                        <line x1="3" y1="10" x2="21" y2="10"></line>
                                    </svg>
                                    <span>${isStudentSchedule ? 'Thời khóa biểu của tôi' : 'Thời Khóa Biểu Hệ Thống'}</span>
                                </h3>
                                <p>${isStudentSchedule ? 'Xem lịch học các lớp bạn đã ghi danh theo tuần hoặc tháng' : 'Tra cứu lịch học, chuyển đổi tuần/tháng và lọc theo lớp, giảng viên, phòng'}</p>
                            </div>

                            <!-- Mode Switcher (Tuần / Tháng) -->
                            <div class="sched-mode-switcher" role="tablist" aria-label="Chế độ hiển thị">
                                <button type="button" class="sched-mode-btn ${this.viewMode === 'week' ? 'active' : ''}" data-mode="week" id="sched-btn-week">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                                    <span>Chế độ Tuần</span>
                                </button>
                                <button type="button" class="sched-mode-btn ${this.viewMode === 'month' ? 'active' : ''}" data-mode="month" id="sched-btn-month">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                                    <span>Chế độ Tháng</span>
                                </button>
                            </div>
                        </div>

                        <!-- Date Navigation Controls -->
                        <div class="sched-nav-group">
                            <button type="button" class="sched-nav-btn" id="sched-nav-prev" title="Kỳ trước">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
                                <span>Trước</span>
                            </button>
                            <span class="sched-period-label" id="sched-period-text">Đang tải...</span>
                            <button type="button" class="sched-nav-btn" id="sched-nav-today">Hôm nay</button>
                            <button type="button" class="sched-nav-btn" id="sched-nav-next" title="Kỳ sau">
                                <span>Sau</span>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                            </button>
                        </div>
                    </div>

                    <!-- Filter Bar (Lọc theo Lớp, Giảng viên, Phòng) -->
                    <div class="sched-filter-bar">
                        <!-- Lọc theo Lớp -->
                        <div class="sched-filter-item">
                            <label class="sched-filter-label" for="sched-filter-class">Lớp học</label>
                            <select id="sched-filter-class" class="sched-filter-select">
                                <option value="">-- Tất cả lớp học --</option>
                            </select>
                        </div>

                        <!-- Lọc theo Giảng viên -->
                        <div class="sched-filter-item">
                            <label class="sched-filter-label" for="sched-filter-instructor">Giảng viên</label>
                            <select id="sched-filter-instructor" class="sched-filter-select">
                                <option value="">-- Tất cả giảng viên --</option>
                            </select>
                        </div>

                        <!-- Lọc theo Phòng -->
                        <div class="sched-filter-item">
                            <label class="sched-filter-label" for="sched-filter-room">Phòng học</label>
                            <select id="sched-filter-room" class="sched-filter-select">
                                <option value="">-- Tất cả phòng học --</option>
                            </select>
                        </div>

                        <!-- Tìm kiếm nhanh -->
                        <div class="sched-filter-item">
                            <label class="sched-filter-label" for="sched-filter-search">Tìm kiếm</label>
                            <input type="text" id="sched-filter-search" class="sched-filter-input" placeholder="Tên môn, bài học, phòng...">
                        </div>

                        <!-- Actions & Badge -->
                        <div class="sched-filter-actions">
                            <button type="button" class="sched-btn-reset" id="sched-btn-reset-filters">Đặt lại</button>
                            <span class="sched-count-pill" id="sched-result-count">0 buổi</span>
                        </div>
                    </div>

                    <!-- Mobile Day Selector Strip (For Week View on mobile) -->
                    <div class="sched-mobile-day-strip" id="sched-mobile-day-strip">
                        <!-- Rendered dynamically -->
                    </div>

                    <!-- KN-158: Thông báo trạng thái tải lịch học -->
                    <div
                        id="sched-status-message"
                        role="status"
                        aria-live="polite"
                        style="display: none; margin: 12px 0; padding: 14px 16px; border: 1px solid #cbd5e1; border-radius: 10px; color: var(--sched-text-muted);">
                    </div>

                    <!-- Main Calendar View Body -->
                    <div id="sched-view-body">
                        <!-- Rendered dynamically based on week/month -->
                    </div>
                </div>

                <!-- Session Detail Modal (Bấm vào một buổi mở được chi tiết buổi học) -->
                <div class="sched-modal-overlay" id="sched-detail-modal">
                    <div class="sched-modal-card" role="dialog" aria-modal="true" aria-labelledby="sched-modal-title">
                        <div class="sched-modal-header">
                            <div>
                                <h4 id="sched-modal-title">Chi Tiết Buổi Học</h4>
                                <div class="sub-code" id="sched-modal-class-code">Mã lớp: --</div>
                            </div>
                            <button type="button" class="sched-modal-close" id="sched-modal-close-btn" aria-label="Đóng">✕</button>
                        </div>
                        <div class="sched-modal-body" id="sched-modal-body-content">
                            <!-- Populated dynamically -->
                        </div>
                        <div class="sched-modal-footer">
                            <button type="button" class="btn btn-secondary sched-modal-close-action" style="padding:8px 18px; border-radius:8px; border:1px solid #cbd5e1; background:#fff; cursor:pointer;">Đóng</button>
                        </div>
                    </div>
                </div>
            `;
        }

        attachEvents() {
            // View Mode Switcher
            const btnWeek = this.container.querySelector('#sched-btn-week');
            const btnMonth = this.container.querySelector('#sched-btn-month');

            btnWeek.addEventListener('click', () => this.switchViewMode('week'));
            btnMonth.addEventListener('click', () => this.switchViewMode('month'));

            // Navigation
            this.container.querySelector('#sched-nav-prev').addEventListener('click', () => this.navigate(-1));
            this.container.querySelector('#sched-nav-next').addEventListener('click', () => this.navigate(1));
            this.container.querySelector('#sched-nav-today').addEventListener('click', () => this.navigate(0));

            // Filters
            const filterClass = this.container.querySelector('#sched-filter-class');
            const filterInstructor = this.container.querySelector('#sched-filter-instructor');
            const filterRoom = this.container.querySelector('#sched-filter-room');
            const filterSearch = this.container.querySelector('#sched-filter-search');
            const btnReset = this.container.querySelector('#sched-btn-reset-filters');

            filterClass.addEventListener('change', () => {
                this.filters.classId = filterClass.value;
                this.render();
            });

            filterInstructor.addEventListener('change', () => {
                this.filters.instructor = filterInstructor.value;
                this.render();
            });

            filterRoom.addEventListener('change', () => {
                this.filters.room = filterRoom.value;
                this.render();
            });

            let searchTimeout;
            filterSearch.addEventListener('input', () => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    this.filters.search = filterSearch.value.trim().toLowerCase();
                    this.render();
                }, 200);
            });

            btnReset.addEventListener('click', () => {
                this.filters = { classId: '', instructor: '', room: '', search: '' };
                filterClass.value = '';
                filterInstructor.value = '';
                filterRoom.value = '';
                filterSearch.value = '';
                this.render();
            });

            // Modal Close Events
            const modal = this.container.querySelector('#sched-detail-modal');
            const closeBtn = this.container.querySelector('#sched-modal-close-btn');
            const closeFooterBtn = this.container.querySelector('.sched-modal-close-action');

            const closeModal = () => modal.classList.remove('open');
            closeBtn.addEventListener('click', closeModal);
            if (closeFooterBtn) closeFooterBtn.addEventListener('click', closeModal);
            modal.addEventListener('click', (e) => {
                if (e.target === modal) closeModal();
            });

            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && modal.classList.contains('open')) closeModal();
            });
        }

        async loadData() {
            let loadedSessions = [];
            this.loadError = null;

            const token = localStorage.getItem('tms_token') || localStorage.getItem('token');

            // KN-158: Phân biệt lỗi API với trường hợp không có lịch học.
            try {
                const res = await fetch(this.options.apiEndpoint, {
                    headers: token ? { Authorization: `Bearer ${token}` } : {}
                });

                if (!res.ok) {
                    throw new Error(`HTTP ${res.status}`);
                }

                const result = await res.json();

                if (!result || result.success === false) {
                    throw new Error(result?.message || 'Phản hồi API không hợp lệ');
                }

                if (Array.isArray(result.data)) {
                    loadedSessions = result.data;
                } else if (Array.isArray(result.sessions)) {
                    loadedSessions = result.sessions;
                } else {
                    throw new Error('Dữ liệu lịch học không hợp lệ');
                }
            } catch (err) {
                this.loadError = 'Không thể tải thời khóa biểu. Vui lòng thử lại.';
                console.error('Lỗi tải thời khóa biểu:', err);
            }

            // 2. Also check if ScheduleManagement preview sessions are in memory
            if (typeof window.previewSessions !== 'undefined' && Array.isArray(window.previewSessions) && window.previewSessions.length > 0) {
                loadedSessions = [...loadedSessions, ...window.previewSessions];
            }

            // KN-158: Chỉ hiển thị lịch học thật từ Backend.
            // Không sử dụng lịch demo khi học viên chưa có lịch.

            // Normalize sessions
            this.sessions = loadedSessions.map(s => {
                const dateObj = new Date(s.date + 'T12:00:00');
                const dow = isNaN(dateObj.getDay()) ? 0 : dateObj.getDay();
                return {
                    id: s.id || 'ses_' + Math.random().toString(36).substr(2, 9),
                    classId: s.classId || 'cls_general',
                    className: s.className || s.classCode || 'Lớp học',
                    classCode: s.classCode || s.classId || 'LỚP',
                    subjectName: s.subjectName || s.subject || s.lessonTopic || 'Chuyên đề học tập',
                    sessionNumber: s.sessionNumber || 1,
                    totalSessions: s.totalSessions || 60,
                    date: s.date,
                    dayOfWeek: dow,
                    startTime: s.startTime || '08:00',
                    endTime: s.endTime || '11:30',
                    shift: s.shift || (s.startTime && parseInt(s.startTime) >= 18 ? 'evening' : (s.startTime && parseInt(s.startTime) >= 13 ? 'afternoon' : 'morning')),
                    room: s.room || 'Phòng học TMS',
                    instructor: s.instructor || 'Giảng viên TMS',
                    instructorEmail: s.instructorEmail || '',
                    lessonNumber: s.lessonNumber || s.sessionNumber || 1,
                    lessonTopic: s.lessonTopic || 'Nội dung bài học chuyên sâu',
                    note: s.note || '',
                    status: s.status || 'scheduled'
                };
            });

            // Extract Filter Options
            this.populateFilterDropdowns();
        }

        populateFilterDropdowns() {
            const selectClass = this.container.querySelector('#sched-filter-class');
            const selectInstructor = this.container.querySelector('#sched-filter-instructor');
            const selectRoom = this.container.querySelector('#sched-filter-room');

            // Unique Classes
            const classMap = new Map();
            this.sessions.forEach(s => {
                if (s.classId) {
                    classMap.set(s.classId, s.className ? `${s.classCode || s.classId} - ${s.className}` : s.classCode || s.classId);
                }
            });

            selectClass.innerHTML = '<option value="">-- Tất cả lớp học --</option>' +
                Array.from(classMap.entries()).map(([id, label]) => `<option value="${id}">${this.escapeHtml(label)}</option>`).join('');

            // Unique Instructors
            const instructors = Array.from(new Set(this.sessions.map(s => s.instructor).filter(Boolean))).sort();
            selectInstructor.innerHTML = '<option value="">-- Tất cả giảng viên --</option>' +
                instructors.map(name => `<option value="${this.escapeHtml(name)}">${this.escapeHtml(name)}</option>`).join('');

            // Unique Rooms
            const rooms = Array.from(new Set(this.sessions.map(s => s.room).filter(Boolean))).sort();
            selectRoom.innerHTML = '<option value="">-- Tất cả phòng học --</option>' +
                rooms.map(room => `<option value="${this.escapeHtml(room)}">${this.escapeHtml(room)}</option>`).join('');
        }

        switchViewMode(mode) {
            if (this.viewMode === mode) return;
            this.viewMode = mode;
            localStorage.setItem('tms_schedule_view_mode', mode);

            const btnWeek = this.container.querySelector('#sched-btn-week');
            const btnMonth = this.container.querySelector('#sched-btn-month');

            if (mode === 'week') {
                btnWeek.classList.add('active');
                btnMonth.classList.remove('active');
            } else {
                btnMonth.classList.add('active');
                btnWeek.classList.remove('active');
            }

            this.render();
        }

        navigate(direction) {
            if (direction === 0) {
                this.currentDate = new Date();
            } else if (this.viewMode === 'week') {
                this.currentDate = addDays(this.currentDate, direction * 7);
            } else {
                // Month navigation
                const d = new Date(this.currentDate);
                d.setMonth(d.getMonth() + direction);
                this.currentDate = d;
            }
            this.render();
        }

        getFilteredSessions() {
            return this.sessions.filter(s => {
                if (this.filters.classId && s.classId !== this.filters.classId) return false;
                if (this.filters.instructor && s.instructor !== this.filters.instructor) return false;
                if (this.filters.room && s.room !== this.filters.room) return false;
                if (this.filters.search) {
                    const q = this.filters.search;
                    const match = (s.className && s.className.toLowerCase().includes(q)) ||
                                  (s.classCode && s.classCode.toLowerCase().includes(q)) ||
                                  (s.subjectName && s.subjectName.toLowerCase().includes(q)) ||
                                  (s.lessonTopic && s.lessonTopic.toLowerCase().includes(q)) ||
                                  (s.room && s.room.toLowerCase().includes(q)) ||
                                  (s.instructor && s.instructor.toLowerCase().includes(q));
                    if (!match) return false;
                }
                return true;
            });
        }

        render() {
            const filtered = this.getFilteredSessions();

            // KN-158: Hiển thị trạng thái tải lịch học.
            const statusEl = this.container.querySelector('#sched-status-message');

            if (statusEl) {
                const message = this.loadError ||
                    (this.sessions.length === 0 ? 'Bạn chưa có lịch học.' : '');

                statusEl.textContent = message;
                statusEl.style.display = message ? 'block' : 'none';
            }

            this.container.querySelector('#sched-result-count').textContent =
                `${filtered.length} buổi`;

            if (this.viewMode === 'week') {
                this.renderWeekView(filtered);
            } else {
                this.renderMonthView(filtered);
            }
        }

        renderWeekView(sessions) {
            const monday = getMonday(this.currentDate);
            const sunday = addDays(monday, 6);
            const todayStr = formatISO(new Date());

            // Build week dates (Monday to Sunday)
            const weekDays = [];
            for (let i = 0; i < 7; i++) {
                const date = addDays(monday, i);
                const iso = formatISO(date);
                weekDays.push({
                    index: i,
                    date: date,
                    iso: iso,
                    dayOfWeek: date.getDay(),
                    dowName: DOW_NAMES_VI[date.getDay()],
                    dowShort: DOW_SHORT_VI[date.getDay()],
                    dayNum: date.getDate(),
                    monthNum: date.getMonth() + 1,
                    isToday: iso === todayStr
                });
            }

            // Update Navigation Label
            const periodLabel = `${monday.getDate()}/${monday.getMonth() + 1} – ${sunday.getDate()}/${sunday.getMonth() + 1}/${sunday.getFullYear()}`;
            this.container.querySelector('#sched-period-text').textContent = `Tuần: ${periodLabel}`;

            // Render Mobile Day Selector Strip
            const strip = this.container.querySelector('#sched-mobile-day-strip');
            strip.innerHTML = weekDays.map((d, idx) => {
                const count = sessions.filter(s => s.date === d.iso).length;
                const active = idx === this.mobileSelectedDayIndex ? 'active' : '';
                const today = d.isToday ? 'is-today' : '';
                return `
                    <div class="sched-mobile-day-pill ${active} ${today}" data-day-index="${idx}">
                        <span class="pill-dow">${d.dowShort}</span>
                        <span class="pill-date">${d.dayNum}</span>
                        <span class="pill-count">${count} buổi</span>
                    </div>
                `;
            }).join('');

            // Mobile pill click listener
            strip.querySelectorAll('.sched-mobile-day-pill').forEach(pill => {
                pill.addEventListener('click', (e) => {
                    const idx = parseInt(pill.getAttribute('data-day-index'));
                    this.mobileSelectedDayIndex = idx;
                    this.renderWeekView(sessions);
                });
            });

            // Standard Shifts
            const shifts = [
                { id: 'morning', name: 'Sáng', time: '08:00 - 11:30' },
                { id: 'afternoon', name: 'Chiều', time: '13:30 - 17:00' },
                { id: 'evening', name: 'Tối', time: '18:00 - 21:00' }
            ];

            // Render Desktop / Tablet Week Table
            let tableHtml = `
                <div class="sched-week-table-wrap">
                    <table class="sched-week-table">
                        <thead>
                            <tr>
                                <th class="col-time">Ca học</th>
                                ${weekDays.map(d => `
                                    <th class="${d.isToday ? 'is-today' : ''}">
                                        <span class="th-dow">${d.dowName}</span>
                                        <span class="th-date">${d.dayNum}/${d.monthNum}</span>
                                    </th>
                                `).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${shifts.map(shift => `
                                <tr>
                                    <td class="col-time">
                                        <strong>${shift.name}</strong><br>
                                        <small style="font-size:0.6875rem; color:var(--sched-text-sub);">${shift.time}</small>
                                    </td>
                                    ${weekDays.map(d => {
                                        const cellSessions = sessions.filter(s => s.date === d.iso && s.shift === shift.id);
                                        return `
                                            <td class="${d.isToday ? 'is-today' : ''}">
                                                <div class="sched-cell-sessions">
                                                    ${cellSessions.map(s => this.renderSessionCardHTML(s)).join('')}
                                                </div>
                                            </td>
                                        `;
                                    }).join('')}
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;

            // Render Mobile Single-Day View
            const activeMobileDay = weekDays[this.mobileSelectedDayIndex] || weekDays[0];
            const mobileDaySessions = sessions.filter(s => s.date === activeMobileDay.iso);

            let mobileHtml = `
                <div class="sched-mobile-single-day-view" style="display: none;">
                    <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; background:#f1f5f9; border-radius:10px; margin-bottom:8px;">
                        <strong>📅 ${activeMobileDay.dowName}, ${activeMobileDay.dayNum}/${activeMobileDay.monthNum}/${activeMobileDay.date.getFullYear()}</strong>
                        <span style="font-size:0.8125rem; font-weight:700; color:var(--sched-primary);">${mobileDaySessions.length} buổi học</span>
                    </div>
            `;

            if (mobileDaySessions.length === 0) {
                mobileHtml += `
                    <div style="text-align:center; padding:36px 16px; background:#f8fafc; border-radius:10px; border:1px dashed #cbd5e1; color:var(--sched-text-muted);">
                        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom:8px; opacity:0.6;"><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/></svg>
                        <p style="margin:0; font-size:0.875rem;">Không có buổi học nào trong ngày này.</p>
                    </div>
                `;
            } else {
                shifts.forEach(shift => {
                    const shiftSessions = mobileDaySessions.filter(s => s.shift === shift.id);
                    if (shiftSessions.length > 0) {
                        mobileHtml += `
                            <div class="sched-mobile-shift-header">${shift.name} (${shift.time})</div>
                            ${shiftSessions.map(s => this.renderSessionCardHTML(s)).join('')}
                        `;
                    }
                });
            }
            mobileHtml += `</div>`;

            // Insert into container
            const body = this.container.querySelector('#sched-view-body');
            body.innerHTML = tableHtml + mobileHtml;

            // Media Query switch for mobile view styling
            this.bindCardClickEvents();
        }

        renderMonthView(sessions) {
            const year = this.currentDate.getFullYear();
            const month = this.currentDate.getMonth();
            const todayStr = formatISO(new Date());

            // First day of current month
            const firstDay = new Date(year, month, 1);
            // Last day of current month
            const lastDay = new Date(year, month + 1, 0);

            // Month Label
            const monthNamesVi = ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];
            this.container.querySelector('#sched-period-text').textContent = `${monthNamesVi[month]} / ${year}`;

            // Hide mobile day strip in month view
            this.container.querySelector('#sched-mobile-day-strip').innerHTML = '';

            // Compute calendar days (starting Monday)
            let startDow = firstDay.getDay(); // 0 is Sun, 1 is Mon...
            const offset = startDow === 0 ? 6 : startDow - 1; // days before Monday
            const startDate = addDays(firstDay, -offset);

            const cells = [];
            for (let i = 0; i < 42; i++) { // 6 weeks * 7 days
                const d = addDays(startDate, i);
                const iso = formatISO(d);
                cells.push({
                    date: d,
                    iso: iso,
                    dayNum: d.getDate(),
                    isCurrentMonth: d.getMonth() === month,
                    isToday: iso === todayStr
                });
                // If we reach end of 5th week and already passed last day of month, stop at 35
                if (i === 34 && d >= lastDay) {
                    break;
                }
            }

            const dowHeaders = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'CN'];

            let gridHtml = `
                <div class="sched-month-grid">
                    ${dowHeaders.map(h => `<div class="sched-month-head">${h}</div>`).join('')}
                    ${cells.map(c => {
                        const daySessions = sessions.filter(s => s.date === c.iso);
                        const otherClass = !c.isCurrentMonth ? 'other-month' : '';
                        const todayClass = c.isToday ? 'is-today' : '';
                        const maxDisplay = 3;
                        const visibleSessions = daySessions.slice(0, maxDisplay);
                        const extraCount = daySessions.length - maxDisplay;

                        return `
                            <div class="sched-month-cell ${otherClass} ${todayClass}" data-date="${c.iso}">
                                <div class="sched-month-cell-header">
                                    <span class="sched-month-day-num">${c.dayNum}</span>
                                    ${daySessions.length > 0 ? `<span style="font-size:0.6875rem; font-weight:700; color:var(--sched-primary);">${daySessions.length}b</span>` : ''}
                                </div>
                                ${visibleSessions.map(s => `
                                    <div class="sched-month-item status-${s.status}" data-session-id="${s.id}" title="${this.escapeHtml(s.className)} • ${s.startTime}">
                                        <span class="sched-month-item-time">${s.startTime}</span>
                                        <span class="sched-month-item-title">${this.escapeHtml(s.classCode || s.className)}</span>
                                    </div>
                                `).join('')}
                                ${extraCount > 0 ? `
                                    <button type="button" class="sched-month-more-btn" data-date="${c.iso}">+${extraCount} buổi khác</button>
                                ` : ''}
                            </div>
                        `;
                    }).join('')}
                </div>
            `;

            const body = this.container.querySelector('#sched-view-body');
            body.innerHTML = gridHtml;

            this.bindCardClickEvents();
        }

        renderSessionCardHTML(s) {
            const statusLabel = s.status === 'completed' ? 'Đã điểm danh' : (s.status === 'cancelled' ? 'Đã hủy' : 'Đã xếp lịch');
            return `
                <div class="sched-card status-${s.status}" data-session-id="${s.id}">
                    <div class="sched-card-top">
                        <span class="sched-card-class" title="${this.escapeHtml(s.className)}">${this.escapeHtml(s.classCode || s.className)}</span>
                        <span class="sched-card-session-num">B${s.sessionNumber}/${s.totalSessions}</span>
                    </div>
                    <div class="sched-card-time">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        <span>${s.startTime} – ${s.endTime}</span>
                    </div>
                    <div class="sched-card-topic" title="${this.escapeHtml(s.lessonTopic)}">
                        ${this.escapeHtml(s.lessonTopic)}
                    </div>
                    <div class="sched-card-meta">
                        <span class="sched-card-meta-item" title="Phòng học">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
                            ${this.escapeHtml(s.room)}
                        </span>
                        <span class="sched-card-meta-item" title="Giảng viên">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                            ${this.escapeHtml(s.instructor)}
                        </span>
                    </div>
                </div>
            `;
        }

        bindCardClickEvents() {
            // Click on session cards in week view or month view
            const cards = this.container.querySelectorAll('[data-session-id]');
            cards.forEach(card => {
                card.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const sid = card.getAttribute('data-session-id');
                    this.openSessionDetail(sid);
                });
            });

            // Click "+X buổi khác" in month view
            const moreBtns = this.container.querySelectorAll('.sched-month-more-btn');
            moreBtns.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const date = btn.getAttribute('data-date');
                    const daySessions = this.sessions.filter(s => s.date === date);
                    if (daySessions.length > 0) {
                        this.openSessionDetail(daySessions[0].id);
                    }
                });
            });
        }

        // Bấm vào một buổi mở được chi tiết buổi học
        openSessionDetail(sessionId) {
            const session = this.sessions.find(s => s.id === sessionId);
            if (!session) return;

            const modal = this.container.querySelector('#sched-detail-modal');
            const titleEl = this.container.querySelector('#sched-modal-title');
            const codeEl = this.container.querySelector('#sched-modal-class-code');
            const bodyEl = this.container.querySelector('#sched-modal-body-content');

            titleEl.textContent = `Chi Tiết Buổi ${session.sessionNumber} / ${session.totalSessions}`;
            codeEl.textContent = `Mã lớp: ${session.classCode || session.classId} • ${session.className || ''}`;

            const statusClass = session.status === 'completed' ? 'status-completed' : (session.status === 'cancelled' ? 'status-cancelled' : 'status-scheduled');
            const statusText = session.status === 'completed' ? 'Đã điểm danh hoàn tất 🔒' : (session.status === 'cancelled' ? 'Đã hủy lịch' : 'Đã xếp lịch chính thức');

            // Date format in Vietnamese
            const d = new Date(session.date + 'T12:00:00');
            const dateStrVi = `${DOW_NAMES_VI[d.getDay()]}, ${d.getDate()} tháng ${d.getMonth() + 1}, năm ${d.getFullYear()}`;

            bodyEl.innerHTML = `
                <div class="sched-info-grid">
                    <div class="sched-info-item">
                        <div class="sched-info-label">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                            <span>Trạng thái buổi</span>
                        </div>
                        <div class="sched-info-value">
                            <span class="sched-status-badge ${statusClass}">${statusText}</span>
                        </div>
                    </div>

                    <div class="sched-info-item">
                        <div class="sched-info-label">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                            <span>Ngày học</span>
                        </div>
                        <div class="sched-info-value">${dateStrVi}</div>
                    </div>

                    <div class="sched-info-item">
                        <div class="sched-info-label">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                            <span>Thời gian & Ca</span>
                        </div>
                        <div class="sched-info-value">${session.startTime} – ${session.endTime} (${session.shift === 'morning' ? 'Ca Sáng' : (session.shift === 'afternoon' ? 'Ca Chiều' : 'Ca Tối')})</div>
                    </div>

                    <div class="sched-info-item">
                        <div class="sched-info-label">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
                            <span>Phòng học</span>
                        </div>
                        <div class="sched-info-value">${this.escapeHtml(session.room)}</div>
                    </div>

                    <div class="sched-info-item">
                        <div class="sched-info-label">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                            <span>Giảng viên</span>
                        </div>
                        <div class="sched-info-value">${this.escapeHtml(session.instructor)} ${session.instructorEmail ? `<br><small style="font-weight:400; color:var(--sched-text-muted);">${session.instructorEmail}</small>` : ''}</div>
                    </div>

                    <div class="sched-info-item">
                        <div class="sched-info-label">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                            <span>Môn học</span>
                        </div>
                        <div class="sched-info-value">${this.escapeHtml(session.subjectName || session.className)}</div>
                    </div>

                    <div class="sched-info-item full-width">
                        <div class="sched-info-label">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                            <span>Chủ đề bài học (Syllabus)</span>
                        </div>
                        <div class="sched-info-value" style="color:var(--sched-primary); font-size:1.05rem;">
                            Buổi ${session.sessionNumber}: ${this.escapeHtml(session.lessonTopic)}
                        </div>
                    </div>

                    ${session.note ? `
                        <div class="sched-info-item full-width">
                            <div class="sched-info-label">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                                <span>Ghi chú buổi học</span>
                            </div>
                            <div class="sched-info-value" style="font-weight:400; color:var(--sched-text-muted);">
                                ${this.escapeHtml(session.note)}
                            </div>
                        </div>
                    ` : ''}
                </div>
            `;

            modal.classList.add('open');

            if (typeof this.options.onSessionClick === 'function') {
                this.options.onSessionClick(session);
            }
        }

        escapeHtml(str) {
            if (!str) return '';
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }
    }

    // Export to window
    global.ScheduleCalendar = ScheduleCalendar;

    global.initScheduleCalendar = function (containerSelector, options) {
        return new ScheduleCalendar(containerSelector, options);
    };

})(typeof window !== 'undefined' ? window : this);
