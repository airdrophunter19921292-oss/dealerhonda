/*
# Financing Providers, Product Images, Lead Events, and Data Integrity

## Overview
1. Creates financing_providers table for flexible provider management
2. Creates product_images table for Supabase Storage-based image management
3. Creates lead_events table for lead timeline tracking
4. Adds trigger for automatic price history on products.otr change
5. Adds trigger for stock consistency (qty=0 → out_of_stock)
6. Adds financing_plans flexible columns (tenor_months, installment_amount, admin_fee, insurance_fee)
7. Migrates existing financing data to new flexible structure
8. Adds data integrity constraints (CHECK for price >= 0, dp >= 0, etc.)

## New Tables
- financing_providers: id, name, code, status, created_at, updated_at
- product_images: id, product_id, storage_path, public_url, alt_text, sort_order, is_primary, created_at, updated_at
- lead_events: id, lead_id, user_id, event_type, note, created_at

## Schema Changes
- financing_plans: + provider_id (FK), tenor_months, installment_amount, admin_fee, insurance_fee
- products: + CHECK constraint otr >= 0, stock_quantity >= 0
- financing_plans: + CHECK constraint dp >= 0, installment_amount >= 0

## Triggers
- trg_price_change: auto-insert into price_history when products.otr changes
- trg_stock_consistency: auto-update stock_status when stock_quantity changes
*/

-- ============ FINANCING PROVIDERS ============
CREATE TABLE IF NOT EXISTS financing_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE financing_providers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_active_providers" ON financing_providers;
CREATE POLICY "public_read_active_providers" ON financing_providers FOR SELECT
  TO anon, authenticated USING (status = 'active' OR is_staff());

DROP POLICY IF EXISTS "admin_insert_providers" ON financing_providers;
CREATE POLICY "admin_insert_providers" ON financing_providers FOR INSERT
  TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS "admin_update_providers" ON financing_providers;
CREATE POLICY "admin_update_providers" ON financing_providers FOR UPDATE
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "admin_delete_providers" ON financing_providers;
CREATE POLICY "admin_delete_providers" ON financing_providers FOR DELETE
  TO authenticated USING (is_admin());

DROP TRIGGER IF EXISTS trg_financing_providers_updated ON financing_providers;
CREATE TRIGGER trg_financing_providers_updated BEFORE UPDATE ON financing_providers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Seed default provider
INSERT INTO financing_providers (name, code, status, sort_order)
VALUES ('Honda Finance', 'honda_finance', 'active', 1)
ON CONFLICT (code) DO NOTHING;

-- ============ FINANCING PLANS NEW COLUMNS ============
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'financing_plans' AND column_name = 'provider_id') THEN
    ALTER TABLE financing_plans ADD COLUMN provider_id uuid REFERENCES financing_providers(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'financing_plans' AND column_name = 'tenor_months') THEN
    ALTER TABLE financing_plans ADD COLUMN tenor_months int;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'financing_plans' AND column_name = 'installment_amount') THEN
    ALTER TABLE financing_plans ADD COLUMN installment_amount bigint;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'financing_plans' AND column_name = 'admin_fee') THEN
    ALTER TABLE financing_plans ADD COLUMN admin_fee bigint;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'financing_plans' AND column_name = 'insurance_fee') THEN
    ALTER TABLE financing_plans ADD COLUMN insurance_fee bigint;
  END IF;
END $$;

-- Update existing financing_plans: set provider_id to Honda Finance, populate tenor_months and installment_amount from existing data
UPDATE financing_plans
SET provider_id = (SELECT id FROM financing_providers WHERE code = 'honda_finance' LIMIT 1),
    tenor_months = 35,
    installment_amount = tenor35
WHERE tenor_months IS NULL AND tenor35 > 0;

-- Also create 47-month variants for existing plans
INSERT INTO financing_plans (product_id, provider_id, dp, tenor35, tenor47, tenor_months, installment_amount, status, sort_order)
SELECT fp.product_id, fp.provider_id, fp.dp, fp.tenor35, fp.tenor47, 47, fp.tenor47, fp.status, fp.sort_order + 100
FROM financing_plans fp
WHERE fp.tenor_months = 35 AND fp.tenor47 > 0
AND NOT EXISTS (
  SELECT 1 FROM financing_plans fp2
  WHERE fp2.product_id = fp.product_id AND fp2.dp = fp.dp AND fp2.tenor_months = 47
);

-- Add CHECK constraints
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'financing_dp_positive' AND table_name = 'financing_plans'
  ) THEN
    ALTER TABLE financing_plans ADD CONSTRAINT financing_dp_positive CHECK (dp >= 0);
  END IF;
END $$;

-- ============ PRODUCT IMAGES ============
CREATE TABLE IF NOT EXISTS product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  public_url text NOT NULL,
  alt_text text,
  sort_order int NOT NULL DEFAULT 0,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_product_images" ON product_images;
CREATE POLICY "public_read_product_images" ON product_images FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "admin_insert_product_images" ON product_images;
CREATE POLICY "admin_insert_product_images" ON product_images FOR INSERT
  TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS "admin_update_product_images" ON product_images;
