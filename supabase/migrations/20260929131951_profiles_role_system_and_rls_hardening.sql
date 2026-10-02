/*
# Profiles Table, Role System, and RLS Hardening

## Overview
Introduces role-based access control with profiles table, helper functions, and hardened RLS policies replacing the previous authenticated=true pattern.

## New Tables
- profiles: id (FK auth.users), full_name, email, phone, role (admin|sales), status (active|inactive)

## Schema Changes
- leads: + assigned_to (FK profiles), follow_up_at (date), email (text)
- visits: + sales_id (FK profiles)
- products: + last_stock_update, short_description, seo_title, seo_description, type, featured
- audit_logs: + user_id, entity_type, entity_id, old_data, new_data

## Security
- is_admin(), is_sales(), is_staff() helper functions
- All RLS policies replaced with role-aware checks
- Public can: read active products/financing/promos/faqs/settings, insert leads/analytics
- Admin: full CRUD on all tables
- Sales: read products/financing, manage assigned leads, manage own visits
- Audit logs: append-only (no UPDATE/DELETE)
*/

-- ============ ADD COLUMNS FIRST (before policies reference them) ============

-- Leads new columns
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'assigned_to') THEN
    ALTER TABLE leads ADD COLUMN assigned_to uuid;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'follow_up_at') THEN
    ALTER TABLE leads ADD COLUMN follow_up_at date;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'email') THEN
    ALTER TABLE leads ADD COLUMN email text;
  END IF;
END $$;

-- Visits new column
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'visits' AND column_name = 'sales_id') THEN
    ALTER TABLE visits ADD COLUMN sales_id uuid;
  END IF;
END $$;

-- Products new columns
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'last_stock_update') THEN
    ALTER TABLE products ADD COLUMN last_stock_update timestamptz;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'short_description') THEN
    ALTER TABLE products ADD COLUMN short_description text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'seo_title') THEN
    ALTER TABLE products ADD COLUMN seo_title text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'seo_description') THEN
    ALTER TABLE products ADD COLUMN seo_description text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'type') THEN
    ALTER TABLE products ADD COLUMN type text DEFAULT 'motorcycle';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'featured') THEN
    ALTER TABLE products ADD COLUMN featured boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- Audit logs new columns
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'user_id') THEN
    ALTER TABLE audit_logs ADD COLUMN user_id uuid;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'entity_type') THEN
    ALTER TABLE audit_logs ADD COLUMN entity_type text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'entity_id') THEN
    ALTER TABLE audit_logs ADD COLUMN entity_id uuid;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'old_data') THEN
    ALTER TABLE audit_logs ADD COLUMN old_data jsonb;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'new_data') THEN
    ALTER TABLE audit_logs ADD COLUMN new_data jsonb;
  END IF;
END $$;

-- ============ PROFILES TABLE ============
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  email text UNIQUE,
  phone text,
  role text NOT NULL DEFAULT 'sales' CHECK (role IN ('admin', 'sales')),
  status text NOT NULL DEFAULT 'inactive' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Now add FK constraints for assigned_to and sales_id to profiles
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'leads_assigned_to_fkey' AND table_name = 'leads'
  ) THEN
    ALTER TABLE leads ADD CONSTRAINT leads_assigned_to_fkey
      FOREIGN KEY (assigned_to) REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'visits_sales_id_fkey' AND table_name = 'visits'
  ) THEN
    ALTER TABLE visits ADD CONSTRAINT visits_sales_id_fkey
      FOREIGN KEY (sales_id) REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, role, status)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), 'sales', 'inactive')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

DROP TRIGGER IF EXISTS trg_profiles_updated ON profiles;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============ HELPER FUNCTIONS ============
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin' AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_sales()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'sales' AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_staff()
RETURNS boolean AS $$
BEGIN
  RETURN is_admin() OR is_sales();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============ PROFILES RLS ============
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id OR is_admin());

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id OR is_admin()) WITH CHECK (auth.uid() = id OR is_admin());

DROP POLICY IF EXISTS "profiles_admin_insert" ON profiles;
CREATE POLICY "profiles_admin_insert" ON profiles FOR INSERT
  TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS "profiles_admin_delete" ON profiles;
