
-- ১. ফি ক্যাটাগরি টেবিল
CREATE TABLE IF NOT EXISTS public.fee_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    madrasah_id UUID REFERENCES public.madrasahs(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT CHECK (type IN ('recurring', 'one-time', 'optional')) DEFAULT 'recurring',
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ২. ফি স্ট্রাকচার টেবিলে ক্যাটাগরি আইডি যোগ করা
ALTER TABLE public.fee_structures ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.fee_categories(id) ON DELETE SET NULL;

-- ৩. ছাত্র-নির্দিষ্ট ফি ওভাররাইড/ডিসকাউন্ট টেবিল
CREATE TABLE IF NOT EXISTS public.student_fee_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    fee_structure_id UUID REFERENCES public.fee_structures(id) ON DELETE CASCADE,
    override_amount NUMERIC,
    discount_percentage NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(student_id, fee_structure_id)
);

-- ৪. পরীক্ষা সেশন টেবিল
CREATE TABLE IF NOT EXISTS public.exam_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    madrasah_id UUID REFERENCES public.madrasahs(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    date DATE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ৫. পরীক্ষা ফি টেবিল (সেশন ভিত্তিক)
CREATE TABLE IF NOT EXISTS public.exam_fees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_session_id UUID REFERENCES public.exam_sessions(id) ON DELETE CASCADE,
    class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(exam_session_id, class_id)
);

-- ৬. কোচিং ব্যাচ টেবিল
CREATE TABLE IF NOT EXISTS public.coaching_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    madrasah_id UUID REFERENCES public.madrasahs(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    fee_amount NUMERIC NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ৭. কোচিং এনরোলমেন্ট টেবিল
CREATE TABLE IF NOT EXISTS public.coaching_enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID REFERENCES public.coaching_batches(id) ON DELETE CASCADE,
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(batch_id, student_id)
);

-- ৮. RLS এনাবল করা
ALTER TABLE public.fee_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_fee_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coaching_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coaching_enrollments ENABLE ROW LEVEL SECURITY;

-- ৯. RLS পলিসি (মাদরাসা আইডি অনুযায়ী)
CREATE POLICY "Users can manage their madrasah fee categories" ON public.fee_categories
    FOR ALL USING (madrasah_id IN (SELECT madrasah_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can manage their madrasah student fee overrides" ON public.student_fee_overrides
    FOR ALL USING (student_id IN (SELECT id FROM public.students WHERE madrasah_id IN (SELECT madrasah_id FROM public.profiles WHERE id = auth.uid())));

CREATE POLICY "Users can manage their madrasah exam sessions" ON public.exam_sessions
    FOR ALL USING (madrasah_id IN (SELECT madrasah_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can manage their madrasah exam fees" ON public.exam_fees
    FOR ALL USING (exam_session_id IN (SELECT id FROM public.exam_sessions WHERE madrasah_id IN (SELECT madrasah_id FROM public.profiles WHERE id = auth.uid())));

CREATE POLICY "Users can manage their madrasah coaching batches" ON public.coaching_batches
    FOR ALL USING (madrasah_id IN (SELECT madrasah_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can manage their madrasah coaching enrollments" ON public.coaching_enrollments
    FOR ALL USING (batch_id IN (SELECT id FROM public.coaching_batches WHERE madrasah_id IN (SELECT madrasah_id FROM public.profiles WHERE id = auth.uid())));

-- ১০. মাসিক ফি জেনারেট করার ফাংশন (উন্নত সংস্করণ)
CREATE OR REPLACE FUNCTION generate_monthly_fees(p_madrasah_id UUID, p_month TEXT)
RETURNS VOID AS $$
DECLARE
    student_rec RECORD;
    fee_rec RECORD;
    final_amount NUMERIC;
    override_rec RECORD;
BEGIN
    FOR student_rec IN SELECT id, class_id FROM public.students WHERE madrasah_id = p_madrasah_id AND is_active = true LOOP
        -- ১. নিয়মিত মাসিক ফি (Recurring Fees)
        FOR fee_rec IN SELECT id, amount, fee_name FROM public.fee_structures 
                       WHERE class_id = student_rec.class_id 
                       AND category_id IN (SELECT id FROM public.fee_categories WHERE type = 'recurring') LOOP
            
            -- ওভাররাইড বা ডিসকাউন্ট চেক করা
            SELECT override_amount, discount_percentage INTO override_rec 
            FROM public.student_fee_overrides 
            WHERE student_id = student_rec.id AND fee_structure_id = fee_rec.id;

            IF override_rec.override_amount IS NOT NULL THEN
                final_amount := override_rec.override_amount;
            ELSE
                final_amount := fee_rec.amount * (1 - COALESCE(override_rec.discount_percentage, 0) / 100);
            END IF;

            -- ফি এন্ট্রি করা (যদি আগে না থাকে)
            INSERT INTO public.fees (madrasah_id, student_id, class_id, fee_structure_id, amount_paid, month, description, status)
            VALUES (p_madrasah_id, student_rec.id, student_rec.class_id, fee_rec.id, 0, p_month, fee_rec.fee_name, 'unpaid')
            ON CONFLICT DO NOTHING;
        END LOOP;

        -- ২. কোচিং ফি (এনরোলমেন্ট অনুযায়ী)
        FOR fee_rec IN SELECT cb.id, cb.fee_amount, cb.name 
                       FROM public.coaching_batches cb
                       JOIN public.coaching_enrollments ce ON cb.id = ce.batch_id
                       WHERE ce.student_id = student_rec.id LOOP
            
            INSERT INTO public.fees (madrasah_id, student_id, class_id, amount_paid, month, description, status)
            VALUES (p_madrasah_id, student_rec.id, student_rec.class_id, 0, p_month, 'Coaching Fee: ' || fee_rec.name, 'unpaid')
            ON CONFLICT DO NOTHING;
        END LOOP;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
