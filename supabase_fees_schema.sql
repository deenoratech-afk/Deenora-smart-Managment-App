-- Fee Categories System
CREATE TABLE IF NOT EXISTS fee_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  madrasah_id UUID REFERENCES madrasahs(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('recurring', 'one-time', 'optional')),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE fee_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for madrasah members" ON fee_categories USING (madrasah_id = get_madrasah_id());

-- Class Based Fee Structure
CREATE TABLE IF NOT EXISTS class_fee_structures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  madrasah_id UUID REFERENCES madrasahs(id) ON DELETE CASCADE NOT NULL,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE NOT NULL,
  fee_category_id UUID REFERENCES fee_categories(id) ON DELETE CASCADE NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (class_id, fee_category_id)
);

ALTER TABLE class_fee_structures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for madrasah members" ON class_fee_structures USING (madrasah_id = get_madrasah_id());

-- Student Fees (Monthly Auto Fee Generation, Exam, Coaching, Admission, Transport, Fine, Others)
CREATE TABLE IF NOT EXISTS student_fees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  madrasah_id UUID REFERENCES madrasahs(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  fee_category_id UUID REFERENCES fee_categories(id) ON DELETE CASCADE NOT NULL,
  month TEXT, -- YYYY-MM for recurring fees, NULL for one-time/optional
  amount NUMERIC(10, 2) NOT NULL,
  paid_amount NUMERIC(10, 2) DEFAULT 0,
  due_amount NUMERIC(10, 2) NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('due', 'partial', 'paid', 'waived')),
  notes TEXT, -- For custom overrides/discounts
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (student_id, fee_category_id, month) -- Ensure unique fee per student per month per category
);

ALTER TABLE student_fees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for madrasah members" ON student_fees USING (madrasah_id = get_madrasah_id());

-- Payment System
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  madrasah_id UUID REFERENCES madrasahs(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  student_fee_id UUID REFERENCES student_fees(id) ON DELETE CASCADE, -- Nullable for general payments not tied to a specific student_fee
  amount NUMERIC(10, 2) NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'bkash', 'nagad', 'bank', 'other')),
  receipt_number TEXT UNIQUE NOT NULL,
  payment_date TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for madrasah members" ON payments USING (madrasah_id = get_madrasah_id());

-- Exam Fee System (On Demand)
CREATE TABLE IF NOT EXISTS exam_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  madrasah_id UUID REFERENCES madrasahs(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  exam_date DATE NOT NULL,
  fee_category_id UUID REFERENCES fee_categories(id) ON DELETE CASCADE NOT NULL, -- Should be an 'Exam' type fee category
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE exam_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for madrasah members" ON exam_sessions USING (madrasah_id = get_madrasah_id());

-- Coaching Fee (Optional Enrollment Based)
CREATE TABLE IF NOT EXISTS coaching_batches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  madrasah_id UUID REFERENCES madrasahs(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  fee_category_id UUID REFERENCES fee_categories(id) ON DELETE CASCADE NOT NULL, -- Should be a 'Coaching' type fee category
  amount NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE coaching_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for madrasah members" ON coaching_batches USING (madrasah_id = get_madrasah_id());

CREATE TABLE IF NOT EXISTS student_coaching_enrollments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  madrasah_id UUID REFERENCES madrasahs(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  coaching_batch_id UUID REFERENCES coaching_batches(id) ON DELETE CASCADE NOT NULL,
  enrollment_date DATE DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (student_id, coaching_batch_id)
);

ALTER TABLE student_coaching_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for madrasah members" ON student_coaching_enrollments USING (madrasah_id = get_madrasah_id());

-- Function to generate receipt number
CREATE OR REPLACE FUNCTION generate_receipt_number() RETURNS TEXT AS $$
DECLARE
  new_receipt_number TEXT;
  current_year TEXT;
  current_month TEXT;
  next_seq BIGINT;
BEGIN
  current_year := TO_CHAR(NOW(), 'YYYY');
  current_month := TO_CHAR(NOW(), 'MM');

  -- Get next sequence number for the current month
  INSERT INTO receipt_sequences (year_month, last_sequence) VALUES (current_year || current_month, 1)
  ON CONFLICT (year_month) DO UPDATE SET last_sequence = receipt_sequences.last_sequence + 1
  RETURNING last_sequence INTO next_seq;

  new_receipt_number := current_year || current_month || LPAD(next_seq::TEXT, 6, '0');

  RETURN new_receipt_number;
END;
$$ LANGUAGE plpgsql;

-- Table to store receipt sequences
CREATE TABLE IF NOT EXISTS receipt_sequences (
  year_month TEXT PRIMARY KEY, -- e.g., '202602'
  last_sequence BIGINT NOT NULL DEFAULT 0
);

ALTER TABLE receipt_sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for madrasah members" ON receipt_sequences USING (TRUE); -- No madrasah_id for this table, managed globally

-- Trigger to auto-generate receipt number before insert into payments
CREATE OR REPLACE FUNCTION set_receipt_number() RETURNS TRIGGER AS $$
BEGIN
  NEW.receipt_number := generate_receipt_number();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_receipt_number_trigger
BEFORE INSERT ON payments
FOR EACH ROW EXECUTE FUNCTION set_receipt_number();

-- Update `updated_at` columns automatically
CREATE OR REPLACE FUNCTION update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN (
        'fee_categories', 'class_fee_structures', 'student_fees', 'payments', 
        'exam_sessions', 'coaching_batches', 'student_coaching_enrollments'
    ) LOOP
        EXECUTE FORMAT('DROP TRIGGER IF EXISTS set_updated_at_trigger ON %I;', t);
        EXECUTE FORMAT('CREATE TRIGGER set_updated_at_trigger BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();', t);
    END LOOP;
END;
$$ LANGUAGE plpgsql;
