# WhatsApp Session Server

Persistent Node.js server that manages WhatsApp Web sessions using Baileys.

## Why This Exists

Supabase Edge Functions are request/response only — they cannot maintain
persistent WebSocket connections to WhatsApp. This server runs continuously,
maintains the WhatsApp session, generates QR codes, and posts events back
to Supabase via the webhook edge function.

## Architecture

```
Admin Browser
    → Supabase Edge Function (whatsapp-session)
    → This Server (Baileys)
    → WhatsApp Network
    → This Server receives message
    → Posts to Supabase Webhook (whatsapp-webhook)
    → Supabase DB + Realtime
    → Admin Inbox
```

## Setup

1. Install dependencies:
```bash
cd whatsapp-session-server
npm install
```

2. Copy `.env.example` to `.env` and fill in values:
```bash
cp .env.example .env
```

3. Set `WHATSAPP_WEBHOOK_SECRET` to the same value used in Supabase secrets.

4. Run:
```bash
npm start
```

## Deploy

Deploy to any platform that supports persistent Node.js:
- Railway.app
- Render.com
- Fly.io
- VPS (pm2 or systemd)

After deploying, set the server URL in Supabase:
- `WHATSAPP_SERVER_URL` = your deployed URL (e.g. https://your-app.railway.app)
- `WHATSAPP_SERVER_SECRET` = same as `WHATSAPP_WEBHOOK_SECRET`
- `WHATSAPP_WEBHOOK_SECRET` = same secret (for webhook auth)

## API Endpoints

All requests require `X-Webhook-Secret` header.

| Method | Path | Body | Description |
|--------|------|------|-------------|
| GET | /health | — | Health check |
| POST | /start | `{ connection_id }` | Start session, returns QR |
| GET | /status?connection_id=X | — | Check session status |
| POST | /disconnect | `{ connection_id }` | Logout & cleanup |
| POST | /reconnect | `{ connection_id, session_data }` | Restore session |
| POST | /send | `{ connection_id, phone, text }` | Send message |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| PORT | No | Server port (default 3000) |
| SUPABASE_URL | Yes | Supabase project URL |
| SUPABASE_SERVICE_ROLE_KEY | Yes | Supabase service role key |
| WHATSAPP_WEBHOOK_SECRET | Yes | Shared secret for webhook auth |
| SESSIONS_DIR | No | Session storage path (default ./.sessions) |
