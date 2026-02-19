
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
-- Using SECURITY DEFINER bypasses RLS for queries inside the function
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
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recent_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_templates ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- 4. THE RECURSION FIX: PROFILES TABLE
-- We split self-access from admin-access to stop the loop
-- ==========================================

-- Standard user: only see your own profile (No subquery = No recursion)
CREATE POLICY "profiles_self_access" ON public.profiles
FOR SELECT USING (auth.uid() = id);

-- Super admin: see and manage all profiles
CREATE POLICY "profiles_admin_access" ON public.profiles
FOR ALL USING (public.check_is_super_admin());

-- ==========================================
-- 5. TENANT ISOLATION POLICIES
-- ==========================================

-- MADRASAHS (Access your own or if super admin)
CREATE POLICY "madrasah_access" ON public.madrasahs
FOR SELECT USING (
  id = public.get_authenticated_madrasah_id() 
  OR public.check_is_super_admin()
);

-- CLASSES (Tenant Isolation)
CREATE POLICY "class_isolation" ON public.classes
FOR ALL USING (
  madrasah_id = public.get_authenticated_madrasah_id() 
  OR public.check_is_super_admin()
);

-- STUDENTS (Tenant Isolation)
CREATE POLICY "student_isolation" ON public.students
FOR ALL USING (
  madrasah_id = public.get_authenticated_madrasah_id() 
  OR public.check_is_super_admin()
);

-- TEACHERS (Tenant Isolation)
CREATE POLICY "teacher_isolation" ON public.teachers
FOR ALL USING (
  madrasah_id = public.get_authenticated_madrasah_id() 
  OR public.check_is_super_admin()
);

-- RECENT CALLS (Tenant Isolation)
CREATE POLICY "calls_isolation" ON public.recent_calls
FOR ALL USING (
  madrasah_id = public.get_authenticated_madrasah_id()
);

-- SMS TEMPLATES (Tenant Isolation)
CREATE POLICY "templates_isolation" ON public.sms_templates
FOR ALL USING (
  madrasah_id = public.get_authenticated_madrasah_id()
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

-- ATTENDANCE / EXAMS
CREATE POLICY "attendance_isolation" ON public.attendance
FOR ALL USING (
  madrasah_id = public.get_authenticated_madrasah_id() 
  OR public.check_is_super_admin()
);

CREATE POLICY "exams_isolation" ON public.exams
FOR ALL USING (
  madrasah_id = public.get_authenticated_madrasah_id() 
  OR public.check_is_super_admin()
);

-- TRANSACTIONS (Recharge Requests)
CREATE POLICY "transaction_view" ON public.transactions
FOR SELECT USING (
  madrasah_id = public.get_authenticated_madrasah_id() 
  OR public.check_is_super_admin()
);

CREATE POLICY "transaction_insert" ON public.transactions
FOR INSERT WITH CHECK (
  madrasah_id = public.get_authenticated_madrasah_id()
);
