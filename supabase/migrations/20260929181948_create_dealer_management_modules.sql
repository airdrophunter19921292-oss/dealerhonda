/*
# Dealer Management Modules: Credit Applications, SPK, Deliveries, Documents, Finance Programs

## Overview
This migration adds the core Dealer Management System tables that connect Customer to the full sales workflow.

## New Tables
1. finance_programs — Master data for finance/leasing programs
2. credit_applications — Credit/financing applications with snapshot data
3. spks — Surat Pesanan Kendaraan with unique sequential numbering
4. customer_documents — Document management with checklist
5. deliveries — Delivery management with checklist validation

## Modified Tables
- products — added reservation_status column

## Security
- RLS enabled on all new tables with authenticated policies
- RPC functions for SPK number generation, unit reservation, delivery completion

## Business Rules
- SPK number uniqueness via sequence
- Unit reservation prevents double-booking
- Delivery checklist must be complete before DELIVERED
- Snapshot data stored to preserve historical accuracy
*/

-- 1. FINANCE PROGRAMS
CREATE TABLE IF NOT EXISTS finance_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid REFERENCES financing_providers(id) ON DELETE SET NULL,
  name text NOT NULL,
  tenor_months integer NOT NULL DEFAULT 36,
  min_dp_percent numeric DEFAULT 20,
  rate numeric,
  admin_fee bigint DEFAULT 0,
  insurance_fee bigint DEFAULT 0,
  promo text,
  is_active boolean DEFAULT true,
  valid_from date,
  valid_until date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE finance_programs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_finance_programs" ON finance_programs;
CREATE POLICY "select_finance_programs" ON finance_programs FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_finance_programs" ON finance_programs;
CREATE POLICY "insert_finance_programs" ON finance_programs FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_finance_programs" ON finance_programs;
CREATE POLICY "update_finance_programs" ON finance_programs FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_finance_programs" ON finance_programs;
CREATE POLICY "delete_finance_programs" ON finance_programs FOR DELETE TO authenticated USING (true);

-- 2. CREDIT APPLICATIONS
CREATE TABLE IF NOT EXISTS credit_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  finance_provider_id uuid REFERENCES financing_providers(id) ON DELETE SET NULL,
  finance_program_id uuid REFERENCES finance_programs(id) ON DELETE SET NULL,
  spk_id uuid,
  motor_name text,
  motor_type text,
  otr_price bigint NOT NULL DEFAULT 0,
  dp_amount bigint DEFAULT 0,
  tenor_months integer DEFAULT 0,
  estimated_installment bigint DEFAULT 0,
  admin_fee bigint DEFAULT 0,
  insurance_fee bigint DEFAULT 0,
  promo_discount bigint DEFAULT 0,
  finance_name text,
  finance_code text,
  occupation text,
  monthly_income bigint,
  residence_status text,
  employment_years integer,
  spouse_name text,
  spouse_income bigint,
  guarantor_name text,
  guarantor_phone text,
  status text NOT NULL DEFAULT 'draft',
  payment_type text NOT NULL DEFAULT 'credit',
  notes text,
  sales_id uuid,
  created_by uuid,
  updated_by uuid,
  submitted_at timestamptz,
  approved_at timestamptz,
  rejected_at timestamptz,
  rejected_reason text,
  disbursed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE credit_applications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_credit_apps" ON credit_applications;
CREATE POLICY "select_credit_apps" ON credit_applications FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_credit_apps" ON credit_applications;
CREATE POLICY "insert_credit_apps" ON credit_applications FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_credit_apps" ON credit_applications;
CREATE POLICY "update_credit_apps" ON credit_applications FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_credit_apps" ON credit_applications;
CREATE POLICY "delete_credit_apps" ON credit_applications FOR DELETE TO authenticated USING (true);
CREATE INDEX IF NOT EXISTS idx_credit_apps_customer ON credit_applications(customer_id);
CREATE INDEX IF NOT EXISTS idx_credit_apps_status ON credit_applications(status);
CREATE INDEX IF NOT EXISTS idx_credit_apps_sales ON credit_applications(sales_id);

