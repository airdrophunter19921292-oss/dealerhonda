/*
# WhatsApp CRM Module — Phase 1 Foundation

## Overview
Creates core WhatsApp CRM Inbox tables: conversations, messages, templates,
internal notes. Integrates with existing CRM (customers, leads).

## New Tables
1. whatsapp_conversations — main conversation entity with assignment, SLA, priority
2. whatsapp_templates — quick reply templates with shortcuts
3. whatsapp_messages — individual messages with idempotency via external_message_id
4. whatsapp_internal_notes — private notes not sent to customer

## Security
- RLS on all tables, sales see only assigned conversations, admin sees all
- Templates managed by admin only

## Realtime
- whatsapp_conversations and whatsapp_messages added to supabase_realtime

## Helper Functions
- normalize_phone() — converts phone to 62xxx format
- find_or_create_conversation() — matches incoming message to customer/lead
*/

-- =========================================================
-- 1. whatsapp_conversations
-- =========================================================
CREATE TABLE IF NOT EXISTS whatsapp_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  customer_name text NOT NULL DEFAULT '',
  customer_phone text NOT NULL,
  customer_phone_raw text,
  assigned_to uuid REFERENCES profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'open',
  priority text NOT NULL DEFAULT 'normal',
  source text,
  last_message_text text,
  last_message_at timestamptz,
  last_message_direction text,
  unread_count integer NOT NULL DEFAULT 0,
  last_response_at timestamptz,
  first_response_at timestamptz,
  sla_due_at timestamptz,
  tags text[] DEFAULT '{}',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT wa_conversation_status_check
    CHECK (status IN ('open', 'waiting_customer', 'waiting_sales', 'resolved', 'archived')),
  CONSTRAINT wa_conversation_priority_check
    CHECK (priority IN ('low', 'normal', 'high', 'urgent'))
);

CREATE INDEX IF NOT EXISTS idx_wa_conv_assigned ON whatsapp_conversations(assigned_to);
CREATE INDEX IF NOT EXISTS idx_wa_conv_status ON whatsapp_conversations(status);
CREATE INDEX IF NOT EXISTS idx_wa_conv_phone ON whatsapp_conversations(customer_phone);
CREATE INDEX IF NOT EXISTS idx_wa_conv_last_msg ON whatsapp_conversations(last_message_at DESC);

ALTER TABLE whatsapp_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_wa_conversations" ON whatsapp_conversations;
CREATE POLICY "select_wa_conversations" ON whatsapp_conversations
  FOR SELECT TO authenticated
  USING (is_admin() OR (is_sales() AND assigned_to = auth.uid()));

DROP POLICY IF EXISTS "insert_wa_conversations" ON whatsapp_conversations;
CREATE POLICY "insert_wa_conversations" ON whatsapp_conversations
  FOR INSERT TO authenticated WITH CHECK (is_staff());

DROP POLICY IF EXISTS "update_wa_conversations" ON whatsapp_conversations;
CREATE POLICY "update_wa_conversations" ON whatsapp_conversations
  FOR UPDATE TO authenticated
  USING (is_admin() OR (is_sales() AND assigned_to = auth.uid()))
  WITH CHECK (is_admin() OR (is_sales() AND assigned_to = auth.uid()));

DROP POLICY IF EXISTS "delete_wa_conversations" ON whatsapp_conversations;
CREATE POLICY "delete_wa_conversations" ON whatsapp_conversations
  FOR DELETE TO authenticated USING (is_admin());

-- =========================================================
-- 2. whatsapp_templates
-- =========================================================
CREATE TABLE IF NOT EXISTS whatsapp_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  content text NOT NULL,
  category text NOT NULL DEFAULT 'other',
  shortcut text UNIQUE,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT wa_template_category_check
    CHECK (category IN ('greeting', 'pricing', 'credit', 'follow_up', 'location', 'test_ride', 'other'))
);

CREATE INDEX IF NOT EXISTS idx_wa_tpl_category ON whatsapp_templates(category);
CREATE INDEX IF NOT EXISTS idx_wa_tpl_active ON whatsapp_templates(is_active);

ALTER TABLE whatsapp_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_wa_templates" ON whatsapp_templates;
CREATE POLICY "select_wa_templates" ON whatsapp_templates
  FOR SELECT TO authenticated USING (is_staff());

DROP POLICY IF EXISTS "insert_wa_templates" ON whatsapp_templates;
CREATE POLICY "insert_wa_templates" ON whatsapp_templates
  FOR INSERT TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS "update_wa_templates" ON whatsapp_templates;
CREATE POLICY "update_wa_templates" ON whatsapp_templates
  FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "delete_wa_templates" ON whatsapp_templates;
CREATE POLICY "delete_wa_templates" ON whatsapp_templates
  FOR DELETE TO authenticated USING (is_admin());

