/*
# Create Admin Dashboard Schema

## Overview
Creates the complete database schema for the Honda sales admin dashboard, including products, financing, leads, visits, promos, FAQs, settings, analytics, and audit logs.

## New Tables
1. `products` — Motor catalog (name, slug, category, OTR, image, status, stock)
2. `product_colors` — Color variants per product
3. `financing_plans` — DP/tenor/installment options per product
4. `price_history` — Audit trail of OTR changes
5. `promos` — Promotional campaigns
6. `leads` — Customer inquiries from the website
7. `visits` — Scheduled customer visits/test rides
8. `visit_history` — Reschedule/cancel audit trail
9. `faqs` — FAQ entries manageable from admin
10. `site_settings` — Business info, social links, SEO config
11. `analytics_events` — Public website event tracking
12. `audit_logs` — Admin action audit trail

## Security
- RLS enabled on ALL tables
- Public (anon) can: READ active products/financing/FAQs, CREATE leads/analytics_events
- Authenticated (admin) can: full CRUD on all tables
- Leads cannot be deleted (no DELETE policy for authenticated)
*/

-- ============ PRODUCTS ============
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'Matic',
  otr bigint NOT NULL DEFAULT 0,
  image text,
  popular boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active',
  stock_status text NOT NULL DEFAULT 'ready',
  stock_quantity int NOT NULL DEFAULT 0,
  description text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_active_products" ON products;
CREATE POLICY "public_read_active_products" ON products FOR SELECT
  TO anon, authenticated USING (status = 'active' OR auth.role() = 'authenticated');

DROP POLICY IF EXISTS "auth_insert_products" ON products;
CREATE POLICY "auth_insert_products" ON products FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_products" ON products;
CREATE POLICY "auth_update_products" ON products FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

-- No DELETE policy: products cannot be deleted via client

-- ============ PRODUCT COLORS ============
CREATE TABLE IF NOT EXISTS product_colors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name text NOT NULL,
  hex_color text,
  image text,
  stock int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE product_colors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_colors" ON product_colors;
CREATE POLICY "public_read_colors" ON product_colors FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_colors" ON product_colors;
CREATE POLICY "auth_insert_colors" ON product_colors FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_colors" ON product_colors;
CREATE POLICY "auth_update_colors" ON product_colors FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_colors" ON product_colors;
CREATE POLICY "auth_delete_colors" ON product_colors FOR DELETE
  TO authenticated USING (true);

-- ============ FINANCING PLANS ============
CREATE TABLE IF NOT EXISTS financing_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  dp bigint NOT NULL,
  tenor35 bigint NOT NULL,
  tenor47 bigint NOT NULL,
  provider text,
  valid_from date,
  valid_until date,
  status text NOT NULL DEFAULT 'active',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE financing_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_active_financing" ON financing_plans;
CREATE POLICY "public_read_active_financing" ON financing_plans FOR SELECT
  TO anon, authenticated USING (status = 'active' OR auth.role() = 'authenticated');

DROP POLICY IF EXISTS "auth_insert_financing" ON financing_plans;
CREATE POLICY "auth_insert_financing" ON financing_plans FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_financing" ON financing_plans;
CREATE POLICY "auth_update_financing" ON financing_plans FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_financing" ON financing_plans;
CREATE POLICY "auth_delete_financing" ON financing_plans FOR DELETE
  TO authenticated USING (true);

-- ============ PRICE HISTORY ============
CREATE TABLE IF NOT EXISTS price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  old_otr bigint,
  new_otr bigint NOT NULL,
  changed_by text,
  reason text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_read_price_history" ON price_history;
CREATE POLICY "auth_read_price_history" ON price_history FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_price_history" ON price_history;
CREATE POLICY "auth_insert_price_history" ON price_history FOR INSERT
  TO authenticated WITH CHECK (true);

-- ============ PROMOS ============
CREATE TABLE IF NOT EXISTS promos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  banner text,
  discount_amount bigint,
  bonus text,
  valid_from date,
  valid_until date,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE promos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_active_promos" ON promos;
CREATE POLICY "public_read_active_promos" ON promos FOR SELECT
  TO anon, authenticated USING (status = 'active' OR auth.role() = 'authenticated');

DROP POLICY IF EXISTS "auth_insert_promos" ON promos;
CREATE POLICY "auth_insert_promos" ON promos FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_promos" ON promos;
CREATE POLICY "auth_update_promos" ON promos FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_promos" ON promos;
CREATE POLICY "auth_delete_promos" ON promos FOR DELETE
  TO authenticated USING (true);

-- ============ LEADS ============
CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL,
  city text,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  motor_name text,
  dp bigint,
  tenor int,
  installment bigint,
  message text,
  source text,
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_insert_leads" ON leads;
CREATE POLICY "public_insert_leads" ON leads FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_read_leads" ON leads;
CREATE POLICY "auth_read_leads" ON leads FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_update_leads" ON leads;
CREATE POLICY "auth_update_leads" ON leads FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

-- No DELETE policy: leads cannot be deleted

-- ============ VISITS ============
CREATE TABLE IF NOT EXISTS visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  motor_name text,
  visit_date date NOT NULL,
  visit_time text NOT NULL,
  visit_type text NOT NULL DEFAULT 'showroom_visit',
  notes text,
  sales_person text,
  status text NOT NULL DEFAULT 'scheduled',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE visits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_read_visits" ON visits;