-- 3. SPK
CREATE SEQUENCE IF NOT EXISTS spk_number_seq START 1;
CREATE TABLE IF NOT EXISTS spks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  spk_number text UNIQUE NOT NULL,
  spk_date date NOT NULL DEFAULT CURRENT_DATE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  credit_application_id uuid REFERENCES credit_applications(id) ON DELETE SET NULL,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  sales_id uuid,
  created_by uuid,
  motor_name text,
  motor_type text,
  color text,
  otr_price bigint NOT NULL DEFAULT 0,
  payment_type text NOT NULL DEFAULT 'credit',
  finance_name text,
  dp_amount bigint DEFAULT 0,
  tenor_months integer DEFAULT 0,
  installment_amount bigint DEFAULT 0,
  admin_fee bigint DEFAULT 0,
  insurance_fee bigint DEFAULT 0,
  promo_discount bigint DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  notes text,
  unit_reserved_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE spks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_spks" ON spks;
CREATE POLICY "select_spks" ON spks FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_spks" ON spks;
CREATE POLICY "insert_spks" ON spks FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_spks" ON spks;
CREATE POLICY "update_spks" ON spks FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_spks" ON spks;
CREATE POLICY "delete_spks" ON spks FOR DELETE TO authenticated USING (true);
CREATE INDEX IF NOT EXISTS idx_spks_customer ON spks(customer_id);
CREATE INDEX IF NOT EXISTS idx_spks_status ON spks(status);
CREATE INDEX IF NOT EXISTS idx_spks_sales ON spks(sales_id);

-- 4. CUSTOMER DOCUMENTS
CREATE TABLE IF NOT EXISTS customer_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  credit_application_id uuid REFERENCES credit_applications(id) ON DELETE CASCADE,
  spk_id uuid REFERENCES spks(id) ON DELETE CASCADE,
  category text NOT NULL,
  document_type text NOT NULL,
  label text NOT NULL,
  file_path text,
  file_name text,
  file_size bigint,
  mime_type text,
  status text NOT NULL DEFAULT 'required',
  is_required boolean DEFAULT true,
  rejection_reason text,
  verified_by uuid,
  verified_at timestamptz,
  uploaded_by uuid,
  uploaded_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE customer_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_customer_docs" ON customer_documents;
CREATE POLICY "select_customer_docs" ON customer_documents FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_customer_docs" ON customer_documents;
CREATE POLICY "insert_customer_docs" ON customer_documents FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_customer_docs" ON customer_documents;
CREATE POLICY "update_customer_docs" ON customer_documents FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_customer_docs" ON customer_documents;
CREATE POLICY "delete_customer_docs" ON customer_documents FOR DELETE TO authenticated USING (true);
CREATE INDEX IF NOT EXISTS idx_cust_docs_customer ON customer_documents(customer_id);
CREATE INDEX IF NOT EXISTS idx_cust_docs_category ON customer_documents(category);
CREATE INDEX IF NOT EXISTS idx_cust_docs_status ON customer_documents(status);

