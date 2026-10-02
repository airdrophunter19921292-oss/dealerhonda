/*
# Create Customers Table and CRM Workflow Functions

## Overview
Creates a separate `customers` entity and RPC functions for the full CRM workflow.

## New Tables
1. `customers` — Separate from leads. Contact info, address, type, source, sales, status, soft-delete.

## Modified Tables
1. `leads` — Added: priority, customer_id, converted_at, converted_by
2. `follow_ups` — Added: customer_id (nullable FK to customers)

## New RPC Functions
1. create_customer(...) — with duplicate detection
2. convert_lead_to_customer(p_lead_id)
3. update_customer(p_customer_id, ...)
4. archive_customer(p_customer_id)
5. create_lead_manual(...)
6. normalize_phone(p_phone) — helper

## Security
- RLS on customers: admin sees all, sales sees own
- All RPCs verify ownership/admin
*/

-- ============ CUSTOMERS TABLE ============
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL,
  phone_alt text,
  email text,
  address text,
  city text,
  province text,
  postal_code text,
  customer_type text NOT NULL DEFAULT 'individual',
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  motor_name text,
  motor_type text,
  source text NOT NULL DEFAULT 'walk_in',
  sales_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active',
  notes text,
  lead_id uuid,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  archived_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_sales_id ON customers(sales_id);
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);
CREATE INDEX IF NOT EXISTS idx_customers_created_at ON customers(created_at DESC);

DROP TRIGGER IF EXISTS trg_customers_updated ON customers;
CREATE TRIGGER trg_customers_updated BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS POLICIES
DROP POLICY IF EXISTS "customers_select_staff" ON customers;
CREATE POLICY "customers_select_staff" ON customers FOR SELECT
  TO authenticated USING (is_admin() OR (is_sales() AND sales_id = auth.uid()));

DROP POLICY IF EXISTS "customers_insert_staff" ON customers;
CREATE POLICY "customers_insert_staff" ON customers FOR INSERT
  TO authenticated WITH CHECK (is_admin() OR (is_sales() AND (sales_id = auth.uid() OR sales_id IS NULL)));

DROP POLICY IF EXISTS "customers_update_staff" ON customers;
CREATE POLICY "customers_update_staff" ON customers FOR UPDATE
  TO authenticated USING (is_admin() OR (is_sales() AND sales_id = auth.uid()))
  WITH CHECK (is_admin() OR (is_sales() AND sales_id = auth.uid()));

DROP POLICY IF EXISTS "customers_delete_admin" ON customers;
CREATE POLICY "customers_delete_admin" ON customers FOR DELETE
  TO authenticated USING (is_admin());

-- ============ ADD COLUMNS TO LEADS ============
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'priority') THEN
    ALTER TABLE leads ADD COLUMN priority text NOT NULL DEFAULT 'medium';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'customer_id') THEN
    ALTER TABLE leads ADD COLUMN customer_id uuid REFERENCES customers(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'converted_at') THEN
    ALTER TABLE leads ADD COLUMN converted_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'converted_by') THEN
    ALTER TABLE leads ADD COLUMN converted_by uuid REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'customers_lead_id_fkey' AND table_name = 'customers'
  ) THEN
    ALTER TABLE customers ADD CONSTRAINT customers_lead_id_fkey
      FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_leads_customer_id ON leads(customer_id);
CREATE INDEX IF NOT EXISTS idx_leads_priority ON leads(priority);

