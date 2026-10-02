/*
# WhatsApp Connections, Secrets, SLA, Connection Logs

## Overview
This migration adds:
1. whatsapp_connections — multi-branch WhatsApp Business number management
2. whatsapp_connection_secrets — stores API credentials server-side (never exposed to frontend)
3. whatsapp_connection_logs — audit trail for connection events
4. SLA columns on whatsapp_conversations (response_time_seconds, resolution_time_seconds, sla_status)
5. SECURITY DEFINER functions for connection management (test, connect, disconnect)
6. whatsapp_config table for SLA targets and global settings

## Security
- whatsapp_connection_secrets has NO SELECT policy for any frontend role
- Only SECURITY DEFINER functions can read secrets
- whatsapp_connections: admin-only for write, staff can read
- whatsapp_connection_logs: admin-only for write, admin can read

## Key Design Decisions
- Secrets stored in separate table with no RLS SELECT policy (deny-by-default)
- SECURITY DEFINER functions read secrets with SET search_path = public
- Frontend never sees access tokens, app secrets, or webhook verify tokens
- Multi-branch: each connection has optional branch_id
*/

-- =========================================================
-- 1. whatsapp_connections
-- =========================================================
CREATE TABLE IF NOT EXISTS whatsapp_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name text NOT NULL,
  branch text,
  display_name text NOT NULL,
  phone_number text,
  phone_number_id text,
  waba_id text,
  business_account_id text,
  provider text NOT NULL DEFAULT 'meta_cloud_api',
  status text NOT NULL DEFAULT 'disconnected',
  webhook_status text NOT NULL DEFAULT 'unknown',
  api_status text NOT NULL DEFAULT 'unknown',
  webhook_url text,
  webhook_verified_at timestamptz,
  last_health_check timestamptz,
  last_message_at timestamptz,
  is_default boolean DEFAULT false,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT wa_conn_status_check
    CHECK (status IN ('connected', 'connecting', 'disconnected', 'invalid_credentials', 'webhook_error', 'phone_number_error', 'api_error')),
  CONSTRAINT wa_conn_webhook_status_check
    CHECK (webhook_status IN ('healthy', 'unverified', 'error', 'unknown')),
  CONSTRAINT wa_conn_api_status_check
    CHECK (api_status IN ('healthy', 'error', 'degraded', 'unknown')),
  CONSTRAINT wa_conn_provider_check
    CHECK (provider IN ('meta_cloud_api', 'fonnte', 'wati', 'ultramsg', 'other'))
);

CREATE INDEX IF NOT EXISTS idx_wa_conn_status ON whatsapp_connections(status);
CREATE INDEX IF NOT EXISTS idx_wa_conn_phone ON whatsapp_connections(phone_number);

ALTER TABLE whatsapp_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_wa_connections" ON whatsapp_connections;
CREATE POLICY "select_wa_connections" ON whatsapp_connections
  FOR SELECT TO authenticated USING (is_staff());

DROP POLICY IF EXISTS "insert_wa_connections" ON whatsapp_connections;
CREATE POLICY "insert_wa_connections" ON whatsapp_connections
  FOR INSERT TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS "update_wa_connections" ON whatsapp_connections;
CREATE POLICY "update_wa_connections" ON whatsapp_connections
  FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "delete_wa_connections" ON whatsapp_connections;
CREATE POLICY "delete_wa_connections" ON whatsapp_connections
  FOR DELETE TO authenticated USING (is_admin());

-- =========================================================
-- 2. whatsapp_connection_secrets
--    NO SELECT policy — deny by default for all roles
--    Only accessible via SECURITY DEFINER functions
-- =========================================================
CREATE TABLE IF NOT EXISTS whatsapp_connection_secrets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES whatsapp_connections(id) ON DELETE CASCADE,
  access_token text,
  app_id text,
  app_secret text,
  webhook_verify_token text,
  api_key text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_wa_secrets_conn ON whatsapp_connection_secrets(connection_id);

ALTER TABLE whatsapp_connection_secrets ENABLE ROW LEVEL SECURITY;
-- No SELECT/INSERT/UPDATE/DELETE policies = deny by default for authenticated and anon
-- Only SECURITY DEFINER functions (running as postgres) can access this table

-- =========================================================
-- 3. whatsapp_connection_logs
-- =========================================================
CREATE TABLE IF NOT EXISTS whatsapp_connection_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid REFERENCES whatsapp_connections(id) ON DELETE CASCADE,
  action text NOT NULL,
  result text NOT NULL DEFAULT 'success',
  details jsonb DEFAULT '{}'::jsonb,
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wa_logs_conn ON whatsapp_connection_logs(connection_id);
CREATE INDEX IF NOT EXISTS idx_wa_logs_created ON whatsapp_connection_logs(created_at DESC);

