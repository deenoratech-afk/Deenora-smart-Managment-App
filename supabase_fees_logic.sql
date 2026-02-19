
-- প্রথমে পুরনো ফাংশনটি মুছে ফেলা হচ্ছে যাতে রিটার্ন টাইপ পরিবর্তনের এরর না আসে
DROP FUNCTION IF EXISTS get_monthly_dues_report(UUID, UUID, TEXT);

-- ফাংশন: মাসিক ফি রিপোর্ট এবং বকেয়া হিসাব
CREATE OR REPLACE FUNCTION get_monthly_dues_report(
    p_madrasah_id UUID,
    p_class_id UUID DEFAULT NULL,
    p_month TEXT DEFAULT NULL -- Format: YYYY-MM
)
RETURNS TABLE (
    student_id UUID,
    student_name TEXT,
    roll INTEGER,
    class_id UUID,
    total_payable NUMERIC,
    total_paid NUMERIC,
    balance_due NUMERIC,
    status TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    WITH class_fees AS (
        -- ঐ মাদরাসার জন্য নির্ধারিত ফি স্ট্রাকচার (শ্রেণি ভিত্তিক মোট ফি)
        SELECT 
            fs.class_id, 
            SUM(fs.amount) as total_fixed_fee
        FROM public.fee_structures fs
        WHERE fs.madrasah_id = p_madrasah_id
        GROUP BY fs.class_id
    ),
    student_payments AS (
        -- ঐ নির্দিষ্ট মাসের জন্য জমা হওয়া টাকা (ছাত্র ভিত্তিক)
        SELECT 
            f.student_id, 
            SUM(f.amount_paid) as total_collected
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
        (COALESCE(cf.total_fixed_fee, 0) - COALESCE(sp.total_collected, 0))::NUMERIC as balance_due,
        CASE 
            WHEN COALESCE(cf.total_fixed_fee, 0) <= 0 THEN 'no_fee'
            WHEN COALESCE(sp.total_collected, 0) >= COALESCE(cf.total_fixed_fee, 0) THEN 'paid'
            WHEN COALESCE(sp.total_collected, 0) > 0 THEN 'partial'
            ELSE 'unpaid'
        END as status
    FROM public.students s
    LEFT JOIN class_fees cf ON s.class_id = cf.class_id
    LEFT JOIN student_payments sp ON s.id = sp.student_id
    WHERE s.madrasah_id = p_madrasah_id
    AND (p_class_id IS NULL OR s.class_id = p_class_id)
    ORDER BY s.roll ASC NULLS LAST;
END;
$$;
