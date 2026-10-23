-- ========================================================
-- TMS SYSTEM - SUPABASE POSTGRESQL SCHEMA INITIALIZATION
-- Run this script in Supabase SQL Editor if you wish to
-- create relational PostgreSQL tables in schema "public".
-- ========================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Table: users
CREATE TABLE IF NOT EXISTS public.users (
    id VARCHAR(64) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(64) NOT NULL DEFAULT 'student',
    phone VARCHAR(32),
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    password_hash TEXT,
    salt VARCHAR(64),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- KN-67: Bổ sung thông tin hồ sơ cá nhân
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS birth_date DATE;

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS address TEXT;

-- 3. Table: roles
CREATE TABLE IF NOT EXISTS public.roles (
    id VARCHAR(64) PRIMARY KEY,
    code VARCHAR(64) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT
);

-- 4. Table: user_roles (Many-to-Many RBAC)
CREATE TABLE IF NOT EXISTS public.user_roles (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    role_id VARCHAR(64) NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    assigned_by VARCHAR(64) DEFAULT 'system',
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_user_role UNIQUE (user_id, role_id)
);

-- 5. Table: audit_logs (KN-63)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id VARCHAR(64) PRIMARY KEY,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    action VARCHAR(64) NOT NULL,
    performed_by VARCHAR(64) NOT NULL,
    target_user_id VARCHAR(64),
    role_id VARCHAR(64),
    status VARCHAR(32) NOT NULL,
    reason TEXT
);

-- 6. Table: scores & tuitions (KN-8 RBAC)
CREATE TABLE IF NOT EXISTS public.scores (
    id VARCHAR(64) PRIMARY KEY,
    student_id VARCHAR(64) NOT NULL,
    student_name VARCHAR(255),
    course VARCHAR(255),
    score NUMERIC(4,2),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by VARCHAR(64)
);

CREATE TABLE IF NOT EXISTS public.tuition (
    id VARCHAR(64) PRIMARY KEY,
    student_id VARCHAR(64) NOT NULL,
    student_name VARCHAR(255),
    amount NUMERIC(12,2),
    status VARCHAR(32),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by VARCHAR(64)
);

