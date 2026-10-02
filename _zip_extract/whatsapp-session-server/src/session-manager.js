import makeWASocket from '@whiskeysockets/baileys';
import { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import P from 'pino';
import fs from 'fs';
import path from 'path';

const logger = P({ level: 'silent' });
const SESSIONS_DIR = process.env.SESSIONS_DIR || './.sessions';

export class SessionManager {
  constructor(webhookClient) {
    this.webhookClient = webhookClient;
    this.sessions = new Map(); // connection_id -> { sock, state, status, phone }
  }

  getSessionCount() {
    return this.sessions.size;
  }

  getStatus(connectionId) {
    const session = this.sessions.get(connectionId);
    if (!session) return null;
    return {
      status: session.status,
      phone: session.phone || null,
      connection_id: connectionId,
    };
  }

  async startSession(connectionId) {
    // If session exists and is connected, return its status
    const existing = this.sessions.get(connectionId);
    if (existing && existing.status === 'connected') {
      return null;
    }

    // Notify connecting
    await this.webhookClient.postEvent('connecting', connectionId);

    const { state, saveCreds } = await useMultiFileAuthState(
      path.join(SESSIONS_DIR, connectionId)
    );
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket.default({
      version,
      auth: state,
      logger,
      printQRInTerminal: false,
    });

    const session = { sock, state, saveCreds, status: 'connecting', phone: null };
    this.sessions.set(connectionId, session);

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        // Send QR to webhook
        await this.webhookClient.postEvent('qr', connectionId, { qr });
      }

      if (connection === 'close') {
        const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
        if (statusCode === DisconnectReason.loggedOut) {
          await this.webhookClient.postEvent('logged_out', connectionId);
          this.sessions.delete(connectionId);
        } else if (statusCode === DisconnectReason.restartRequired) {
          // Auto-reconnect
          await this.webhookClient.postEvent('reconnecting', connectionId);
          this.startSession(connectionId);
        } else {
          await this.webhookClient.postEvent('disconnected', connectionId, {
            reason: lastDisconnect?.error?.message || 'unknown',
          });
          session.status = 'disconnected';
        }
      } else if (connection === 'open') {
        session.status = 'connected';
        const phone = sock.user?.id?.split(':')[0]?.split('@')[0] || null;
        session.phone = phone;
        const sessionData = this._readSessionData(connectionId);
        await this.webhookClient.postEvent('authenticated', connectionId, {
          phone,
          session_id: connectionId,
          session_data: sessionData,
        });
      }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;
      for (const msg of messages) {
        if (!msg.key.fromMe && msg.message) {
          const from = msg.key.remoteJid?.split('@')[0] || '';
          const name = msg.pushName || '';
          const text = msg.message.conversation ||
            msg.message.extendedTextMessage?.text ||
            msg.message.imageMessage?.caption ||
            msg.message.videoMessage?.caption || '';
          const msgType = Object.keys(msg.message)[0] || 'text';

          await this.webhookClient.postEvent('message', connectionId, {
            id: msg.key.id,
            from,
            name,
            message: text || '',
            type: msgType === 'conversation' || msgType === 'extendedTextMessage' ? 'text' : msgType,
            connection_id: connectionId,
          });
        }
      }
    });

    // Wait for QR (up to 20 seconds)
    return new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(null), 20000);
      sock.ev.on('connection.update', (update) => {
        if (update.qr) {
          clearTimeout(timeout);
          resolve(update.qr);
        }
      });
    });
  }

  async reconnectSession(connectionId, sessionData) {
    const sessionDir = path.join(SESSIONS_DIR, connectionId);
    if (!fs.existsSync(sessionDir)) {
      throw new Error('No saved session found');
    }
    return this.startSession(connectionId);
  }

  async disconnectSession(connectionId) {
    const session = this.sessions.get(connectionId);
    if (session?.sock) {
      try { await session.sock.logout(); } catch {}
    }
    this.sessions.delete(connectionId);
    // Clean up session files
    const sessionDir = path.join(SESSIONS_DIR, connectionId);
    if (fs.existsSync(sessionDir)) {
      fs.rmSync(sessionDir, { recursive: true, force: true });
    }
  }

  async sendMessage(connectionId, phone, text) {
    const session = this.sessions.get(connectionId);
    if (!session || session.status !== 'connected') {
      throw new Error('Session not connected');
    }
    const jid = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`;
    const result = await session.sock.sendMessage(jid, { text });
    return result?.key?.id || null;
  }

  _readSessionData(connectionId) {
    const sessionDir = path.join(SESSIONS_DIR, connectionId);
    if (!fs.existsSync(sessionDir)) return null;
    const files = fs.readdirSync(sessionDir);
    const data = {};
    for (const file of files) {
      try {
        data[file] = JSON.parse(fs.readFileSync(path.join(sessionDir, file), 'utf8'));
      } catch {}
    }
    return data;
  }
}
