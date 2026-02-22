
-- Smart Fee Analytics Function
CREATE OR REPLACE FUNCTION get_smart_fee_analytics(
    p_madrasah_id UUID,
    p_month TEXT -- Format 'YYYY-MM'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_expected_income NUMERIC;
    v_current_collection NUMERIC;
    v_previous_month_collection NUMERIC;
    v_prev_month TEXT;
    v_prediction NUMERIC;
    v_result JSONB;
BEGIN
    -- 1. Calculate Expected Monthly Income
    SELECT SUM(fs.amount * (SELECT COUNT(*) FROM public.students s WHERE s.class_id = fs.class_id))
    INTO v_expected_income
    FROM public.fee_structures fs
    WHERE fs.madrasah_id = p_madrasah_id;

    -- 2. Calculate Current Collection
    SELECT COALESCE(SUM(f.amount_paid), 0)
    INTO v_current_collection
    FROM public.fees f
    WHERE f.madrasah_id = p_madrasah_id AND f.month = p_month;

    -- 3. Calculate Previous Month Collection for Prediction
    v_prev_month := to_char((p_month || '-01')::DATE - INTERVAL '1 month', 'YYYY-MM');
    
    SELECT COALESCE(SUM(f.amount_paid), 0)
    INTO v_previous_month_collection
    FROM public.fees f
    WHERE f.madrasah_id = p_madrasah_id AND f.month = v_prev_month;

    -- 4. Simple Prediction Logic
    -- If we have previous data, we assume we'll reach at least that or a percentage of expected
    IF v_previous_month_collection > 0 THEN
        v_prediction := GREATEST(v_current_collection, v_previous_month_collection * 0.95);
    ELSE
        v_prediction := v_expected_income * 0.8; -- Default 80% prediction if no history
    END IF;

    -- 5. Build Result JSON
    v_result := jsonb_build_object(
        'expected_income', COALESCE(v_expected_income, 0),
        'current_collection', v_current_collection,
        'prediction', ROUND(v_prediction, 2),
        'collection_rate', CASE WHEN v_expected_income > 0 THEN ROUND((v_current_collection / v_expected_income) * 100, 2) ELSE 0 END
    );

    RETURN v_result;
END;
$$;

-- Function to get students for reminders
CREATE OR REPLACE FUNCTION get_fee_reminder_list(
    p_madrasah_id UUID,
    p_month TEXT
)
RETURNS TABLE (
    student_id UUID,
    student_name TEXT,
    guardian_phone TEXT,
    class_name TEXT,
    balance_due NUMERIC,
    reminder_type TEXT -- 'soft', 'strong', 'final'
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_day_of_month INTEGER := EXTRACT(DAY FROM CURRENT_DATE)::INTEGER;
BEGIN
    RETURN QUERY
    SELECT 
        r.student_id,
        r.student_name,
        s.guardian_phone,
        c.class_name,
        r.balance_due,
        CASE 
            WHEN v_day_of_month >= 25 THEN 'final'
            WHEN v_day_of_month >= 15 THEN 'strong'
            ELSE 'soft'
        END as reminder_type
    FROM get_monthly_dues_report(p_madrasah_id, NULL, p_month) r
    JOIN public.students s ON r.student_id = s.id
    JOIN public.classes c ON s.class_id = c.id
    WHERE r.balance_due > 0;
END;
$$;