-- =========================================================
-- 3. whatsapp_messages
-- =========================================================
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES whatsapp_conversations(id) ON DELETE CASCADE,
  external_message_id text UNIQUE,
  direction text NOT NULL DEFAULT 'incoming',
  message_type text NOT NULL DEFAULT 'text',
  text text,
  media_url text,
  media_caption text,
  status text NOT NULL DEFAULT 'sent',
  sender_phone text,
  recipient_phone text,
  template_id uuid REFERENCES whatsapp_templates(id) ON DELETE SET NULL,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT wa_msg_direction_check
    CHECK (direction IN ('incoming', 'outgoing')),
  CONSTRAINT wa_msg_type_check
    CHECK (message_type IN ('text', 'image', 'video', 'audio', 'document', 'location', 'template')),
  CONSTRAINT wa_msg_status_check
    CHECK (status IN ('sending', 'sent', 'delivered', 'read', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_wa_msg_conv ON whatsapp_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_wa_msg_external ON whatsapp_messages(external_message_id);
CREATE INDEX IF NOT EXISTS idx_wa_msg_created ON whatsapp_messages(created_at DESC);

ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_wa_messages" ON whatsapp_messages;
CREATE POLICY "select_wa_messages" ON whatsapp_messages
  FOR SELECT TO authenticated
  USING (
    is_admin() OR (
      is_sales() AND EXISTS (
        SELECT 1 FROM whatsapp_conversations c
        WHERE c.id = whatsapp_messages.conversation_id
        AND c.assigned_to = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "insert_wa_messages" ON whatsapp_messages;
CREATE POLICY "insert_wa_messages" ON whatsapp_messages
  FOR INSERT TO authenticated WITH CHECK (is_staff());

DROP POLICY IF EXISTS "update_wa_messages" ON whatsapp_messages;
CREATE POLICY "update_wa_messages" ON whatsapp_messages
  FOR UPDATE TO authenticated
  USING (is_staff()) WITH CHECK (is_staff());

DROP POLICY IF EXISTS "delete_wa_messages" ON whatsapp_messages;
CREATE POLICY "delete_wa_messages" ON whatsapp_messages
  FOR DELETE TO authenticated USING (is_admin());

-- =========================================================
-- 4. whatsapp_internal_notes
-- =========================================================
CREATE TABLE IF NOT EXISTS whatsapp_internal_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES whatsapp_conversations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  note text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wa_notes_conv ON whatsapp_internal_notes(conversation_id);

ALTER TABLE whatsapp_internal_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_wa_notes" ON whatsapp_internal_notes;
CREATE POLICY "select_wa_notes" ON whatsapp_internal_notes
  FOR SELECT TO authenticated
  USING (
    is_admin() OR (
      is_sales() AND EXISTS (
        SELECT 1 FROM whatsapp_conversations c
        WHERE c.id = whatsapp_internal_notes.conversation_id
        AND c.assigned_to = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "insert_wa_notes" ON whatsapp_internal_notes;
CREATE POLICY "insert_wa_notes" ON whatsapp_internal_notes
  FOR INSERT TO authenticated WITH CHECK (is_staff());

DROP POLICY IF EXISTS "update_wa_notes" ON whatsapp_internal_notes;
CREATE POLICY "update_wa_notes" ON whatsapp_internal_notes
  FOR UPDATE TO authenticated USING (is_staff()) WITH CHECK (is_staff());

DROP POLICY IF EXISTS "delete_wa_notes" ON whatsapp_internal_notes;
CREATE POLICY "delete_wa_notes" ON whatsapp_internal_notes
  FOR DELETE TO authenticated USING (is_admin());

-- =========================================================
-- 5. Realtime publications
-- =========================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;

-- =========================================================
-- 6. Helper function: normalize phone
-- =========================================================
CREATE OR REPLACE FUNCTION normalize_phone(p_phone text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  p_phone := regexp_replace(p_phone, '[^0-9]', '', 'g');
  IF p_phone LIKE '0%' THEN
    p_phone := '62' || substring(p_phone from 2);
  END IF;
  RETURN p_phone;
END;
$$;

-- =========================================================
-- 7. Helper function: find or create conversation
-- =========================================================
CREATE OR REPLACE FUNCTION find_or_create_conversation(
  p_phone text,
  p_name text DEFAULT NULL,
  p_source text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_normalized text;
  v_conv_id uuid;
  v_customer_id uuid;
  v_lead_id uuid;
  v_customer_name text;
BEGIN
  v_normalized := normalize_phone(p_phone);

  SELECT id, customer_id, lead_id, customer_name INTO v_conv_id, v_customer_id, v_lead_id, v_customer_name
    FROM whatsapp_conversations
    WHERE customer_phone = v_normalized
    AND status NOT IN ('resolved', 'archived')
    ORDER BY updated_at DESC
    LIMIT 1;

  IF v_conv_id IS NOT NULL THEN
    IF p_name IS NOT NULL AND p_name <> '' AND (v_customer_name IS NULL OR v_customer_name = '') THEN
      UPDATE whatsapp_conversations SET customer_name = p_name, updated_at = now()
        WHERE id = v_conv_id;
    END IF;
    RETURN v_conv_id;
  END IF;

  SELECT id INTO v_customer_id FROM customers
    WHERE normalize_phone(phone) = v_normalized
    ORDER BY created_at DESC LIMIT 1;

  SELECT id INTO v_lead_id FROM leads
    WHERE normalize_phone(phone) = v_normalized
    ORDER BY created_at DESC LIMIT 1;

  v_customer_name := COALESCE(p_name, '');
  IF v_customer_name = '' AND v_customer_id IS NOT NULL THEN
    SELECT name INTO v_customer_name FROM customers WHERE id = v_customer_id;
  END IF;

  INSERT INTO whatsapp_conversations (
    customer_id, lead_id, customer_name, customer_phone,
    customer_phone_raw, source, status
  )
  VALUES (
    v_customer_id, v_lead_id, v_customer_name, v_normalized,
    p_phone, p_source, 'open'
  )
  RETURNING id INTO v_conv_id;

  RETURN v_conv_id;
END;
$$;
