/*
# Lead Attribution Columns + Idempotent New-Lead Notification Trigger

## Purpose
1. Add first-touch lead attribution columns to the `leads` table so we can distinguish
   where a lead originally came from (source_type, source_page, source_campaign,
   source_medium, source_content) separately from last-touch info (last_touch_page).
2. Add UTM content/term columns for richer campaign tracking.
3. Create a database trigger that fires AFTER INSERT on `leads` to create a real-time
   notification for the assigned sales person (or all active admins if unassigned).
   The trigger is idempotent — it uses a unique constraint on
   (related_entity, related_id, user_id, type) to prevent duplicate notifications
   from retries, re-renders, or realtime reconnects.

## New Columns on `leads`
- `source_type` text — high-level channel: website | landing_page | whatsapp | social | paid | walk_in | phone | referral | event | manual | other
- `source_page` text — specific page/context: homepage | pekalongan | pemalang | batang | credit_simulator | vehicle_detail | catalog | etc.
- `source_campaign` text — campaign name (from UTM or explicit)
- `source_medium` text — medium: facebook | instagram | cpc | organic | etc.
- `source_content` text — UTM content or ad-specific content
- `utm_content` text — UTM content parameter
- `utm_term` text — UTM term parameter
- `last_touch_page` text — last page the visitor was on before submitting (kept separate from first-touch source_page)

## Notification Table Changes
- Add unique constraint `uq_notifications_dedup` on (related_entity, related_id, user_id, type)
  to enforce idempotent notification creation. NULL user_id is treated as distinct
  by default in Postgres, so we use a COALESCE-free partial approach: the constraint
  includes user_id which means NULL values won't conflict. To handle the "notify all
  admins" case where user_id is NULL we use a sentinel via a COALESCE in the index
  expression is NOT possible in a unique constraint directly, so instead we use
  a unique index with COALESCE to treat NULL user_id as a single sentinel value.

## New Trigger
- `trg_leads_notify_on_insert` — AFTER INSERT ON leads, calls `notify_new_lead()`
  which:
  a. If the lead has `assigned_to` set → creates one notification for that sales person.
  b. If `assigned_to` is NULL → creates one notification for every active admin.
  c. Notification type = 'new_lead', related_entity = 'lead', related_id = new lead id.
  d. The unique index prevents duplicates.

## New Function
- `notify_new_lead()` — SECURITY DEFINER so it can insert into notifications
  regardless of caller's role. Runs as the trigger function.

## Security
- The trigger function is SECURITY DEFINER, owned by postgres, so anon inserts
  on leads (public form) still produce notifications.
- No RLS policy changes — notifications table already has policies.
- The unique index is safe and non-destructive.
*/

-- =========================================================
-- 1. Add attribution columns to leads
-- =========================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'source_type') THEN
    ALTER TABLE leads ADD COLUMN source_type text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'source_page') THEN
    ALTER TABLE leads ADD COLUMN source_page text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'source_campaign') THEN
    ALTER TABLE leads ADD COLUMN source_campaign text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'source_medium') THEN
    ALTER TABLE leads ADD COLUMN source_medium text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'source_content') THEN
    ALTER TABLE leads ADD COLUMN source_content text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'utm_content') THEN
    ALTER TABLE leads ADD COLUMN utm_content text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'utm_term') THEN
    ALTER TABLE leads ADD COLUMN utm_term text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'last_touch_page') THEN
    ALTER TABLE leads ADD COLUMN last_touch_page text;
  END IF;
END $$;

-- Backfill source_type for existing leads based on current source value
UPDATE leads
SET source_type = CASE
    WHEN source = 'website' THEN 'website'
    WHEN source = 'whatsapp' THEN 'whatsapp'
    WHEN source = 'walk_in' THEN 'walk_in'
    WHEN source = 'instagram' THEN 'social'
    WHEN source = 'facebook' THEN 'social'
    WHEN source = 'phone' THEN 'phone'
    WHEN source = 'referral' THEN 'referral'
    WHEN source = 'event' THEN 'event'
    WHEN source = 'manual' THEN 'manual'
    WHEN source = 'other' THEN 'other'
    WHEN source = 'homepage' THEN 'website'
    WHEN source = 'landing_pekalongan' THEN 'landing_page'
    WHEN source = 'landing_pemalang' THEN 'landing_page'
    WHEN source = 'landing_batang' THEN 'landing_page'
    WHEN source = 'simulator' THEN 'website'
    WHEN source = 'motor_detail' THEN 'website'
    WHEN source = 'catalog' THEN 'website'
    ELSE 'website'
  END
WHERE source_type IS NULL AND source IS NOT NULL;

UPDATE leads
SET source_page = CASE
    WHEN source = 'homepage' THEN 'homepage'
    WHEN source = 'landing_pekalongan' THEN 'pekalongan'
    WHEN source = 'landing_pemalang' THEN 'pemalang'
    WHEN source = 'landing_batang' THEN 'batang'
    WHEN source = 'simulator' THEN 'credit_simulator'
    WHEN source = 'motor_detail' THEN 'vehicle_detail'
    WHEN source = 'catalog' THEN 'catalog'
    ELSE source_page
  END
WHERE source_page IS NULL AND source IS NOT NULL;

-- =========================================================
-- 2. Add unique index for idempotent notifications
--    Uses COALESCE to treat NULL user_id as '00000000-... sentinel
-- =========================================================
DROP INDEX IF EXISTS uq_notifications_dedup;
CREATE UNIQUE INDEX uq_notifications_dedup
  ON notifications (related_entity, related_id, COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::uuid), type)
  WHERE related_entity IS NOT NULL AND related_id IS NOT NULL;

-- =========================================================
-- 3. Create notification function (SECURITY DEFINER)
-- =========================================================
CREATE OR REPLACE FUNCTION notify_new_lead()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead_name text;
  v_motor text;
  v_source_page text;
  v_notif_body text;
  v_notif_link text;
  v_assigned uuid;
  v_admin record;
BEGIN
  v_lead_name := NEW.name;
  v_motor := COALESCE(NEW.motor_name, 'tidak disebutkan');
  v_source_page := COALESCE(NEW.source_page, NEW.landing_page, NEW.source, 'website');
  v_notif_body := v_lead_name || ' tertarik dengan Honda ' || v_motor || '.';
  v_notif_link := '/admin/leads/' || NEW.id::text;
  v_assigned := NEW.assigned_to;

  IF v_assigned IS NOT NULL THEN
    -- Notify the assigned sales person (idempotent via unique index)
    INSERT INTO notifications (user_id, type, title, body, link, related_entity, related_id)
    VALUES (v_assigned, 'new_lead', 'Lead Baru', v_notif_body, v_notif_link, 'lead', NEW.id)
    ON CONFLICT DO NOTHING;
  ELSE
    -- Notify all active admins
    FOR v_admin IN
      SELECT id FROM profiles WHERE role = 'admin' AND status = 'active'
    LOOP
      INSERT INTO notifications (user_id, type, title, body, link, related_entity, related_id)
      VALUES (v_admin.id, 'new_lead', 'Lead Baru', v_notif_body, v_notif_link, 'lead', NEW.id)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

-- =========================================================
-- 4. Create trigger on leads AFTER INSERT
-- =========================================================
DROP TRIGGER IF EXISTS trg_leads_notify_on_insert ON leads;
CREATE TRIGGER trg_leads_notify_on_insert
  AFTER INSERT ON leads
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_lead();
