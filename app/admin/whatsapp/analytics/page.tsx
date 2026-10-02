'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase-client';
import { useAuth } from '@/lib/auth-provider';
import { Loader2, MessageCircle, Clock, CheckCircle2, TrendingUp, Users, AlertTriangle } from 'lucide-react';

type ProfileOption = { id: string; full_name: string };

export default function WhatsAppAnalyticsPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [totalConversations, setTotalConversations] = useState(0);
  const [totalIncoming, setTotalIncoming] = useState(0);
  const [totalOutgoing, setTotalOutgoing] = useState(0);
  const [avgResponseTime, setAvgResponseTime] = useState<string>('—');
  const [slaCompliance, setSlaCompliance] = useState<number>(0);
  const [unanswered, setUnanswered] = useState(0);
  const [byStatus, setByStatus] = useState<{ status: string; count: number }[]>([]);
  const [bySales, setBySales] = useState<{ name: string; conversations: number; messages: number }[]>([]);
  const [salesReps, setSalesReps] = useState<ProfileOption[]>([]);

  useEffect(() => {
    supabase.from('profiles').select('id, full_name').in('role', ['admin', 'sales']).eq('status', 'active')
      .then(({ data }) => { if (data) setSalesReps(data as ProfileOption[]); });
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const now = new Date();
    let startDate: string | null = null;
    if (dateRange === '7d') startDate = new Date(now.getTime() - 7 * 86400000).toISOString();
    else if (dateRange === '30d') startDate = new Date(now.getTime() - 30 * 86400000).toISOString();
    else if (dateRange === '90d') startDate = new Date(now.getTime() - 90 * 86400000).toISOString();

    let convQuery = supabase.from('whatsapp_conversations').select('id, status, assigned_to, sla_status, response_time_seconds, created_at');
    if (startDate) convQuery = convQuery.gte('created_at', startDate);

    let msgQuery = supabase.from('whatsapp_messages').select('id, direction, conversation_id, created_at');
    if (startDate) msgQuery = msgQuery.gte('created_at', startDate);

    const [convRes, msgRes] = await Promise.all([convQuery, msgQuery]);

    const convs = (convRes.data || []) as any[];
    const msgs = (msgRes.data || []) as any[];

    setTotalConversations(convs.length);
    setTotalIncoming(msgs.filter((m) => m.direction === 'incoming').length);
    setTotalOutgoing(msgs.filter((m) => m.direction === 'outgoing').length);
    setUnanswered(convs.filter((c) => c.status === 'waiting_sales').length);

    // Avg response time
    const responseTimes = convs.filter((c) => c.response_time_seconds != null).map((c) => c.response_time_seconds);
    if (responseTimes.length > 0) {
      const avg = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const mins = Math.floor(avg / 60);
      const secs = Math.round(avg % 60);
      setAvgResponseTime(`${mins}m ${secs}s`);
    }

    // SLA compliance
    const slaConvs = convs.filter((c) => c.sla_status !== 'no_sla');
    if (slaConvs.length > 0) {
      const withinSla = slaConvs.filter((c) => c.sla_status === 'within_sla').length;
      setSlaCompliance(Math.round((withinSla / slaConvs.length) * 100));
    }

    // By status
    const statusMap: Record<string, number> = {};
    convs.forEach((c) => { statusMap[c.status] = (statusMap[c.status] || 0) + 1; });
    setByStatus(Object.entries(statusMap).map(([status, count]) => ({ status, count })).sort((a, b) => b.count - a.count));

    // By sales
    const salesMap: Record<string, { conversations: number; messages: number }> = {};
    convs.forEach((c) => {
      const key = c.assigned_to || 'unassigned';
      if (!salesMap[key]) salesMap[key] = { conversations: 0, messages: 0 };
      salesMap[key].conversations++;
    });
    msgs.forEach((m) => {
      // Find conversation's assigned_to
      const conv = convs.find((c) => c.id === m.conversation_id);
      const key = conv?.assigned_to || 'unassigned';
      if (!salesMap[key]) salesMap[key] = { conversations: 0, messages: 0 };
      salesMap[key].messages++;
    });
    setBySales(Object.entries(salesMap).map(([key, val]) => ({
      name: key === 'unassigned' ? 'Unassigned' : (salesReps.find((r) => r.id === key)?.full_name || 'Sales'),
      conversations: val.conversations,
      messages: val.messages,
    })).sort((a, b) => b.conversations - a.conversations));

    setLoading(false);
  }, [dateRange, salesReps]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center text-neutral-400">
        <Loader2 className="mr-2 h-6 w-6 animate-spin" /> Memuat WhatsApp Analytics...
      </div>
    );
  }

  const statusLabels: Record<string, string> = {
    open: 'Open', waiting_customer: 'Menunggu Customer', waiting_sales: 'Menunggu Sales',
    resolved: 'Selesai', archived: 'Arsip',
  };

  const kpis = [
    { label: 'Total Conversations', value: totalConversations, icon: MessageCircle, color: 'text-green-600 bg-green-50' },
    { label: 'Incoming Messages', value: totalIncoming, icon: TrendingUp, color: 'text-blue-600 bg-blue-50' },
    { label: 'Outgoing Messages', value: totalOutgoing, icon: MessageCircle, color: 'text-purple-600 bg-purple-50' },
    { label: 'Unanswered', value: unanswered, icon: AlertTriangle, color: 'text-orange-600 bg-orange-50' },
    { label: 'Avg Response', value: avgResponseTime, icon: Clock, color: 'text-cyan-600 bg-cyan-50' },
    { label: 'SLA Compliance', value: `${slaCompliance}%`, icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-neutral-900">WhatsApp Analytics</h1>
        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value as typeof dateRange)}
          className="h-9 rounded-md border border-input bg-white px-3 text-sm"
        >
          <option value="7d">7 Hari</option>
          <option value="30d">30 Hari</option>
          <option value="90d">90 Hari</option>
          <option value="all">Semua</option>
        </select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-xl border border-neutral-200 bg-white p-4">
            <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-lg ${kpi.color}`}>
              <kpi.icon className="h-5 w-5" />
            </div>
            <p className="text-xl font-bold text-neutral-900">{kpi.value}</p>
            <p className="text-xs text-neutral-500">{kpi.label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Status Distribution */}
        <div className="rounded-xl border border-neutral-200 bg-white p-5">
          <h2 className="text-base font-bold text-neutral-900">Status Percakapan</h2>
          {byStatus.length === 0 ? (
            <p className="mt-4 text-sm text-neutral-400">Belum ada data.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {byStatus.map((s) => {
                const max = byStatus[0]?.count || 1;
                const pct = Math.round((s.count / max) * 100);
                return (
                  <div key={s.status}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-neutral-700">{statusLabels[s.status] || s.status}</span>
                      <span className="font-semibold text-neutral-900">{s.count}</span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-neutral-100">
                      <div className="h-full bg-green-500 transition-all duration-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Sales Performance */}
        <div className="rounded-xl border border-neutral-200 bg-white p-5">
          <h2 className="text-base font-bold text-neutral-900">Sales Performance</h2>
          {bySales.length === 0 ? (
            <p className="mt-4 text-sm text-neutral-400">Belum ada data.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
                    <th className="pb-2 font-medium">Sales</th>
                    <th className="pb-2 text-right font-medium">Conversations</th>
                    <th className="pb-2 text-right font-medium">Messages</th>
                  </tr>
                </thead>
                <tbody>
                  {bySales.map((s) => (
                    <tr key={s.name} className="border-b border-neutral-50 last:border-0">
                      <td className="py-2 font-medium text-neutral-900">{s.name}</td>
                      <td className="py-2 text-right text-neutral-700">{s.conversations}</td>
                      <td className="py-2 text-right text-neutral-500">{s.messages}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
