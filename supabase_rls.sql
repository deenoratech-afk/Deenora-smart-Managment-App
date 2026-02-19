
-- ==========================================
-- 1. RECURSION-SAFE HELPER FUNCTIONS
-- ==========================================

-- Check if user is super admin (Bypasses RLS using SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.check_is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'super_admin'
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- Get madrasah ID (Bypasses RLS using SECURITY DEFINER)
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
-- 2. CLEANUP & ENABLE RLS
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

ALTER TABLE public.madrasahs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- 3. THE RECURSION FIX (PROFILES TABLE)
-- ==========================================

-- Standard user: only see your own profile
CREATE POLICY "profiles_self_read" ON public.profiles
FOR SELECT USING (auth.uid() = id);

-- Super admin: see all (Uses the SD function to avoid loop)
CREATE POLICY "profiles_admin_all" ON public.profiles
FOR ALL USING (public.check_is_super_admin());

-- ==========================================
-- 4. TENANT ISOLATION POLICIES
-- ==========================================

-- MADRASAHS
CREATE POLICY "madrasah_tenant_access" ON public.madrasahs
FOR SELECT USING (id = public.get_authenticated_madrasah_id() OR public.check_is_super_admin());

-- CLASSES
CREATE POLICY "class_tenant_isolation" ON public.classes
FOR ALL USING (madrasah_id = public.get_authenticated_madrasah_id() OR public.check_is_super_admin());

-- STUDENTS
CREATE POLICY "student_tenant_isolation" ON public.students
FOR ALL USING (madrasah_id = public.get_authenticated_madrasah_id() OR public.check_is_super_admin());

-- TEACHERS
CREATE POLICY "teacher_tenant_isolation" ON public.teachers
FOR ALL USING (madrasah_id = public.get_authenticated_madrasah_id() OR public.check_is_super_admin());

-- TRANSACTIONS
CREATE POLICY "transaction_tenant_view" ON public.transactions
FOR SELECT USING (madrasah_id = public.get_authenticated_madrasah_id() OR public.check_is_super_admin());

CREATE POLICY "transaction_tenant_insert" ON public.transactions
FOR INSERT WITH CHECK (madrasah_id = public.get_authenticated_madrasah_id());

-- FINANCIALS (Ledger/Fees)
CREATE POLICY "finance_tenant_isolation" ON public.ledger
FOR ALL USING (madrasah_id = public.get_authenticated_madrasah_id() OR public.check_is_super_admin());

CREATE POLICY "fee_tenant_isolation" ON public.fees
FOR ALL USING (madrasah_id = public.get_authenticated_madrasah_id() OR public.check_is_super_admin());

-- ATTENDANCE / EXAMS
CREATE POLICY "attendance_tenant_isolation" ON public.attendance
FOR ALL USING (madrasah_id = public.get_authenticated_madrasah_id() OR public.check_is_super_admin());

CREATE POLICY "exam_tenant_isolation" ON public.exams
FOR ALL USING (madrasah_id = public.get_authenticated_madrasah_id() OR public.check_is_super_admin());