CREATE POLICY "auth_read_visits" ON visits FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_visits" ON visits;
CREATE POLICY "auth_insert_visits" ON visits FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_visits" ON visits;
CREATE POLICY "auth_update_visits" ON visits FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_visits" ON visits;
CREATE POLICY "auth_delete_visits" ON visits FOR DELETE
  TO authenticated USING (true);

-- ============ VISIT HISTORY ============
CREATE TABLE IF NOT EXISTS visit_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id uuid NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
  old_date date,
  old_time text,
  new_date date,
  new_time text,
  reason text,
  changed_by text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE visit_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_read_visit_history" ON visit_history;
CREATE POLICY "auth_read_visit_history" ON visit_history FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_visit_history" ON visit_history;
CREATE POLICY "auth_insert_visit_history" ON visit_history FOR INSERT
  TO authenticated WITH CHECK (true);

-- ============ FAQS ============
CREATE TABLE IF NOT EXISTS faqs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  answer text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE faqs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_active_faqs" ON faqs;
CREATE POLICY "public_read_active_faqs" ON faqs FOR SELECT
  TO anon, authenticated USING (status = 'active' OR auth.role() = 'authenticated');

DROP POLICY IF EXISTS "auth_insert_faqs" ON faqs;
CREATE POLICY "auth_insert_faqs" ON faqs FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_faqs" ON faqs;
CREATE POLICY "auth_update_faqs" ON faqs FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_faqs" ON faqs;
CREATE POLICY "auth_delete_faqs" ON faqs FOR DELETE
  TO authenticated USING (true);

-- ============ SITE SETTINGS ============
CREATE TABLE IF NOT EXISTS site_settings (
  id int PRIMARY KEY DEFAULT 1,
  showroom_name text,
  sales_name text NOT NULL DEFAULT 'Dony Kurniawan',
  sales_role text NOT NULL DEFAULT 'Sales Motor Honda',
  whatsapp_number text NOT NULL DEFAULT '085869185780',
  whatsapp_international text NOT NULL DEFAULT '6285869185780',
  address text,
  google_maps_link text,
  areas text[] NOT NULL DEFAULT ARRAY['Pekalongan', 'Pemalang', 'Batang'],
  instagram text,
  facebook text,
  tiktok text,
  youtube text,
  site_title text NOT NULL DEFAULT 'Motor Honda Pekalongan',
  meta_description text,
  og_image text,
  google_verification text,
  default_keywords text[],
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_settings" ON site_settings;
CREATE POLICY "public_read_settings" ON site_settings FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "auth_update_settings" ON site_settings;
CREATE POLICY "auth_update_settings" ON site_settings FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

-- ============ ANALYTICS EVENTS ============
CREATE TABLE IF NOT EXISTS analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  source text,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_insert_events" ON analytics_events;
CREATE POLICY "public_insert_events" ON analytics_events FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_read_events" ON analytics_events;
CREATE POLICY "auth_read_events" ON analytics_events FOR SELECT
  TO authenticated USING (true);

-- ============ AUDIT LOGS ============
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email text,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id uuid,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_read_audit_logs" ON audit_logs;
CREATE POLICY "auth_read_audit_logs" ON audit_logs FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_audit_logs" ON audit_logs;
CREATE POLICY "auth_insert_audit_logs" ON audit_logs FOR INSERT
  TO authenticated WITH CHECK (true);

-- ============ INDEXES ============
CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_financing_product_id ON financing_plans(product_id);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone);
CREATE INDEX IF NOT EXISTS idx_visits_date ON visits(visit_date);
CREATE INDEX IF NOT EXISTS idx_visits_status ON visits(status);
CREATE INDEX IF NOT EXISTS idx_analytics_created_at ON analytics_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- ============ TRIGGER: updated_at ============
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_products_updated ON products;
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_financing_updated ON financing_plans;
CREATE TRIGGER trg_financing_updated BEFORE UPDATE ON financing_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_leads_updated ON leads;
CREATE TRIGGER trg_leads_updated BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_visits_updated ON visits;
CREATE TRIGGER trg_visits_updated BEFORE UPDATE ON visits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_promos_updated ON promos;
CREATE TRIGGER trg_promos_updated BEFORE UPDATE ON promos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_faqs_updated ON faqs;
CREATE TRIGGER trg_faqs_updated BEFORE UPDATE ON faqs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_settings_updated ON site_settings;
CREATE TRIGGER trg_settings_updated BEFORE UPDATE ON site_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============ SEED SITE SETTINGS ============
INSERT INTO site_settings (id, showroom_name, sales_name, sales_role, whatsapp_number, whatsapp_international, address, areas, site_title, meta_description)
VALUES (
  1,
  'Motor Honda Pantura',
  'Dony Kurniawan',
  'Sales Motor Honda',
  '085869185780',
  '6285869185780',
  'Melayani wilayah Pekalongan, Pemalang, Batang dan sekitar Pantura Jawa Tengah',
  ARRAY['Pekalongan', 'Pemalang', 'Batang'],
  'Motor Honda Pekalongan | Kredit Motor Honda Pekalongan',
  'Temukan pilihan motor Honda dengan berbagai pilihan DP dan cicilan untuk wilayah Pekalongan, Pemalang, Batang dan sekitarnya.'
) ON CONFLICT (id) DO NOTHING;
