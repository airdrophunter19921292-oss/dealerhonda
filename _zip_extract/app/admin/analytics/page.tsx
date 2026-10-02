'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase-client';
import { BarChart3, TrendingUp, Users, Eye, MessageCircle, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth-provider';

type LeadRow = {
  id: string;
  status: string;
  source: string | null;
  source_type: string | null;
  source_page: string | null;
  source_medium: string | null;
  source_campaign: string | null;
  motor_name: string | null;
  city: string | null;
  assigned_to: string | null;
  created_at: string;
};

type ProfileOption = { id: string; full_name: string };

const sourcePageLabels: Record<string, string> = {
  homepage: 'Homepage',
  pekalongan: 'Landing Pekalongan',
  pemalang: 'Landing Pemalang',
  batang: 'Landing Batang',
  credit_simulator: 'Credit Simulator',
  vehicle_detail: 'Detail Motor',
  catalog: 'Katalog',
  other: 'Lainnya',
};

const sourceTypeLabels: Record<string, string> = {
  website: 'Website',
  landing_page: 'Landing Page',
  social: 'Sosial Media',
  paid: 'Iklan Berbayar',
  whatsapp: 'WhatsApp',
  walk_in: 'Walk-in',
  phone: 'Telepon',
  referral: 'Referral',
  event: 'Event',
  manual: 'Manual',
  other: 'Lainnya',
};

const leadStatusLabels: Record<string, string> = {
  new: 'Baru', contacted: 'Dihubungi', follow_up: 'Follow Up',
  visit_scheduled: 'Kunjungan', test_ride: 'Test Ride',
  negotiation: 'Negosiasi', deal: 'Deal', lost: 'Lost', cancelled: 'Batal',
};

function countBy<T>(arr: T[], key: (item: T) => string | null | undefined): { label: string; count: number }[] {
  const map: Record<string, number> = {};
  for (const item of arr) {
    const k = key(item) || '(kosong)';
    map[k] = (map[k] || 0) + 1;
  }
  return Object.entries(map)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

export default function AdminAnalyticsPage() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [sourceTypeFilter, setSourceTypeFilter] = useState('all');
  const [sourcePageFilter, setSourcePageFilter] = useState('all');
  const [salesFilter, setSalesFilter] = useState('all');
  const [salesReps, setSalesReps] = useState<ProfileOption[]>([]);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [totalVisits, setTotalVisits] = useState(0);
  const [totalEvents, setTotalEvents] = useState(0);
  const [eventsByType, setEventsByType] = useState<{ event_type: string; count: number }[]>([]);
  const [funnelBySource, setFunnelBySource] = useState<{
    source: string;
    leads: number;
    contacted: number;
    visits: number;
    credit: number;
    approved: number;
    spk: number;
    deals: number;
  }[]>([]);

  // Fetch sales reps for filter
  useEffect(() => {
    supabase
      .from('profiles')
      .select('id, full_name')
      .in('role', ['admin', 'sales'])
      .eq('status', 'active')
      .then(({ data }) => {
        if (data) setSalesReps(data as ProfileOption[]);
      });
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const now = new Date();
    let startDate: string | null = null;
    if (dateRange === '7d') startDate = new Date(now.getTime() - 7 * 86400000).toISOString();
    else if (dateRange === '30d') startDate = new Date(now.getTime() - 30 * 86400000).toISOString();
    else if (dateRange === '90d') startDate = new Date(now.getTime() - 90 * 86400000).toISOString();

    let leadQuery = supabase
      .from('leads')
      .select('id, status, source, source_type, source_page, source_medium, source_campaign, motor_name, city, assigned_to, created_at');
    if (startDate) leadQuery = leadQuery.gte('created_at', startDate);
    if (sourceTypeFilter !== 'all') leadQuery = leadQuery.eq('source_type', sourceTypeFilter);
    if (sourcePageFilter !== 'all') leadQuery = leadQuery.eq('source_page', sourcePageFilter);
    if (salesFilter !== 'all') leadQuery = leadQuery.eq('assigned_to', salesFilter);

    let eventsQuery = supabase.from('analytics_events').select('event_type, source');
    if (startDate) eventsQuery = eventsQuery.gte('created_at', startDate);

    let visitQuery = supabase.from('visits').select('id, lead_id', { count: 'exact', head: false });
    if (startDate) visitQuery = visitQuery.gte('created_at', startDate);

    const [leadsRes, eventsRes, visitsRes, creditRes, spkRes, dealRes] = await Promise.all([
      leadQuery,
      eventsQuery,
      visitQuery,
      supabase.from('credit_applications').select('customer_id, status'),
      supabase.from('spks').select('customer_id, status'),
      supabase.from('deals').select('lead_id, status'),
    ]);

    const leadsData = (leadsRes.data || []) as LeadRow[];
    setLeads(leadsData);
    setTotalVisits(visitsRes.count || 0);

    // Build customer_id → lead_id mapping from customers
    const customerIds = new Set<string>();
    // We need to get customer→lead_id mapping
    const leadIds = leadsData.map((l) => l.id);
    let customerLeadMap: Record<string, string> = {};
    if (leadIds.length > 0) {
      const { data: custData } = await supabase
        .from('customers')
        .select('id, lead_id')
        .in('lead_id', leadIds);
      if (custData) {
        for (const c of custData as { id: string; lead_id: string | null }[]) {
          if (c.lead_id) customerLeadMap[c.id] = c.lead_id;
        }
      }
    }

    // Build funnel by source
    const sourceFunnelMap: Record<string, {
      source: string;
      leads: number;
      contacted: number;
      visits: number;
      credit: number;
      approved: number;
      spk: number;
      deals: number;
    }> = {};

    function getOrCreateSource(src: string) {
      if (!sourceFunnelMap[src]) {
        sourceFunnelMap[src] = {
          source: src, leads: 0, contacted: 0, visits: 0,
          credit: 0, approved: 0, spk: 0, deals: 0,
        };
      }
      return sourceFunnelMap[src];
    }

    const leadSourceMap: Record<string, string> = {};
    for (const l of leadsData) {
      const src = l.source_type || l.source_page || l.source || 'unknown';
      leadSourceMap[l.id] = src;
      const entry = getOrCreateSource(src);
      entry.leads++;
      if (l.status === 'contacted' || l.status === 'follow_up') entry.contacted++;
      if (l.status === 'deal') entry.deals++;
    }

    // Visits by lead_id → source
    for (const v of (visitsRes.data || []) as { lead_id: string | null }[]) {
      if (v.lead_id && leadSourceMap[v.lead_id]) {
        sourceFunnelMap[leadSourceMap[v.lead_id]].visits++;
      }
    }

    // Credit apps via customer_id → lead_id → source
    const creditApprovedStatuses = ['approved', 'disbursed'];
    for (const ca of (creditRes.data || []) as { customer_id: string; status: string }[]) {
      const leadId = customerLeadMap[ca.customer_id];
      if (leadId && leadSourceMap[leadId]) {
        const entry = sourceFunnelMap[leadSourceMap[leadId]];
        entry.credit++;
        if (creditApprovedStatuses.includes(ca.status)) entry.approved++;
      }
    }

    // SPKs via customer_id → lead_id → source
    for (const s of (spkRes.data || []) as { customer_id: string; status: string }[]) {
      const leadId = customerLeadMap[s.customer_id];
      if (leadId && leadSourceMap[leadId]) {
        sourceFunnelMap[leadSourceMap[leadId]].spk++;
      }
    }

    // Deals via lead_id → source (already counted from leads, but also check deals table)
    for (const d of (dealRes.data || []) as { lead_id: string | null; status: string }[]) {
      if (d.lead_id && leadSourceMap[d.lead_id] && d.status === 'closed') {
        sourceFunnelMap[leadSourceMap[d.lead_id]].deals++;
      }
    }

    setFunnelBySource(Object.values(sourceFunnelMap).sort((a, b) => b.leads - a.leads));

    const typeMap: Record<string, number> = {};
    (eventsRes.data || []).forEach((e: any) => {
      typeMap[e.event_type] = (typeMap[e.event_type] || 0) + 1;
    });
    setTotalEvents(eventsRes.data?.length || 0);
    setEventsByType(
      Object.entries(typeMap)
        .map(([event_type, count]) => ({ event_type, count }))
        .sort((a, b) => b.count - a.count)
    );

    setLoading(false);
  }, [dateRange, sourceTypeFilter, sourcePageFilter, salesFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalLeads = leads.length;
  const totalDeals = leads.filter((l) => l.status === 'deal').length;
  const conversionRate = totalLeads > 0 ? Math.round((totalDeals / totalLeads) * 100) : 0;

  const bySourcePage = countBy(leads, (l) => l.source_page || l.source);
  const bySourceType = countBy(leads, (l) => l.source_type);
  const byMedium = countBy(leads, (l) => l.source_medium);
  const byCampaign = countBy(leads, (l) => l.source_campaign).filter((r) => r.label !== '(kosong)');
  const byMotor = countBy(leads, (l) => l.motor_name).slice(0, 8);
  const byCity = countBy(leads, (l) => l.city).slice(0, 8);
  const byStatus = countBy(leads, (l) => l.status);
  const bySales = countBy(leads, (l) => {
    const rep = salesReps.find((s) => s.id === l.assigned_to);
    return rep ? rep.full_name : l.assigned_to ? 'Sales (ID)' : 'Unassigned';
  });

  const eventTypeLabels: Record<string, string> = {
    view_motor: 'Lihat Motor', click_whatsapp: 'Klik WhatsApp', open_simulator: 'Buka Simulator',
    submit_simulator: 'Submit Simulator', submit_lead: 'Submit Lead', schedule_visit: 'Jadwal Kunjungan',
  };

  const kpis = [
    { label: 'Total Events', value: totalEvents, icon: BarChart3, color: 'text-blue-600 bg-blue-50' },
    { label: 'Total Leads', value: totalLeads, icon: Users, color: 'text-green-600 bg-green-50' },
    { label: 'Total Kunjungan', value: totalVisits, icon: TrendingUp, color: 'text-orange-600 bg-orange-50' },
    { label: 'Conversion Rate', value: `${conversionRate}%`, icon: Eye, color: 'text-red-600 bg-red-50' },
  ];

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center text-neutral-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Memuat analytics...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header + Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-neutral-900">Analytics</h1>
        <div className="flex flex-wrap gap-2">
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
          <select
            value={sourceTypeFilter}
            onChange={(e) => setSourceTypeFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-white px-3 text-sm"
          >
            <option value="all">Semua Channel</option>
            {Object.entries(sourceTypeLabels).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
          <select
            value={sourcePageFilter}
            onChange={(e) => setSourcePageFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-white px-3 text-sm"
          >
            <option value="all">Semua Halaman</option>
            {Object.entries(sourcePageLabels).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
          <select
            value={salesFilter}
            onChange={(e) => setSalesFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-white px-3 text-sm"
          >
            <option value="all">Semua Sales</option>
            {salesReps.map((r) => (
              <option key={r.id} value={r.id}>{r.full_name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-xl border border-neutral-200 bg-white p-4">
            <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-lg ${kpi.color}`}>
              <kpi.icon className="h-5 w-5" />
            </div>
            <p className="text-2xl font-bold text-neutral-900">{kpi.value}</p>
            <p className="text-xs text-neutral-500">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Conversion Funnel */}
      <div className="rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="text-base font-bold text-neutral-900">Conversion Funnel</h2>
        <div className="mt-4 space-y-3">
          {[
            { label: 'Visitor (Events)', count: totalEvents, color: 'bg-blue-500', pct: 100 },
            { label: 'Lead', count: totalLeads, color: 'bg-green-500', pct: totalEvents > 0 ? Math.round((totalLeads / totalEvents) * 100) : 0 },
            { label: 'Visit', count: totalVisits, color: 'bg-orange-500', pct: totalLeads > 0 ? Math.round((totalVisits / totalLeads) * 100) : 0 },
            { label: 'Deal', count: totalDeals, color: 'bg-red-500', pct: totalLeads > 0 ? Math.round((totalDeals / totalLeads) * 100) : 0 },
          ].map((stage) => (
            <div key={stage.label}>
              <div className="flex items-center justify-between text-sm">
                <span className="text-neutral-700">{stage.label}</span>
                <span className="font-semibold text-neutral-900">{stage.count} ({stage.pct}%)</span>
              </div>
              <div className="mt-1 h-3 overflow-hidden rounded-full bg-neutral-100">
                <div className={`h-full ${stage.color} transition-all duration-500`} style={{ width: `${Math.min(stage.pct, 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Marketing Funnel by Source */}
      {funnelBySource.length > 0 && (
        <div className="rounded-xl border border-neutral-200 bg-white p-5">
          <h2 className="text-base font-bold text-neutral-900">Marketing Funnel per Source</h2>
          <p className="mt-1 text-xs text-neutral-500">Lead → Contacted → Visit → Credit → Approved → SPK → Deal</p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
                  <th className="pb-2 pr-3 font-medium">Source</th>
                  <th className="pb-2 px-2 text-right font-medium">Lead</th>
                  <th className="pb-2 px-2 text-right font-medium">Contacted</th>
                  <th className="pb-2 px-2 text-right font-medium">Visit</th>
                  <th className="pb-2 px-2 text-right font-medium">Credit</th>
                  <th className="pb-2 px-2 text-right font-medium">Approved</th>
                  <th className="pb-2 px-2 text-right font-medium">SPK</th>
                  <th className="pb-2 px-2 text-right font-medium">Deal</th>
                  <th className="pb-2 pl-2 text-right font-medium">Conv.</th>
                </tr>
              </thead>
              <tbody>
                {funnelBySource.map((row) => {
                  const conv = row.leads > 0 ? Math.round((row.deals / row.leads) * 100) : 0;
                  return (
                    <tr key={row.source} className="border-b border-neutral-50 last:border-0">
                      <td className="py-2 pr-3 font-medium text-neutral-900">
                        {sourceTypeLabels[row.source] || sourcePageLabels[row.source] || row.source}
                      </td>
                      <td className="py-2 px-2 text-right font-semibold text-neutral-900">{row.leads}</td>
                      <td className="py-2 px-2 text-right text-neutral-600">{row.contacted}</td>
                      <td className="py-2 px-2 text-right text-neutral-600">{row.visits}</td>
                      <td className="py-2 px-2 text-right text-neutral-600">{row.credit}</td>
                      <td className="py-2 px-2 text-right text-green-600">{row.approved}</td>
                      <td className="py-2 px-2 text-right text-blue-600">{row.spk}</td>
                      <td className="py-2 px-2 text-right font-semibold text-red-600">{row.deals}</td>
                      <td className="py-2 pl-2 text-right text-xs text-neutral-500">{conv}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Attribution Breakdown */}
      <div className="grid gap-6 lg:grid-cols-2">
        <AnalyticsCard title="Lead per Halaman / Source">
          {bySourcePage.map((r) => (
            <BarRow key={r.label} label={sourcePageLabels[r.label] || r.label} count={r.count} max={bySourcePage[0]?.count || 1} />
          ))}
        </AnalyticsCard>

        <AnalyticsCard title="Lead per Channel (Source Type)">
          {bySourceType.map((r) => (
            <BarRow key={r.label} label={sourceTypeLabels[r.label] || r.label} count={r.count} max={bySourceType[0]?.count || 1} />
          ))}
        </AnalyticsCard>

        <AnalyticsCard title="Lead per Medium (Facebook, Instagram, dll)">
          {byMedium.length === 0
            ? <p className="text-sm text-neutral-400">Belum ada data medium.</p>
            : byMedium.map((r) => (
              <BarRow key={r.label} label={r.label} count={r.count} max={byMedium[0]?.count || 1} />
            ))}
        </AnalyticsCard>

        <AnalyticsCard title="Lead per Campaign">
          {byCampaign.length === 0
            ? <p className="text-sm text-neutral-400">Belum ada data campaign.</p>
            : byCampaign.map((r) => (
              <BarRow key={r.label} label={r.label} count={r.count} max={byCampaign[0]?.count || 1} />
            ))}
        </AnalyticsCard>

        <AnalyticsCard title="Motor Paling Diminati">
          {byMotor.length === 0
            ? <p className="text-sm text-neutral-400">Belum ada data motor.</p>
            : byMotor.map((r, i) => (
              <div key={r.label} className="flex items-center gap-3">
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs font-bold text-neutral-600">
                  {i + 1}
                </span>
                <span className="flex-1 text-sm">{r.label}</span>
                <span className="text-sm font-semibold text-red-600">{r.count} lead</span>
              </div>
            ))}
        </AnalyticsCard>

        <AnalyticsCard title="Area Customer">
          {byCity.length === 0
            ? <p className="text-sm text-neutral-400">Belum ada data kota.</p>
            : byCity.map((r) => (
              <BarRow key={r.label} label={r.label} count={r.count} max={byCity[0]?.count || 1} />
            ))}
        </AnalyticsCard>

        <AnalyticsCard title="Lead per Sales">
          {bySales.length === 0
            ? <p className="text-sm text-neutral-400">Belum ada data sales.</p>
            : bySales.map((r) => (
              <BarRow key={r.label} label={r.label} count={r.count} max={bySales[0]?.count || 1} />
            ))}
        </AnalyticsCard>

        <AnalyticsCard title="Event per Tipe">
          {eventsByType.length === 0
            ? <p className="text-sm text-neutral-400">Belum ada event.</p>
            : eventsByType.map((e) => (
              <BarRow key={e.event_type} label={eventTypeLabels[e.event_type] || e.event_type} count={e.count} max={eventsByType[0]?.count || 1} />
            ))}
        </AnalyticsCard>
      </div>

      {/* Lead Status */}
      <div className="rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="text-base font-bold text-neutral-900">Status Lead</h2>
        {byStatus.length === 0 ? (
          <p className="mt-4 text-sm text-neutral-400">Belum ada data.</p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {byStatus.map((s) => (
              <div key={s.label} className="flex items-center justify-between rounded-lg border border-neutral-100 bg-neutral-50 p-3">
                <span className="text-sm text-neutral-700">
                  {leadStatusLabels[s.label] || s.label}
                </span>
                <span className="text-sm font-bold text-neutral-900">{s.count}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-4">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-neutral-400" />
          <p className="text-xs text-neutral-500">
            Semua data analytics berasal dari database secara langsung. Filter berpengaruh pada semua grafik dan tabel di halaman ini.
          </p>
        </div>
      </div>
    </div>
  );
}

function AnalyticsCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5">
      <h2 className="text-base font-bold text-neutral-900">{title}</h2>
      <div className="mt-4 space-y-3">{children}</div>
    </div>
  );
}

function BarRow({ label, count, max }: { label: string; count: number; max: number }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="truncate text-neutral-700" title={label}>{label}</span>
        <span className="ml-2 flex-shrink-0 font-semibold text-red-600">{count}</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-neutral-100">
        <div className="h-full bg-red-500 transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
