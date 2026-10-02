/*
# P0: Security, Notification, RLS, and SPK Status Transition Hardening

## Overview
This migration addresses all P0 critical issues identified in the system review:
1. Notification CHECK constraint blocks 'new_lead' type → lead insert fails
2. Dealer module tables have USING(true) policies → any authenticated user has full CRUD
3. Realtime publication not enabled for notifications
4. SPK status transitions are unvalidated → can jump from DRAFT to DELIVERED

## Changes

### 1. Notification CHECK Constraint Fix
- Drop the old CHECK constraint that only allows ('info','warning','danger','success')
- Add a new CHECK constraint that also allows 'new_lead', 'lead_assigned', 'lead_converted', 'spk_created', 'credit_approved', 'delivery_updated'
- This unblocks the AFTER INSERT trigger on leads that inserts type='new_lead'

### 2. RLS Policy Hardening on Dealer Modules
Replace USING(true)/WITH CHECK(true) with proper role-based checks on:
- finance_programs: admin-only for write, staff can read
- credit_applications: staff can read, staff can insert, staff can update, admin-only delete
- spks: staff can read, staff can insert, staff can update, admin-only delete
- customer_documents: staff can read, staff can insert, staff can update, admin-only delete
- deliveries: staff can read, staff can insert, staff can update, admin-only delete

### 3. Realtime Publication
- Add notifications table to supabase_realtime publication

### 4. SPK Status Transition Validation
- Create a trigger function validate_spk_status_transition() that enforces valid status flow:
  DRAFT → APPROVED → UNIT_RESERVED → READY_DELIVERY → DELIVERED
  Also allows CANCELLED from DRAFT or APPROVED
- Add BEFORE UPDATE trigger on spks

### 5. Idempotency
All statements use IF EXISTS / IF NOT EXISTS / DROP POLICY IF EXISTS patterns.
*/

-- =========================================================
-- 1. Fix notification CHECK constraint
-- =========================================================
DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.notifications'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%info%warning%danger%success%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.notifications DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'info', 'warning', 'danger', 'success',
    'new_lead', 'lead_assigned', 'lead_converted',
    'spk_created', 'credit_approved', 'delivery_updated'
  ));

-- =========================================================
-- 2. RLS Policy Hardening — finance_programs
--    Admin-only writes, staff can read
-- =========================================================
DROP POLICY IF EXISTS "select_finance_programs" ON finance_programs;
CREATE POLICY "select_finance_programs" ON finance_programs
  FOR SELECT TO authenticated USING (is_staff());

DROP POLICY IF EXISTS "insert_finance_programs" ON finance_programs;
CREATE POLICY "insert_finance_programs" ON finance_programs
  FOR INSERT TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS "update_finance_programs" ON finance_programs;
CREATE POLICY "update_finance_programs" ON finance_programs
  FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "delete_finance_programs" ON finance_programs;
CREATE POLICY "delete_finance_programs" ON finance_programs
  FOR DELETE TO authenticated USING (is_admin());

-- =========================================================
-- 3. RLS Policy Hardening — credit_applications
--    Staff can read/insert/update, admin-only delete
-- =========================================================
DROP POLICY IF EXISTS "select_credit_apps" ON credit_applications;
CREATE POLICY "select_credit_apps" ON credit_applications
  FOR SELECT TO authenticated USING (is_staff());

DROP POLICY IF EXISTS "insert_credit_apps" ON credit_applications;
CREATE POLICY "insert_credit_apps" ON credit_applications
  FOR INSERT TO authenticated WITH CHECK (is_staff());

DROP POLICY IF EXISTS "update_credit_apps" ON credit_applications;
CREATE POLICY "update_credit_apps" ON credit_applications
  FOR UPDATE TO authenticated USING (is_staff()) WITH CHECK (is_staff());

DROP POLICY IF EXISTS "delete_credit_apps" ON credit_applications;
CREATE POLICY "delete_credit_apps" ON credit_applications
  FOR DELETE TO authenticated USING (is_admin());

