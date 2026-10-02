'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase, Lead, FollowUp, Visit, Profile } from '@/lib/supabase-client';
import { useAuth } from '@/lib/auth-provider';
import { MetricCard, SectionCard, EmptyState, LoadingState, leadStatusLabels, timeAgo } from '@/components/admin/admin-ui';
import {
  Users, CalendarDays, Clock, AlertCircle, CheckCircle, XCircle,
  TrendingUp, PhoneCall, CalendarPlus, MessageCircle, ArrowRight,
  ChevronRight, Bike, Package, Tag, BarChart3,
  CreditCard, ClipboardList, Truck, FileText,
} from 'lucide-react';
import Link from 'next/link';

type FollowUpWithLead = FollowUp & { leads?: Pick<Lead, 'id' | 'name' | 'phone' | 'motor_name'> };

export default function AdminDashboardPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [todayFollowUps, setTodayFollowUps] = useState<FollowUpWithLead[]>([]);
  const [overdueFollowUps, setOverdueFollowUps] = useState<FollowUpWithLead[]>([]);
  const [todayVisits, setTodayVisits] = useState<Visit[]>([]);
  const [recentLeads, setRecentLeads] = useState<Lead[]>([]);
  const [recentActivity, setRecentActivity] = useState<{ id: string; action: string; entity: string; user_email: string | null; created_at: string }[]>([]);

  const [kpis, setKpis] = useState({
    leadsToday: 0, leadsThisWeek: 0, leadsThisMonth: 0,
    newLeads: 0, contactedLeads: 0, qualifiedLeads: 0,
    visitScheduledLeads: 0, negotiationLeads: 0,
    wonLeads: 0, lostLeads: 0, totalLeads: 0,
    visitsToday: 0, visitsUpcoming: 0,
    followUpsToday: 0, followUpsOverdue: 0,
    productsActive: 0, productsReady: 0, productsLimited: 0, productsOutOfStock: 0,
    activePromos: 0, totalDeals: 0, totalDealValue: 0,
    creditApps: 0, creditApproved: 0, creditRejected: 0,
    spkNew: 0, unitReserved: 0, readyDelivery: 0, inDelivery: 0, delivered: 0,
    newCustomers: 0,
  });

  const [salesReps, setSalesReps] = useState<Profile[]>([]);

  const fetchDashboard = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setError(false);

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const scope = isAdmin ? null : profile.id;

    const leadQuery = (q: any) => {
      if (scope) return q.eq('assigned_to', scope);
      return q;
    };

    try {
      const [
        leadsTodayR, leadsWeekR, leadsMonthR,
        newLeadsR, contactedR, qualifiedR, visitSchedR, negotiationR,
        wonR, lostR, totalLeadsR,
        visitsTodayR, visitsUpcomingR,
        followTodayR, followOverdueR,
        productsActiveR, readyR, limitedR, oosR,
        activePromosR, dealsR, dealSumR,
        recentLeadsR, recentActivityR,
        todayFollowR, overdueFollowR, todayVisitsR,
        creditAppsR, creditApprovedR, creditRejectedR,
        spkNewR, unitReservedR, readyDeliveryR, inDeliveryR, deliveredR,
        newCustomersR,
      ] = await Promise.all([
        leadQuery(supabase.from('leads').select('*', { count: 'exact', head: true })).gte('created_at', todayStart),
        leadQuery(supabase.from('leads').select('*', { count: 'exact', head: true })).gte('created_at', weekStart),
        leadQuery(supabase.from('leads').select('*', { count: 'exact', head: true })).gte('created_at', monthStart),
        leadQuery(supabase.from('leads').select('*', { count: 'exact', head: true })).eq('status', 'new'),
        leadQuery(supabase.from('leads').select('*', { count: 'exact', head: true })).eq('status', 'contacted'),
        leadQuery(supabase.from('leads').select('*', { count: 'exact', head: true })).eq('status', 'follow_up'),
        leadQuery(supabase.from('leads').select('*', { count: 'exact', head: true })).eq('status', 'visit_scheduled'),
        leadQuery(supabase.from('leads').select('*', { count: 'exact', head: true })).eq('status', 'negotiation'),
        leadQuery(supabase.from('leads').select('*', { count: 'exact', head: true })).eq('status', 'deal'),
        leadQuery(supabase.from('leads').select('*', { count: 'exact', head: true })).eq('status', 'lost'),
        leadQuery(supabase.from('leads').select('*', { count: 'exact', head: true })),
        supabase.from('visits').select('*', { count: 'exact', head: true }).eq('visit_date', todayStr).neq('status', 'cancelled'),
        supabase.from('visits').select('*', { count: 'exact', head: true }).gte('visit_date', todayStr).eq('status', 'scheduled'),
        leadQuery(supabase.from('leads').select('*', { count: 'exact', head: true })).eq('follow_up_at', todayStr).not('status', 'in', '("deal","lost")'),
        leadQuery(supabase.from('leads').select('*', { count: 'exact', head: true })).lt('follow_up_at', todayStr).not('status', 'in', '("deal","lost")'),
        supabase.from('products').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('products').select('*', { count: 'exact', head: true }).eq('stock_status', 'ready'),
        supabase.from('products').select('*', { count: 'exact', head: true }).eq('stock_status', 'limited'),
        supabase.from('products').select('*', { count: 'exact', head: true }).eq('stock_status', 'out_of_stock'),
        supabase.from('promos').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        leadQuery(supabase.from('deals').select('*', { count: 'exact', head: true })).eq('status', 'won'),
        supabase.from('deals').select('deal_value').eq('status', 'won'),
        leadQuery(supabase.from('leads').select('*')).order('created_at', { ascending: false }).limit(5),
        supabase.from('audit_logs').select('id,action,entity,user_email,created_at').order('created_at', { ascending: false }).limit(5),
        supabase.from('follow_ups').select('*,leads(id,name,phone,motor_name)').eq('scheduled_at', todayStr).eq('result', 'pending').order('created_at', { ascending: true }),
        supabase.from('follow_ups').select('*,leads(id,name,phone,motor_name)').lt('scheduled_at', todayStr).eq('result', 'pending').order('scheduled_at', { ascending: true }),
        supabase.from('visits').select('*').eq('visit_date', todayStr).neq('status', 'cancelled').order('visit_time', { ascending: true }),
        scope ? supabase.from('credit_applications').select('*', { count: 'exact', head: true }).gte('created_at', monthStart).eq('sales_id', scope) : supabase.from('credit_applications').select('*', { count: 'exact', head: true }).gte('created_at', monthStart),
        scope ? supabase.from('credit_applications').select('*', { count: 'exact', head: true }).eq('status', 'approved').eq('sales_id', scope) : supabase.from('credit_applications').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
        scope ? supabase.from('credit_applications').select('*', { count: 'exact', head: true }).eq('status', 'rejected').eq('sales_id', scope) : supabase.from('credit_applications').select('*', { count: 'exact', head: true }).eq('status', 'rejected'),
        scope ? supabase.from('spks').select('*', { count: 'exact', head: true }).eq('status', 'draft').eq('sales_id', scope) : supabase.from('spks').select('*', { count: 'exact', head: true }).eq('status', 'draft'),
        scope ? supabase.from('spks').select('*', { count: 'exact', head: true }).eq('status', 'unit_reserved').eq('sales_id', scope) : supabase.from('spks').select('*', { count: 'exact', head: true }).eq('status', 'unit_reserved'),
        scope ? supabase.from('spks').select('*', { count: 'exact', head: true }).eq('status', 'ready_delivery').eq('sales_id', scope) : supabase.from('spks').select('*', { count: 'exact', head: true }).eq('status', 'ready_delivery'),
        scope ? supabase.from('deliveries').select('*', { count: 'exact', head: true }).eq('status', 'in_delivery').eq('sales_id', scope) : supabase.from('deliveries').select('*', { count: 'exact', head: true }).eq('status', 'in_delivery'),
        scope ? supabase.from('deliveries').select('*', { count: 'exact', head: true }).eq('status', 'delivered').eq('sales_id', scope) : supabase.from('deliveries').select('*', { count: 'exact', head: true }).eq('status', 'delivered'),
        supabase.from('customers').select('*', { count: 'exact', head: true }).eq('status', 'active').gte('created_at', monthStart),
      ]);

      if (isAdmin) {
        supabase.from('profiles').select('*').eq('role', 'sales').eq('status', 'active').then(({ data }) => {
          if (data) setSalesReps(data as Profile[]);
        });
      }

      const totalDealValue = (dealSumR.data as { deal_value: number }[] || []).reduce((s, d) => s + (d.deal_value || 0), 0);

      setKpis({
        leadsToday: leadsTodayR.count || 0,
        leadsThisWeek: leadsWeekR.count || 0,
        leadsThisMonth: leadsMonthR.count || 0,
        newLeads: newLeadsR.count || 0,
        contactedLeads: contactedR.count || 0,
        qualifiedLeads: qualifiedR.count || 0,
        visitScheduledLeads: visitSchedR.count || 0,
        negotiationLeads: negotiationR.count || 0,
        wonLeads: wonR.count || 0,
        lostLeads: lostR.count || 0,
        totalLeads: totalLeadsR.count || 0,
        visitsToday: visitsTodayR.count || 0,
        visitsUpcoming: visitsUpcomingR.count || 0,
        followUpsToday: followTodayR.count || 0,
        followUpsOverdue: followOverdueR.count || 0,
        productsActive: productsActiveR.count || 0,
        productsReady: readyR.count || 0,
        productsLimited: limitedR.count || 0,
        productsOutOfStock: oosR.count || 0,
        activePromos: activePromosR.count || 0,
        totalDeals: dealsR.count || 0,
        totalDealValue,
        creditApps: creditAppsR.count || 0,
        creditApproved: creditApprovedR.count || 0,
        creditRejected: creditRejectedR.count || 0,
        spkNew: spkNewR.count || 0,
        unitReserved: unitReservedR.count || 0,
        readyDelivery: readyDeliveryR.count || 0,
        inDelivery: inDeliveryR.count || 0,
        delivered: deliveredR.count || 0,
        newCustomers: newCustomersR.count || 0,
      });

      setRecentLeads((recentLeadsR.data || []) as Lead[]);
      setRecentActivity((recentActivityR.data || []) as typeof recentActivity);
      setTodayFollowUps((todayFollowR.data || []) as FollowUpWithLead[]);
      setOverdueFollowUps((overdueFollowR.data || []) as FollowUpWithLead[]);
      setTodayVisits((todayVisitsR.data || []) as Visit[]);
    } catch {
      setError(true);
    }
    setLoading(false);
  }, [profile, isAdmin]);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  if (loading) return <LoadingState label="Memuat dashboard..." />;
  if (error) return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center">
      <p className="text-sm font-medium text-red-700">Tidak dapat memuat data.</p>
      <button onClick={fetchDashboard} className="mt-3 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">Coba Lagi</button>
    </div>
  );

  const adminKpis = [
    { label: 'Lead Hari Ini', value: kpis.leadsToday, icon: Users, color: 'blue' as const },
    { label: 'Customer Baru', value: kpis.newCustomers, icon: Users, color: 'cyan' as const },
    { label: 'Pengajuan Kredit', value: kpis.creditApps, icon: CreditCard, color: 'orange' as const },
    { label: 'Kredit Approved', value: kpis.creditApproved, icon: CheckCircle, color: 'green' as const },
    { label: 'SPK Baru', value: kpis.spkNew, icon: ClipboardList, color: 'blue' as const },
    { label: 'Unit Reserved', value: kpis.unitReserved, icon: Package, color: 'amber' as const },
    { label: 'Siap Dikirim', value: kpis.readyDelivery, icon: Truck, color: 'orange' as const },
    { label: 'Dalam Pengiriman', value: kpis.inDelivery, icon: Truck, color: 'cyan' as const },
    { label: 'Terkirim', value: kpis.delivered, icon: CheckCircle, color: 'green' as const },
    { label: 'Total Deal', value: kpis.totalDeals, icon: TrendingUp, color: 'green' as const },
  ];

  const salesKpis = [
    { label: 'Lead Baru', value: kpis.newLeads, icon: Users, color: 'blue' as const, sublabel: 'Perlu ditindaklanjuti' },
    { label: 'Follow-up Hari Ini', value: kpis.followUpsToday, icon: PhoneCall, color: 'orange' as const },
    { label: 'Follow-up Terlambat', value: kpis.followUpsOverdue, icon: AlertCircle, color: 'red' as const, sublabel: 'Perlu segera ditindaklanjuti' },
    { label: 'Kunjungan Hari Ini', value: kpis.visitsToday, icon: CalendarDays, color: 'cyan' as const },
    { label: 'Pengajuan Kredit', value: kpis.creditApps, icon: CreditCard, color: 'orange' as const },
    { label: 'Kredit Approved', value: kpis.creditApproved, icon: CheckCircle, color: 'green' as const },
    { label: 'SPK Baru', value: kpis.spkNew, icon: ClipboardList, color: 'blue' as const },
    { label: 'Deal', value: kpis.wonLeads, icon: TrendingUp, color: 'green' as const },
    { label: 'Lost', value: kpis.lostLeads, icon: XCircle, color: 'neutral' as const },
  ];

  const activeKpis = isAdmin ? adminKpis : salesKpis;

  const funnelStages = [
    { label: 'Lead', value: kpis.totalLeads, color: 'bg-blue-500' },
    { label: 'Dihubungi', value: kpis.contactedLeads, color: 'bg-cyan-500' },
    { label: 'Follow Up', value: kpis.qualifiedLeads, color: 'bg-yellow-500' },
    { label: 'Kunjungan', value: kpis.visitScheduledLeads, color: 'bg-orange-500' },
    { label: 'Negosiasi', value: kpis.negotiationLeads, color: 'bg-amber-500' },
    { label: 'Deal', value: kpis.wonLeads, color: 'bg-green-500' },
  ];
  const maxFunnel = Math.max(...funnelStages.map((s) => s.value), 1);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold text-neutral-900 sm:text-2xl">
          {isAdmin ? 'Dashboard Admin' : 'Dashboard Sales'}
        </h1>
        <p className="text-sm text-neutral-500">
          {isAdmin ? 'Gambaran umum performa bisnis dealer.' : `Berikut aktivitas penjualan Anda hari ini, ${profile?.full_name?.split(' ')[0] || ''}.`}
        </p>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2">
        <Link href="/admin/leads">
          <button className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700">
            <Users className="h-4 w-4" /> Lihat Leads
          </button>
        </Link>
        <Link href="/admin/follow-ups">
          <button className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50">
            <PhoneCall className="h-4 w-4" /> Follow-up
          </button>
        </Link>
        <Link href="/admin/visits">
          <button className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50">
            <CalendarPlus className="h-4 w-4" /> Jadwalkan Kunjungan
          </button>
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-7">
        {activeKpis.map((kpi) => (
          <MetricCard key={kpi.label} {...kpi} />
        ))}
      </div>

      {/* Funnel */}
      <SectionCard title="Sales Funnel">
        <div className="space-y-2">
          {funnelStages.map((stage) => (
            <div key={stage.label} className="flex items-center gap-4">
              <span className="w-24 text-sm font-medium text-neutral-700">{stage.label}</span>
              <div className="flex-1">
                <div className="h-7 rounded-md bg-neutral-100">
                  <div
                    className={`flex h-7 items-center justify-end rounded-md px-2 text-xs font-bold text-white ${stage.color}`}
                    style={{ width: `${Math.max((stage.value / maxFunnel) * 100, 8)}%` }}
                  >
                    {stage.value}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Follow-up Today */}
        <SectionCard
          title="Follow-up Hari Ini"
          action={<Link href="/admin/follow-ups" className="text-xs font-medium text-red-600 hover:underline">Lihat Semua</Link>}
        >
          {todayFollowUps.length === 0 ? (
            <p className="py-8 text-center text-sm text-neutral-400">Tidak ada follow-up hari ini.</p>
          ) : (
            <div className="space-y-3">
              {todayFollowUps.slice(0, 5).map((fu) => (
                <div key={fu.id} className="flex items-center justify-between border-b border-neutral-100 pb-3 last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-neutral-900">{fu.leads?.name || 'Unknown'}</p>
                    <p className="text-xs text-neutral-500">{fu.leads?.motor_name || '-'} • {fu.type}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={`https://wa.me/${(fu.leads?.phone || '').replace(/^0/, '62')}?text=${encodeURIComponent(`Halo ${fu.leads?.name || ''}`)}`}
                      target="_blank" rel="noopener noreferrer"
                      className="rounded-md p-1.5 text-green-600 hover:bg-green-50"
                    >
                      <MessageCircle className="h-4 w-4" />
                    </a>
                    <Link href={`/admin/leads/${fu.leads?.id}`} className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100">
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Today Visits */}
        <SectionCard
          title="Kunjungan Hari Ini"
          action={<Link href="/admin/visits" className="text-xs font-medium text-red-600 hover:underline">Lihat Semua</Link>}
        >
          {todayVisits.length === 0 ? (
            <p className="py-8 text-center text-sm text-neutral-400">Tidak ada kunjungan hari ini.</p>
          ) : (
            <div className="space-y-3">
              {todayVisits.slice(0, 5).map((v) => (
                <div key={v.id} className="flex items-center justify-between border-b border-neutral-100 pb-3 last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-neutral-900">
                      <span className="text-neutral-400">{v.visit_time}</span> {v.customer_name}
                    </p>
                    <p className="text-xs text-neutral-500">{v.motor_name || '-'} • {v.visit_type.replace(/_/g, ' ')}</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${v.status === 'confirmed' ? 'bg-green-100 text-green-700' : v.status === 'scheduled' ? 'bg-blue-100 text-blue-700' : 'bg-neutral-100 text-neutral-700'}`}>
                    {v.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {/* Overdue Follow-ups */}
      {overdueFollowUps.length > 0 && (
        <SectionCard
          title="Follow-up Terlambat"
          action={<Link href="/admin/follow-ups" className="text-xs font-medium text-red-600 hover:underline">Lihat Semua</Link>}
        >
          <div className="space-y-3">
            {overdueFollowUps.slice(0, 5).map((fu) => {
              const daysLate = Math.floor((Date.now() - new Date(fu.scheduled_at || '').getTime()) / 86400000);
              return (
                <div key={fu.id} className="flex items-center justify-between rounded-lg border border-red-100 bg-red-50/40 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-neutral-900">{fu.leads?.name || 'Unknown'}</p>
                    <p className="text-xs text-neutral-500">{fu.leads?.motor_name || '-'}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-medium text-red-600">Terlambat {daysLate} hari</span>
                    <a
                      href={`https://wa.me/${(fu.leads?.phone || '').replace(/^0/, '62')}?text=${encodeURIComponent(`Halo ${fu.leads?.name || ''}`)}`}
                      target="_blank" rel="noopener noreferrer"
                      className="rounded-md bg-green-600 p-1.5 text-white hover:bg-green-700"
                    >
                      <MessageCircle className="h-4 w-4" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Leads */}
        <SectionCard
          title="Lead Terbaru"
          action={<Link href="/admin/leads" className="text-xs font-medium text-red-600 hover:underline">Lihat Semua</Link>}
        >
          {recentLeads.length === 0 ? (
            <EmptyState icon={Users} title="Belum ada lead" description="Lead dari website akan muncul di sini." />
          ) : (
            <div className="space-y-3">
              {recentLeads.map((lead) => (
                <div key={lead.id} className="flex items-center justify-between border-b border-neutral-100 pb-3 last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-neutral-900">{lead.name}</p>
                    <p className="text-xs text-neutral-500">{lead.motor_name || '-'} • {lead.phone}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${leadStatusLabels[lead.status]?.color || 'bg-neutral-100 text-neutral-600'}`}>
                      {leadStatusLabels[lead.status]?.label || lead.status}
                    </span>
                    <Link href={`/admin/leads/${lead.id}`} className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100">
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Recent Activity */}
        <SectionCard title="Aktivitas Terbaru">
          {recentActivity.length === 0 ? (
            <EmptyState icon={BarChart3} title="Belum ada aktivitas" />
          ) : (
            <div className="space-y-3">
              {recentActivity.map((log) => (
                <div key={log.id} className="flex items-center justify-between border-b border-neutral-100 pb-3 last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-neutral-900">{log.action}</p>
                    <p className="text-xs text-neutral-500">{log.entity} • {log.user_email?.split('@')[0] || 'System'}</p>
                  </div>
                  <span className="flex-shrink-0 text-xs text-neutral-400">{timeAgo(log.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {/* Sales Performance Table for Admin */}
      {isAdmin && salesReps.length > 0 && (
        <SectionCard title="Performa Sales">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left text-xs font-semibold text-neutral-500">
                  <th className="pb-2 pr-4">Sales</th>
                  <th className="pb-2 pr-4">Total Lead</th>
                  <th className="pb-2 pr-4">Deal</th>
                  <th className="pb-2 pr-4">Konversi</th>
                </tr>
              </thead>
              <tbody>
                {salesReps.map((rep) => {
                  const repLeads = recentLeads.filter((l) => l.assigned_to === rep.id).length;
                  return (
                    <tr key={rep.id} className="border-b border-neutral-50 last:border-0">
                      <td className="py-2.5 pr-4 font-medium text-neutral-900">{rep.full_name}</td>
                      <td className="py-2.5 pr-4 text-neutral-600">{repLeads}</td>
                      <td className="py-2.5 pr-4 text-neutral-600">-</td>
                      <td className="py-2.5 pr-4 text-neutral-600">-</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-neutral-400">Data performa sales perlu query database untuk akurasi.</p>
          </div>
        </SectionCard>
      )}
    </div>
  );
}
