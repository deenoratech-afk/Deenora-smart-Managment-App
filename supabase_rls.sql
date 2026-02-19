
-- ==========================================
-- 1. NUCLEAR CLEANUP
-- Drops ALL existing policies in the public schema to prevent conflicts
-- ==========================================
DO $$ 
DECLARE 
    t text;
    p text;
BEGIN
    FOR t, p IN 
        SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', p, t);
    END LOOP;
END $$;

-- ==========================================
-- 2. RECURSION-PROOF HELPER FUNCTIONS
-- ==========================================

-- Check if user is super admin
CREATE OR REPLACE FUNCTION public.check_is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'super_admin'
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- Get madrasah ID for current user
CREATE OR REPLACE FUNCTION public.get_authenticated_madrasah_id()
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT madrasah_id FROM public.profiles 
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- ==========================================
-- 3. ENABLE RLS ON ALL TABLES
-- ==========================================
ALTER TABLE public.madrasahs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_marks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recent_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_templates ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- 4. THE RECURSION FIX: PROFILES TABLE
-- ==========================================

-- Standard user: only see your own profile
CREATE POLICY "profiles_self_access" ON public.profiles
FOR SELECT USING (auth.uid() = id);

-- Super admin: see and manage all profiles
CREATE POLICY "profiles_admin_access" ON public.profiles
FOR ALL USING (public.check_is_super_admin());

-- ==========================================
-- 5. TENANT ISOLATION POLICIES
-- ==========================================

-- MADRASAHS
CREATE POLICY "madrasah_access" ON public.madrasahs
FOR SELECT USING (
  id = public.get_authenticated_madrasah_id() 
  OR public.check_is_super_admin()
);

-- CLASSES
CREATE POLICY "class_isolation" ON public.classes
FOR ALL USING (
  madrasah_id = public.get_authenticated_madrasah_id() 
  OR public.check_is_super_admin()
);

-- STUDENTS
CREATE POLICY "student_isolation" ON public.students
FOR ALL USING (
  madrasah_id = public.get_authenticated_madrasah_id() 
  OR public.check_is_super_admin()
);

-- TEACHERS
CREATE POLICY "teacher_isolation" ON public.teachers
FOR ALL USING (
  madrasah_id = public.get_authenticated_madrasah_id() 
  OR public.check_is_super_admin()
);

-- FEE STRUCTURES (The Fix)
CREATE POLICY "fee_structures_isolation" ON public.fee_structures
FOR ALL USING (
  madrasah_id = public.get_authenticated_madrasah_id() 
  OR public.check_is_super_admin()
);

-- ATTENDANCE
CREATE POLICY "attendance_isolation" ON public.attendance
FOR ALL USING (
  madrasah_id = public.get_authenticated_madrasah_id() 
  OR public.check_is_super_admin()
);

-- EXAMS
CREATE POLICY "exams_isolation" ON public.exams
FOR ALL USING (
  madrasah_id = public.get_authenticated_madrasah_id() 
  OR public.check_is_super_admin()
);

-- EXAM SUBJECTS (Linked via exam_id)
CREATE POLICY "exam_subjects_isolation" ON public.exam_subjects
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.exams 
    WHERE exams.id = exam_subjects.exam_id 
    AND exams.madrasah_id = public.get_authenticated_madrasah_id()
  )
  OR public.check_is_super_admin()
);

-- EXAM MARKS (Linked via exam_id)
CREATE POLICY "exam_marks_isolation" ON public.exam_marks
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.exams 
    WHERE exams.id = exam_marks.exam_id 
    AND exams.madrasah_id = public.get_authenticated_madrasah_id()
  )
  OR public.check_is_super_admin()
);

-- FINANCIALS (Ledger/Fees)
CREATE POLICY "ledger_isolation" ON public.ledger
FOR ALL USING (
  madrasah_id = public.get_authenticated_madrasah_id() 
  OR public.check_is_super_admin()
);

CREATE POLICY "fees_isolation" ON public.fees
FOR ALL USING (
  madrasah_id = public.get_authenticated_madrasah_id() 
  OR public.check_is_super_admin()
);

-- RECENT CALLS
CREATE POLICY "calls_isolation" ON public.recent_calls
FOR ALL USING (
  madrasah_id = public.get_authenticated_madrasah_id()
);

-- SMS TEMPLATES
CREATE POLICY "templates_isolation" ON public.sms_templates
FOR ALL USING (
  madrasah_id = public.get_authenticated_madrasah_id()
);

-- TRANSACTIONS
CREATE POLICY "transaction_view" ON public.transactions
FOR SELECT USING (
  madrasah_id = public.get_authenticated_madrasah_id() 
  OR public.check_is_super_admin()
);

CREATE POLICY "transaction_insert" ON public.transactions
FOR INSERT WITH CHECK (
  madrasah_id = public.get_authenticated_madrasah_id()
);
