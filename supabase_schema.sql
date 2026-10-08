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
('visitor', 'visitor', 'Khách truy cập', 'Xem thông tin khóa học công khai và biểu phí tham khảo')
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
