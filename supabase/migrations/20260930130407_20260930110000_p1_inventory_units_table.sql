/*
# P1: Inventory Units — Individual Unit Tracking

## Overview
This migration creates the `inventory_units` table to track individual motorcycle
units (by engine/frame number) rather than relying on a single stock_quantity on
the product model. This upgrades the system from a catalog-level stock count to
a proper dealer inventory management system.

## New Table: inventory_units
- id (uuid, PK)
- product_id (uuid, FK → products) — which model this unit belongs to
- product_color_id (uuid, nullable, FK → product_colors) — color variant
- unit_code (text) — internal SKU/code for the unit
- engine_number (text) — engine serial number
- frame_number (text) — frame/chassis serial number
- year (integer) — model year
- status (text) — AVAILABLE | RESERVED | SOLD | DELIVERED | RETURNED | SERVICE
- location (text) — warehouse/showroom location
- purchase_date (date) — when the unit was acquired
- reserved_at (timestamptz) — when it was reserved
- reserved_by_spk_id (uuid, nullable, FK → spks) — which SPK reserved it
- sold_at (timestamptz) — when it was sold
- delivered_at (timestamptz) — when it was delivered
- notes (text)
- created_at, updated_at (timestamptz)

## Modified Functions
- reserve_unit() — updated to work with inventory_units when a unit_id is provided.
  If p_unit_id is NULL, falls back to product-level reservation for backward compat.

## Security
- RLS enabled, staff can read, staff can insert/update, admin-only delete

## Indexes
- product_id, status, reserved_by_spk_id

## Constraints
- UNIQUE on engine_number (if not null)
- UNIQUE on frame_number (if not null)
- CHECK on status values
*/

CREATE TABLE IF NOT EXISTS inventory_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  product_color_id uuid REFERENCES product_colors(id) ON DELETE SET NULL,
  unit_code text,
  engine_number text,
  frame_number text,
  year integer,
  status text NOT NULL DEFAULT 'available',
  location text,
  purchase_date date,
  reserved_at timestamptz,
  reserved_by_spk_id uuid REFERENCES spks(id) ON DELETE SET NULL,
  sold_at timestamptz,
  delivered_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT inventory_units_status_check
    CHECK (status IN ('available', 'reserved', 'sold', 'delivered', 'returned', 'service'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_engine_number
  ON inventory_units (engine_number) WHERE engine_number IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_frame_number
  ON inventory_units (frame_number) WHERE frame_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_product ON inventory_units(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_status ON inventory_units(status);
CREATE INDEX IF NOT EXISTS idx_inventory_spk ON inventory_units(reserved_by_spk_id);

ALTER TABLE inventory_units ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_inventory_units" ON inventory_units;
CREATE POLICY "select_inventory_units" ON inventory_units
  FOR SELECT TO authenticated USING (is_staff());

DROP POLICY IF EXISTS "insert_inventory_units" ON inventory_units;
CREATE POLICY "insert_inventory_units" ON inventory_units
  FOR INSERT TO authenticated WITH CHECK (is_staff());

DROP POLICY IF EXISTS "update_inventory_units" ON inventory_units;
CREATE POLICY "update_inventory_units" ON inventory_units
  FOR UPDATE TO authenticated USING (is_staff()) WITH CHECK (is_staff());

DROP POLICY IF EXISTS "delete_inventory_units" ON inventory_units;
CREATE POLICY "delete_inventory_units" ON inventory_units
  FOR DELETE TO authenticated USING (is_admin());

-- =========================================================
-- Update reserve_unit to support individual unit reservation
-- =========================================================
CREATE OR REPLACE FUNCTION reserve_unit(
  p_product_id uuid,
  p_spk_id uuid,
  p_unit_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_unit_status text;
  v_product_status text;
BEGIN
  IF p_unit_id IS NOT NULL THEN
    -- Reserve a specific inventory unit
    SELECT status INTO v_unit_status FROM inventory_units
      WHERE id = p_unit_id AND product_id = p_product_id
      FOR UPDATE;
    IF v_unit_status IS NULL THEN
      RETURN false;
    END IF;
    IF v_unit_status = 'available' THEN
      UPDATE inventory_units
        SET status = 'reserved', reserved_at = now(), reserved_by_spk_id = p_spk_id,
            updated_at = now()
        WHERE id = p_unit_id;
      RETURN true;
    END IF;
    RETURN false;
  ELSE
    -- Fallback: product-level reservation (backward compat)
    SELECT reservation_status INTO v_product_status
      FROM products WHERE id = p_product_id FOR UPDATE;
    IF v_product_status IS NULL OR v_product_status = 'available' THEN
      UPDATE products SET reservation_status = 'reserved', updated_at = now()
        WHERE id = p_product_id;
      RETURN true;
    END IF;
    RETURN false;
  END IF;
END;
$$;
