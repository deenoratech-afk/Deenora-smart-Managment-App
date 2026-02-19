
-- Exam tables
CREATE TABLE IF NOT EXISTS public.exams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  madrasah_id UUID REFERENCES public.madrasahs(id) ON DELETE CASCADE NOT NULL,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE NOT NULL,
  exam_name TEXT NOT NULL,
  exam_date DATE NOT NULL,
  is_published BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.exam_subjects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_id UUID REFERENCES public.exams(id) ON DELETE CASCADE NOT NULL,
  subject_name TEXT NOT NULL,
  full_marks INTEGER DEFAULT 100,
  pass_marks INTEGER DEFAULT 33,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.exam_marks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_id UUID REFERENCES public.exams(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
  subject_id UUID REFERENCES public.exam_subjects(id) ON DELETE CASCADE NOT NULL,
  marks_obtained DECIMAL(5,2) NOT NULL,
  UNIQUE(student_id, subject_id)
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_exams_class ON public.exams(class_id);
CREATE INDEX IF NOT EXISTS idx_exam_marks_student ON public.exam_marks(student_id);

-- Function to get exam ranking and detailed results
CREATE OR REPLACE FUNCTION get_exam_ranking(p_exam_id UUID)
RETURNS TABLE (
    student_id UUID,
    student_name TEXT,
    roll INTEGER,
    total_marks DECIMAL(12,2),
    pass_status BOOLEAN,
    rank BIGINT
) AS $$
BEGIN
    RETURN QUERY
    WITH student_totals AS (
        SELECT 
            s.id as s_id,
            s.student_name as s_name,
            s.roll as s_roll,
            SUM(em.marks_obtained) as t_marks,
            -- Check if any subject marks are below pass marks
            BOOL_AND(em.marks_obtained >= es.pass_marks) as p_status
        FROM public.students s
        JOIN public.exams e ON s.class_id = e.class_id
        LEFT JOIN public.exam_subjects es ON e.id = es.exam_id
        LEFT JOIN public.exam_marks em ON s.id = em.student_id AND es.id = em.subject_id
        WHERE e.id = p_exam_id
        GROUP BY s.id, s.student_name, s.roll
    )
    SELECT 
        s_id,
        s_name,
        s_roll,
        COALESCE(t_marks, 0),
        COALESCE(p_status, FALSE),
        DENSE_RANK() OVER (ORDER BY COALESCE(t_marks, 0) DESC) as rank
    FROM student_totals
    ORDER BY rank ASC, s_roll ASC;
END;
$$ LANGUAGE plpgsql;