-- 5. DELIVERIES
CREATE TABLE IF NOT EXISTS deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  spk_id uuid NOT NULL REFERENCES spks(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  sales_id uuid,
  customer_name text,
  customer_phone text,
  motor_name text,
  motor_type text,
  spk_number text,
  delivery_address text,
  delivery_date date,
  delivery_time text,
  driver_name text,
  driver_phone text,
  vehicle_plate text,
  notes text,
  checklist jsonb DEFAULT '{"documents_complete": false, "payment_complete": false, "unit_available": false, "unit_prepared": false, "accessories_complete": false, "surat_jalan_ready": false, "customer_ready": false}'::jsonb,
  status text NOT NULL DEFAULT 'waiting',
  delivered_at timestamptz,
  delivered_by uuid,
  delivery_proof_path text,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_deliveries" ON deliveries;
CREATE POLICY "select_deliveries" ON deliveries FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_deliveries" ON deliveries;
CREATE POLICY "insert_deliveries" ON deliveries FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_deliveries" ON deliveries;
CREATE POLICY "update_deliveries" ON deliveries FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_deliveries" ON deliveries;
CREATE POLICY "delete_deliveries" ON deliveries FOR DELETE TO authenticated USING (true);
CREATE INDEX IF NOT EXISTS idx_deliveries_spk ON deliveries(spk_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_customer ON deliveries(customer_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status);

-- 6. ADD RESERVATION STATUS TO PRODUCTS
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'reservation_status') THEN
    ALTER TABLE products ADD COLUMN reservation_status text DEFAULT 'available';
  END IF;
END $$;

-- 7. RPC: Generate SPK Number
CREATE OR REPLACE FUNCTION generate_spk_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_val bigint;
  year_str text;
  spk_no text;
BEGIN
  next_val := nextval('spk_number_seq');
  year_str := EXTRACT(YEAR FROM now())::text;
  spk_no := 'SPK-' || year_str || '-' || lpad(next_val::text, 5, '0');
  RETURN spk_no;
END;
$$;

-- 8. RPC: Log Audit Action
CREATE OR REPLACE FUNCTION log_audit_action(
  p_user_id uuid,
  p_user_email text,
  p_action text,
  p_entity text,
  p_entity_id uuid DEFAULT NULL,
  p_old_data jsonb DEFAULT NULL,
  p_new_data jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO audit_logs (user_id, user_email, action, entity, entity_id, old_data, new_data, entity_type)
  VALUES (p_user_id, p_user_email, p_action, p_entity, p_entity_id, p_old_data, p_new_data, p_entity);
END;
$$;

-- 9. RPC: Reserve Unit (prevents double reservation)
CREATE OR REPLACE FUNCTION reserve_unit(p_product_id uuid, p_spk_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_status text;
BEGIN
  SELECT reservation_status INTO current_status FROM products WHERE id = p_product_id FOR UPDATE;
  IF current_status IS NULL OR current_status = 'available' THEN
    UPDATE products SET reservation_status = 'reserved', updated_at = now() WHERE id = p_product_id;
    RETURN true;
  END IF;
  RETURN false;
END;
$$;

-- 10. RPC: Complete Delivery (with checklist validation)
CREATE OR REPLACE FUNCTION complete_delivery(
  p_delivery_id uuid,
  p_delivered_by uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  del_record RECORD;
  checklist_valid boolean;
BEGIN
  SELECT * INTO del_record FROM deliveries WHERE id = p_delivery_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  checklist_valid := (
    (del_record.checklist->>'documents_complete')::boolean AND
    (del_record.checklist->>'payment_complete')::boolean AND
    (del_record.checklist->>'unit_available')::boolean AND
    (del_record.checklist->>'unit_prepared')::boolean AND
    (del_record.checklist->>'accessories_complete')::boolean AND
    (del_record.checklist->>'surat_jalan_ready')::boolean AND
    (del_record.checklist->>'customer_ready')::boolean
  );
  
  IF NOT checklist_valid THEN
    RETURN false;
  END IF;
  
  UPDATE deliveries SET 
    status = 'delivered', 
    delivered_at = now(), 
    delivered_by = p_delivered_by,
    updated_at = now()
  WHERE id = p_delivery_id;
  
  IF del_record.spk_id IS NOT NULL THEN
    UPDATE spks SET status = 'delivered', updated_at = now() WHERE id = del_record.spk_id;
  END IF;
  
  IF del_record.product_id IS NOT NULL THEN
    UPDATE products SET reservation_status = 'delivered', updated_at = now() WHERE id = del_record.product_id;
  END IF;
  
  RETURN true;
END;
$$;