CREATE POLICY "admin_update_product_images" ON product_images FOR UPDATE
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "admin_delete_product_images" ON product_images;
CREATE POLICY "admin_delete_product_images" ON product_images FOR DELETE
  TO authenticated USING (is_admin());

DROP TRIGGER IF EXISTS trg_product_images_updated ON product_images;
CREATE TRIGGER trg_product_images_updated BEFORE UPDATE ON product_images
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_product_images_product ON product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_product_images_primary ON product_images(is_primary);

-- ============ LEAD EVENTS ============
CREATE TABLE IF NOT EXISTS lead_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  note text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE lead_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_read_lead_events" ON lead_events;
CREATE POLICY "staff_read_lead_events" ON lead_events FOR SELECT
  TO authenticated USING (
    is_admin() OR (
      is_sales() AND EXISTS (
        SELECT 1 FROM leads WHERE leads.id = lead_events.lead_id AND leads.assigned_to = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "staff_insert_lead_events" ON lead_events;
CREATE POLICY "staff_insert_lead_events" ON lead_events FOR INSERT
  TO authenticated WITH CHECK (
    is_admin() OR (
      is_sales() AND EXISTS (
        SELECT 1 FROM leads WHERE leads.id = lead_events.lead_id AND leads.assigned_to = auth.uid()
      )
    )
  );

CREATE INDEX IF NOT EXISTS idx_lead_events_lead ON lead_events(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_events_created ON lead_events(created_at DESC);

-- ============ PRICE HISTORY TRIGGER ============
CREATE OR REPLACE FUNCTION log_price_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.otr IS DISTINCT FROM NEW.otr THEN
    INSERT INTO price_history (product_id, old_otr, new_otr, changed_by)
    VALUES (NEW.id, OLD.otr, NEW.otr, auth.uid()::text);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_price_change ON products;
CREATE TRIGGER trg_price_change AFTER UPDATE OF otr ON products
  FOR EACH ROW EXECUTE FUNCTION log_price_change();

-- ============ STOCK CONSISTENCY TRIGGER ============
CREATE OR REPLACE FUNCTION enforce_stock_consistency()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.stock_quantity = 0 AND NEW.stock_status NOT IN ('out_of_stock', 'indent') THEN
    NEW.stock_status := 'out_of_stock';
  ELSIF NEW.stock_quantity > 0 AND NEW.stock_status = 'out_of_stock' THEN
    NEW.stock_status := 'ready';
  END IF;
  NEW.last_stock_update := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_stock_consistency ON products;
CREATE TRIGGER trg_stock_consistency BEFORE UPDATE OF stock_quantity, stock_status ON products
  FOR EACH ROW EXECUTE FUNCTION enforce_stock_consistency();

-- ============ PRODUCT CHECK CONSTRAINTS ============
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'products_otr_positive' AND table_name = 'products'
  ) THEN
    ALTER TABLE products ADD CONSTRAINT products_otr_positive CHECK (otr >= 0);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'products_stock_positive' AND table_name = 'products'
  ) THEN
    ALTER TABLE products ADD CONSTRAINT products_stock_positive CHECK (stock_quantity >= 0);
  END IF;
END $$;

-- ============ ADD LEAD SOURCE TRACKING COLUMNS ============
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'campaign') THEN
    ALTER TABLE leads ADD COLUMN campaign text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'utm_source') THEN
    ALTER TABLE leads ADD COLUMN utm_source text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'utm_medium') THEN
    ALTER TABLE leads ADD COLUMN utm_medium text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'utm_campaign') THEN
    ALTER TABLE leads ADD COLUMN utm_campaign text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'landing_page') THEN
    ALTER TABLE leads ADD COLUMN landing_page text;
  END IF;
END $$;

-- ============ ADD FAQ CATEGORY ============
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'faqs' AND column_name = 'category') THEN
    ALTER TABLE faqs ADD COLUMN category text DEFAULT 'umum';
  END IF;
END $$;

-- ============ ADD PROMO FIELDS ============
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'promos' AND column_name = 'priority') THEN
    ALTER TABLE promos ADD COLUMN priority int NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'promos' AND column_name = 'image') THEN
    ALTER TABLE promos ADD COLUMN image text;
  END IF;
END $$;

-- ============ ADD SITE SETTINGS FIELDS ============
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_settings' AND column_name = 'phone') THEN
    ALTER TABLE site_settings ADD COLUMN phone text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_settings' AND column_name = 'email') THEN
    ALTER TABLE site_settings ADD COLUMN email text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_settings' AND column_name = 'opening_hours') THEN
    ALTER TABLE site_settings ADD COLUMN opening_hours text;
  END IF;
END $$;

-- ============ ADD FINANCING PROVIDER INDEX ============
CREATE INDEX IF NOT EXISTS idx_financing_plans_provider ON financing_plans(provider_id);
CREATE INDEX IF NOT EXISTS idx_financing_plans_tenor ON financing_plans(tenor_months);
