
-- ==========================================
-- 1. CORE TABLES DEFINITION
-- ==========================================

-- Madrasahs Table
CREATE TABLE IF NOT EXISTS public.madrasahs (
  id UUID PRIMARY KEY, -- Will match Auth User ID for 1:1 admins
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

-- ==========================================
-- 2. AUTH SYNC AUTOMATION
-- ==========================================

-- Resilient Trigger Function
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
DECLARE
    v_full_name TEXT;
    v_madrasah_name TEXT;
BEGIN
    -- 1. Determine names from metadata or email
    v_full_name := COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1));
    v_madrasah_name := COALESCE(new.raw_user_meta_data->>'madrasah_name', v_full_name || ' Madrasah');

    -- 2. Create the Madrasah record
    -- We use 'new.id' as the PK for the madrasah created for the first admin
    INSERT INTO public.madrasahs (
        id, 
        name, 
        is_active, 
        is_super_admin, 
        balance, 
        sms_balance
    )
    VALUES (
        new.id, 
        v_madrasah_name, 
        true, 
        false, 
        0, 
        0
    )
    ON CONFLICT (id) DO NOTHING;

    -- 3. Create the Profile record
    INSERT INTO public.profiles (
        id, 
        madrasah_id, 
        full_name, 
        role, 
        is_active
    )
    VALUES (
        new.id, 
        new.id, 
        v_full_name, 
        'madrasah_admin', 
        true
    )
    ON CONFLICT (id) DO UPDATE 
    SET madrasah_id = EXCLUDED.madrasah_id;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Log error details to Supabase logs (Postgres RAISE)
    RAISE LOG 'Error in handle_new_auth_user: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Re-create Trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- ==========================================
-- 3. OTHER SYSTEM TABLES
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

-- Insert default settings row if not exists
INSERT INTO public.system_settings (id, bkash_number)
VALUES ('00000000-0000-0000-0000-000000000001', '01700000000')
ON CONFLICT (id) DO NOTHING;
