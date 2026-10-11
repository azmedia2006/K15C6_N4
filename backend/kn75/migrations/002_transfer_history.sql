-- KN-119: Lịch sử chuyển giao, ghi TỰ ĐỘNG bằng trigger khi người phụ trách thay đổi.
CREATE TABLE IF NOT EXISTS public.kn75_lead_transfer_history (
    id              BIGSERIAL PRIMARY KEY,
    lead_id         VARCHAR(64) NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    old_user_id     VARCHAR(64) REFERENCES public.users(id) ON DELETE SET NULL,  -- người cũ
    new_user_id     VARCHAR(64) REFERENCES public.users(id) ON DELETE SET NULL,  -- người mới
    performed_by    VARCHAR(64) REFERENCES public.users(id) ON DELETE SET NULL,  -- người thực hiện
    -- Ảnh chụp tên tại thời điểm chuyển giao: vẫn đọc được khi user bị xóa/đổi tên.
    old_user_name   VARCHAR(255),
    new_user_name   VARCHAR(255) NOT NULL,
    performed_by_name VARCHAR(255) NOT NULL,
    old_user_inactive BOOLEAN NOT NULL DEFAULT FALSE,
    reason          VARCHAR(500) NOT NULL DEFAULT '',
    transferred_at  TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_kn75_history_lead
    ON public.kn75_lead_transfer_history (lead_id, transferred_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_kn75_history_new_user
    ON public.kn75_lead_transfer_history (new_user_id, transferred_at DESC);

-- BEFORE: bắt buộc có ngữ cảnh người thực hiện; giao lại đúng người cũ = no-op.
CREATE OR REPLACE FUNCTION public.kn75_before_assignment() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF nullif(current_setting('kn75.actor', true), '') IS DISTINCT FROM NEW.nguoi_giao_id THEN
        RAISE EXCEPTION 'KN75: thiếu hoặc sai ngữ cảnh người thực hiện phân công';
    END IF;
    IF TG_OP = 'UPDATE' AND OLD.tu_van_vien_id = NEW.tu_van_vien_id THEN
        RETURN OLD;
    END IF;
    NEW.assigned_at := clock_timestamp();
    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS kn75_before_assignment ON public.kn75_lead_assignments;
CREATE TRIGGER kn75_before_assignment
    BEFORE INSERT OR UPDATE ON public.kn75_lead_assignments
    FOR EACH ROW EXECUTE FUNCTION public.kn75_before_assignment();

-- AFTER: ghi 1 dòng lịch sử (người cũ, người mới, người thực hiện, lý do, thời gian).
CREATE OR REPLACE FUNCTION public.kn75_after_assignment() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    v_old VARCHAR(64) := CASE WHEN TG_OP = 'UPDATE' THEN OLD.tu_van_vien_id END;
BEGIN
    IF TG_OP = 'UPDATE' AND OLD.tu_van_vien_id = NEW.tu_van_vien_id THEN
        RETURN NEW;
    END IF;
    INSERT INTO public.kn75_lead_transfer_history
        (lead_id, old_user_id, new_user_id, performed_by,
         old_user_name, new_user_name, performed_by_name,
         old_user_inactive, reason, transferred_at)
    VALUES
        (NEW.lead_id, v_old, NEW.tu_van_vien_id, NEW.nguoi_giao_id,
         (SELECT name FROM public.users WHERE id = v_old),
         coalesce((SELECT name FROM public.users WHERE id = NEW.tu_van_vien_id), NEW.tu_van_vien_id),
         coalesce((SELECT name FROM public.users WHERE id = NEW.nguoi_giao_id), NEW.nguoi_giao_id),
         coalesce(coalesce(current_setting('kn75.old_inactive', true), '') LIKE '%,' || v_old || ',%', FALSE),
         coalesce(current_setting('kn75.reason', true), ''),
         NEW.assigned_at);
    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS kn75_after_assignment ON public.kn75_lead_assignments;
CREATE TRIGGER kn75_after_assignment
    AFTER INSERT OR UPDATE ON public.kn75_lead_assignments
    FOR EACH ROW EXECUTE FUNCTION public.kn75_after_assignment();

-- Lịch sử chỉ được thêm, không sửa (DELETE chỉ xảy ra qua CASCADE khi xóa lead/user).
CREATE OR REPLACE FUNCTION public.kn75_history_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND (NEW.lead_id, NEW.new_user_name, NEW.performed_by_name, NEW.reason, NEW.transferred_at)
        IS NOT DISTINCT FROM (OLD.lead_id, OLD.new_user_name, OLD.performed_by_name, OLD.reason, OLD.transferred_at) THEN
        RETURN NEW; -- cho phép FK ON DELETE SET NULL cập nhật cột *_id
    END IF;
    RAISE EXCEPTION 'KN75: lịch sử chuyển giao chỉ được thêm mới';
END $$;

DROP TRIGGER IF EXISTS kn75_history_append_only ON public.kn75_lead_transfer_history;
CREATE TRIGGER kn75_history_append_only
    BEFORE UPDATE ON public.kn75_lead_transfer_history
    FOR EACH ROW EXECUTE FUNCTION public.kn75_history_append_only();
