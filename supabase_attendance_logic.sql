
-- ১. attendance টেবিলে class_id কলাম নিশ্চিত করা
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='attendance' AND column_name='class_id') THEN
        ALTER TABLE public.attendance ADD COLUMN class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE;
    END IF;
END $$;

-- ২. পুরোনো ফাংশন মুছে ফেলা
DROP FUNCTION IF EXISTS get_attendance_report(UUID, DATE, DATE);

-- ৩. নতুন এবং উন্নত রিপোর্ট ফাংশন তৈরি
CREATE OR REPLACE FUNCTION get_attendance_report(
    p_class_id UUID, 
    p_start_date DATE, 
    p_end_date DATE
)
RETURNS TABLE (
    student_id UUID,
    student_name TEXT,
    roll INTEGER,
    present_days BIGINT,
    absent_days BIGINT,
    late_days BIGINT,
    total_days BIGINT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id as student_id,
        s.student_name,
        s.roll,
        COUNT(a.id) FILTER (WHERE a.status = 'present') as present_days,
        COUNT(a.id) FILTER (WHERE a.status = 'absent') as absent_days,
        COUNT(a.id) FILTER (WHERE a.status = 'late') as late_days,
        COUNT(a.id) as total_days
    FROM public.students s
    LEFT JOIN public.attendance a ON s.id = a.student_id 
        AND a.date >= p_start_date 
        AND a.date <= p_end_date
    WHERE s.class_id = p_class_id
    GROUP BY s.id, s.student_name, s.roll
    ORDER BY s.roll ASC NULLS LAST;
END;
$$;
