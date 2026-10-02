/*
# Fix WhatsApp QR Connection Issues

## Problems fixed:
1. No delete_whatsapp_connection function — "Hapus" only disconnected, never deleted
2. No cleanup for orphaned "connecting" connections when server is unavailable
3. No webhook authentication — anyone could post QR/auth events
4. Missing "reconnecting" status in the check constraint
5. whatsapp_qr_sessions needs updated_at column for proper expiration tracking

## Security:
- Webhook events require WHATSAPP_WEBHOOK_SECRET header validation (done in edge function)
- delete_whatsapp_connection is SECURITY DEFINER, admin-only
- Session credentials never exposed to frontend
*/

-- =========================================================
-- 1. Add 'reconnecting' and 'error' to status check constraint
-- =========================================================
ALTER TABLE whatsapp_connections DROP CONSTRAINT IF EXISTS wa_conn_status_check;
ALTER TABLE whatsapp_connections ADD CONSTRAINT wa_conn_status_check
  CHECK (status IN (
    'connected', 'connecting', 'disconnected',
    'invalid_credentials', 'webhook_error', 'phone_number_error', 'api_error',
    'auth_required', 'session_expired', 'auth_failed', 'qr_ready', 'waiting_for_scan',
    'reconnecting', 'error'
  ));

-- =========================================================
-- 2. Add updated_at to whatsapp_qr_sessions
-- =========================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'whatsapp_qr_sessions' AND column_name = 'updated_at') THEN
    ALTER TABLE whatsapp_qr_sessions ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;

-- =========================================================
-- 3. SECURITY DEFINER: Delete WhatsApp connection
--    Properly deletes connection + secrets + QR sessions
--    Preserves conversations and messages (only nullifies connection_id FK)
-- =========================================================
CREATE OR REPLACE FUNCTION delete_whatsapp_connection(
  p_connection_id uuid,
  p_user_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify admin permission
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id AND role = 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: only admin can delete connections';
  END IF;

  -- Log before deletion
  INSERT INTO whatsapp_connection_logs (connection_id, action, result, user_id, details)
  VALUES (p_connection_id, 'delete_connection', 'success', p_user_id,
    jsonb_build_object('timestamp', now()));

  -- Nullify connection_id on conversations (preserve history)
  UPDATE whatsapp_conversations SET connection_id = NULL WHERE connection_id = p_connection_id;

  -- Delete QR sessions
  DELETE FROM whatsapp_qr_sessions WHERE connection_id = p_connection_id;

  -- Delete secrets (cascades with connection)
  DELETE FROM whatsapp_connection_secrets WHERE connection_id = p_connection_id;

  -- Delete connection
  DELETE FROM whatsapp_connections WHERE id = p_connection_id;
END;
$$;

-- =========================================================
-- 4. SECURITY DEFINER: Cleanup orphaned connecting connections
--    Removes connections stuck in "connecting" for > 5 minutes
--    Called by edge function when server is unavailable
-- =========================================================
CREATE OR REPLACE FUNCTION cleanup_orphan_connections(
  p_connection_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_connection_id IS NOT NULL THEN
    -- Delete specific orphaned connection if still connecting
    DELETE FROM whatsapp_qr_sessions WHERE connection_id = p_connection_id;
    DELETE FROM whatsapp_connection_secrets WHERE connection_id = p_connection_id;
    DELETE FROM whatsapp_connections
    WHERE id = p_connection_id AND status = 'connecting';
  ELSE
    -- Delete all connections stuck in connecting for > 5 minutes
    DELETE FROM whatsapp_qr_sessions
    WHERE connection_id IN (
      SELECT id FROM whatsapp_connections
      WHERE status = 'connecting' AND created_at < now() - interval '5 minutes'
    );
    DELETE FROM whatsapp_connection_secrets
    WHERE connection_id IN (
      SELECT id FROM whatsapp_connections
      WHERE status = 'connecting' AND created_at < now() - interval '5 minutes'
    );
    DELETE FROM whatsapp_connections
    WHERE status = 'connecting' AND created_at < now() - interval '5 minutes';
  END IF;
END;
$$;

-- =========================================================
-- 5. SECURITY DEFINER: Update connection from webhook (authenticated)
--    Used by webhook to update connection status from session server events
-- =========================================================
CREATE OR REPLACE FUNCTION webhook_update_connection(
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
  -- Verify connection exists
  IF NOT EXISTS (SELECT 1 FROM whatsapp_connections WHERE id = p_connection_id) THEN
    RAISE EXCEPTION 'Connection not found: %', p_connection_id;
  END IF;

  -- Update connection
  UPDATE whatsapp_connections SET
    status = p_status,
    phone_number = COALESCE(p_phone_number, phone_number),
    session_id = COALESCE(p_session_id, session_id),
    last_seen_at = CASE WHEN p_status = 'connected' THEN now() ELSE last_seen_at END,
    last_connected_at = CASE WHEN p_status = 'connected' THEN now() ELSE last_connected_at END,
    last_disconnected_at = CASE WHEN p_status = 'disconnected' THEN now() ELSE last_disconnected_at END,
    last_health_check = now(),
    api_status = CASE WHEN p_status = 'connected' THEN 'healthy' ELSE api_status END,
    updated_at = now()
  WHERE id = p_connection_id;

  -- Handle QR data
  IF p_qr_data IS NOT NULL THEN
    -- Expire all previous QRs for this connection
    UPDATE whatsapp_qr_sessions SET status = 'expired', updated_at = now()
    WHERE connection_id = p_connection_id AND status = 'qr_ready';

    -- Insert new QR
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
-- 6. SECURITY DEFINER: Save outgoing message
--    Called by edge function when sales sends a message
-- =========================================================
CREATE OR REPLACE FUNCTION save_outgoing_message(
  p_conversation_id uuid,
  p_text text,
  p_external_message_id text DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  p_connection_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_msg_id uuid;
BEGIN
  INSERT INTO whatsapp_messages (
    conversation_id, external_message_id, direction,
    message_type, text, status, created_by
  )
  VALUES (
    p_conversation_id, p_external_message_id, 'outgoing',
    'text', p_text, 'pending', p_user_id
  )
  RETURNING id INTO v_msg_id;

  -- Update conversation
  UPDATE whatsapp_conversations SET
    last_message_text = p_text,
    last_message_at = now(),
    last_message_direction = 'outgoing',
    status = 'waiting_customer',
    last_response_at = now(),
    first_response_at = COALESCE(first_response_at, now()),
    connection_id = COALESCE(connection_id, p_connection_id),
    updated_at = now()
  WHERE id = p_conversation_id;

  RETURN v_msg_id;
END;
$$;

-- =========================================================
-- 7. SECURITY DEFINER: Update message status from webhook
-- =========================================================
CREATE OR REPLACE FUNCTION update_message_status(
  p_external_message_id text,
  p_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE whatsapp_messages SET status = p_status
  WHERE external_message_id = p_external_message_id;
END;
$$;

-- =========================================================
-- 8. Clean up existing orphaned connections
-- =========================================================
SELECT cleanup_orphan_connections();
