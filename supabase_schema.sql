
-- Enable RLS
ALTER TABLE IF EXISTS public.madrasahs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.teachers ENABLE ROW LEVEL SECURITY;

-- 1. Roles & User Profiles
-- This links Supabase Auth users to the Madrasah SaaS system
CREATE TYPE user_role AS ENUM ('super_admin', 'madrasah_admin', 'teacher', 'accountant');

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  madrasah_id UUID REFERENCES public.madrasahs(id),
  full_name TEXT,
  role user_role DEFAULT 'teacher',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2. Student Fees & Collections
CREATE TABLE IF NOT EXISTS public.fees (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  madrasah_id UUID REFERENCES public.madrasahs(id) NOT NULL,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  month TEXT NOT NULL, -- e.g., 'January 2025'
  status TEXT DEFAULT 'unpaid', -- paid, unpaid, partial
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.fees ENABLE ROW LEVEL SECURITY;

-- 3. Madrasah Accounts (Income / Expenses)
CREATE TABLE IF NOT EXISTS public.ledger (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  madrasah_id UUID REFERENCES public.madrasahs(id) NOT NULL,
  type TEXT NOT NULL, -- 'income' or 'expense'
  category TEXT, -- 'salary', 'electricity', 'donation', 'fee'
  amount DECIMAL(12,2) NOT NULL,
  description TEXT,
  transaction_date DATE DEFAULT CURRENT_DATE,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.ledger ENABLE ROW LEVEL SECURITY;

-- 4. Attendance System
CREATE TABLE IF NOT EXISTS public.attendance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  madrasah_id UUID REFERENCES public.madrasahs(id) NOT NULL,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL, -- 'present', 'absent', 'late'
  date DATE DEFAULT CURRENT_DATE,
  recorded_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for Multi-Tenancy
-- Policy: Users can only see data from their own Madrasah
-- profiles policy
CREATE POLICY "Users can see their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Admins can see all profiles in their madrasah" ON public.profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = auth.uid() 
      AND (p.role = 'madrasah_admin' OR p.role = 'super_admin')
      AND p.madrasah_id = profiles.madrasah_id
    )
  );

-- ledger policy
CREATE POLICY "Users can see ledger for their madrasah" ON public.ledger
  FOR SELECT USING (
    madrasah_id = (SELECT madrasah_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "Accountants and Admins can manage ledger" ON public.ledger
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = auth.uid() 
      AND (p.role = 'madrasah_admin' OR p.role = 'accountant')
      AND p.madrasah_id = ledger.madrasah_id
    )
  );

-- attendance policy
CREATE POLICY "Users can manage attendance for their madrasah" ON public.attendance
  FOR ALL USING (
    madrasah_id = (SELECT madrasah_id FROM public.profiles WHERE id = auth.uid())
  );

-- Updated Approve Payment Logic
CREATE OR REPLACE FUNCTION approve_payment_with_sms(t_id UUID, m_id UUID, sms_to_give INTEGER)
RETURNS JSON AS $$
DECLARE
    current_admin_stock INTEGER;
    stock_id UUID;
BEGIN
    SELECT id, remaining_sms INTO stock_id, current_admin_stock FROM admin_sms_stock LIMIT 1;
    
    IF stock_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Admin stock not found.');
    END IF;

    IF current_admin_stock IS NULL OR current_admin_stock < sms_to_give THEN
        RETURN json_build_object('success', false, 'error', 'Insufficient admin SMS stock.');
    END IF;

    UPDATE transactions SET status = 'approved', sms_count = sms_to_give WHERE id = t_id;
    UPDATE madrasahs SET sms_balance = COALESCE(sms_balance, 0) + sms_to_give WHERE id = m_id;
    UPDATE admin_sms_stock SET remaining_sms = remaining_sms - sms_to_give WHERE id = stock_id;

    RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql;