-- 7. Table: leads (Tiếp nhận lead tư vấn từ Landing Page)
CREATE TABLE IF NOT EXISTS public.leads (
    id VARCHAR(64) PRIMARY KEY,
    code VARCHAR(32),
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(32) NOT NULL,
    email VARCHAR(255) NOT NULL,
    course VARCHAR(255),
    notes TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'Mới',
    source VARCHAR(255) DEFAULT 'Website (Biểu mẫu công khai)',
    ip VARCHAR(64),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Insert Standard 8 Roles
INSERT INTO public.roles (id, code, name, description) VALUES
('administrator', 'administrator', 'Quản trị hệ thống', 'Toàn quyền quản trị hệ thống, tài khoản và phân quyền'),
('training_manager', 'training_manager', 'Quản lý đào tạo', 'Quản lý chương trình, môn học, lớp học và tiến độ đào tạo'),
('instructor', 'instructor', 'Giảng viên', 'Quản lý lớp học phụ trách, điểm danh và chấm bài tập'),
('teaching_assistant', 'teaching_assistant', 'Trợ giảng', 'Hỗ trợ giảng viên hướng dẫn học viên và điểm danh'),
('student', 'student', 'Học viên', 'Học tập, nộp bài tập và xem kết quả học tập'),
('admissions', 'admissions', 'Tư vấn tuyển sinh', 'Tiếp nhận lead, tư vấn khóa học và ghi danh'),
('accountant', 'accountant', 'Kế toán đào tạo', 'Quản lý học phí, biên lai thu và đối soát công nợ'),
('visitor', 'visitor', 'Khách truy cập', 'Xem thông tin khóa học công khai và biểu phí tham khảo'),
('technical_manager', 'technical_manager', 'Quản lý kỹ thuật & Mail', 'Quản trị kỹ thuật hệ thống, cấu hình máy chủ và nhật ký gửi Mail SMTP')
ON CONFLICT (id) DO NOTHING;

-- 9. Enable Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tuition ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- 10. Read/Write policies for public and authenticated
CREATE POLICY "Public read for roles" ON public.roles FOR SELECT USING (true);
CREATE POLICY "Public insert leads" ON public.leads FOR INSERT WITH CHECK (true);
CREATE POLICY "Service role full access users" ON public.users FOR ALL USING (true);
CREATE POLICY "Service role full access user_roles" ON public.user_roles FOR ALL USING (true);
CREATE POLICY "Service role full access audit_logs" ON public.audit_logs FOR ALL USING (true);
CREATE POLICY "Service role full access scores" ON public.scores FOR ALL USING (true);
CREATE POLICY "Service role full access tuition" ON public.tuition FOR ALL USING (true);
CREATE POLICY "Service role full access leads" ON public.leads FOR ALL USING (true);

-- ========================================================
-- KN-70 (KN-107): SUBJECT & PROGRAM CATALOG MANAGEMENT
-- Quản lý danh mục môn học, tái sử dụng đa chương trình
-- Ràng buộc: Môn đã có lớp học thì không xóa được (RESTRICT)
-- ========================================================

-- 11. Table: programs (Chương trình đào tạo)
CREATE TABLE IF NOT EXISTS public.programs (
    id VARCHAR(64) PRIMARY KEY,
    code VARCHAR(32) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    total_sessions INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Table: subjects (Danh mục môn học)
CREATE TABLE IF NOT EXISTS public.subjects (
    id VARCHAR(64) PRIMARY KEY,
    code VARCHAR(32) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    sessions INT NOT NULL CHECK (sessions > 0),
    weight NUMERIC(4,2) NOT NULL CHECK (weight > 0),
    outcomes TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by VARCHAR(64) REFERENCES public.users(id) ON DELETE SET NULL
);

-- 13. Table: program_subjects (Quan hệ nhiều-nhiều: Một môn dùng cho nhiều chương trình)
CREATE TABLE IF NOT EXISTS public.program_subjects (
    id SERIAL PRIMARY KEY,
    program_id VARCHAR(64) NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
    subject_id VARCHAR(64) NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_program_subject UNIQUE (program_id, subject_id)
);

-- 14. Table: classes (Lớp học - Ràng buộc: Môn đã có lớp học thì không được xóa)
CREATE TABLE IF NOT EXISTS public.classes (
    id VARCHAR(64) PRIMARY KEY,
    code VARCHAR(32) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    subject_id VARCHAR(64) NOT NULL REFERENCES public.subjects(id) ON DELETE RESTRICT,
    program_id VARCHAR(64) REFERENCES public.programs(id) ON DELETE SET NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 15. RLS Policies for Subjects & Programs
ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read programs" ON public.programs FOR SELECT USING (true);
CREATE POLICY "Public read subjects" ON public.subjects FOR SELECT USING (true);
CREATE POLICY "Public read program_subjects" ON public.program_subjects FOR SELECT USING (true);
CREATE POLICY "Public read classes" ON public.classes FOR SELECT USING (true);

CREATE POLICY "Service role full access programs" ON public.programs FOR ALL USING (true);
CREATE POLICY "Service role full access subjects" ON public.subjects FOR ALL USING (true);
CREATE POLICY "Service role full access program_subjects" ON public.program_subjects FOR ALL USING (true);
CREATE POLICY "Service role full access classes" ON public.classes FOR ALL USING (true);

-- ========================================================
-- KN-154: AUTO SCHEDULE GENERATOR & TIMETABLE MANAGEMENT
-- Sinh thời khóa biểu tự động theo mẫu lặp cho lớp học (60 buổi)
-- Tự động bỏ qua ngày nghỉ lễ, gắn bài học theo môn (Syllabus Mapping)
-- ========================================================

-- 16. Table: holidays (Danh mục ngày nghỉ lễ hệ thống & trường học)
CREATE TABLE IF NOT EXISTS public.holidays (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    date DATE NOT NULL,
    recurring_month_day VARCHAR(8), -- vd: "01-01", "04-30", "05-01", "09-02"
    description TEXT,
    type VARCHAR(32) NOT NULL DEFAULT 'national', -- national | school | custom
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 17. Table: class_schedules (Thời khóa biểu chi tiết từng buổi học)
CREATE TABLE IF NOT EXISTS public.class_schedules (
    id VARCHAR(64) PRIMARY KEY,
    class_id VARCHAR(64) NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    session_number INT NOT NULL CHECK (session_number > 0),
    total_sessions INT NOT NULL CHECK (total_sessions > 0),
    date DATE NOT NULL,
    day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    day_of_week_name VARCHAR(32) NOT NULL,
    shift VARCHAR(32) NOT NULL DEFAULT 'morning',
    start_time VARCHAR(8) NOT NULL, -- vd: "08:00"
    end_time VARCHAR(8) NOT NULL,   -- vd: "11:30"
    room VARCHAR(128) NOT NULL,
    instructor VARCHAR(255) NOT NULL,
    lesson_number INT,
    lesson_topic VARCHAR(255),
    lesson_type VARCHAR(32) DEFAULT 'practice', -- theory | practice | assessment | workshop | exam
    status VARCHAR(32) NOT NULL DEFAULT 'scheduled', -- scheduled | completed | cancelled | in_progress
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_class_session UNIQUE (class_id, session_number)
);

-- 18. Chỉ mục tối ưu tốc độ tìm kiếm & tra cứu lịch học
CREATE INDEX IF NOT EXISTS idx_class_schedules_class_id ON public.class_schedules(class_id);
CREATE INDEX IF NOT EXISTS idx_class_schedules_date ON public.class_schedules(date);
CREATE INDEX IF NOT EXISTS idx_class_schedules_instructor ON public.class_schedules(instructor);
CREATE INDEX IF NOT EXISTS idx_holidays_date ON public.holidays(date);

-- 19. RLS Policies for Schedules & Holidays
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read holidays" ON public.holidays FOR SELECT USING (true);
CREATE POLICY "Public read class_schedules" ON public.class_schedules FOR SELECT USING (true);

CREATE POLICY "Service role full access holidays" ON public.holidays FOR ALL USING (true);
CREATE POLICY "Service role full access class_schedules" ON public.class_schedules FOR ALL USING (true);


