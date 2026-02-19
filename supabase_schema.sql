
-- ==========================================
-- 1. CORE TABLES DEFINITION
-- ==========================================

-- Madrasahs Table
CREATE TABLE IF NOT EXISTS public.madrasahs (
  id UUID PRIMARY KEY, 
  name TEXT NOT NULL,
  phone TEXT,
  logo_url TEXT,
  is_active BOOLEAN DEFAULT true,
  is_super_admin BOOLEAN DEFAULT false,
  balance NUMERIC DEFAULT 0,
  sms_balance INTEGER DEFAULT 0,
  reve_api_key TEXT,
  reve_secret_key TEXT,
  reve_caller_id TEXT,
  reve_client_id TEXT,
  login_code TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  madrasah_id UUID REFERENCES public.madrasahs(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'madrasah_admin', -- super_admin, madrasah_admin, teacher, accountant
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Classes Table
CREATE TABLE IF NOT EXISTS public.classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  madrasah_id UUID REFERENCES public.madrasahs(id) ON DELETE CASCADE,
  class_name TEXT NOT NULL,
  sort_order INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Students Table
CREATE TABLE IF NOT EXISTS public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  madrasah_id UUID REFERENCES public.madrasahs(id) ON DELETE CASCADE,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  student_name TEXT NOT NULL,
  roll INTEGER,
  guardian_name TEXT,
  guardian_phone TEXT NOT NULL,
  guardian_phone_2 TEXT,
  photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(class_id, roll) -- একই ক্লাসে একই রোল দুজন হতে পারবে না
);

-- Teachers Table
CREATE TABLE IF NOT EXISTS public.teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  madrasah_id UUID REFERENCES public.madrasahs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  login_code TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  permissions JSONB DEFAULT '{"can_manage_students": true, "can_manage_classes": false, "can_send_sms": false, "can_send_free_sms": false}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fee Structures Table (ফি সেটিংস - কোন ক্লাসে কত ফি)
CREATE TABLE IF NOT EXISTS public.fee_structures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  madrasah_id UUID REFERENCES public.madrasahs(id) ON DELETE CASCADE,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  fee_name TEXT NOT NULL, -- যেমন: মাসিক বেতন, ভর্তি ফি
  amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fees Table (ছাত্রদের ফি জমার রেকর্ড)
CREATE TABLE IF NOT EXISTS public.fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  madrasah_id UUID REFERENCES public.madrasahs(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  amount_paid NUMERIC NOT NULL DEFAULT 0,
  month TEXT NOT NULL, -- Format: YYYY-MM
  status TEXT DEFAULT 'paid', -- paid, partial, unpaid
  paid_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ledger Table (জমা-খরচের হিসাব খাতা)
CREATE TABLE IF NOT EXISTS public.ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  madrasah_id UUID REFERENCES public.madrasahs(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- income, expense
  category TEXT NOT NULL, -- যেমন: Student Fee, Salary, Electricity
  amount NUMERIC NOT NULL DEFAULT 0,
  description TEXT,
  transaction_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Attendance Table
CREATE TABLE IF NOT EXISTS public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  madrasah_id UUID REFERENCES public.madrasahs(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  status TEXT NOT NULL, -- present, absent, late
  date DATE DEFAULT CURRENT_DATE,
  recorded_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Exams Table
CREATE TABLE IF NOT EXISTS public.exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  madrasah_id UUID REFERENCES public.madrasahs(id) ON DELETE CASCADE,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  exam_name TEXT NOT NULL,
  exam_date DATE,
  is_published BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.exam_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID REFERENCES public.exams(id) ON DELETE CASCADE,
  subject_name TEXT NOT NULL,
  full_marks INTEGER DEFAULT 100,
  pass_marks INTEGER DEFAULT 33
);

CREATE TABLE IF NOT EXISTS public.exam_marks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID REFERENCES public.exams(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES public.exam_subjects(id) ON DELETE CASCADE,
  marks_obtained NUMERIC DEFAULT 0,
  UNIQUE(exam_id, student_id, subject_id)
);

-- SMS Templates
CREATE TABLE IF NOT EXISTS public.sms_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  madrasah_id UUID REFERENCES public.madrasahs(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transactions (Recharge Requests)
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  madrasah_id UUID REFERENCES public.madrasahs(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  transaction_id TEXT NOT NULL,
  sender_phone TEXT,
  description TEXT,
  status TEXT DEFAULT 'pending', -- pending, approved, rejected
  sms_count INTEGER,
  type TEXT DEFAULT 'credit',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Recent Calls
CREATE TABLE IF NOT EXISTS public.recent_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  madrasah_id UUID REFERENCES public.madrasahs(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  called_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 2. AUTH SYNC AUTOMATION
-- ==========================================

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
DECLARE
    v_full_name TEXT;
    v_madrasah_name TEXT;
BEGIN
    v_full_name := COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1));
    v_madrasah_name := COALESCE(new.raw_user_meta_data->>'madrasah_name', v_full_name || ' Madrasah');

    INSERT INTO public.madrasahs (id, name, is_active, is_super_admin, balance, sms_balance)
    VALUES (new.id, v_madrasah_name, true, false, 0, 0)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.profiles (id, madrasah_id, full_name, role, is_active)
    VALUES (new.id, new.id, v_full_name, 'madrasah_admin', true)
    ON CONFLICT (id) DO UPDATE SET madrasah_id = EXCLUDED.madrasah_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- ==========================================
-- 3. SYSTEM TABLES
-- ==========================================

CREATE TABLE IF NOT EXISTS public.system_settings (
  id UUID PRIMARY KEY DEFAULT '00000000-0000-0000-0000-000000000001',
  reve_api_key TEXT,
  reve_secret_key TEXT,
  reve_caller_id TEXT,
  reve_client_id TEXT,
  bkash_number TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.system_settings (id, bkash_number)
VALUES ('00000000-0000-0000-0000-000000000001', '01700000000')
ON CONFLICT (id) DO NOTHING;
