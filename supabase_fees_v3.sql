-- Fee System V3: Comprehensive Fee Management with Discounts

-- 1. Fee Categories (Monthly, Exam, Admission, etc.)
CREATE TABLE IF NOT EXISTS public.fee_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  madrasah_id UUID REFERENCES public.madrasahs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('recurring', 'one-time', 'optional')),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Class-wise Fee Structure
CREATE TABLE IF NOT EXISTS public.class_fee_structures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  madrasah_id UUID REFERENCES public.madrasahs(id) ON DELETE CASCADE,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  fee_category_id UUID REFERENCES public.fee_categories(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(class_id, fee_category_id)
);

-- 3. Student Discounts
CREATE TABLE IF NOT EXISTS public.student_discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  madrasah_id UUID REFERENCES public.madrasahs(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  fee_category_id UUID REFERENCES public.fee_categories(id) ON DELETE CASCADE,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  amount NUMERIC NOT NULL,
  duration TEXT NOT NULL CHECK (duration IN ('one-time', 'recurring')),
  reason TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Student Fees (The actual bills)
CREATE TABLE IF NOT EXISTS public.student_fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  madrasah_id UUID REFERENCES public.madrasahs(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  fee_category_id UUID REFERENCES public.fee_categories(id) ON DELETE CASCADE,
  month TEXT, -- Format: YYYY-MM (for recurring fees)
  amount NUMERIC NOT NULL,
  discount_amount NUMERIC DEFAULT 0,
  paid_amount NUMERIC DEFAULT 0,
  due_amount NUMERIC NOT NULL,
  status TEXT DEFAULT 'due', -- due, partial, paid
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, fee_category_id, month)
);

-- 5. Payments (Transaction records)
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  madrasah_id UUID REFERENCES public.madrasahs(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  student_fee_id UUID REFERENCES public.student_fees(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  payment_method TEXT NOT NULL, -- cash, bkash, nagad, bank
  receipt_number TEXT UNIQUE,
  payment_date TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Financial Summary View
CREATE OR REPLACE VIEW public.financial_summary AS
SELECT 
  madrasah_id,
  TO_CHAR(transaction_date, 'YYYY-MM') as month,
  SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as total_income,
  SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as total_expense,
  SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END) as net_profit
FROM public.ledger
GROUP BY madrasah_id, TO_CHAR(transaction_date, 'YYYY-MM');

-- RLS Policies
ALTER TABLE public.fee_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_fee_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Madrasah access" ON public.fee_categories USING (madrasah_id = auth.uid());
CREATE POLICY "Madrasah access" ON public.class_fee_structures USING (madrasah_id = auth.uid());
CREATE POLICY "Madrasah access" ON public.student_discounts USING (madrasah_id = auth.uid());
CREATE POLICY "Madrasah access" ON public.student_fees USING (madrasah_id = auth.uid());
CREATE POLICY "Madrasah access" ON public.payments USING (madrasah_id = auth.uid());

-- Trigger for Receipt Number
CREATE OR REPLACE FUNCTION public.generate_receipt_number()
RETURNS TRIGGER AS $$
DECLARE
  v_prefix TEXT;
  v_count INTEGER;
BEGIN
  v_prefix := TO_CHAR(NOW(), 'YYYYMM');
  SELECT COUNT(*) INTO v_count FROM public.payments WHERE receipt_number LIKE v_prefix || '%';
  NEW.receipt_number := v_prefix || LPAD((v_count + 1)::TEXT, 6, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_generate_receipt_number
BEFORE INSERT ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.generate_receipt_number();

-- Trigger to sync payment to ledger
CREATE OR REPLACE FUNCTION public.sync_payment_to_ledger()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.ledger (madrasah_id, type, category, amount, description, transaction_date)
  VALUES (
    NEW.madrasah_id, 
    'income', 
    'Student Fee', 
    NEW.amount, 
    'Fee Payment Receipt: ' || NEW.receipt_number, 
    NEW.payment_date::DATE
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_sync_payment_to_ledger
AFTER INSERT ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.sync_payment_to_ledger();
