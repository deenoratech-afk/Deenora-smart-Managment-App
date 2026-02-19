
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
    total_payable NUMERIC,
    total_paid NUMERIC,
    balance_due NUMERIC,
    status TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH class_fees AS (
        -- ঐ ক্লাসের জন্য নির্ধারিত মোট ফি
        SELECT 
            fs.class_id, 
            SUM(fs.amount) as total_fixed_fee
        FROM public.fee_structures fs
        WHERE fs.madrasah_id = p_madrasah_id
        GROUP BY fs.class_id
    ),
    student_payments AS (
        -- ছাত্রের প্রদানকৃত মোট টাকা ঐ নির্দিষ্ট মাসের জন্য
        SELECT 
            f.student_id, 
            f.month,
            SUM(f.amount_paid) as total_collected
        FROM public.fees f
        WHERE f.madrasah_id = p_madrasah_id AND f.month = p_month
        GROUP BY f.student_id, f.month
    )
    SELECT 
        s.id as student_id,
        s.student_name,
        s.roll,
        COALESCE(cf.total_fixed_fee, 0) as total_payable,
        COALESCE(sp.total_collected, 0) as total_paid,
        (COALESCE(cf.total_fixed_fee, 0) - COALESCE(sp.total_collected, 0)) as balance_due,
        CASE 
            WHEN COALESCE(sp.total_collected, 0) >= COALESCE(cf.total_fixed_fee, 0) THEN 'paid'
            WHEN COALESCE(sp.total_collected, 0) > 0 THEN 'partial'
            ELSE 'unpaid'
        END as status
    FROM public.students s
    LEFT JOIN class_fees cf ON s.class_id = cf.class_id
    LEFT JOIN student_payments sp ON s.id = sp.student_id
    WHERE s.madrasah_id = p_madrasah_id
    AND (p_class_id IS NULL OR s.class_id = p_class_id)
    ORDER BY s.roll ASC;
END;
$$ LANGUAGE plpgsql STABLE;
