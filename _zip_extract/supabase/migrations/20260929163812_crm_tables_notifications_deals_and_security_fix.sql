/*
# CRM Tables, Notifications, Deals, and Critical Security Fix

## Overview
Adds follow_ups, notifications, and deals tables for the CRM workflow.
Fixes critical privilege escalation vulnerability in profiles RLS by revoking
UPDATE on role/status columns from authenticated and adding a SECURITY DEFINER
function for admin-only role/status changes.

## New Tables
- `follow_ups`: Tracks individual follow-up activities per lead
- `notifications`: In-app notification center for staff
- `deals`: Records won/lost sales outcomes

## Security Changes
1. CRITICAL FIX: Revoke UPDATE on profiles.role and profiles.status from authenticated
   - Previously any user could change their own role to 'admin' via the data API
   - Now only admins can change role/status via the update_profile_role_status() function
2. New SECURITY DEFINER function: update_profile_role_status() - admin-only role/status updates
3. RLS policies on all new tables

## Important Notes
1. The profiles UPDATE policy still allows users to update their own row,
   but column-level privileges now prevent them from touching role/status columns
2. Admin role/status changes go through the RPC function instead of direct table updates
3. All new tables have RLS enabled with appropriate policies
*/

-- ============ FOLLOW_UPS TABLE ============
CREATE TABLE IF NOT EXISTS follow_ups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  type text NOT NULL DEFAULT 'call' CHECK (type IN ('call', 'whatsapp', 'visit', 'email', 'meeting', 'other')),
  result text NOT NULL DEFAULT 'pending' CHECK (result IN ('pending', 'completed', 'no_answer', 'rescheduled', 'cancelled')),
  note text,
  scheduled_at date,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE follow_ups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "follow_ups_select_staff" ON follow_ups;
CREATE POLICY "follow_ups_select_staff" ON follow_ups FOR SELECT
  TO authenticated USING (
    is_admin() OR (is_sales() AND EXISTS (
      SELECT 1 FROM leads WHERE leads.id = follow_ups.lead_id AND leads.assigned_to = auth.uid()
    ))
  );

DROP POLICY IF EXISTS "follow_ups_insert_staff" ON follow_ups;
CREATE POLICY "follow_ups_insert_staff" ON follow_ups FOR INSERT
  TO authenticated WITH CHECK (
    is_admin() OR (is_sales() AND EXISTS (
      SELECT 1 FROM leads WHERE leads.id = follow_ups.lead_id AND leads.assigned_to = auth.uid()
    ))
  );

DROP POLICY IF EXISTS "follow_ups_update_staff" ON follow_ups;
CREATE POLICY "follow_ups_update_staff" ON follow_ups FOR UPDATE
  TO authenticated USING (
    is_admin() OR (is_sales() AND EXISTS (
      SELECT 1 FROM leads WHERE leads.id = follow_ups.lead_id AND leads.assigned_to = auth.uid()
    ))
  )
  WITH CHECK (
    is_admin() OR (is_sales() AND EXISTS (
      SELECT 1 FROM leads WHERE leads.id = follow_ups.lead_id AND leads.assigned_to = auth.uid()
    ))
  );

DROP POLICY IF EXISTS "follow_ups_delete_admin" ON follow_ups;
CREATE POLICY "follow_ups_delete_admin" ON follow_ups FOR DELETE
  TO authenticated USING (is_admin());

-- ============ NOTIFICATIONS TABLE ============
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'warning', 'danger', 'success')),
  title text NOT NULL,
  body text,
  link text,
  related_entity text,
  related_id uuid,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select_own" ON notifications;
CREATE POLICY "notifications_select_own" ON notifications FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR is_admin());