CREATE POLICY "profiles_admin_delete" ON profiles FOR DELETE
  TO authenticated USING (is_admin());

-- ============ PRODUCTS RLS (HARDENED) ============
DROP POLICY IF EXISTS "public_read_active_products" ON products;
CREATE POLICY "public_read_active_products" ON products FOR SELECT
  TO anon, authenticated USING (status = 'active' OR is_staff());

DROP POLICY IF EXISTS "auth_insert_products" ON products;
CREATE POLICY "auth_insert_products" ON products FOR INSERT
  TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS "auth_update_products" ON products;
CREATE POLICY "auth_update_products" ON products FOR UPDATE
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- ============ PRODUCT COLORS RLS (HARDENED) ============
DROP POLICY IF EXISTS "public_read_colors" ON product_colors;
CREATE POLICY "public_read_colors" ON product_colors FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_colors" ON product_colors;
CREATE POLICY "auth_insert_colors" ON product_colors FOR INSERT
  TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS "auth_update_colors" ON product_colors;
CREATE POLICY "auth_update_colors" ON product_colors FOR UPDATE
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "auth_delete_colors" ON product_colors;
CREATE POLICY "auth_delete_colors" ON product_colors FOR DELETE
  TO authenticated USING (is_admin());

-- ============ FINANCING PLANS RLS (HARDENED) ============
DROP POLICY IF EXISTS "public_read_active_financing" ON financing_plans;
CREATE POLICY "public_read_active_financing" ON financing_plans FOR SELECT
  TO anon, authenticated USING (status = 'active' OR is_staff());

DROP POLICY IF EXISTS "auth_insert_financing" ON financing_plans;
CREATE POLICY "auth_insert_financing" ON financing_plans FOR INSERT
  TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS "auth_update_financing" ON financing_plans;
CREATE POLICY "auth_update_financing" ON financing_plans FOR UPDATE
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "auth_delete_financing" ON financing_plans;
CREATE POLICY "auth_delete_financing" ON financing_plans FOR DELETE
  TO authenticated USING (is_admin());

-- ============ PRICE HISTORY RLS (HARDENED) ============
DROP POLICY IF EXISTS "auth_read_price_history" ON price_history;
CREATE POLICY "auth_read_price_history" ON price_history FOR SELECT
  TO authenticated USING (is_staff());

DROP POLICY IF EXISTS "auth_insert_price_history" ON price_history;
CREATE POLICY "auth_insert_price_history" ON price_history FOR INSERT
  TO authenticated WITH CHECK (is_admin());

-- ============ PROMOS RLS (HARDENED) ============
DROP POLICY IF EXISTS "public_read_active_promos" ON promos;
CREATE POLICY "public_read_active_promos" ON promos FOR SELECT
  TO anon, authenticated USING (status = 'active' OR is_staff());

DROP POLICY IF EXISTS "auth_insert_promos" ON promos;
CREATE POLICY "auth_insert_promos" ON promos FOR INSERT
  TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS "auth_update_promos" ON promos;
CREATE POLICY "auth_update_promos" ON promos FOR UPDATE
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "auth_delete_promos" ON promos;
CREATE POLICY "auth_delete_promos" ON promos FOR DELETE
  TO authenticated USING (is_admin());

-- ============ LEADS RLS (HARDENED) ============
DROP POLICY IF EXISTS "public_insert_leads" ON leads;
CREATE POLICY "public_insert_leads" ON leads FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_read_leads" ON leads;
CREATE POLICY "auth_read_leads" ON leads FOR SELECT
  TO authenticated USING (is_admin() OR (is_sales() AND assigned_to = auth.uid()));

DROP POLICY IF EXISTS "auth_update_leads" ON leads;
CREATE POLICY "auth_update_leads" ON leads FOR UPDATE
  TO authenticated USING (is_admin() OR (is_sales() AND assigned_to = auth.uid()))
  WITH CHECK (is_admin() OR (is_sales() AND assigned_to = auth.uid()));

