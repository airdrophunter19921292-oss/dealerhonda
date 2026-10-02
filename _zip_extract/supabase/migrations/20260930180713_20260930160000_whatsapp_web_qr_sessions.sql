/*
# WhatsApp Web / QR-Based Connection Support

Adds support for WhatsApp Web multi-device sessions (QR scan) alongside
the existing Meta Cloud API provider. This migration:
1. Adds 'whatsapp_web' to the provider enum
2. Adds QR session columns to whatsapp_connections
3. Adds new session status values
4. Creates SECURITY DEFINER functions for QR session management
5. Creates whatsapp_qr_sessions table for realtime QR delivery

Architecture:
- Admin clicks "Hubungkan WhatsApp" → edge function calls external Baileys server
- Baileys server generates QR → posts to webhook → stored in whatsapp_qr_sessions
- Frontend subscribes to whatsapp_qr_sessions via Supabase Realtime
- When QR is scanned → Baileys authenticates → posts to webhook → connection status updated
- Session credentials stored in whatsapp_connection_secrets (encrypted session data)
- Baileys server runs externally (persistent process), restored on reconnect
*/

-- =========================================================
-- 1. Add 'whatsapp_web' to provider enum
-- =========================================================
ALTER TABLE whatsapp_connections DROP CONSTRAINT IF EXISTS wa_conn_provider_check;
ALTER TABLE whatsapp_connections ADD CONSTRAINT wa_conn_provider_check
  CHECK (provider IN ('meta_cloud_api', 'whatsapp_web', 'fonnte', 'wati', 'ultramsg', 'other'));

-- =========================================================
-- 2. Add session status values
-- =========================================================
ALTER TABLE whatsapp_connections DROP CONSTRAINT IF EXISTS wa_conn_status_check;
ALTER TABLE whatsapp_connections ADD CONSTRAINT wa_conn_status_check
  CHECK (status IN (
    'connected', 'connecting', 'disconnected',
    'invalid_credentials', 'webhook_error', 'phone_number_error', 'api_error',
    'auth_required', 'session_expired', 'auth_failed', 'qr_ready', 'waiting_for_scan'
  ));

-- =========================================================
-- 3. Add QR/session columns to whatsapp_connections
-- =========================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'whatsapp_connections' AND column_name = 'session_id') THEN
    ALTER TABLE whatsapp_connections ADD COLUMN session_id text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'whatsapp_connections' AND column_name = 'last_connected_at') THEN
    ALTER TABLE whatsapp_connections ADD COLUMN last_connected_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'whatsapp_connections' AND column_name = 'last_disconnected_at') THEN
    ALTER TABLE whatsapp_connections ADD COLUMN last_disconnected_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'whatsapp_connections' AND column_name = 'last_seen_at') THEN
    ALTER TABLE whatsapp_connections ADD COLUMN last_seen_at timestamptz;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_wa_conn_session ON whatsapp_connections(session_id) WHERE session_id IS NOT NULL;

-- =========================================================
-- 4. whatsapp_qr_sessions — realtime QR delivery
--    Each row is a QR code for a specific connection
--    Frontend subscribes via Realtime to get new QRs
-- =========================================================
CREATE TABLE IF NOT EXISTS whatsapp_qr_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES whatsapp_connections(id) ON DELETE CASCADE,
  qr_data text NOT NULL,
  status text NOT NULL DEFAULT 'qr_ready',
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wa_qr_conn ON whatsapp_qr_sessions(connection_id);
CREATE INDEX IF NOT EXISTS idx_wa_qr_status ON whatsapp_qr_sessions(status);
CREATE INDEX IF NOT EXISTS idx_wa_qr_expires ON whatsapp_qr_sessions(expires_at DESC);

ALTER TABLE whatsapp_qr_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_wa_qr" ON whatsapp_qr_sessions;
CREATE POLICY "select_wa_qr" ON whatsapp_qr_sessions
  FOR SELECT TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "insert_wa_qr" ON whatsapp_qr_sessions;
CREATE POLICY "insert_wa_qr" ON whatsapp_qr_sessions
  FOR INSERT TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS "delete_wa_qr" ON whatsapp_qr_sessions;
CREATE POLICY "delete_wa_qr" ON whatsapp_qr_sessions
  FOR DELETE TO authenticated USING (is_admin());

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_qr_sessions;

