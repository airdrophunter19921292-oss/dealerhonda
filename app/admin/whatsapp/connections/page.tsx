'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import QRCode from 'qrcode';
import { supabase, WhatsAppConnection, WhatsAppConnectionLog, WhatsAppQRSession } from '@/lib/supabase-client';
import { useAuth } from '@/lib/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Plug, Plus, Loader2, CheckCircle2, XCircle, AlertCircle,
  Phone, Activity, RefreshCw, Trash2, QrCode,
  Power, WifiOff, Server, ServerOff,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { getSafeError } from '@/lib/validation';

const statusConfig: Record<string, { label: string; color: string; dot: string }> = {
  connected: { label: 'Connected', color: 'text-green-600', dot: 'bg-green-500' },
  connecting: { label: 'Connecting', color: 'text-blue-600', dot: 'bg-blue-500' },
  reconnecting: { label: 'Reconnecting', color: 'text-blue-600', dot: 'bg-blue-500' },
  disconnected: { label: 'Disconnected', color: 'text-neutral-400', dot: 'bg-neutral-400' },
  qr_ready: { label: 'QR Ready', color: 'text-blue-600', dot: 'bg-blue-500' },
  waiting_for_scan: { label: 'Menunggu Scan', color: 'text-blue-600', dot: 'bg-blue-500' },
  auth_required: { label: 'Auth Required', color: 'text-orange-600', dot: 'bg-orange-500' },
  session_expired: { label: 'Session Expired', color: 'text-red-600', dot: 'bg-red-500' },
  auth_failed: { label: 'Auth Failed', color: 'text-red-600', dot: 'bg-red-500' },
  invalid_credentials: { label: 'Invalid Credentials', color: 'text-red-600', dot: 'bg-red-500' },
  webhook_error: { label: 'Webhook Error', color: 'text-orange-600', dot: 'bg-orange-500' },
  phone_number_error: { label: 'Phone Number Error', color: 'text-orange-600', dot: 'bg-orange-500' },
  api_error: { label: 'API Error', color: 'text-red-600', dot: 'bg-red-500' },
  error: { label: 'Error', color: 'text-red-600', dot: 'bg-red-500' },
};

const providerLabels: Record<string, string> = {
  whatsapp_web: 'WhatsApp Web (QR)',
  meta_cloud_api: 'Meta Cloud API',
  fonnte: 'Fonnte',
  wati: 'Wati',
  ultramsg: 'UltraMsg',
  other: 'Other',
};

const healthLabels: Record<string, { label: string; color: string }> = {
  healthy: { label: 'Active', color: 'text-green-600' },
  unverified: { label: 'Unverified', color: 'text-neutral-400' },
  error: { label: 'Error', color: 'text-red-600' },
  degraded: { label: 'Degraded', color: 'text-orange-600' },
  unknown: { label: 'Unknown', color: 'text-neutral-400' },
};

