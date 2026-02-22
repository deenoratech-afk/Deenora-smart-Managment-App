
-- Student Risk Analysis Function
CREATE OR REPLACE FUNCTION get_student_risk_analysis(p_madrasah_id UUID)
RETURNS TABLE (
    student_id UUID,
    student_name TEXT,
    class_name TEXT,
    roll INTEGER,
    attendance_pct NUMERIC,
    late_count BIGINT,
    latest_avg NUMERIC,
    dropout_risk TEXT,
    late_risk TEXT,
    result_risk TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_start_date DATE := CURRENT_DATE - INTERVAL '30 days';
BEGIN
    RETURN QUERY
    WITH 
    -- 1. Attendance Metrics (Last 30 Days)
    att_metrics AS (
        SELECT 
            s.id as s_id,
            COUNT(a.id) as total_days,
            COUNT(a.id) FILTER (WHERE a.status IN ('present', 'late')) as active_days,
            COUNT(a.id) FILTER (WHERE a.status = 'late') as lates
        FROM public.students s
        LEFT JOIN public.attendance a ON s.id = a.student_id AND a.date >= v_start_date
        WHERE s.madrasah_id = p_madrasah_id
        GROUP BY s.id
    ),
    -- 2. Latest Exam Metrics
    latest_exams AS (
        SELECT DISTINCT ON (e.class_id) e.id, e.class_id
        FROM public.exams e
        WHERE e.madrasah_id = p_madrasah_id
        ORDER BY e.class_id, e.exam_date DESC, e.created_at DESC
    ),
    exam_metrics AS (
        SELECT 
            s.id as s_id,
            AVG(CASE WHEN es.full_marks > 0 THEN (em.marks_obtained / es.full_marks) * 100 ELSE 0 END) as avg_pct
        FROM public.students s
        JOIN latest_exams le ON s.class_id = le.class_id
        JOIN public.exam_marks em ON s.id = em.student_id AND em.exam_id = le.id
        JOIN public.exam_subjects es ON em.subject_id = es.id
        GROUP BY s.id
    )
    SELECT 
        s.id,
        s.student_name,
        c.class_name,
        s.roll,
        COALESCE(CASE WHEN am.total_days > 0 THEN (am.active_days::NUMERIC / am.total_days::NUMERIC) * 100 ELSE 100 END, 100)::NUMERIC as attendance_pct,
        COALESCE(am.lates, 0) as late_count,
        COALESCE(em.avg_pct, 100)::NUMERIC as latest_avg,
        -- Dropout Risk Logic
        CASE 
            WHEN am.total_days < 5 THEN 'safe' -- Not enough data
            WHEN (am.active_days::NUMERIC / am.total_days::NUMERIC) < 0.6 THEN 'high'
            WHEN (am.active_days::NUMERIC / am.total_days::NUMERIC) < 0.8 THEN 'warning'
            ELSE 'safe'
        END as dropout_risk,
        -- Late Risk Logic
        CASE 
            WHEN am.lates >= 5 THEN 'high'
            WHEN am.lates >= 2 THEN 'warning'
            ELSE 'safe'
        END as late_risk,
        -- Result Risk Logic
        CASE 
            WHEN em.avg_pct < 40 THEN 'high'
            WHEN em.avg_pct < 60 THEN 'warning'
            ELSE 'safe'
        END as result_risk
    FROM public.students s
    JOIN public.classes c ON s.class_id = c.id
    LEFT JOIN att_metrics am ON s.id = am.s_id
    LEFT JOIN exam_metrics em ON s.id = em.s_id
    WHERE s.madrasah_id = p_madrasah_id
    ORDER BY 
        CASE WHEN dropout_risk = 'high' OR late_risk = 'high' OR result_risk = 'high' THEN 0 
             WHEN dropout_risk = 'warning' OR late_risk = 'warning' OR result_risk = 'warning' THEN 1 
             ELSE 2 END ASC,
        s.student_name ASC;
END;
$$;

-- Smart Result Insights Function
CREATE OR REPLACE FUNCTION get_smart_result_insights(p_madrasah_id UUID)
RETURNS TABLE (
    student_id UUID,
    student_name TEXT,
    class_name TEXT,
    roll INTEGER,
    current_avg NUMERIC,
    previous_avg NUMERIC,
    change NUMERIC,
    status TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    WITH student_exam_history AS (
        SELECT 
            s.id as s_id,
            s.student_name,
            c.class_name,
            s.roll,
            e.id as exam_id,
            e.exam_date,
            AVG(CASE WHEN es.full_marks > 0 THEN (em.marks_obtained / es.full_marks) * 100 ELSE 0 END) as avg_pct,
            DENSE_RANK() OVER (PARTITION BY s.id ORDER BY e.exam_date DESC, e.created_at DESC) as exam_rank
        FROM public.students s
        JOIN public.classes c ON s.class_id = c.id
        JOIN public.exams e ON s.class_id = e.class_id
        JOIN public.exam_marks em ON s.id = em.student_id AND em.exam_id = e.id
        JOIN public.exam_subjects es ON em.subject_id = es.id
        WHERE s.madrasah_id = p_madrasah_id
        GROUP BY s.id, s.student_name, c.class_name, s.roll, e.id, e.exam_date, e.created_at
    ),
    latest_two AS (
        SELECT 
            h1.s_id,
            h1.student_name,
            h1.class_name,
            h1.roll,
            h1.avg_pct as current_avg,
            COALESCE(h2.avg_pct, h1.avg_pct) as previous_avg
        FROM student_exam_history h1
        LEFT JOIN student_exam_history h2 ON h1.s_id = h2.s_id AND h2.exam_rank = 2
        WHERE h1.exam_rank = 1
    )
    SELECT 
        l.s_id,
        l.student_name,
        l.class_name,
        l.roll,
        ROUND(l.current_avg, 2) as current_avg,
        ROUND(l.previous_avg, 2) as previous_avg,
        ROUND(l.current_avg - l.previous_avg, 2) as change,
        CASE 
            WHEN (l.current_avg - l.previous_avg) > 5 THEN 'improving'
            WHEN (l.current_avg - l.previous_avg) < -5 THEN 'declining'
            ELSE 'stable'
        END as status
    FROM latest_two l
    WHERE ABS(l.current_avg - l.previous_avg) > 0.1 OR l.current_avg > 0
    ORDER BY ABS(l.current_avg - l.previous_avg) DESC;
END;
$$;