-- =========================================================
-- 5. SECURITY DEFINER: Create QR connection
--    Creates a new whatsapp_web connection in 'connecting' state
-- =========================================================
CREATE OR REPLACE FUNCTION create_qr_connection(
  p_display_name text,
  p_business_name text DEFAULT NULL,
  p_branch text DEFAULT NULL,
  p_user_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conn_id uuid;
BEGIN
  INSERT INTO whatsapp_connections (
    business_name, branch, display_name, provider,
    status, created_by
  )
  VALUES (
    COALESCE(p_business_name, p_display_name), p_branch, p_display_name,
    'whatsapp_web', 'connecting', p_user_id
  )
  RETURNING id INTO v_conn_id;

  INSERT INTO whatsapp_connection_logs (connection_id, action, result, user_id, details)
  VALUES (v_conn_id, 'connect_qr', 'success', p_user_id, jsonb_build_object('provider', 'whatsapp_web'));

  RETURN v_conn_id;
END;
$$;

-- =========================================================
-- 6. SECURITY DEFINER: Update QR status
--    Called by edge function when Baileys generates QR or auth succeeds
-- =========================================================
CREATE OR REPLACE FUNCTION update_qr_session_status(
  p_connection_id uuid,
  p_status text,
  p_phone_number text DEFAULT NULL,
  p_session_id text DEFAULT NULL,
  p_qr_data text DEFAULT NULL,
  p_details jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update connection status
  UPDATE whatsapp_connections SET
    status = p_status,
    phone_number = COALESCE(p_phone_number, phone_number),
    session_id = COALESCE(p_session_id, session_id),
    last_seen_at = CASE WHEN p_status = 'connected' THEN now() ELSE last_seen_at END,
    last_connected_at = CASE WHEN p_status = 'connected' THEN now() ELSE last_connected_at END,
    last_health_check = now(),
    api_status = CASE WHEN p_status = 'connected' THEN 'healthy' ELSE api_status END,
    updated_at = now()
  WHERE id = p_connection_id;

  -- Insert QR data if provided
  IF p_qr_data IS NOT NULL THEN
    -- Delete old QRs for this connection
    DELETE FROM whatsapp_qr_sessions WHERE connection_id = p_connection_id;
    -- Insert new QR (valid for ~60 seconds)
    INSERT INTO whatsapp_qr_sessions (connection_id, qr_data, status, expires_at)
    VALUES (p_connection_id, p_qr_data, 'qr_ready', now() + interval '90 seconds');
  END IF;

  -- Log
  INSERT INTO whatsapp_connection_logs (connection_id, action, result, details)
  VALUES (
    p_connection_id,
    p_status,
    CASE WHEN p_status IN ('auth_failed', 'session_expired', 'error') THEN 'error' ELSE 'success' END,
    COALESCE(p_details, '{}'::jsonb)
  );
END;
$$;

-- =========================================================
-- 7. SECURITY DEFINER: Reconnect WhatsApp Web session
--    Marks connection as 'connecting' to trigger reconnect
-- =========================================================
CREATE OR REPLACE FUNCTION reconnect_whatsapp_connection(
  p_connection_id uuid,
  p_user_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE whatsapp_connections SET
    status = 'connecting',
    updated_at = now()
  WHERE id = p_connection_id;

  INSERT INTO whatsapp_connection_logs (connection_id, action, result, user_id, details)
  VALUES (p_connection_id, 'reconnect', 'success', p_user_id, jsonb_build_object('timestamp', now()));
END;
$$;

-- =========================================================
-- 8. SECURITY DEFINER: Save session credentials
--    Called by edge function when Baileys authenticates
--    Stores encrypted session data in secrets table
-- =========================================================
CREATE OR REPLACE FUNCTION save_session_credentials(
  p_connection_id uuid,
  p_session_data text DEFAULT NULL,
  p_api_key text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Upsert secrets
  INSERT INTO whatsapp_connection_secrets (connection_id, api_key, access_token)
  VALUES (p_connection_id, p_api_key, p_session_data)
  ON CONFLICT (connection_id) DO UPDATE SET
    api_key = COALESCE(p_api_key, whatsapp_connection_secrets.api_key),
    access_token = COALESCE(p_session_data, whatsapp_connection_secrets.access_token),
    updated_at = now();
END;
$$;

-- =========================================================
-- 9. SECURITY DEFINER: Get session data for reconnect
--    Only service role (edge function) can call this
-- =========================================================
CREATE OR REPLACE FUNCTION get_session_data(p_connection_id uuid)
RETURNS TABLE (
  session_data text,
  api_key text,
  session_id text,
  provider text,
  phone_number text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_service_role boolean;
BEGIN
  v_is_service_role := current_setting('role', true) = 'service_role';
  IF NOT v_is_service_role THEN
    RAISE EXCEPTION 'Unauthorized: only service role can read session data';
  END IF;

  SELECT s.access_token, s.api_key, c.session_id, c.provider, c.phone_number
  INTO session_data, api_key, session_id, provider, phone_number
  FROM whatsapp_connection_secrets s
  JOIN whatsapp_connections c ON c.id = s.connection_id
  WHERE s.connection_id = p_connection_id;
END;
$$;

-- =========================================================
-- 10. SECURITY DEFINER: Clean expired QR codes
-- =========================================================
CREATE OR REPLACE FUNCTION clean_expired_qr()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM whatsapp_qr_sessions WHERE expires_at < now();
END;
$$;
