
-- ১. fee_structures টেবিলে is_monthly কলাম যোগ করা
ALTER TABLE public.fee_structures ADD COLUMN IF NOT EXISTS is_monthly BOOLEAN DEFAULT true;

-- ২. fees টেবিলে প্রয়োজনীয় কলাম যোগ করা
ALTER TABLE public.fees ADD COLUMN IF NOT EXISTS fee_structure_id UUID REFERENCES public.fee_structures(id) ON DELETE SET NULL;
ALTER TABLE public.fees ADD COLUMN IF NOT EXISTS description TEXT;

-- ৩. get_monthly_dues_report ফাংশন আপডেট করা
DROP FUNCTION IF EXISTS get_monthly_dues_report(UUID, UUID, TEXT);

CREATE OR REPLACE FUNCTION get_monthly_dues_report(
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
    WITH class_fees AS (
        -- ঐ মাদরাসার জন্য নির্ধারিত ফি স্ট্রাকচার
        SELECT 
            fs.class_id as cid, 
            COALESCE(SUM(fs.amount), 0) as total_fixed_fee,
            jsonb_agg(jsonb_build_object(
                'id', fs.id,
                'name', fs.fee_name,
                'amount', fs.amount,
                'is_monthly', fs.is_monthly
            )) as breakdown
        FROM public.fee_structures fs
        WHERE fs.madrasah_id = p_madrasah_id
        GROUP BY fs.class_id
    ),
    student_payments AS (
        -- ঐ নির্দিষ্ট মাসের জন্য জমা হওয়া টাকা
        SELECT 
            f.student_id as sid, 
            COALESCE(SUM(f.amount_paid), 0) as total_collected,
            jsonb_object_agg(COALESCE(f.fee_structure_id::text, 'other'), f.amount_paid) as p_map
        FROM public.fees f
        WHERE f.madrasah_id = p_madrasah_id AND f.month = p_month
        GROUP BY f.student_id
    )
    SELECT 
        s.id,
        s.student_name,
        s.roll,
        s.class_id,
        COALESCE(cf.total_fixed_fee, 0)::NUMERIC,
        COALESCE(sp.total_collected, 0)::NUMERIC,
        (COALESCE(cf.total_fixed_fee, 0) - COALESCE(sp.total_collected, 0))::NUMERIC,
        CASE 
            WHEN COALESCE(cf.total_fixed_fee, 0) <= 0 THEN 'no_fee'
            WHEN COALESCE(sp.total_collected, 0) >= COALESCE(cf.total_fixed_fee, 0) THEN 'paid'
            WHEN COALESCE(sp.total_collected, 0) > 0 THEN 'partial'
            ELSE 'unpaid'
        END::TEXT,
        COALESCE(cf.breakdown, '[]'::jsonb),
        COALESCE(sp.p_map, '{}'::jsonb)
    FROM public.students s
    LEFT JOIN class_fees cf ON s.class_id = cf.cid
    LEFT JOIN student_payments sp ON s.id = sp.sid
    WHERE s.madrasah_id = p_madrasah_id
    AND (p_class_id IS NULL OR s.class_id = p_class_id)
    ORDER BY s.roll ASC NULLS LAST;
END;
$$;