type QRState = 'idle' | 'initializing' | 'qr_ready' | 'waiting_for_scan' | 'authenticating' | 'connected' | 'auth_failed' | 'session_expired' | 'error' | 'no_server' | 'server_offline';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function callSessionServer(action: string, payload: Record<string, unknown>) {
  const resp = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ANON_KEY}`,
    },
    body: JSON.stringify({ action, ...payload }),
  });
  return { ok: resp.ok, status: resp.status, data: await resp.json() };
}

export default function WhatsAppConnectionsPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const [loading, setLoading] = useState(true);
  const [connections, setConnections] = useState<WhatsAppConnection[]>([]);
  const [logs, setLogs] = useState<WhatsAppConnectionLog[]>([]);
  const [showQRWizard, setShowQRWizard] = useState(false);
  const [editConn, setEditConn] = useState<WhatsAppConnection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [serverOnline, setServerOnline] = useState<boolean | null>(null);
  const [checkingServer, setCheckingServer] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: connData, error: err } = await supabase.from('whatsapp_connections')
      .select('*').order('created_at', { ascending: true });
    if (err) { setError(getSafeError(err)); }
    if (connData) setConnections(connData as WhatsAppConnection[]);

    const { data: logData } = await supabase.from('whatsapp_connection_logs')
      .select('*').order('created_at', { ascending: false }).limit(20);
    if (logData) setLogs(logData as WhatsAppConnectionLog[]);
    setLoading(false);
  }, []);

  const checkServerHealth = useCallback(async () => {
    setCheckingServer(true);
    try {
      const { ok, data } = await callSessionServer('health', {});
      setServerOnline(ok && data.server_online !== false);
    } catch {
      setServerOnline(false);
    }
    setCheckingServer(false);
  }, []);

  useEffect(() => { fetchData(); checkServerHealth(); }, [fetchData, checkServerHealth]);

  useEffect(() => {
    const channel = supabase.channel('wa-connections');
    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_connections' }, () => {
      fetchData();
    }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  const handleDisconnect = async (conn: WhatsAppConnection) => {
    if (!confirm(`Putuskan koneksi ${conn.display_name}?\n\nSetelah diputuskan, sistem tidak akan menerima pesan baru dari nomor ini sampai WhatsApp dihubungkan kembali.\n\nPercakapan historis tetap tersimpan.`)) return;

    if (conn.provider === 'whatsapp_web' && conn.status === 'connected') {
      try {
        await callSessionServer('disconnect', { connection_id: conn.id });
      } catch { /* continue with DB disconnect */ }
    }

    const { error: discErr } = await supabase.rpc('disconnect_whatsapp_connection', {
      p_connection_id: conn.id,
      p_user_id: profile?.id,
    });
    if (discErr) { setError(getSafeError(discErr)); return; }
    fetchData();
  };

  const handleDelete = async (conn: WhatsAppConnection) => {
    const isStuck = conn.status === 'connecting' || conn.status === 'disconnected';
    const msg = isStuck
      ? `Hapus koneksi "${conn.display_name}"?\n\nKoneksi ini akan dihapus permanen dari sistem. Percakapan dan pesan historis tetap tersimpan.`
      : `Putuskan dan hapus koneksi WhatsApp "${conn.display_name}"?\n\nKoneksi akan diputus dari WhatsApp dan dihapus permanen. Percakapan dan pesan historis tetap tersimpan.`;

    if (!confirm(msg)) return;

    setDeleting(conn.id);
    try {
      const { ok, data } = await callSessionServer('delete', { connection_id: conn.id });
      if (!ok) {
        // If server is offline, still try DB-level delete
        if (data?.error === 'WHATSAPP_SERVER_URL_NOT_CONFIGURED' || data?.error === 'SERVER_OFFLINE') {
          const { error: delErr } = await supabase.rpc('delete_whatsapp_connection', {
            p_connection_id: conn.id,
            p_user_id: profile?.id,
          });
          if (delErr) { setError(getSafeError(delErr)); return; }
        } else {
          setError(data?.message || data?.error || 'Gagal menghapus koneksi');
          return;
        }
      }
      fetchData();
    } catch (e) {
      setError('Gagal menghapus koneksi');
    } finally {
      setDeleting(null);
    }
  };

  const handleReconnect = async (conn: WhatsAppConnection) => {
    await supabase.rpc('reconnect_whatsapp_connection', {
      p_connection_id: conn.id,
      p_user_id: profile?.id,
    });

    if (conn.provider === 'whatsapp_web') {
      try {
        const { ok } = await callSessionServer('reconnect', { connection_id: conn.id });
        if (!ok) {
          setShowQRWizard(true);
          setEditConn(conn);
          return;
        }
      } catch {
        setShowQRWizard(true);
        setEditConn(conn);
        return;
      }
    }
    fetchData();
  };

  const handleSetDefault = async (conn: WhatsAppConnection) => {
    await supabase.from('whatsapp_connections').update({ is_default: false }).neq('id', conn.id);
    await supabase.from('whatsapp_connections').update({ is_default: true }).eq('id', conn.id);
    fetchData();
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center text-neutral-400">
        <Loader2 className="mr-2 h-6 w-6 animate-spin" /> Memuat connections...
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex h-96 items-center justify-center text-neutral-400">
        <p>Hanya admin yang dapat mengelola koneksi WhatsApp.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">WhatsApp Connections</h1>
          <p className="mt-1 text-sm text-neutral-500">Hubungkan nomor WhatsApp untuk menerima dan membalas chat pelanggan melalui CRM</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Server Health Indicator */}
          <div className={cn(
            'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium',
            serverOnline === null ? 'border-neutral-200 bg-neutral-50 text-neutral-400' :
            serverOnline ? 'border-green-200 bg-green-50 text-green-700' :
            'border-red-200 bg-red-50 text-red-600'
          )}>
            {checkingServer ? <Loader2 className="h-3 w-3 animate-spin" /> :
             serverOnline ? <Server className="h-3 w-3" /> : <ServerOff className="h-3 w-3" />}
            {serverOnline === null ? 'Checking...' : serverOnline ? 'Server Online' : 'Server Offline'}
          </div>
          <Button variant="outline" size="sm" onClick={checkServerHealth} disabled={checkingServer}>
            <RefreshCw className={cn('h-3.5 w-3.5', checkingServer && 'animate-spin')} />
          </Button>
          <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={() => { setEditConn(null); setShowQRWizard(true); }}>
            <QrCode className="mr-1 h-4 w-4" /> Hubungkan WhatsApp
          </Button>
        </div>
      </div>

      {/* Server Offline Warning */}
      {serverOnline === false && (
        <div className="flex items-start gap-3 rounded-lg border border-orange-200 bg-orange-50 p-4 text-sm text-orange-700">
          <ServerOff className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">WhatsApp Session Server tidak tersedia</p>
            <p className="mt-1 text-xs">QR code tidak dapat digunakan sampai server WhatsApp di-deploy dan WHATSAPP_SERVER_URL dikonfigurasi di Supabase secrets. Koneksi yang sudah aktif tetap berfungsi jika session masih valid.</p>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
          <AlertCircle className="h-4 w-4 flex-shrink-0" /> {error}
          <button onClick={() => setError(null)} className="ml-auto text-xs underline">Tutup</button>
        </div>
      )}

      {/* Empty State */}
      {connections.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-neutral-200 bg-white py-20 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-50">
            <QrCode className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-lg font-bold text-neutral-900">Belum ada WhatsApp yang terhubung</h2>
          <p className="mt-2 max-w-md text-sm text-neutral-500">
            Hubungkan nomor WhatsApp untuk mulai menerima dan membalas chat pelanggan melalui CRM.
          </p>
          <Button className="mt-4 bg-green-600 hover:bg-green-700 text-white" onClick={() => { setEditConn(null); setShowQRWizard(true); }}>
            <Plus className="mr-1 h-4 w-4" /> Hubungkan WhatsApp
          </Button>
        </div>
      )}

      {/* Connection Cards */}
      {connections.length > 0 && (
        <div className="space-y-4">
          {connections.map((conn) => {
            const stCfg = statusConfig[conn.status] || statusConfig.disconnected;
            const isWeb = conn.provider === 'whatsapp_web';
            const isConnected = conn.status === 'connected';
            const needsReconnect = conn.status === 'disconnected' || conn.status === 'session_expired' || conn.status === 'auth_required' || conn.status === 'auth_failed';
            const isStuck = conn.status === 'connecting';

            return (
              <div key={conn.id} className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className={cn(
                      'flex h-12 w-12 items-center justify-center rounded-xl',
                      isConnected ? 'bg-green-50' : 'bg-neutral-100'
                    )}>
                      {isConnected ? <Phone className="h-6 w-6 text-green-600" /> : <WifiOff className="h-6 w-6 text-neutral-400" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-neutral-900">{conn.display_name}</h3>
                        {conn.is_default && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-600">Default</span>}
                      </div>
                      <p className="mt-0.5 text-sm text-neutral-500">{conn.business_name}{conn.branch ? ` • ${conn.branch}` : ''}</p>
                      <p className="mt-0.5 text-sm font-medium text-neutral-700">{conn.phone_number || 'Nomor belum terdeteksi'}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <div className="flex items-center gap-2">
                      <div className={cn('h-2.5 w-2.5 rounded-full', stCfg.dot, isConnected && 'animate-pulse')} />
                      <span className={cn('text-sm font-semibold', stCfg.color)}>{stCfg.label}</span>
                    </div>
                    <p className="mt-1 text-xs text-neutral-400">{providerLabels[conn.provider] || conn.provider}</p>
                  </div>
                </div>

                {/* Health Indicators */}
                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <HealthIndicator icon={Activity} label="Session" status={isConnected ? healthLabels.healthy : healthLabels.unknown} />
                  <HealthIndicator icon={Plug} label="Inbox" status={isConnected ? healthLabels.healthy : healthLabels.unverified} />
                  <HealthIndicator icon={Phone} label="Phone Number" status={conn.phone_number ? healthLabels.healthy : healthLabels.unverified} />
                  <div className="rounded-lg border border-neutral-100 bg-neutral-50 p-3">
                    <p className="text-xs text-neutral-400">Last Activity</p>
                    <p className="mt-1 text-sm font-medium text-neutral-700">
                      {conn.last_seen_at ? new Date(conn.last_seen_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }) :
                       conn.last_connected_at ? new Date(conn.last_connected_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }) : 'Never'}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-5 flex flex-wrap gap-2">
                  {isConnected && (
                    <Link href="/admin/whatsapp">
                      <Button variant="outline" size="sm" className="border-green-200 text-green-700 hover:bg-green-50">
                        <Plug className="mr-1 h-3.5 w-3.5" /> Open Inbox
                      </Button>
                    </Link>
                  )}
                  {needsReconnect && isWeb && (
                    <Button variant="outline" size="sm" onClick={() => handleReconnect(conn)}>
                      <RefreshCw className="mr-1 h-3.5 w-3.5" /> Hubungkan Kembali
                    </Button>
                  )}
                  {isConnected && (
                    <Button variant="outline" size="sm" onClick={() => { setEditConn(conn); setShowQRWizard(true); }} className="text-orange-600 hover:bg-orange-50">
                      <RefreshCw className="mr-1 h-3.5 w-3.5" /> Reconnect
                    </Button>
                  )}
                  {isConnected && !conn.is_default && (
                    <Button variant="outline" size="sm" onClick={() => handleSetDefault(conn)}>Set as Default</Button>
                  )}
                  {isConnected && (
                    <Button variant="outline" size="sm" className="text-red-600 hover:bg-red-50" onClick={() => handleDisconnect(conn)}>
                      <Power className="mr-1 h-3.5 w-3.5" /> Disconnect
                    </Button>
                  )}
                  {!isConnected && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:bg-red-50"
                      onClick={() => handleDelete(conn)}
                      disabled={deleting === conn.id}
                    >
                      {deleting === conn.id ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Trash2 className="mr-1 h-3.5 w-3.5" />}
                      {isStuck ? 'Hapus' : 'Hapus'}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Connection Logs */}
      {logs.length > 0 && (
        <div className="rounded-xl border border-neutral-200 bg-white p-5">
          <h2 className="text-sm font-bold text-neutral-900">Connection Logs</h2>
          <div className="mt-3 space-y-1">
            {logs.map((log) => (
              <div key={log.id} className="flex items-center justify-between border-b border-neutral-50 py-1.5 text-xs last:border-0">
                <div className="flex items-center gap-2">
                  <span className={cn('flex h-5 w-5 items-center justify-center rounded-full', log.result === 'success' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600')}>
                    {log.result === 'success' ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                  </span>
                  <span className="font-medium text-neutral-700">{log.action}</span>
                </div>
                <span className="text-neutral-400">{new Date(log.created_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* QR Connection Wizard */}
      <Dialog open={showQRWizard} onOpenChange={setShowQRWizard}>
        <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
          <DialogHeader><DialogTitle>Hubungkan WhatsApp</DialogTitle></DialogHeader>
          <QRConnectionWizard
            editConn={editConn}
            userId={profile?.id}
            onConnected={() => { setShowQRWizard(false); fetchData(); }}
            onCancel={() => setShowQRWizard(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function HealthIndicator({ icon: Icon, label, status }: { icon: typeof Activity; label: string; status: { label: string; color: string } }) {
  return (
    <div className="rounded-lg border border-neutral-100 bg-neutral-50 p-3">
      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-neutral-400" />
        <p className="text-xs text-neutral-400">{label}</p>
      </div>
      <p className={cn('mt-1 text-sm font-medium', status.color)}>{status.label}</p>
    </div>
  );
}

function QRConnectionWizard({ editConn, userId, onConnected, onCancel }: {
  editConn: WhatsAppConnection | null;
  userId: string | undefined;
  onConnected: () => void;
  onCancel: () => void;
}) {
  const [phase, setPhase] = useState<'info' | 'connecting' | 'qr' | 'success' | 'error'>('info');
  const [qrState, setQrState] = useState<QRState>('idle');
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrExpiresAt, setQrExpiresAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState(editConn?.display_name || '');
  const [connectionId, setConnectionId] = useState<string | null>(editConn?.id || null);
  const [pollingRef, setPollingRef] = useState<ReturnType<typeof setInterval> | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const qrChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    return () => {
      if (pollingRef) clearInterval(pollingRef);
      if (qrChannelRef.current) supabase.removeChannel(qrChannelRef.current);
    };
  }, []);

  const subscribeToConnection = useCallback((connId: string) => {
    if (qrChannelRef.current) supabase.removeChannel(qrChannelRef.current);
    const channel = supabase.channel(`qr-conn-${connId}`);
    channel.on('postgres_changes', {
      event: 'UPDATE', schema: 'public', table: 'whatsapp_connections',
      filter: `id=eq.${connId}`,
    }, (payload) => handleConnectionUpdate(payload.new as WhatsAppConnection)
    ).on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'whatsapp_qr_sessions',
      filter: `connection_id=eq.${connId}`,
    }, async (payload) => {
      const qrSession = payload.new as WhatsAppQRSession;
      if (qrSession.qr_data && qrSession.status === 'qr_ready') {
        await renderQR(qrSession.qr_data);
        setQrExpiresAt(new Date(qrSession.expires_at));
        setQrState('qr_ready');
        setPhase('qr');
      }
    }).subscribe();
    qrChannelRef.current = channel;
  }, []);

  const handleConnectionUpdate = useCallback((conn: WhatsAppConnection) => {
    if (conn.status === 'connected') {
      setQrState('connected');
      setPhase('success');
      if (pollingRef) clearInterval(pollingRef);
    } else if (conn.status === 'auth_failed') {
      setQrState('auth_failed');
      setPhase('error');
      setError('Autentikasi gagal. Pastikan Anda scan QR dengan benar.');
    } else if (conn.status === 'session_expired') {
      setQrState('session_expired');
      setError('Sesi telah berakhir. Silakan coba lagi.');
    } else if (conn.status === 'qr_ready' || conn.status === 'waiting_for_scan') {
      setQrState('waiting_for_scan');
    }
  }, [pollingRef]);

  const renderQR = async (data: string) => {
    if (canvasRef.current) {
      try {
        await QRCode.toCanvas(canvasRef.current, data, {
          width: 256, margin: 2, color: { dark: '#000000', light: '#ffffff' },
        });
        setQrDataUrl(data);
      } catch (e) {
        console.error('QR render error:', e);
      }
    }
  };

  const startConnection = async () => {
    setPhase('connecting');
    setQrState('initializing');
    setError(null);

    // Step 1: Check server health BEFORE creating any connection record
    try {
      const { ok, data } = await callSessionServer('health', {});
      if (!ok || data.server_online === false) {
        setQrState('server_offline');
        setPhase('error');
        setError(data?.message || 'WhatsApp Session Server tidak tersedia. Pastikan server berjalan sebelum menghubungkan.');
        return;
      }
    } catch {
      setQrState('server_offline');
      setPhase('error');
      setError('Tidak dapat menghubungi server WhatsApp. Pastikan server berjalan dan WHATSAPP_SERVER_URL dikonfigurasi.');
      return;
    }

    // Step 2: Create connection record (now that we know server is online)
    let connId = connectionId;
    if (!connId) {
      const { data: newConnId, error: createErr } = await supabase.rpc('create_qr_connection', {
        p_display_name: displayName.trim() || 'WhatsApp Dealer',
        p_user_id: userId || null,
      });
      if (createErr || !newConnId) {
        setError(getSafeError(createErr || new Error('Failed to create connection')));
        setPhase('error');
        return;
      }
      connId = newConnId as string;
      setConnectionId(connId);
    }

    // Step 3: Subscribe to realtime for this connection
    subscribeToConnection(connId);

    // Step 4: Ask session server to start WhatsApp session
    try {
      const { ok, data } = await callSessionServer('start', { connection_id: connId });

      if (!ok) {
        // Clean up orphaned connection if server returned error
        if (data?.error === 'SERVER_OFFLINE' || data?.error === 'SERVER_TIMEOUT') {
          // Don't leave orphaned "connecting" record
          await supabase.rpc('cleanup_orphan_connections', { p_connection_id: connId });
          setConnectionId(null);
        }

        if (data?.error === 'WHATSAPP_SERVER_URL_NOT_CONFIGURED') {
          setQrState('no_server');
        } else {
          setQrState('server_offline');
        }
        setPhase('error');
        setError(data?.message || data?.error || 'Gagal memulai sesi WhatsApp');
        return;
      }

      // If QR data is returned immediately, render it
      if (data.qr) {
        await renderQR(data.qr);
        setQrExpiresAt(new Date(Date.now() + 90000));
        setQrState('qr_ready');
        setPhase('qr');
      } else {
        // QR will come via realtime — poll as fallback
        const pollInterval = setInterval(async () => {
          const { data: qrSessions } = await supabase.from('whatsapp_qr_sessions')
            .select('*').eq('connection_id', connId)
            .order('created_at', { ascending: false }).limit(1);
          if (qrSessions && qrSessions.length > 0) {
            const latest = qrSessions[0] as WhatsAppQRSession;
            if (latest.qr_data && latest.status === 'qr_ready') {
              await renderQR(latest.qr_data);
              setQrExpiresAt(new Date(latest.expires_at));
              setQrState('qr_ready');
              setPhase('qr');
              clearInterval(pollInterval);
            }
          }
          const { data: conn } = await supabase.from('whatsapp_connections')
            .select('*').eq('id', connId).maybeSingle();
          if (conn && (conn as WhatsAppConnection).status === 'connected') {
            handleConnectionUpdate(conn as WhatsAppConnection);
            clearInterval(pollInterval);
          }
        }, 2000);
        setPollingRef(pollInterval);

        // Safety timeout: if no QR after 30s, show error and clean up
        setTimeout(() => {
          if (phase === 'connecting') {
            clearInterval(pollInterval);
            setPhase('error');
            setQrState('error');
            setError('Server tidak menghasilkan QR code dalam waktu yang ditentukan. Pastikan server WhatsApp berjalan dengan benar.');
          }
        }, 30000);
      }
    } catch {
      // Clean up orphaned connection
      await supabase.rpc('cleanup_orphan_connections', { p_connection_id: connId });
      setConnectionId(null);
      setError('Tidak dapat menghubungi server WhatsApp. Pastikan koneksi internet stabil.');
      setPhase('error');
    }
  };

  const refreshQR = async () => {
    if (!connectionId) return;
    setQrState('initializing');
    setError(null);
    setQrDataUrl(null);
    await supabase.from('whatsapp_qr_sessions').delete().eq('connection_id', connectionId);
    try {
      await callSessionServer('start', { connection_id: connectionId });
    } catch {
      setError('Gagal memperbarui QR code');
    }
  };

  const [qrCountdown, setQrCountdown] = useState(0);
  useEffect(() => {
    if (!qrExpiresAt || phase !== 'qr') return;
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((qrExpiresAt.getTime() - Date.now()) / 1000));
      setQrCountdown(remaining);
      if (remaining <= 0) {
        setQrState('session_expired');
        setError('QR telah kedaluwarsa. Silakan buat QR baru.');
        clearInterval(interval);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [qrExpiresAt, phase]);

  // === Phase: Info ===
  if (phase === 'info') {
    return (
      <div className="space-y-5">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-green-50">
            <QrCode className="h-7 w-7 text-green-600" />
          </div>
          <h3 className="text-base font-bold text-neutral-900">Hubungkan WhatsApp Anda</h3>
          <p className="mt-1 text-sm text-neutral-500">Scan QR code dengan WhatsApp di HP Anda untuk menghubungkan nomor ke CRM</p>
        </div>
        <div>
          <Label className="text-sm font-medium">Nama Tampilan</Label>
          <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="contoh: Honda Pekalongan" className="mt-1.5" />
          <p className="mt-1 text-xs text-neutral-400">Nama untuk mengidentifikasi nomor ini di sistem</p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
          <p className="text-xs font-medium text-neutral-600">Cara menghubungkan:</p>
          <ol className="mt-2 space-y-1.5 text-xs text-neutral-500">
            <li>1. Buka WhatsApp di HP Anda</li>
            <li>2. Buka Pengaturan</li>
            <li>3. Pilih Perangkat Tertaut</li>
            <li>4. Pilih Tautkan Perangkat</li>
            <li>5. Scan QR Code yang muncul</li>
          </ol>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>Batal</Button>
          <Button onClick={startConnection} disabled={!displayName.trim()} className="bg-green-600 hover:bg-green-700 text-white">
            <QrCode className="mr-1 h-4 w-4" /> Buat QR Code
          </Button>
        </div>
      </div>
    );
  }

  // === Phase: Connecting ===
  if (phase === 'connecting') {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-10 w-10 animate-spin text-green-600" />
        <p className="mt-4 text-sm font-medium text-neutral-700">Menginisialisasi sesi WhatsApp...</p>
        <p className="mt-1 text-xs text-neutral-400">Memeriksa server dan menghasilkan QR code</p>
      </div>
    );
  }

  // === Phase: QR ===
  if (phase === 'qr') {
    return (
      <div className="space-y-5">
        <div className="text-center">
          <h3 className="text-base font-bold text-neutral-900">Scan QR Code</h3>
          <p className="mt-1 text-sm text-neutral-500">Buka WhatsApp → Pengaturan → Perangkat Tertaut → Tautkan Perangkat</p>
        </div>
        <div className="flex flex-col items-center">
          <div className="rounded-xl border-2 border-neutral-200 bg-white p-4">
            <canvas ref={canvasRef} className="block" />
          </div>
          <div className="mt-4 flex items-center gap-2">
            <div className={cn('h-2.5 w-2.5 rounded-full',
              qrState === 'qr_ready' ? 'bg-blue-500 animate-pulse' :
              qrState === 'waiting_for_scan' ? 'bg-blue-500' :
              qrState === 'authenticating' ? 'bg-amber-500 animate-pulse' : 'bg-neutral-300')} />
            <span className="text-sm font-medium text-neutral-700">
              {qrState === 'qr_ready' ? 'Menunggu scan dari HP...' :
               qrState === 'waiting_for_scan' ? 'Menunggu scan...' :
               qrState === 'authenticating' ? 'Mengautentikasi...' : 'Memuat...'}
            </span>
          </div>
          {qrCountdown > 0 && <p className="mt-2 text-xs text-neutral-400">QR diperbarui dalam {qrCountdown} detik</p>}
          {qrCountdown <= 0 && qrState === 'session_expired' && <p className="mt-2 text-xs text-red-500">QR telah kedaluwarsa</p>}
        </div>
        <div className="flex justify-between">
          <Button variant="outline" onClick={onCancel}>Batalkan</Button>
          <Button variant="outline" onClick={refreshQR}><RefreshCw className="mr-1 h-3.5 w-3.5" /> QR Baru</Button>
        </div>
      </div>
    );
  }

  // === Phase: Success ===
  if (phase === 'success') {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-50">
          <CheckCircle2 className="h-8 w-8 text-green-600" />
        </div>
        <h3 className="mt-4 text-lg font-bold text-neutral-900">WhatsApp Berhasil Terhubung</h3>
        <p className="mt-1 text-sm text-neutral-500">Nomor WhatsApp Anda telah terhubung ke CRM</p>
        <div className="mt-4 rounded-lg border border-green-100 bg-green-50 p-4 text-sm">
          <div className="flex items-center gap-2 text-green-700"><CheckCircle2 className="h-4 w-4" /> Connected</div>
        </div>
        <div className="mt-6 flex gap-2">
          <Button variant="outline" onClick={onCancel}>Tutup</Button>
          <Button onClick={onConnected} className="bg-green-600 hover:bg-green-700 text-white">
            <Plug className="mr-1 h-4 w-4" /> Buka Inbox
          </Button>
        </div>
      </div>
    );
  }

  // === Phase: Error ===
  if (phase === 'error') {
    return (
      <div className="space-y-5">
        <div className="flex flex-col items-center justify-center py-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
            <AlertCircle className="h-8 w-8 text-red-600" />
          </div>
          <h3 className="mt-4 text-base font-bold text-neutral-900">Gagal Menghubungkan</h3>
          <p className="mt-2 max-w-sm text-center text-sm text-neutral-500">{error}</p>
        </div>
        {(qrState === 'no_server' || qrState === 'server_offline') && (
          <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs text-blue-700">
            <p className="font-medium">Cara mengaktifkan koneksi QR:</p>
            <ol className="mt-1 space-y-0.5">
              <li>1. Deploy server Baileys (Node.js) di VPS/Railway/Render</li>
              <li>2. Set environment variable WHATSAPP_SERVER_URL di Supabase secrets</li>
              <li>3. Set WHATSAPP_WEBHOOK_SECRET untuk autentikasi webhook</li>
              <li>4. Pastikan server memposting event QR dan autentikasi ke webhook endpoint</li>
            </ol>
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>Tutup</Button>
          <Button onClick={() => { setPhase('info'); setError(null); setConnectionId(null); }} className="bg-green-600 hover:bg-green-700 text-white">
            Coba Lagi
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