ALTER TABLE whatsapp_connection_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_wa_conn_logs" ON whatsapp_connection_logs;
CREATE POLICY "select_wa_conn_logs" ON whatsapp_connection_logs
  FOR SELECT TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "insert_wa_conn_logs" ON whatsapp_connection_logs;
CREATE POLICY "insert_wa_conn_logs" ON whatsapp_connection_logs
  FOR INSERT TO authenticated WITH CHECK (is_staff());

DROP POLICY IF EXISTS "delete_wa_conn_logs" ON whatsapp_connection_logs;
CREATE POLICY "delete_wa_conn_logs" ON whatsapp_connection_logs
  FOR DELETE TO authenticated USING (is_admin());

-- =========================================================
-- 4. SLA columns on whatsapp_conversations
-- =========================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'whatsapp_conversations' AND column_name = 'response_time_seconds') THEN
    ALTER TABLE whatsapp_conversations ADD COLUMN response_time_seconds integer;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'whatsapp_conversations' AND column_name = 'resolution_time_seconds') THEN
    ALTER TABLE whatsapp_conversations ADD COLUMN resolution_time_seconds integer;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'whatsapp_conversations' AND column_name = 'sla_status') THEN
    ALTER TABLE whatsapp_conversations ADD COLUMN sla_status text DEFAULT 'within_sla';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'whatsapp_conversations' AND column_name = 'connection_id') THEN
    ALTER TABLE whatsapp_conversations ADD COLUMN connection_id uuid REFERENCES whatsapp_connections(id) ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE whatsapp_conversations DROP CONSTRAINT IF EXISTS wa_conv_sla_check;
ALTER TABLE whatsapp_conversations ADD CONSTRAINT wa_conv_sla_check
  CHECK (sla_status IN ('within_sla', 'sla_breached', 'no_sla'));

CREATE INDEX IF NOT EXISTS idx_wa_conv_sla ON whatsapp_conversations(sla_status);
CREATE INDEX IF NOT EXISTS idx_wa_conv_conn ON whatsapp_conversations(connection_id);

-- =========================================================
-- 5. whatsapp_config — SLA targets and settings
-- =========================================================
CREATE TABLE IF NOT EXISTS whatsapp_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE whatsapp_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_wa_config" ON whatsapp_config;
CREATE POLICY "select_wa_config" ON whatsapp_config
  FOR SELECT TO authenticated USING (is_staff());

DROP POLICY IF EXISTS "update_wa_config" ON whatsapp_config;
CREATE POLICY "update_wa_config" ON whatsapp_config
  FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());

