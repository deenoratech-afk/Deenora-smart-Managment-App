
-- ==========================================
-- AUTH SYNC AUTOMATION
-- This script ensures that when you create a user in Supabase Auth,
-- they automatically get a Madrasah and a Profile record.
-- ==========================================

-- 1. Create the function that handles the new user
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
DECLARE
  new_madrasah_id UUID;
  user_full_name TEXT;
BEGIN
  -- Extract name from metadata if it exists, otherwise use email prefix
  user_full_name := COALESCE(
    (new.raw_user_meta_data->>'name'), 
    split_part(new.email, '@', 1)
  );

  -- 1. Create a new Madrasah for this admin
  -- We use the same ID as the auth user for the madrasah to keep it simple,
  -- or you can let it generate a new UUID.
  INSERT INTO public.madrasahs (id, name, is_active, balance, sms_balance)
  VALUES (new.id, user_full_name || ' Madrasah', true, 0, 0)
  RETURNING id INTO new_madrasah_id;

  -- 2. Create the User Profile linked to the Madrasah
  INSERT INTO public.profiles (id, madrasah_id, full_name, role, is_active)
  VALUES (new.id, new_madrasah_id, user_full_name, 'madrasah_admin', true);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create the Trigger
-- This fires AFTER a user is created in the auth.users table
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- ==========================================
-- RE-ENABLE RLS FOR PROFILES (Fixing recursion)
-- ==========================================
-- Ensure the profiles table can be read during the login flow
-- without causing circular logic errors.

DROP POLICY IF EXISTS "Enable read access for all users" ON public.profiles;
CREATE POLICY "profiles_read_own" ON public.profiles
FOR SELECT USING (auth.uid() = id);

-- ==========================================
-- ADD MISSING SYSTEM SETTINGS TABLE
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
