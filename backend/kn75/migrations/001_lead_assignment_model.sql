-- KN-115: Mô hình dữ liệu phân công lead cho tư vấn viên.
-- public.users và public.leads đã được định nghĩa trong supabase_schema.sql (của nhóm).
-- Hai lệnh CREATE TABLE IF NOT EXISTS dưới đây chỉ phục vụ DB local trống;
-- trên Supabase hiện có chúng là no-op, KHÔNG thay đổi bảng của người khác.
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

-- Bảng phân công: mỗi lead có đúng 1 người phụ trách hiện tại (PK = lead_id).
-- ON DELETE CASCADE để không chặn chức năng xóa user/lead của module khác.
CREATE TABLE IF NOT EXISTS public.kn75_lead_assignments (
    lead_id        VARCHAR(64) PRIMARY KEY
                   REFERENCES public.leads(id) ON DELETE CASCADE,
    tu_van_vien_id VARCHAR(64) NOT NULL
                   REFERENCES public.users(id) ON DELETE CASCADE,
    nguoi_giao_id  VARCHAR(64)
                   REFERENCES public.users(id) ON DELETE SET NULL,
    assigned_at    TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_kn75_assign_counselor
    ON public.kn75_lead_assignments (tu_van_vien_id, assigned_at DESC, lead_id);
CREATE INDEX IF NOT EXISTS idx_kn75_assign_assigner
    ON public.kn75_lead_assignments (nguoi_giao_id);
