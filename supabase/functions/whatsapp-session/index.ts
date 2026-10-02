import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * WhatsApp Session Manager Edge Function
 *
 * Bridges admin frontend ↔ external WhatsApp Session Server (Baileys).
 * Supabase Edge Functions are request/response — they CANNOT maintain
 * persistent WebSocket connections. The actual WhatsApp session runs
 * on an external persistent Node.js server.
 *
 * Architecture:
 *   Admin Browser → this edge function → external Baileys server
 *   External Baileys server → whatsapp-webhook edge function → Supabase DB
 *   Supabase Realtime → Admin Browser
 *
 * The external server URL is read from WHATSAPP_SERVER_URL secret.
 * Requests to the external server include WHATSAPP_SERVER_SECRET header.
 *
 * Actions:
 *   health    — check if session server is reachable
 *   start     — start new session, triggers QR generation
 *   status    — check session status
 *   disconnect— logout session
 *   reconnect — attempt to restore existing session
 *   send      — send message via session
 *   delete    — delete connection + cleanup
 */

const SERVER_TIMEOUT_MS = 10000;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const { action, connection_id, phone, text, media_url } = body;

    if (!action) {
      return new Response(JSON.stringify({ error: "Missing 'action' field" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serverUrl = Deno.env.get("WHATSAPP_SERVER_URL")?.replace(/\/$/, "");
    const serverSecret = Deno.env.get("WHATSAPP_SERVER_SECRET");

    // For "delete" action, we don't need the server — just clean up DB
    if (action === "delete") {
      if (!connection_id) {
        return new Response(JSON.stringify({ error: "Missing connection_id" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Try to disconnect on server if server is available
      if (serverUrl && serverSecret) {
        try {
          await fetchWithTimeout(`${serverUrl}/disconnect`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Webhook-Secret": serverSecret,
            },
            body: JSON.stringify({ connection_id }),
          }, 5000);
        } catch (e) {
          // Server may be offline — continue with DB cleanup
        }
      }

      // Delete from database (preserves conversations/messages)
      const { error: delErr } = await supabase.rpc("delete_whatsapp_connection", {
        p_connection_id: connection_id,
      });

      if (delErr) {
        return new Response(JSON.stringify({
          error: "Failed to delete connection",
          message: delErr.message,
        }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, action: "deleted" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If no external server is configured, return honest error
    // Do NOT create connection records when server is unavailable
    if (!serverUrl) {
      return new Response(JSON.stringify({
        error: "WHATSAPP_SERVER_URL_NOT_CONFIGURED",
        message: "Server WhatsApp eksternal belum dikonfigurasi. Hubungkan server Baileys dan set WHATSAPP_SERVER_URL di Supabase secrets.",
        server_online: false,
      }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Health check — verify server is reachable before any other action
    if (action === "health") {
      try {
        const healthResp = await fetchWithTimeout(`${serverUrl}/health`, {
          method: "GET",
          headers: serverSecret ? { "X-Webhook-Secret": serverSecret } : {},
        }, 5000);

        if (healthResp.ok) {
          const healthData = await healthResp.json();
          return new Response(JSON.stringify({
            server_online: true,
            ...healthData,
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw new Error(`Health check failed: ${healthResp.status}`);
      } catch (e) {
        return new Response(JSON.stringify({
          server_online: false,
          error: "Server tidak dapat dijangkau",
          message: "WhatsApp Session Server tidak merespons. Pastikan server berjalan.",
        }), {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // For "start" action: validate server is reachable BEFORE creating connection
    if (action === "start") {
      // Health check first
      try {
        const healthResp = await fetchWithTimeout(`${serverUrl}/health`, {
          method: "GET",
          headers: serverSecret ? { "X-Webhook-Secret": serverSecret } : {},
        }, 5000);

        if (!healthResp.ok) throw new Error("Health check failed");
      } catch (e) {
        return new Response(JSON.stringify({
          error: "SERVER_OFFLINE",
          message: "WhatsApp Session Server tidak tersedia. Pastikan server berjalan sebelum menghubungkan.",
          server_online: false,
        }), {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // All remaining actions require connection_id
    if (!connection_id) {
      return new Response(JSON.stringify({ error: "Missing connection_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serverHeaders: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (serverSecret) {
      serverHeaders["X-Webhook-Secret"] = serverSecret;
    }

    let externalResponse: Response;

    switch (action) {
      case "start": {
        externalResponse = await fetchWithTimeout(`${serverUrl}/start`, {
          method: "POST",
          headers: serverHeaders,
          body: JSON.stringify({ connection_id }),
        }, SERVER_TIMEOUT_MS);
        break;
      }

      case "status": {
        externalResponse = await fetchWithTimeout(
          `${serverUrl}/status?connection_id=${encodeURIComponent(connection_id)}`,
          { method: "GET", headers: serverHeaders },
          SERVER_TIMEOUT_MS
        );
        break;
      }

      case "disconnect": {
        externalResponse = await fetchWithTimeout(`${serverUrl}/disconnect`, {
          method: "POST",
          headers: serverHeaders,
          body: JSON.stringify({ connection_id }),
        }, SERVER_TIMEOUT_MS);
        await supabase.rpc("disconnect_whatsapp_connection", { p_connection_id });
        break;
      }

      case "reconnect": {
        const { data: sessionData } = await supabase.rpc("get_session_data", {
          p_connection_id: connection_id,
        });
        const sessionCreds = sessionData?.length > 0 ? sessionData[0].session_data : null;

        externalResponse = await fetchWithTimeout(`${serverUrl}/reconnect`, {
          method: "POST",
          headers: serverHeaders,
          body: JSON.stringify({ connection_id, session_data: sessionCreds }),
        }, SERVER_TIMEOUT_MS);

        await supabase.rpc("reconnect_whatsapp_connection", { p_connection_id: connection_id });
        break;
      }

      case "send": {
        if (!phone || !text) {
          return new Response(JSON.stringify({ error: "Missing 'phone' or 'text'" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        externalResponse = await fetchWithTimeout(`${serverUrl}/send`, {
          method: "POST",
          headers: serverHeaders,
          body: JSON.stringify({ connection_id, phone, text, media_url }),
        }, SERVER_TIMEOUT_MS);
        break;
      }

      default: {
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const data = await externalResponse.text();
    return new Response(data, {
      status: externalResponse.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[whatsapp-session] Error:", err);
    const msg = err instanceof Error ? err.message : "Unknown error";

    if (msg.includes("timeout") || msg.includes("Timeout")) {
      return new Response(JSON.stringify({
        error: "SERVER_TIMEOUT",
        message: "Server WhatsApp tidak merespons dalam waktu yang ditentukan.",
      }), {
        status: 504,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      error: "INTERNAL_ERROR",
      message: "Terjadi kesalahan saat menghubungi server WhatsApp.",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

/**
 * Fetch with timeout — prevents hanging when server is unreachable
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return resp;
  } catch (e) {
    clearTimeout(timeoutId);
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new Error("timeout");
    }
    throw e;
  }
}
// force redeploy