INSERT INTO whatsapp_config (key, value) VALUES
  ('sla', '{"first_response_target_minutes": 5, "resolution_target_hours": 24}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- =========================================================
-- 6. SECURITY DEFINER: Save connection with secrets
-- =========================================================
CREATE OR REPLACE FUNCTION save_whatsapp_connection(
  p_business_name text,
  p_branch text DEFAULT NULL,
  p_display_name text DEFAULT NULL,
  p_phone_number text DEFAULT NULL,
  p_phone_number_id text DEFAULT NULL,
  p_waba_id text DEFAULT NULL,
  p_business_account_id text DEFAULT NULL,
  p_provider text DEFAULT 'meta_cloud_api',
  p_access_token text DEFAULT NULL,
  p_app_id text DEFAULT NULL,
  p_app_secret text DEFAULT NULL,
  p_webhook_verify_token text DEFAULT NULL,
  p_api_key text DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  p_connection_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conn_id uuid;
BEGIN
  IF p_connection_id IS NOT NULL THEN
    -- Update existing
    v_conn_id := p_connection_id;
    UPDATE whatsapp_connections SET
      business_name = p_business_name,
      branch = p_branch,
      display_name = p_display_name,
      phone_number = p_phone_number,
      phone_number_id = p_phone_number_id,
      waba_id = p_waba_id,
      business_account_id = p_business_account_id,
      provider = p_provider,
      updated_at = now()
    WHERE id = v_conn_id;

    -- Update secrets
    UPDATE whatsapp_connection_secrets SET
      access_token = p_access_token,
      app_id = p_app_id,
      app_secret = p_app_secret,
      webhook_verify_token = p_webhook_verify_token,
      api_key = p_api_key,
      updated_at = now()
    WHERE connection_id = v_conn_id;

    -- Log
    INSERT INTO whatsapp_connection_logs (connection_id, action, result, user_id, details)
    VALUES (v_conn_id, 'update_connection', 'success', p_user_id, jsonb_build_object('provider', p_provider));
  ELSE
    -- Create new
    INSERT INTO whatsapp_connections (
      business_name, branch, display_name, phone_number,
      phone_number_id, waba_id, business_account_id, provider,
      status, created_by
    )
    VALUES (
      p_business_name, p_branch, p_display_name, p_phone_number,
      p_phone_number_id, p_waba_id, p_business_account_id, p_provider,
      'connecting', p_user_id
    )
    RETURNING id INTO v_conn_id;

    -- Insert secrets
    INSERT INTO whatsapp_connection_secrets (
      connection_id, access_token, app_id, app_secret,
      webhook_verify_token, api_key
    )
    VALUES (
      v_conn_id, p_access_token, p_app_id, p_app_secret,
      p_webhook_verify_token, p_api_key
    );

    -- Log
    INSERT INTO whatsapp_connection_logs (connection_id, action, result, user_id, details)
    VALUES (v_conn_id, 'connect', 'success', p_user_id, jsonb_build_object('provider', p_provider));
  END IF;

  RETURN v_conn_id;
END;
$$;

-- =========================================================
-- 7. SECURITY DEFINER: Update connection status
-- =========================================================
CREATE OR REPLACE FUNCTION update_connection_status(
  p_connection_id uuid,
  p_status text DEFAULT NULL,
  p_api_status text DEFAULT NULL,
  p_webhook_status text DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  p_details jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_status text;
BEGIN
  SELECT status INTO v_current_status FROM whatsapp_connections WHERE id = p_connection_id;
  IF v_current_status IS NULL THEN RETURN; END IF;

  UPDATE whatsapp_connections SET
    status = COALESCE(p_status, status),
    api_status = COALESCE(p_api_status, api_status),
    webhook_status = COALESCE(p_webhook_status, webhook_status),
    last_health_check = now(),
    updated_at = now()
  WHERE id = p_connection_id;

  INSERT INTO whatsapp_connection_logs (connection_id, action, result, user_id, details)
  VALUES (
    p_connection_id,
    COALESCE(p_status, 'health_check'),
    CASE WHEN p_status = 'invalid_credentials' OR p_status = 'api_error' THEN 'error' ELSE 'success' END,
    p_user_id,
    COALESCE(p_details, '{}'::jsonb)
  );
END;
$$;

-- =========================================================
-- 8. SECURITY DEFINER: Disconnect connection
-- =========================================================
CREATE OR REPLACE FUNCTION disconnect_whatsapp_connection(
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
    status = 'disconnected',
    api_status = 'unknown',
    webhook_status = 'unknown',
    updated_at = now()
  WHERE id = p_connection_id;

  INSERT INTO whatsapp_connection_logs (connection_id, action, result, user_id, details)
  VALUES (p_connection_id, 'disconnect', 'success', p_user_id, jsonb_build_object('timestamp', now()));
END;
$$;

-- =========================================================
-- 9. SECURITY DEFINER: Get connection secrets (for edge functions)
--    Returns secrets only when called with service role
-- =========================================================
CREATE OR REPLACE FUNCTION get_connection_secrets(p_connection_id uuid)
RETURNS TABLE (
  access_token text,
  app_id text,
  app_secret text,
  webhook_verify_token text,
  api_key text,
  phone_number_id text,
  waba_id text,
  provider text
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
    RAISE EXCEPTION 'Unauthorized: only service role can read secrets';
  END IF;

  SELECT s.access_token, s.app_id, s.app_secret, s.webhook_verify_token,
         s.api_key, c.phone_number_id, c.waba_id, c.provider
  INTO access_token, app_id, app_secret, webhook_verify_token,
       api_key, phone_number_id, waba_id, provider
  FROM whatsapp_connection_secrets s
  JOIN whatsapp_connections c ON c.id = s.connection_id
  WHERE s.connection_id = p_connection_id;
END;
$$;

-- =========================================================
-- 10. SECURITY DEFINER: Get active connection for webhook
--     Returns the default or first connected connection
-- =========================================================
CREATE OR REPLACE FUNCTION get_active_connection()
RETURNS TABLE (
  connection_id uuid,
  phone_number text,
  phone_number_id text,
  waba_id text,
  provider text,
  access_token text,
  api_key text
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
    RAISE EXCEPTION 'Unauthorized: only service role can read connection details';
  END IF;

  SELECT c.id, c.phone_number, c.phone_number_id, c.waba_id, c.provider,
         s.access_token, s.api_key
  INTO connection_id, phone_number, phone_number_id, waba_id, provider,
       access_token, api_key
  FROM whatsapp_connections c
  JOIN whatsapp_connection_secrets s ON s.connection_id = c.id
  WHERE c.status = 'connected'
  ORDER BY c.is_default DESC, c.created_at ASC
  LIMIT 1;
END;
$$;

-- =========================================================
-- 11. Add Realtime for connection status
-- =========================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_connections;