-- ============ VISITS RLS (HARDENED) ============
DROP POLICY IF EXISTS "auth_read_visits" ON visits;
CREATE POLICY "auth_read_visits" ON visits FOR SELECT
  TO authenticated USING (is_admin() OR (is_sales() AND sales_id = auth.uid()));

DROP POLICY IF EXISTS "auth_insert_visits" ON visits;
CREATE POLICY "auth_insert_visits" ON visits FOR INSERT
  TO authenticated WITH CHECK (is_admin() OR is_sales());

DROP POLICY IF EXISTS "auth_update_visits" ON visits;
CREATE POLICY "auth_update_visits" ON visits FOR UPDATE
  TO authenticated USING (is_admin() OR (is_sales() AND sales_id = auth.uid()))
  WITH CHECK (is_admin() OR is_sales());

DROP POLICY IF EXISTS "auth_delete_visits" ON visits;
CREATE POLICY "auth_delete_visits" ON visits FOR DELETE
  TO authenticated USING (is_admin());

-- ============ VISIT HISTORY RLS (HARDENED) ============
DROP POLICY IF EXISTS "auth_read_visit_history" ON visit_history;
CREATE POLICY "auth_read_visit_history" ON visit_history FOR SELECT
  TO authenticated USING (is_staff());

DROP POLICY IF EXISTS "auth_insert_visit_history" ON visit_history;
CREATE POLICY "auth_insert_visit_history" ON visit_history FOR INSERT
  TO authenticated WITH CHECK (is_staff());

-- ============ FAQS RLS (HARDENED) ============
DROP POLICY IF EXISTS "public_read_active_faqs" ON faqs;
CREATE POLICY "public_read_active_faqs" ON faqs FOR SELECT
  TO anon, authenticated USING (status = 'active' OR is_staff());

DROP POLICY IF EXISTS "auth_insert_faqs" ON faqs;
CREATE POLICY "auth_insert_faqs" ON faqs FOR INSERT
  TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS "auth_update_faqs" ON faqs;
CREATE POLICY "auth_update_faqs" ON faqs FOR UPDATE
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "auth_delete_faqs" ON faqs;
CREATE POLICY "auth_delete_faqs" ON faqs FOR DELETE
  TO authenticated USING (is_admin());

-- ============ SITE SETTINGS RLS (HARDENED) ============
DROP POLICY IF EXISTS "public_read_settings" ON site_settings;
CREATE POLICY "public_read_settings" ON site_settings FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "auth_update_settings" ON site_settings;
CREATE POLICY "auth_update_settings" ON site_settings FOR UPDATE
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- ============ ANALYTICS EVENTS RLS (HARDENED) ============
DROP POLICY IF EXISTS "public_insert_events" ON analytics_events;
CREATE POLICY "public_insert_events" ON analytics_events FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_read_events" ON analytics_events;
CREATE POLICY "auth_read_events" ON analytics_events FOR SELECT
  TO authenticated USING (is_staff());

-- ============ AUDIT LOGS RLS (HARDENED — append-only) ============
DROP POLICY IF EXISTS "auth_read_audit_logs" ON audit_logs;
CREATE POLICY "auth_read_audit_logs" ON audit_logs FOR SELECT
  TO authenticated USING (is_staff());

DROP POLICY IF EXISTS "auth_insert_audit_logs" ON audit_logs;
CREATE POLICY "auth_insert_audit_logs" ON audit_logs FOR INSERT
  TO authenticated WITH CHECK (is_staff());

-- No UPDATE or DELETE policy: audit logs are append-only

-- ============ ADD INDEXES ============
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_stock_status ON products(stock_status);
CREATE INDEX IF NOT EXISTS idx_financing_status ON financing_plans(status);
CREATE INDEX IF NOT EXISTS idx_financing_valid_from ON financing_plans(valid_from);
CREATE INDEX IF NOT EXISTS idx_financing_valid_until ON financing_plans(valid_until);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_follow_up_at ON leads(follow_up_at);
CREATE INDEX IF NOT EXISTS idx_visits_sales_id ON visits(sales_id);
CREATE INDEX IF NOT EXISTS idx_visits_visit_date ON visits(visit_date);
CREATE INDEX IF NOT EXISTS idx_analytics_event_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
