
-- Function to get monthly attendance summary per class
CREATE OR REPLACE FUNCTION get_attendance_report(p_class_id UUID, p_start_date DATE, p_end_date DATE)
RETURNS TABLE (
    student_id UUID,
    student_name TEXT,
    roll INTEGER,
    present_days BIGINT,
    absent_days BIGINT,
    late_days BIGINT,
    total_days BIGINT
) AS $$
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
    LEFT JOIN public.attendance a ON s.id = a.student_id AND a.date >= p_start_date AND a.date <= p_end_date
    WHERE s.class_id = p_class_id
    GROUP BY s.id, s.student_name, s.roll
    ORDER BY s.roll ASC;
END;
$$ LANGUAGE plpgsql;
