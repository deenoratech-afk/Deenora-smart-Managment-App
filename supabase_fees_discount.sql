
-- ১. fees টেবিলে discount কলাম যোগ করা
ALTER TABLE public.fees ADD COLUMN IF NOT EXISTS discount NUMERIC DEFAULT 0;

-- ২. get_monthly_dues_report ফাংশন আপডেট করা (পেইড ম্যাপ এবং ডিসকাউন্ট হ্যান্ডেল করা)
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
    WITH class_fees AS (
        -- ঐ মাদরাসার জন্য নির্ধারিত ফি স্ট্রাকচার
        SELECT 
            fs.class_id, 
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
        -- ঐ নির্দিষ্ট মাসের জন্য জমা হওয়া টাকা এবং ডিসকাউন্ট
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
        s.id as student_id,
        s.student_name,
        s.roll,
        s.class_id,
        COALESCE(cf.total_fixed_fee, 0)::NUMERIC as total_payable,
        COALESCE(sp.total_collected, 0)::NUMERIC as total_paid,
        COALESCE(sp.total_discount, 0)::NUMERIC as total_discount,
        (COALESCE(cf.total_fixed_fee, 0) - COALESCE(sp.total_collected, 0) - COALESCE(sp.total_discount, 0))::NUMERIC as balance_due,
        CASE 
            WHEN COALESCE(cf.total_fixed_fee, 0) <= 0 THEN 'no_fee'
            WHEN (COALESCE(sp.total_collected, 0) + COALESCE(sp.total_discount, 0)) >= COALESCE(cf.total_fixed_fee, 0) THEN 'paid'
            WHEN (COALESCE(sp.total_collected, 0) + COALESCE(sp.total_discount, 0)) > 0 THEN 'partial'
            ELSE 'unpaid'
        END as status,
        COALESCE(cf.breakdown, '[]'::jsonb) as fee_breakdown,
        COALESCE(sp.paid_map, '{}'::jsonb) as paid_map
    FROM public.students s
    LEFT JOIN class_fees cf ON s.class_id = cf.class_id
    LEFT JOIN student_payments sp ON s.id = sp.student_id
    WHERE s.madrasah_id = p_madrasah_id
    AND (p_class_id IS NULL OR s.class_id = p_class_id)
    ORDER BY s.roll ASC NULLS LAST;
END;
$$;
