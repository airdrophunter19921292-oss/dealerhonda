/*
# Update create_lead_manual to accept attribution parameters

## Purpose
Extend the `create_lead_manual` function so admin-created leads can also carry
attribution data (source_type, source_page, source_campaign, source_medium,
source_content, utm fields, landing_page, last_touch_page).

## Changes
- Adds optional parameters: p_source_type, p_source_page, p_source_campaign,
  p_source_medium, p_source_content, p_utm_source, p_utm_medium, p_utm_campaign,
  p_utm_content, p_utm_term, p_landing_page, p_last_touch_page, p_campaign
- Inserts these into the leads row alongside existing fields
- Backward compatible: all new params default to NULL
*/

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
  p_follow_up_at date DEFAULT NULL,
  p_source_type text DEFAULT NULL,
  p_source_page text DEFAULT NULL,
  p_source_campaign text DEFAULT NULL,
  p_source_medium text DEFAULT NULL,
  p_source_content text DEFAULT NULL,
  p_utm_source text DEFAULT NULL,
  p_utm_medium text DEFAULT NULL,
  p_utm_campaign text DEFAULT NULL,
  p_utm_content text DEFAULT NULL,
  p_utm_term text DEFAULT NULL,
  p_landing_page text DEFAULT NULL,
  p_last_touch_page text DEFAULT NULL,
  p_campaign text DEFAULT NULL
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
    assigned_to, status, priority, follow_up_at, message,
    source_type, source_page, source_campaign, source_medium, source_content,
    utm_source, utm_medium, utm_campaign, utm_content, utm_term,
    landing_page, last_touch_page, campaign
  ) VALUES (
    btrim(p_name), v_normalized_phone, p_email, p_city, p_motor_name, p_source,
    v_assigned_sales, p_status, p_priority, p_follow_up_at, p_notes,
    p_source_type, p_source_page, p_source_campaign, p_source_medium, p_source_content,
    p_utm_source, p_utm_medium, p_utm_campaign, p_utm_content, p_utm_term,
    p_landing_page, p_last_touch_page, p_campaign
  )
  RETURNING id INTO v_id;

  INSERT INTO lead_events (lead_id, user_id, event_type, note)
  VALUES (v_id, auth.uid(), 'LEAD_CREATED', COALESCE(p_notes, 'Lead dibuat secara manual'));

  INSERT INTO audit_logs (user_email, action, entity, entity_id, new_value)
  VALUES (
    (SELECT email FROM profiles WHERE id = auth.uid()),
    'LEAD_CREATED', 'leads', v_id,
    jsonb_build_object('name', p_name, 'phone', v_normalized_phone, 'source', p_source,
      'source_type', p_source_type, 'source_page', p_source_page)
  );

  RETURN v_id;
END;
$$;