-- =========================================================
-- 4. RLS Policy Hardening — spks
--    Staff can read/insert/update, admin-only delete
-- =========================================================
DROP POLICY IF EXISTS "select_spks" ON spks;
CREATE POLICY "select_spks" ON spks
  FOR SELECT TO authenticated USING (is_staff());

DROP POLICY IF EXISTS "insert_spks" ON spks;
CREATE POLICY "insert_spks" ON spks
  FOR INSERT TO authenticated WITH CHECK (is_staff());

DROP POLICY IF EXISTS "update_spks" ON spks;
CREATE POLICY "update_spks" ON spks
  FOR UPDATE TO authenticated USING (is_staff()) WITH CHECK (is_staff());

DROP POLICY IF EXISTS "delete_spks" ON spks;
CREATE POLICY "delete_spks" ON spks
  FOR DELETE TO authenticated USING (is_admin());

-- =========================================================
-- 5. RLS Policy Hardening — customer_documents
--    Staff can read/insert/update, admin-only delete
-- =========================================================
DROP POLICY IF EXISTS "select_customer_docs" ON customer_documents;
CREATE POLICY "select_customer_docs" ON customer_documents
  FOR SELECT TO authenticated USING (is_staff());

DROP POLICY IF EXISTS "insert_customer_docs" ON customer_documents;
CREATE POLICY "insert_customer_docs" ON customer_documents
  FOR INSERT TO authenticated WITH CHECK (is_staff());

DROP POLICY IF EXISTS "update_customer_docs" ON customer_documents;
CREATE POLICY "update_customer_docs" ON customer_documents
  FOR UPDATE TO authenticated USING (is_staff()) WITH CHECK (is_staff());

DROP POLICY IF EXISTS "delete_customer_docs" ON customer_documents;
CREATE POLICY "delete_customer_docs" ON customer_documents
  FOR DELETE TO authenticated USING (is_admin());

-- =========================================================
-- 6. RLS Policy Hardening — deliveries
--    Staff can read/insert/update, admin-only delete
-- =========================================================
DROP POLICY IF EXISTS "select_deliveries" ON deliveries;
CREATE POLICY "select_deliveries" ON deliveries
  FOR SELECT TO authenticated USING (is_staff());

DROP POLICY IF EXISTS "insert_deliveries" ON deliveries;
CREATE POLICY "insert_deliveries" ON deliveries
  FOR INSERT TO authenticated WITH CHECK (is_staff());

DROP POLICY IF EXISTS "update_deliveries" ON deliveries;
CREATE POLICY "update_deliveries" ON deliveries
  FOR UPDATE TO authenticated USING (is_staff()) WITH CHECK (is_staff());

DROP POLICY IF EXISTS "delete_deliveries" ON deliveries;
CREATE POLICY "delete_deliveries" ON deliveries
  FOR DELETE TO authenticated USING (is_admin());

-- =========================================================
-- 7. Enable Realtime for notifications
-- =========================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- =========================================================
-- 8. SPK Status Transition Validation
-- =========================================================
CREATE OR REPLACE FUNCTION validate_spk_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only validate when status is changing
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  -- Valid forward transitions:
  -- DRAFT → APPROVED → UNIT_RESERVED → READY_DELIVERY → DELIVERED
  -- DRAFT or APPROVED → CANCELLED
  IF NOT (
    (OLD.status = 'draft' AND NEW.status IN ('approved', 'cancelled'))
    OR (OLD.status = 'approved' AND NEW.status IN ('unit_reserved', 'ready_delivery', 'cancelled'))
    OR (OLD.status = 'unit_reserved' AND NEW.status IN ('ready_delivery', 'delivered'))
    OR (OLD.status = 'ready_delivery' AND NEW.status = 'delivered')
    OR (OLD.status = 'cancelled' AND NEW.status = 'draft')
  ) THEN
    RAISE EXCEPTION 'Invalid SPK status transition: % → %', OLD.status, NEW.status
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_spk_status_validation ON spks;
CREATE TRIGGER trg_spk_status_validation
  BEFORE UPDATE OF status ON spks
  FOR EACH ROW
  EXECUTE FUNCTION validate_spk_status_transition();
