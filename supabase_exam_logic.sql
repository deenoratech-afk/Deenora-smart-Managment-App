
-- ১. পুরোনো ফাংশনটি মুছে ফেলা (রিটার্ন টাইপ পরিবর্তনের জন্য এটি প্রয়োজন)
DROP FUNCTION IF EXISTS get_exam_ranking(UUID);

-- ২. নতুন এবং উন্নত মেধা তালিকা (Ranking) ফাংশন তৈরি
CREATE OR REPLACE FUNCTION get_exam_ranking(p_exam_id UUID)
RETURNS TABLE (
    student_id UUID,
    student_name TEXT,
    roll INTEGER,
    total_marks NUMERIC,
    rank BIGINT,
    pass_status BOOLEAN
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    WITH student_totals AS (
        SELECT 
            em.student_id,
            SUM(em.marks_obtained) as total_score,
            -- চেক করা হচ্ছে ছাত্র সব বিষয়ে পাস করেছে কি না
            NOT EXISTS (
                SELECT 1 FROM public.exam_marks em2
                JOIN public.exam_subjects es ON em2.subject_id = es.id
                WHERE em2.student_id = em.student_id 
                AND em2.exam_id = p_exam_id
                AND em2.marks_obtained < es.pass_marks
            ) as is_pass
        FROM public.exam_marks em
        WHERE em.exam_id = p_exam_id
        GROUP BY em.student_id
    )
    SELECT 
        s.id as student_id,
        s.student_name,
        s.roll,
        COALESCE(st.total_score, 0)::NUMERIC as total_marks,
        RANK() OVER (ORDER BY COALESCE(st.total_score, 0) DESC) as rank,
        COALESCE(st.is_pass, false) as pass_status
    FROM public.students s
    JOIN public.exams e ON e.id = p_exam_id AND e.class_id = s.class_id
    LEFT JOIN student_totals st ON s.id = st.student_id
    ORDER BY total_marks DESC, s.roll ASC;
END;
$$;