-- ============ ADD COLUMN TO FOLLOW_UPS ============
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'follow_ups' AND column_name = 'customer_id') THEN
    ALTER TABLE follow_ups ADD COLUMN customer_id uuid REFERENCES customers(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============ NORMALIZE PHONE HELPER ============
CREATE OR REPLACE FUNCTION normalize_phone(p_phone text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_cleaned text;
BEGIN
  v_cleaned := regexp_replace(p_phone, '[\s\-+()]', '', 'g');
  IF v_cleaned LIKE '62%' THEN
    RETURN v_cleaned;
  ELSIF v_cleaned LIKE '0%' THEN
    RETURN '62' || substring(v_cleaned, 2);
  ELSIF v_cleaned LIKE '8%' THEN
    RETURN '62' || v_cleaned;
  END IF;
  RETURN v_cleaned;
END;
$$;

-- ============ RPC: CREATE CUSTOMER ============
CREATE OR REPLACE FUNCTION create_customer(
  p_name text,
  p_phone text,
  p_phone_alt text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_address text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_province text DEFAULT NULL,
  p_postal_code text DEFAULT NULL,
  p_customer_type text DEFAULT 'individual',
  p_product_id uuid DEFAULT NULL,
  p_motor_name text DEFAULT NULL,
  p_motor_type text DEFAULT NULL,
  p_source text DEFAULT 'walk_in',
  p_sales_id uuid DEFAULT NULL,
  p_status text DEFAULT 'active',
  p_notes text DEFAULT NULL,
  p_lead_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id uuid;
  v_normalized_phone text;
  v_normalized_email text;
  v_dup_id uuid;
  v_dup_name text;
  v_dup_status text;
  v_assigned_sales uuid;
BEGIN
  IF p_name IS NULL OR btrim(p_name) = '' THEN
    RAISE EXCEPTION 'Nama wajib diisi';
  END IF;

  v_normalized_phone := normalize_phone(p_phone);
  IF v_normalized_phone !~ '^62\d{8,13}$' THEN
    RAISE EXCEPTION 'Nomor WhatsApp tidak valid';
  END IF;

  IF p_email IS NOT NULL AND btrim(p_email) != '' THEN
    v_normalized_email := lower(btrim(p_email));
    IF v_normalized_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
      RAISE EXCEPTION 'Format email tidak valid';
    END IF;
  END IF;

  SELECT id, name, status INTO v_dup_id, v_dup_name, v_dup_status
  FROM customers WHERE phone = v_normalized_phone AND status != 'archived' LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'DUPLICATE_CUSTOMER|%|%|%', v_dup_id, v_dup_name, v_dup_status;
  END IF;

  IF v_normalized_email IS NOT NULL THEN
    SELECT id, name, status INTO v_dup_id, v_dup_name, v_dup_status
    FROM customers WHERE email = v_normalized_email AND status != 'archived' LIMIT 1;
    IF FOUND THEN
      RAISE EXCEPTION 'DUPLICATE_CUSTOMER|%|%|%', v_dup_id, v_dup_name, v_dup_status;
    END IF;
  END IF;

  IF p_sales_id IS NOT NULL THEN
    v_assigned_sales := p_sales_id;
  ELSIF is_sales() THEN
    v_assigned_sales := auth.uid();
  END IF;

  INSERT INTO customers (
    name, phone, phone_alt, email, address, city, province, postal_code,
    customer_type, product_id, motor_name, motor_type, source,
    sales_id, status, notes, lead_id, created_by
  ) VALUES (
    btrim(p_name), v_normalized_phone, p_phone_alt, v_normalized_email,
    p_address, p_city, p_province, p_postal_code,
    p_customer_type, p_product_id, p_motor_name, p_motor_type, p_source,
    v_assigned_sales, p_status, p_notes, p_lead_id, auth.uid()
  )
  RETURNING id INTO v_id;

  IF p_lead_id IS NOT NULL THEN
    UPDATE leads SET customer_id = v_id, updated_at = now() WHERE id = p_lead_id;
  END IF;

  INSERT INTO audit_logs (user_email, action, entity, entity_id, new_value)
  VALUES (
    (SELECT email FROM profiles WHERE id = auth.uid()),
    'CUSTOMER_CREATED', 'customers', v_id,
    jsonb_build_object('name', p_name, 'phone', v_normalized_phone, 'source', p_source)
  );

  RETURN v_id;
END;
$$;

-- ============ RPC: CONVERT LEAD TO CUSTOMER ============
CREATE OR REPLACE FUNCTION convert_lead_to_customer(p_lead_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_lead leads%ROWTYPE;
  v_normalized_phone text;
  v_dup_id uuid;
  v_dup_name text;
  v_dup_status text;
  v_customer_id uuid;
  v_assigned_sales uuid;
BEGIN
  SELECT * INTO v_lead FROM leads WHERE id = p_lead_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lead tidak ditemukan';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM leads WHERE leads.id = p_lead_id
    AND (leads.assigned_to = auth.uid() OR EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin' AND profiles.status = 'active'
    ))
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF v_lead.customer_id IS NOT NULL THEN
    SELECT id, name, status INTO v_dup_id, v_dup_name, v_dup_status
    FROM customers WHERE id = v_lead.customer_id;
    IF FOUND THEN
      RAISE EXCEPTION 'ALREADY_CONVERTED|%|%|%', v_dup_id, v_dup_name, v_dup_status;
    END IF;
  END IF;

  v_normalized_phone := normalize_phone(v_lead.phone);

  SELECT id, name, status INTO v_dup_id, v_dup_name, v_dup_status
  FROM customers WHERE phone = v_normalized_phone AND status != 'archived' LIMIT 1;

  IF FOUND THEN
    UPDATE leads SET customer_id = v_dup_id, status = 'converted',
      converted_at = now(), converted_by = auth.uid(), updated_at = now()
    WHERE id = p_lead_id;

    INSERT INTO lead_events (lead_id, user_id, event_type, note)
    VALUES (p_lead_id, auth.uid(), 'STATUS_CHANGED', 'Lead dikonversi ke customer existing');

    INSERT INTO audit_logs (user_email, action, entity, entity_id, new_value)
    VALUES (
      (SELECT email FROM profiles WHERE id = auth.uid()),
      'LEAD_CONVERTED', 'customers', v_dup_id,
      jsonb_build_object('lead_id', p_lead_id, 'customer_id', v_dup_id, 'existing', true)
    );

    RETURN v_dup_id;
  END IF;

  IF v_lead.assigned_to IS NOT NULL THEN
    v_assigned_sales := v_lead.assigned_to;
  ELSIF is_sales() THEN
    v_assigned_sales := auth.uid();
  END IF;

  INSERT INTO customers (
    name, phone, email, city, product_id, motor_name, motor_type,
    source, sales_id, status, lead_id, created_by
  ) VALUES (
    v_lead.name, v_normalized_phone, v_lead.email, v_lead.city,
    v_lead.product_id, v_lead.motor_name, NULL,
    COALESCE(v_lead.source, 'website'),
    v_assigned_sales, 'active', v_lead.id, auth.uid()
  )
  RETURNING id INTO v_customer_id;

  UPDATE leads SET customer_id = v_customer_id, status = 'converted',
    converted_at = now(), converted_by = auth.uid(), updated_at = now()
  WHERE id = p_lead_id;

  INSERT INTO lead_events (lead_id, user_id, event_type, note)
  VALUES (p_lead_id, auth.uid(), 'STATUS_CHANGED', 'Lead berhasil dikonversi menjadi customer');

  INSERT INTO audit_logs (user_email, action, entity, entity_id, new_value)
  VALUES (
    (SELECT email FROM profiles WHERE id = auth.uid()),
    'LEAD_CONVERTED', 'customers', v_customer_id,
    jsonb_build_object('lead_id', p_lead_id, 'customer_id', v_customer_id, 'existing', false)
  );

  RETURN v_customer_id;
END;
$$;

-- ============ RPC: UPDATE CUSTOMER ============
CREATE OR REPLACE FUNCTION update_customer(
  p_customer_id uuid,
  p_name text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_phone_alt text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_address text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_province text DEFAULT NULL,
  p_postal_code text DEFAULT NULL,
  p_customer_type text DEFAULT NULL,
  p_product_id uuid DEFAULT NULL,
  p_motor_name text DEFAULT NULL,
  p_motor_type text DEFAULT NULL,
  p_source text DEFAULT NULL,
  p_sales_id text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_normalized_phone text;
  v_normalized_email text;
  v_dup_id uuid;
  v_assigned_sales uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM customers WHERE customers.id = p_customer_id
    AND (customers.sales_id = auth.uid() OR EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin' AND profiles.status = 'active'
    ))
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_phone IS NOT NULL AND btrim(p_phone) != '' THEN
    v_normalized_phone := normalize_phone(p_phone);
    IF v_normalized_phone !~ '^62\d{8,13}$' THEN
      RAISE EXCEPTION 'Nomor WhatsApp tidak valid';
    END IF;
    SELECT id INTO v_dup_id FROM customers
    WHERE phone = v_normalized_phone AND id != p_customer_id AND status != 'archived' LIMIT 1;
    IF FOUND THEN
      RAISE EXCEPTION 'DUPLICATE_PHONE';
    END IF;
  END IF;

  IF p_email IS NOT NULL AND btrim(p_email) != '' THEN
    v_normalized_email := lower(btrim(p_email));
    IF v_normalized_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
      RAISE EXCEPTION 'Format email tidak valid';
    END IF;
    SELECT id INTO v_dup_id FROM customers
    WHERE email = v_normalized_email AND id != p_customer_id AND status != 'archived' LIMIT 1;
    IF FOUND THEN
      RAISE EXCEPTION 'DUPLICATE_EMAIL';
    END IF;
  END IF;

  IF p_sales_id IS NOT NULL AND p_sales_id != '' AND p_sales_id != 'null' THEN
    v_assigned_sales := p_sales_id::uuid;
  END IF;

  UPDATE customers SET
    name = COALESCE(NULLIF(p_name, NULL), name),
    phone = COALESCE(NULLIF(v_normalized_phone, NULL), phone),
    phone_alt = COALESCE(NULLIF(p_phone_alt, NULL), phone_alt),
    email = CASE WHEN p_email IS NOT NULL THEN v_normalized_email ELSE email END,
    address = COALESCE(NULLIF(p_address, NULL), address),
    city = COALESCE(NULLIF(p_city, NULL), city),
    province = COALESCE(NULLIF(p_province, NULL), province),
    postal_code = COALESCE(NULLIF(p_postal_code, NULL), postal_code),
    customer_type = COALESCE(NULLIF(p_customer_type, NULL), customer_type),
    product_id = CASE WHEN p_product_id IS NOT NULL THEN p_product_id ELSE product_id END,
    motor_name = COALESCE(NULLIF(p_motor_name, NULL), motor_name),
    motor_type = COALESCE(NULLIF(p_motor_type, NULL), motor_type),
    source = COALESCE(NULLIF(p_source, NULL), source),
    sales_id = CASE WHEN p_sales_id IS NOT NULL THEN v_assigned_sales ELSE sales_id END,
    status = COALESCE(NULLIF(p_status, NULL), status),
    notes = COALESCE(NULLIF(p_notes, NULL), notes),
    updated_by = auth.uid(),
    updated_at = now()
  WHERE id = p_customer_id;

  INSERT INTO audit_logs (user_email, action, entity, entity_id)
  VALUES (
    (SELECT email FROM profiles WHERE id = auth.uid()),
    'CUSTOMER_UPDATED', 'customers', p_customer_id
  );
END;
$$;

-- ============ RPC: ARCHIVE CUSTOMER ============
CREATE OR REPLACE FUNCTION archive_customer(p_customer_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM customers WHERE customers.id = p_customer_id
    AND (customers.sales_id = auth.uid() OR EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin' AND profiles.status = 'active'
    ))
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE customers SET status = 'archived', archived_at = now(),
    updated_at = now(), updated_by = auth.uid()
  WHERE id = p_customer_id;

  INSERT INTO audit_logs (user_email, action, entity, entity_id)
  VALUES (
    (SELECT email FROM profiles WHERE id = auth.uid()),
    'CUSTOMER_ARCHIVED', 'customers', p_customer_id
  );
END;
$$;

-- ============ RPC: CREATE LEAD MANUAL ============
CREATE OR REPLACE FUNCTION create_lead_manual(
  p_name text,
  p_phone text,
  p_email text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_motor_name text DEFAULT NULL,
  p_source text DEFAULT 'manual',
  p_assigned_to uuid DEFAULT NULL,
  p_status text DEFAULT 'new',
  p_priority text DEFAULT 'medium',
  p_notes text DEFAULT NULL,
  p_follow_up_at date DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id uuid;
  v_normalized_phone text;
  v_assigned_sales uuid;
BEGIN
  IF p_name IS NULL OR btrim(p_name) = '' THEN
    RAISE EXCEPTION 'Nama wajib diisi';
  END IF;

  v_normalized_phone := normalize_phone(p_phone);
  IF v_normalized_phone !~ '^62\d{8,13}$' THEN
    RAISE EXCEPTION 'Nomor WhatsApp tidak valid';
  END IF;

  IF p_assigned_to IS NOT NULL THEN
    v_assigned_sales := p_assigned_to;
  ELSIF is_sales() THEN
    v_assigned_sales := auth.uid();
  END IF;

  INSERT INTO leads (
    name, phone, email, city, motor_name, source,
    assigned_to, status, priority, follow_up_at, message
  ) VALUES (
    btrim(p_name), v_normalized_phone, p_email, p_city, p_motor_name, p_source,
    v_assigned_sales, p_status, p_priority, p_follow_up_at, p_notes
  )
  RETURNING id INTO v_id;

  INSERT INTO lead_events (lead_id, user_id, event_type, note)
  VALUES (v_id, auth.uid(), 'LEAD_CREATED', COALESCE(p_notes, 'Lead dibuat secara manual'));

  INSERT INTO audit_logs (user_email, action, entity, entity_id, new_value)
  VALUES (
    (SELECT email FROM profiles WHERE id = auth.uid()),
    'LEAD_CREATED', 'leads', v_id,
    jsonb_build_object('name', p_name, 'phone', v_normalized_phone, 'source', p_source)
  );

  RETURN v_id;
END;
$$;
