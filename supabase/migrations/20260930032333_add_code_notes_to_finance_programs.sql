-- Add code and notes columns to finance_programs
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'finance_programs' AND column_name = 'code') THEN
    ALTER TABLE finance_programs ADD COLUMN code text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'finance_programs' AND column_name = 'notes') THEN
    ALTER TABLE finance_programs ADD COLUMN notes text;
  END IF;
END $$;
