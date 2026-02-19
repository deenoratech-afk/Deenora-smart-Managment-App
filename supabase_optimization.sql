
-- 1. CRITICAL PERFORMANCE INDICES (Tenant-First)
-- These indices ensure that RLS filters (which always check madrasah_id) are lightning fast.

-- Students: Optimized for class listing and roll-based sorting
CREATE INDEX IF NOT EXISTS idx_students_tenant_class_roll 
ON public.students (madrasah_id, class_id, roll);

-- Students: Optimized for name search within a madrasah
CREATE INDEX IF NOT EXISTS idx_students_tenant_name_search 
ON public.students USING gin (madrasah_id, student_name gin_trgm_ops);

-- Attendance: Optimized for date range queries within a madrasah
CREATE INDEX IF NOT EXISTS idx_attendance_tenant_date 
ON public.attendance (madrasah_id, date, student_id);

-- Ledger: Optimized for financial reporting
CREATE INDEX IF NOT EXISTS idx_ledger_tenant_date_type 
ON public.ledger (madrasah_id, transaction_date DESC, type);

-- Exam Marks: Optimized for ranking calculations
CREATE INDEX IF NOT EXISTS idx_exam_marks_composite 
ON public.exam_marks (exam_id, student_id, marks_obtained DESC);

-- 2. SCALABLE PAGINATION HELPER
-- Use this instead of simple select to get student counts efficiently
CREATE OR REPLACE FUNCTION get_tenant_student_summary(p_madrasah_id UUID, p_class_id UUID DEFAULT NULL)
RETURNS TABLE (
    total_count BIGINT,
    active_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*),
        COUNT(*) -- Placeholder for is_active if added later
    FROM public.students
    WHERE madrasah_id = p_madrasah_id
    AND (p_class_id IS NULL OR class_id = p_class_id);
END;
$$ LANGUAGE plpgsql STABLE;

-- 3. VACUUM & ANALYZE (Run periodically for query planner health)
-- ANALYZE public.students;
-- ANALYZE public.attendance;
