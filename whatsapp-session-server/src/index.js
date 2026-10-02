import express from 'express';
import { SessionManager } from './session-manager.js';
import { WebhookClient } from './webhook-client.js';

const PORT = process.env.PORT || 3000;
const WEBHOOK_SECRET = process.env.WHATSAPP_WEBHOOK_SECRET || '';
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const app = express();
app.use(express.json({ limit: '10mb' }));

// Auth middleware — all requests must have X-Webhook-Secret
app.use((req, res, next) => {
  if (WEBHOOK_SECRET && req.headers['x-webhook-secret'] !== WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});

const webhookClient = new WebhookClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, WEBHOOK_SECRET);
const manager = new SessionManager(webhookClient);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', whatsapp_service: 'running', sessions: manager.getSessionCount() });
});

// Start session — generates QR
app.post('/start', async (req, res) => {
  const { connection_id } = req.body;
  if (!connection_id) return res.status(400).json({ error: 'Missing connection_id' });
  try {
    const qr = await manager.startSession(connection_id);
    res.json({ success: true, qr: qr || null });
  } catch (err) {
    console.error('[start] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Check status
app.get('/status', async (req, res) => {
  const { connection_id } = req.query;
  if (!connection_id) return res.status(400).json({ error: 'Missing connection_id' });
  const status = manager.getStatus(connection_id);
  res.json(status || { status: 'disconnected' });
});

// Disconnect
app.post('/disconnect', async (req, res) => {
  const { connection_id } = req.body;
  if (!connection_id) return res.status(400).json({ error: 'Missing connection_id' });
  try {
    await manager.disconnectSession(connection_id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reconnect with existing session data
app.post('/reconnect', async (req, res) => {
  const { connection_id, session_data } = req.body;
  if (!connection_id) return res.status(400).json({ error: 'Missing connection_id' });
  try {
    const result = await manager.reconnectSession(connection_id, session_data);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[reconnect] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Send message
app.post('/send', async (req, res) => {
  const { connection_id, phone, text } = req.body;
  if (!connection_id || !phone || !text) {
    return res.status(400).json({ error: 'Missing connection_id, phone, or text' });
  }
  try {
    const messageId = await manager.sendMessage(connection_id, phone, text);
    res.json({ success: true, message_id: messageId });
  } catch (err) {
    console.error('[send] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`WhatsApp Session Server running on port ${PORT}`);
  console.log(`Health: http://localhost:${PORT}/health`);
});
