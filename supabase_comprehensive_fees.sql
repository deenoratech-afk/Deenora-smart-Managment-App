
-- ==========================================
-- COMPREHENSIVE FEE MANAGEMENT TABLES
-- ==========================================

-- 1. Fee Categories
CREATE TABLE IF NOT EXISTS public.fee_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  madrasah_id UUID REFERENCES public.madrasahs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Update Fee Structures to include Category
ALTER TABLE public.fee_structures ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.fee_categories(id) ON DELETE SET NULL;

-- 3. Student Fee Overrides (Discounts or special rates)
CREATE TABLE IF NOT EXISTS public.student_fee_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  fee_structure_id UUID REFERENCES public.fee_structures(id) ON DELETE CASCADE,
  custom_amount NUMERIC NOT NULL,
  reason TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, fee_structure_id)
);

-- 4. Coaching Batches
CREATE TABLE IF NOT EXISTS public.coaching_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  madrasah_id UUID REFERENCES public.madrasahs(id) ON DELETE CASCADE,
  batch_name TEXT NOT NULL,
  fee_amount NUMERIC NOT NULL DEFAULT 0,
  teacher_id UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
  schedule TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Student Coaching Enrollment
CREATE TABLE IF NOT EXISTS public.student_coaching (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES public.coaching_batches(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, batch_id)
);

-- 6. Exam Fees
CREATE TABLE IF NOT EXISTS public.exam_fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID REFERENCES public.exams(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(exam_id)
);

-- ==========================================
-- UPDATED FUNCTIONS
-- ==========================================

-- Update get_monthly_dues_report to handle overrides and coaching
CREATE OR REPLACE FUNCTION get_monthly_dues_report_v2(
    p_madrasah_id UUID,
    p_class_id UUID DEFAULT NULL,
    p_month TEXT DEFAULT NULL
)
RETURNS TABLE (
    student_id UUID,
    student_name TEXT,
    roll INTEGER,
    class_id UUID,
    total_payable NUMERIC,
    total_paid NUMERIC,
    total_discount NUMERIC,
    balance_due NUMERIC,
    status TEXT,
    fee_breakdown JSONB,
    paid_map JSONB
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    WITH student_list AS (
        SELECT s.id, s.student_name, s.roll, s.class_id
        FROM public.students s
        WHERE s.madrasah_id = p_madrasah_id
        AND (p_class_id IS NULL OR s.class_id = p_class_id)
    ),
    class_fees AS (
        SELECT 
            fs.class_id, 
            fs.id as fee_id,
            fs.fee_name,
            fs.amount as base_amount,
            fs.is_monthly
        FROM public.fee_structures fs
        WHERE fs.madrasah_id = p_madrasah_id
    ),
    overrides AS (
        SELECT sfo.student_id, sfo.fee_structure_id, sfo.custom_amount
        FROM public.student_fee_overrides sfo
        WHERE sfo.is_active = true
    ),
    coaching_fees AS (
        SELECT sc.student_id, SUM(cb.fee_amount) as total_coaching
        FROM public.student_coaching sc
        JOIN public.coaching_batches cb ON sc.batch_id = cb.id
        GROUP BY sc.student_id
    ),
    calculated_fees AS (
        SELECT 
            sl.id as student_id,
            SUM(COALESCE(ov.custom_amount, cf.base_amount)) + COALESCE(coach.total_coaching, 0) as total_payable,
            jsonb_agg(jsonb_build_object(
                'id', cf.fee_id,
                'name', cf.fee_name,
                'amount', COALESCE(ov.custom_amount, cf.base_amount),
                'is_monthly', cf.is_monthly,
                'is_override', ov.custom_amount IS NOT NULL
            )) as breakdown
        FROM student_list sl
        LEFT JOIN class_fees cf ON sl.class_id = cf.class_id
        LEFT JOIN overrides ov ON sl.id = ov.student_id AND cf.fee_id = ov.fee_structure_id
        LEFT JOIN coaching_fees coach ON sl.id = coach.student_id
        GROUP BY sl.id, coach.total_coaching
    ),
    student_payments AS (
        SELECT 
            f.student_id, 
            COALESCE(SUM(f.amount_paid), 0) as total_collected,
            COALESCE(SUM(f.discount), 0) as total_discount,
            jsonb_object_agg(
                COALESCE(f.fee_structure_id::text, 'other'), 
                jsonb_build_object(
                    'paid', (SELECT SUM(f2.amount_paid) FROM public.fees f2 WHERE f2.student_id = f.student_id AND f2.month = f.month AND COALESCE(f2.fee_structure_id::text, 'other') = COALESCE(f.fee_structure_id::text, 'other')),
                    'discount', (SELECT SUM(f2.discount) FROM public.fees f2 WHERE f2.student_id = f.student_id AND f2.month = f.month AND COALESCE(f2.fee_structure_id::text, 'other') = COALESCE(f.fee_structure_id::text, 'other'))
                )
            ) as paid_map
        FROM public.fees f
        WHERE f.madrasah_id = p_madrasah_id AND f.month = p_month
        GROUP BY f.student_id
    )
    SELECT 
        sl.id as student_id,
        sl.student_name,
        sl.roll,
        sl.class_id,
        COALESCE(calc.total_payable, 0)::NUMERIC as total_payable,
        COALESCE(sp.total_collected, 0)::NUMERIC as total_paid,
        COALESCE(sp.total_discount, 0)::NUMERIC as total_discount,
        (COALESCE(calc.total_payable, 0) - COALESCE(sp.total_collected, 0) - COALESCE(sp.total_discount, 0))::NUMERIC as balance_due,
        CASE 
            WHEN COALESCE(calc.total_payable, 0) <= 0 THEN 'no_fee'
            WHEN (COALESCE(sp.total_collected, 0) + COALESCE(sp.total_discount, 0)) >= COALESCE(calc.total_payable, 0) THEN 'paid'
            WHEN (COALESCE(sp.total_collected, 0) + COALESCE(sp.total_discount, 0)) > 0 THEN 'partial'
            ELSE 'unpaid'
        END as status,
        COALESCE(calc.breakdown, '[]'::jsonb) as fee_breakdown,
        COALESCE(sp.paid_map, '{}'::jsonb) as paid_map
    FROM student_list sl
    LEFT JOIN calculated_fees calc ON sl.id = calc.student_id
    LEFT JOIN student_payments sp ON sl.id = sp.student_id
    ORDER BY sl.roll ASC NULLS LAST;
END;
$$;
