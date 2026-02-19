
-- 1. Helper Function to get authenticated user's madrasah_id
CREATE OR REPLACE FUNCTION public.get_my_madrasah_id()
RETURNS UUID AS $$
  SELECT madrasah_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 2. Helper Function to check if user is super admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT role = 'super_admin' FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 3. ENABLE RLS ON ALL TABLES
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
ALTER TABLE public.recent_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- 4. POLICIES FOR 'madrasahs' (The Tenant Table)
-- Users can read their own madrasah data
CREATE POLICY "Users can view their own madrasah" ON public.madrasahs
FOR SELECT USING (id = public.get_my_madrasah_id() OR public.is_super_admin());

-- Only super admins can insert or delete madrasahs
CREATE POLICY "Super admins manage madrasahs" ON public.madrasahs
FOR ALL USING (public.is_super_admin());

-- 5. POLICIES FOR 'profiles'
CREATE POLICY "Users can view their own profile" ON public.profiles
FOR SELECT USING (id = auth.uid() OR public.is_super_admin());

-- 6. POLICIES FOR 'students' (Isolation)
-- Isolation: Students can only be seen/modified if they belong to the user's Madrasah
CREATE POLICY "Tenant Student Isolation" ON public.students
FOR ALL USING (
    madrasah_id = public.get_my_madrasah_id() OR public.is_super_admin()
)
WITH CHECK (
    madrasah_id = public.get_my_madrasah_id() OR public.is_super_admin()
);

-- 7. POLICIES FOR 'classes'
CREATE POLICY "Tenant Class Isolation" ON public.classes
FOR ALL USING (
    madrasah_id = public.get_my_madrasah_id() OR public.is_super_admin()
)
WITH CHECK (
    madrasah_id = public.get_my_madrasah_id() OR public.is_super_admin()
);

-- 8. POLICIES FOR FINANCIALS (Ledger & Fees)
CREATE POLICY "Tenant Finance Isolation" ON public.ledger
FOR ALL USING (
    madrasah_id = public.get_my_madrasah_id() OR public.is_super_admin()
);

CREATE POLICY "Tenant Fee Isolation" ON public.fees
FOR ALL USING (
    madrasah_id = public.get_my_madrasah_id() OR public.is_super_admin()
);

-- 9. POLICIES FOR EXAMS
CREATE POLICY "Tenant Exam Isolation" ON public.exams
FOR ALL USING (
    madrasah_id = public.get_my_madrasah_id() OR public.is_super_admin()
);

-- 10. POLICIES FOR TRANSACTIONS (Recharge Requests)
-- Users can see their own transactions
CREATE POLICY "Users view own transactions" ON public.transactions
FOR SELECT USING (
    madrasah_id = public.get_my_madrasah_id() OR public.is_super_admin()
);

-- Users can insert their own recharge requests
CREATE POLICY "Users insert own transactions" ON public.transactions
FOR INSERT WITH CHECK (
    madrasah_id = public.get_my_madrasah_id()
);

-- Only super admins can update transaction status
CREATE POLICY "Super admin update transactions" ON public.transactions
FOR UPDATE USING (public.is_super_admin());
