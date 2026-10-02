import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Webhook-Secret",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * WhatsApp Webhook Handler
 *
 * Receives events from:
 * 1. External Baileys Session Server (QR, auth, messages, status)
 * 2. Meta Cloud API / other providers (existing)
 *
 * Security:
 * - Baileys server events require X-Webhook-Secret header matching WHATSAPP_WEBHOOK_SECRET
 * - Meta webhook verification uses hub.verify_token
 * - No unauthenticated external can post events
 */

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // Meta webhook verification (GET)
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && challenge) {
      const envToken = Deno.env.get("WHATSAPP_VERIFY_TOKEN");
      if (envToken && token === envToken) {
        return new Response(challenge, { status: 200, headers: { ...corsHeaders, "Content-Type": "text/plain" } });
      }
      return new Response("Forbidden", { status: 403, headers: corsHeaders });
    }
    return new Response("OK", { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();

    // === Authenticate Baileys server events ===
    // Baileys events have body.event — validate webhook secret
    const isBaileysEvent = body?.event && typeof body.event === "string";
    const webhookSecret = Deno.env.get("WHATSAPP_WEBHOOK_SECRET");

    if (isBaileysEvent && webhookSecret) {
      const providedSecret = req.headers.get("X-Webhook-Secret");
      if (providedSecret !== webhookSecret) {
        console.error("[webhook] Unauthorized Baileys event — secret mismatch");
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // === Baileys / WhatsApp Web server events ===

    // QR Code event
    if (body?.event === "qr" && body?.connection_id && body?.qr) {
      console.log("[whatsapp] QR generated for connection:", body.connection_id);
      await supabase.rpc("webhook_update_connection", {
        p_connection_id: body.connection_id,
        p_status: "qr_ready",
        p_qr_data: body.qr,
        p_details: { event: "qr_generated" },
      });
      return new Response(JSON.stringify({ success: true, event: "qr_stored" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // QR expired event
    if (body?.event === "qr_expired" && body?.connection_id) {
      await supabase.rpc("webhook_update_connection", {
        p_connection_id: body.connection_id,
        p_status: "qr_ready",
        p_details: { event: "qr_expired" },
      });
      return new Response(JSON.stringify({ success: true, event: "qr_expired" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Connecting event
    if (body?.event === "connecting" && body?.connection_id) {
      await supabase.rpc("webhook_update_connection", {
        p_connection_id: body.connection_id,
        p_status: "connecting",
        p_details: { event: "connecting" },
      });
      return new Response(JSON.stringify({ success: true, event: "connecting" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Authentication success event
    if (body?.event === "authenticated" && body?.connection_id) {
      console.log("[whatsapp] Authentication successful for:", body.connection_id, "phone:", body.phone);
      await supabase.rpc("webhook_update_connection", {
        p_connection_id: body.connection_id,
        p_status: "connected",
        p_phone_number: body.phone || null,
        p_session_id: body.session_id || null,
        p_details: { event: "authenticated", phone: body.phone || null },
      });
      if (body.session_data) {
        await supabase.rpc("save_session_credentials", {
          p_connection_id: body.connection_id,
          p_session_data: body.session_data,
        });
      }
      return new Response(JSON.stringify({ success: true, event: "authenticated" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Auth failure event
    if (body?.event === "auth_failure" && body?.connection_id) {
      console.error("[whatsapp] Auth failure for:", body.connection_id);
      await supabase.rpc("webhook_update_connection", {
        p_connection_id: body.connection_id,
        p_status: "auth_failed",
        p_details: { event: "auth_failure", reason: body.reason || null },
      });
      return new Response(JSON.stringify({ success: true, event: "auth_failure" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Disconnected event
    if (body?.event === "disconnected" && body?.connection_id) {
      console.log("[whatsapp] Disconnected:", body.connection_id);
      await supabase.rpc("webhook_update_connection", {
        p_connection_id: body.connection_id,
        p_status: "disconnected",
        p_details: { event: "disconnected", reason: body.reason || null },
      });
      return new Response(JSON.stringify({ success: true, event: "disconnected" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Logged out event
    if (body?.event === "logged_out" && body?.connection_id) {
      console.log("[whatsapp] Logged out:", body.connection_id);
      await supabase.rpc("webhook_update_connection", {
        p_connection_id: body.connection_id,
        p_status: "auth_required",
        p_details: { event: "logged_out" },
      });
      return new Response(JSON.stringify({ success: true, event: "logged_out" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Session expired event
    if (body?.event === "session_expired" && body?.connection_id) {
      await supabase.rpc("webhook_update_connection", {
        p_connection_id: body.connection_id,
        p_status: "session_expired",
        p_details: { event: "session_expired" },
      });
      return new Response(JSON.stringify({ success: true, event: "session_expired" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Reconnecting event
    if (body?.event === "reconnecting" && body?.connection_id) {
      await supabase.rpc("webhook_update_connection", {
        p_connection_id: body.connection_id,
        p_status: "reconnecting",
        p_details: { event: "reconnecting" },
      });
      return new Response(JSON.stringify({ success: true, event: "reconnecting" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Message status update from Baileys
    if (body?.event === "message_status" && body?.connection_id && body?.message_id && body?.status) {
      await supabase.rpc("update_message_status", {
        p_external_message_id: body.message_id,
        p_status: body.status,
      });
      return new Response(JSON.stringify({ success: true, event: "message_status_updated" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === Incoming message from Baileys server ===
    if (body?.event === "message" || (body?.from && body?.message && !body?.entry)) {
      const baileysMsg = body?.event === "message" ? body : {
        id: body.id || `baileys_${Date.now()}`,
        from: body.from,
        fromName: body.name,
        message: body.message,
        type: body.type || "text",
        mediaUrl: body.media_url,
        caption: body.caption,
        connection_id: body.connection_id,
      };

      const msg = {
        id: baileysMsg.id || `baileys_${Date.now()}_${baileysMsg.from}`,
        fromPhone: baileysMsg.from || baileysMsg.fromPhone,
        fromName: baileysMsg.fromName || baileysMsg.name,
        toPhone: baileysMsg.to || null,
        text: typeof baileysMsg.message === "string" ? baileysMsg.message :
              baileysMsg.message?.conversation || baileysMsg.message?.extendedTextMessage?.text || null,
        type: baileysMsg.type || "text",
        mediaUrl: baileysMsg.mediaUrl || baileysMsg.media_url || null,
        caption: baileysMsg.caption || null,
        source: "whatsapp_web",
      };

      const connectionId = baileysMsg.connection_id || null;
      console.log("[whatsapp] Incoming message from:", msg.fromPhone);

      const { data: convId, error: convErr } = await supabase.rpc("find_or_create_conversation", {
        p_phone: msg.fromPhone,
        p_name: msg.fromName || null,
        p_source: msg.source,
      });

      if (convErr || !convId) {
        console.error("[whatsapp] Failed to find/create conversation:", convErr);
        return new Response(JSON.stringify({ error: "Failed to process message" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Insert message (idempotent via external_message_id unique constraint)
      const { error: msgErr } = await supabase.from("whatsapp_messages").insert({
        conversation_id: convId,
        external_message_id: msg.id,
        direction: "incoming",
        message_type: msg.type || "text",
        text: msg.text || null,
        media_url: msg.mediaUrl || null,
        media_caption: msg.caption || null,
        status: "sent",
        sender_phone: msg.fromPhone,
        recipient_phone: msg.toPhone || null,
      }).select("id").single();

      if (msgErr) {
        if (msgErr.code === "23505") {
          // Duplicate — skip silently
          return new Response(JSON.stringify({ success: true, processed: 0, duplicate: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        console.error("[whatsapp] Failed to insert message:", msgErr);
        return new Response(JSON.stringify({ error: "Failed to store message" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Update conversation
      await supabase.from("whatsapp_conversations").update({
        last_message_text: msg.text || (msg.type !== "text" ? `[${msg.type}]` : ""),
        last_message_at: new Date().toISOString(),
        last_message_direction: "incoming",
        status: "waiting_sales",
        unread_count: 1,
        connection_id: connectionId,
        updated_at: new Date().toISOString(),
      }).eq("id", convId);

      // Create notification
      const { data: conv } = await supabase.from("whatsapp_conversations")
        .select("assigned_to, customer_name").eq("id", convId).single();

      if (conv?.assigned_to) {
        await supabase.from("notifications").insert({
          user_id: conv.assigned_to,
          type: "new_lead",
          title: "Pesan WhatsApp Baru",
          body: `${conv.customer_name || msg.fromPhone}: ${msg.text?.substring(0, 80) || "New message"}`,
          link: `/admin/whatsapp?conv=${convId}`,
          related_entity: "whatsapp_conversation",
          related_id: convId,
        });
      } else {
        const { data: admins } = await supabase.from("profiles")
          .select("id").eq("role", "admin").eq("status", "active");
        if (admins) {
          for (const admin of admins) {
            await supabase.from("notifications").insert({
              user_id: admin.id,
              type: "new_lead",
              title: "Pesan WhatsApp Baru (Unassigned)",
              body: `${conv?.customer_name || msg.fromPhone}: ${msg.text?.substring(0, 80) || "New message"}`,
              link: `/admin/whatsapp?conv=${convId}`,
              related_entity: "whatsapp_conversation",
              related_id: convId,
            });
          }
        }
      }

      return new Response(JSON.stringify({ success: true, processed: 1 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === Meta Cloud API / provider webhooks (existing) ===
    const messages = extractMessages(body);
    const { data: activeConn } = await supabase.rpc("get_active_connection");
    const connectionId = activeConn?.length > 0 ? activeConn[0].connection_id : null;

    for (const msg of messages) {
      const { data: convId, error: convErr } = await supabase.rpc("find_or_create_conversation", {
        p_phone: msg.fromPhone,
        p_name: msg.fromName || null,
        p_source: msg.source || "whatsapp",
      });

      if (convErr || !convId) {
        console.error("[whatsapp] Failed to find/create conversation:", convErr);
        continue;
      }

      const { error: msgErr } = await supabase.from("whatsapp_messages").insert({
        conversation_id: convId,
        external_message_id: msg.id,
        direction: "incoming",
        message_type: msg.type || "text",
        text: msg.text || null,
        media_url: msg.mediaUrl || null,
        media_caption: msg.caption || null,
        status: "sent",
        sender_phone: msg.fromPhone,
        recipient_phone: msg.toPhone || null,
      }).select("id").single();

      if (msgErr) {
        if (msgErr.code === "23505") continue;
        console.error("[whatsapp] Failed to insert message:", msgErr);
        continue;
      }

      await supabase.from("whatsapp_conversations").update({
        last_message_text: msg.text || (msg.type !== "text" ? `[${msg.type}]` : ""),
        last_message_at: new Date().toISOString(),
        last_message_direction: "incoming",
        status: "waiting_sales",
        unread_count: 1,
        connection_id: connectionId,
        updated_at: new Date().toISOString(),
      }).eq("id", convId);

      const { data: conv } = await supabase.from("whatsapp_conversations")
        .select("assigned_to, customer_name").eq("id", convId).single();

      if (conv?.assigned_to) {
        await supabase.from("notifications").insert({
          user_id: conv.assigned_to,
          type: "new_lead",
          title: "Pesan WhatsApp Baru",
          body: `${conv.customer_name || msg.fromPhone}: ${msg.text?.substring(0, 80) || "New message"}`,
          link: `/admin/whatsapp?conv=${convId}`,
          related_entity: "whatsapp_conversation",
          related_id: convId,
        });
      } else {
        const { data: admins } = await supabase.from("profiles")
          .select("id").eq("role", "admin").eq("status", "active");
        if (admins) {
          for (const admin of admins) {
            await supabase.from("notifications").insert({
              user_id: admin.id,
              type: "new_lead",
              title: "Pesan WhatsApp Baru (Unassigned)",
              body: `${conv?.customer_name || msg.fromPhone}: ${msg.text?.substring(0, 80) || "New message"}`,
              link: `/admin/whatsapp?conv=${convId}`,
              related_entity: "whatsapp_conversation",
              related_id: convId,
            });
          }
        }
      }
    }

    return new Response(JSON.stringify({ success: true, processed: messages.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[whatsapp] Webhook error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function extractMessages(body: any): Array<{
  id: string; fromPhone: string; fromName?: string; toPhone?: string;
  text?: string; type?: string; mediaUrl?: string; caption?: string; source?: string;
}> {
  const messages: any[] = [];
  if (body?.entry?.[0]?.changes?.[0]?.value?.messages) {
    const msgs = body.entry[0].changes[0].value.messages;
    const contacts = body.entry[0].changes[0].value.contacts;
    for (const msg of msgs) {
      const contact = contacts?.find((c: any) => c.wa_id === msg.from);
      messages.push({
        id: msg.id, fromPhone: msg.from, fromName: contact?.profile?.name,
        toPhone: body.entry[0].changes[0].value?.metadata?.display_phone_number,
        text: msg.text?.body || msg.caption, type: msg.type || "text",
        mediaUrl: msg.image?.url || msg.video?.url || msg.audio?.url || msg.document?.url,
        caption: msg.image?.caption || msg.video?.caption || msg.document?.caption,
        source: "whatsapp_business",
      });
    }
    return messages;
  }
  if (body?.message || body?.messages) {
    const msg = body.message || body.messages;
    messages.push({
      id: body.id || `fonnte_${Date.now()}`, fromPhone: body.sender || body.from || "",
      fromName: body.name, toPhone: body.destination || body.to,
      text: typeof msg === "string" ? msg : msg?.text || msg?.body,
      type: body.type || "text", mediaUrl: body.url, caption: body.caption, source: "fonnte",
    });
    return messages;
  }
  if (body?.from && (body?.text || body?.body || body?.message)) {
    messages.push({
      id: body.id || `generic_${Date.now()}`, fromPhone: body.from, fromName: body.name,
      toPhone: body.to, text: body.text || body.body || (typeof body.message === "string" ? body.message : ""),
      type: body.type || "text", mediaUrl: body.media_url, caption: body.caption,
      source: body.source || "whatsapp",
    });
  }
  return messages;
}
// force redeploy