DROP POLICY IF EXISTS "notifications_insert_admin" ON notifications;
CREATE POLICY "notifications_insert_admin" ON notifications FOR INSERT
  TO authenticated WITH CHECK (is_admin() OR auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications_update_own" ON notifications;
CREATE POLICY "notifications_update_own" ON notifications FOR UPDATE
  TO authenticated USING (auth.uid() = user_id OR is_admin())
  WITH CHECK (auth.uid() = user_id OR is_admin());

DROP POLICY IF EXISTS "notifications_delete_own" ON notifications;
CREATE POLICY "notifications_delete_own" ON notifications FOR DELETE
  TO authenticated USING (auth.uid() = user_id OR is_admin());

-- ============ DEALS TABLE ============
CREATE TABLE IF NOT EXISTS deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  sales_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  deal_date date NOT NULL DEFAULT CURRENT_DATE,
  deal_value bigint DEFAULT 0,
  status text NOT NULL DEFAULT 'won' CHECK (status IN ('won', 'lost')),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE deals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deals_select_staff" ON deals;
CREATE POLICY "deals_select_staff" ON deals FOR SELECT
  TO authenticated USING (
    is_admin() OR (is_sales() AND sales_id = auth.uid())
  );

DROP POLICY IF EXISTS "deals_insert_staff" ON deals;
CREATE POLICY "deals_insert_staff" ON deals FOR INSERT
  TO authenticated WITH CHECK (
    is_admin() OR (is_sales() AND sales_id = auth.uid())
  );

DROP POLICY IF EXISTS "deals_update_staff" ON deals;
CREATE POLICY "deals_update_staff" ON deals FOR UPDATE
  TO authenticated USING (
    is_admin() OR (is_sales() AND sales_id = auth.uid())
  )
  WITH CHECK (
    is_admin() OR (is_sales() AND sales_id = auth.uid())
  );

DROP POLICY IF EXISTS "deals_delete_admin" ON deals;
CREATE POLICY "deals_delete_admin" ON deals FOR DELETE
  TO authenticated USING (is_admin());

-- ============ INDEXES ============
CREATE INDEX IF NOT EXISTS idx_follow_ups_lead_id ON follow_ups(lead_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_user_id ON follow_ups(user_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_scheduled ON follow_ups(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_follow_ups_result ON follow_ups(result);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_deals_lead_id ON deals(lead_id);
CREATE INDEX IF NOT EXISTS idx_deals_sales_id ON deals(sales_id);
CREATE INDEX IF NOT EXISTS idx_deals_status ON deals(status);
CREATE INDEX IF NOT EXISTS idx_deals_deal_date ON deals(deal_date);

-- ============ TRIGGER: auto updated_at on new tables ============
DROP TRIGGER IF EXISTS trg_follow_ups_updated ON follow_ups;
CREATE TRIGGER trg_follow_ups_updated BEFORE UPDATE ON follow_ups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_deals_updated ON deals;
CREATE TRIGGER trg_deals_updated BEFORE UPDATE ON deals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============ CRITICAL SECURITY FIX: profiles column-level privileges ============
-- Revoke UPDATE on role and status columns so users cannot self-escalate
REVOKE UPDATE ON profiles FROM authenticated;
GRANT UPDATE (full_name, email, phone) ON profiles TO authenticated;

-- ============ SECURITY DEFINER: admin-only role/status update ============
CREATE OR REPLACE FUNCTION update_profile_role_status(
  p_profile_id uuid,
  p_role text,
  p_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Authorize the CALLER - must be active admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin' AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Validate inputs
  IF p_role NOT IN ('admin', 'sales') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;

  IF p_status NOT IN ('active', 'inactive') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;

  -- Prevent self-deactivation
  IF p_profile_id = auth.uid() AND p_status = 'inactive' THEN
    RAISE EXCEPTION 'Cannot deactivate your own account';
  END IF;

  UPDATE profiles
  SET role = p_role, status = p_status, updated_at = now()
  WHERE id = p_profile_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION update_profile_role_status(uuid, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION update_profile_role_status(uuid, text, text) TO authenticated;

-- ============ SECURITY DEFINER: create follow_up + lead_event atomically ============
CREATE OR REPLACE FUNCTION create_follow_up(
  p_lead_id uuid,
  p_type text,
  p_note text,
  p_scheduled_at date
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  -- Verify caller owns the lead or is admin
  IF NOT EXISTS (
    SELECT 1 FROM leads
    WHERE leads.id = p_lead_id
    AND (leads.assigned_to = auth.uid() OR EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin' AND profiles.status = 'active'
    ))
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  INSERT INTO follow_ups (lead_id, user_id, type, note, scheduled_at, result)
  VALUES (p_lead_id, auth.uid(), p_type, p_note, p_scheduled_at, 'pending')
  RETURNING id INTO v_id;

  -- Update lead follow_up_at
  UPDATE leads SET follow_up_at = p_scheduled_at, updated_at = now() WHERE id = p_lead_id;

  -- Log event
  INSERT INTO lead_events (lead_id, user_id, event_type, note)
  VALUES (p_lead_id, auth.uid(), 'FOLLOW_UP',
    COALESCE(p_note, 'Follow-up dijadwalkan untuk ' || p_scheduled_at::text));

  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION create_follow_up(uuid, text, text, date) FROM anon;
GRANT EXECUTE ON FUNCTION create_follow_up(uuid, text, text, date) TO authenticated;

-- ============ SECURITY DEFINER: complete follow_up atomically ============
CREATE OR REPLACE FUNCTION complete_follow_up(
  p_follow_up_id uuid,
  p_result text,
  p_note text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify caller owns the lead or is admin
  IF NOT EXISTS (
    SELECT 1 FROM follow_ups fu
    JOIN leads l ON l.id = fu.lead_id
    WHERE fu.id = p_follow_up_id
    AND (l.assigned_to = auth.uid() OR EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin' AND profiles.status = 'active'
    ))
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_result NOT IN ('completed', 'no_answer', 'rescheduled', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid result';
  END IF;

  UPDATE follow_ups
  SET result = p_result, note = p_note, completed_at = now(), updated_at = now()
  WHERE id = p_follow_up_id;

  -- Log event
  INSERT INTO lead_events (lead_id, user_id, event_type, note)
  SELECT fu.lead_id, auth.uid(), 'FOLLOW_UP',
    'Follow-up ' || p_result || COALESCE(': ' || p_note, '')
  FROM follow_ups fu WHERE fu.id = p_follow_up_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION complete_follow_up(uuid, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION complete_follow_up(uuid, text, text) TO authenticated;

-- ============ SECURITY DEFINER: change lead status atomically ============
CREATE OR REPLACE FUNCTION change_lead_status(
  p_lead_id uuid,
  p_new_status text,
  p_note text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_status text;
BEGIN
  -- Verify caller owns the lead or is admin
  SELECT status INTO v_old_status FROM leads WHERE id = p_lead_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lead not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM leads
    WHERE leads.id = p_lead_id
    AND (leads.assigned_to = auth.uid() OR EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin' AND profiles.status = 'active'
    ))
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Update lead status
  UPDATE leads SET status = p_new_status, updated_at = now() WHERE id = p_lead_id;

  -- Determine event type
  IF p_new_status = 'deal' THEN
    INSERT INTO lead_events (lead_id, user_id, event_type, note)
    VALUES (p_lead_id, auth.uid(), 'WON', COALESCE(p_note, 'Status diubah ke Deal'));
  ELSIF p_new_status = 'lost' THEN
    INSERT INTO lead_events (lead_id, user_id, event_type, note)
    VALUES (p_lead_id, auth.uid(), 'LOST', COALESCE(p_note, 'Status diubah ke Lost'));
  ELSE
    INSERT INTO lead_events (lead_id, user_id, event_type, note)
    VALUES (p_lead_id, auth.uid(), 'STATUS_CHANGED',
      COALESCE(p_note, 'Status diubah ke ' || p_new_status));
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION change_lead_status(uuid, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION change_lead_status(uuid, text, text) TO authenticated;

-- ============ SECURITY DEFINER: assign lead atomically ============
CREATE OR REPLACE FUNCTION assign_lead(
  p_lead_id uuid,
  p_assigned_to uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sales_name text;
BEGIN
  -- Only admins can assign leads
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin' AND profiles.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE leads SET assigned_to = p_assigned_to, updated_at = now() WHERE id = p_lead_id;

  SELECT full_name INTO v_sales_name FROM profiles WHERE id = p_assigned_to;
  INSERT INTO lead_events (lead_id, user_id, event_type, note)
  VALUES (p_lead_id, auth.uid(), 'LEAD_ASSIGNED',
    'Lead ditugaskan ke ' || COALESCE(v_sales_name, 'Unassigned'));
END;
$$;

REVOKE EXECUTE ON FUNCTION assign_lead(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION assign_lead(uuid, uuid) TO authenticated;
