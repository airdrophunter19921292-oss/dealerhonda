'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase, Lead, Profile } from '@/lib/supabase-client';
import { useAuth } from '@/lib/auth-provider';
import {
  PageHeader, LoadingState, EmptyState, MetricCard,
  leadStatusLabels, priorityLabels, formatDate,
} from '@/components/admin/admin-ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Search, Users, ChevronRight, MessageCircle, AlertTriangle, Calendar,
  ChevronLeft, Plus, UserPlus, CheckCircle, XCircle, PhoneCall,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { LeadForm } from '@/components/admin/lead-form';

const statusOptions = Object.keys(leadStatusLabels);
const priorityOptions = Object.keys(priorityLabels);

export default function AdminLeadsPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const [leads, setLeads] = useState<Lead[]>([]);
  const [salesReps, setSalesReps] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [salesFilter, setSalesFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [showAddForm, setShowAddForm] = useState(false);
  const [kpis, setKpis] = useState({ total: 0, newLeads: 0, followUpToday: 0, overdue: 0, converted: 0, lost: 0 });

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    let countQuery = supabase.from('leads').select('*', { count: 'exact', head: true });
    let dataQuery = supabase.from('leads').select('*').order('created_at', { ascending: false });

    if (!isAdmin && profile?.id) {
      countQuery = countQuery.eq('assigned_to', profile.id);
      dataQuery = dataQuery.eq('assigned_to', profile.id);
    }
    if (statusFilter !== 'all') {
      countQuery = countQuery.eq('status', statusFilter);
      dataQuery = dataQuery.eq('status', statusFilter);
    }
    if (priorityFilter !== 'all') {
      countQuery = countQuery.eq('priority', priorityFilter);
      dataQuery = dataQuery.eq('priority', priorityFilter);
    }
    if (sourceFilter !== 'all') {
      countQuery = countQuery.eq('source_type', sourceFilter);
      dataQuery = dataQuery.eq('source_type', sourceFilter);
    }
    if (isAdmin && salesFilter !== 'all') {
      if (salesFilter === 'unassigned') {
        countQuery = countQuery.is('assigned_to', null);
        dataQuery = dataQuery.is('assigned_to', null);
      } else {
        countQuery = countQuery.eq('assigned_to', salesFilter);
        dataQuery = dataQuery.eq('assigned_to', salesFilter);
      }
    }

    const [countRes, dataRes] = await Promise.all([
      countQuery,
      dataQuery.range(page * pageSize, (page + 1) * pageSize - 1),
    ]);

    setTotalCount(countRes.count || 0);
    setLeads((dataRes.data || []) as Lead[]);
    setLoading(false);
  }, [isAdmin, profile?.id, statusFilter, salesFilter, priorityFilter, sourceFilter, page, pageSize]);

  const fetchKpis = useCallback(async () => {
    if (!profile) return;
    const todayStr = new Date().toISOString().split('T')[0];
    const scope = (q: any) => {
      if (!isAdmin && profile.id) return q.eq('assigned_to', profile.id);
      return q;
    };

    const [totalR, newR, followTodayR, overdueR, convertedR, lostR] = await Promise.all([
      scope(supabase.from('leads').select('*', { count: 'exact', head: true })),
      scope(supabase.from('leads').select('*', { count: 'exact', head: true })).eq('status', 'new'),
      scope(supabase.from('leads').select('*', { count: 'exact', head: true })).eq('follow_up_at', todayStr).not('status', 'in', '("deal","lost","converted")'),
      scope(supabase.from('leads').select('*', { count: 'exact', head: true })).lt('follow_up_at', todayStr).not('status', 'in', '("deal","lost","converted")'),
      scope(supabase.from('leads').select('*', { count: 'exact', head: true })).eq('status', 'converted'),
      scope(supabase.from('leads').select('*', { count: 'exact', head: true })).eq('status', 'lost'),
    ]);

    setKpis({
      total: totalR.count || 0,
      newLeads: newR.count || 0,
      followUpToday: followTodayR.count || 0,
      overdue: overdueR.count || 0,
      converted: convertedR.count || 0,
      lost: lostR.count || 0,
    });
  }, [profile, isAdmin]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);
  useEffect(() => { fetchKpis(); }, [fetchKpis]);

  useEffect(() => {
    if (isAdmin) {
      supabase.from('profiles').select('*').eq('role', 'sales').eq('status', 'active').then(({ data }) => {
        if (data) setSalesReps(data as Profile[]);
      });
    }
  }, [isAdmin]);

  const handleStatusChange = async (id: string, status: string) => {
    await supabase.rpc('change_lead_status', { p_lead_id: id, p_new_status: status, p_note: null });
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));
    fetchKpis();
  };

  const handleAssign = async (id: string, assignedTo: string) => {
    await supabase.rpc('assign_lead', { p_lead_id: id, p_assigned_to: assignedTo || null });
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, assigned_to: assignedTo || null } : l)));
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const sourceTypeOptions: { value: string; label: string }[] = [
    { value: 'website', label: 'Website' },
    { value: 'landing_page', label: 'Landing Page' },
    { value: 'social', label: 'Sosial Media' },
    { value: 'paid', label: 'Iklan Berbayar' },
    { value: 'whatsapp', label: 'WhatsApp' },
    { value: 'walk_in', label: 'Walk-in' },
    { value: 'phone', label: 'Telepon' },
    { value: 'referral', label: 'Referral' },
    { value: 'event', label: 'Event' },
    { value: 'manual', label: 'Manual' },
    { value: 'other', label: 'Lainnya' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Users}
        title="Lead Customer"
        description="Kelola seluruh prospek dan aktivitas customer."
        actions={
          <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={() => setShowAddForm(true)}>
            <Plus className="mr-2 h-4 w-4" /> Tambah Lead
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <MetricCard label="Total Lead" value={kpis.total} icon={Users} color="blue" />
        <MetricCard label="Lead Baru" value={kpis.newLeads} icon={UserPlus} color="cyan" />
        <MetricCard label="Follow-up Hari Ini" value={kpis.followUpToday} icon={PhoneCall} color="orange" />
        <MetricCard label="Overdue" value={kpis.overdue} icon={AlertTriangle} color="red" />
        <MetricCard label="Converted" value={kpis.converted} icon={CheckCircle} color="green" />
        <MetricCard label="Lost" value={kpis.lost} icon={XCircle} color="neutral" />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <Input
            placeholder="Cari nama, nomor, kota..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="pl-10"
          />
        </div>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }} className="admin-select sm:w-40">
          <option value="all">Semua Status</option>
          {statusOptions.map((s) => <option key={s} value={s}>{leadStatusLabels[s].label}</option>)}
        </select>
        <select value={priorityFilter} onChange={(e) => { setPriorityFilter(e.target.value); setPage(0); }} className="admin-select sm:w-36">
          <option value="all">Semua Prioritas</option>
          {priorityOptions.map((p) => <option key={p} value={p}>{priorityLabels[p].label}</option>)}
        </select>
        <select value={sourceFilter} onChange={(e) => { setSourceFilter(e.target.value); setPage(0); }} className="admin-select sm:w-40">
          <option value="all">Semua Channel</option>
          {sourceTypeOptions.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        {isAdmin && (
          <select value={salesFilter} onChange={(e) => { setSalesFilter(e.target.value); setPage(0); }} className="admin-select sm:w-40">
            <option value="all">Semua Sales</option>
            <option value="unassigned">Unassigned</option>
            {salesReps.map((r) => <option key={r.id} value={r.id}>{r.full_name}</option>)}
          </select>
        )}
      </div>

      {loading ? (
        <LoadingState label="Memuat leads..." />
      ) : leads.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Belum ada lead"
          description="Belum ada prospek yang masuk ke sistem."
          action={
            <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={() => setShowAddForm(true)}>
              <Plus className="mr-2 h-4 w-4" /> Tambah Lead
            </Button>
          }
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead>WhatsApp</TableHead>
                  <TableHead>Motor</TableHead>
                  <TableHead>Sumber</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Follow-up</TableHead>
                  {isAdmin && <TableHead>Sales</TableHead>}
                  <TableHead>Dibuat</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads
                  .filter((l) =>
                    !search ||
                    l.name.toLowerCase().includes(search.toLowerCase()) ||
                    l.phone.includes(search) ||
                    (l.city || '').toLowerCase().includes(search.toLowerCase())
                  )
                  .map((lead) => {
                    const isOverdue = lead.follow_up_at && lead.follow_up_at < todayStr && lead.status !== 'deal' && lead.status !== 'lost' && lead.status !== 'converted';
                    const isToday = lead.follow_up_at === todayStr;
                    return (
                      <TableRow key={lead.id} className="hover:bg-neutral-50">
                        <TableCell>
                          <Link href={`/admin/leads/${lead.id}`}>
                            <p className="font-medium text-neutral-900 hover:text-red-600">{lead.name}</p>
                          </Link>
                          {lead.email && <p className="text-xs text-neutral-500">{lead.email}</p>}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-neutral-500">{lead.phone}</span>
                            <a href={`https://wa.me/${lead.phone.replace(/^0/, '62')}?text=${encodeURIComponent(`Halo ${lead.name}`)}`} target="_blank" rel="noopener noreferrer" className="text-green-600">
                              <MessageCircle className="h-3 w-3" />
                            </a>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-neutral-600">{lead.motor_name || '-'}</TableCell>
                        <TableCell className="text-sm text-neutral-600">
                          {lead.source_page
                            ? ({ homepage: 'Homepage', pekalongan: 'Pekalongan', pemalang: 'Pemalang', batang: 'Batang', credit_simulator: 'Simulator', vehicle_detail: 'Detail Motor', catalog: 'Katalog' } as Record<string,string>)[lead.source_page] || lead.source_page
                            : lead.source || '-'}
                          {lead.source_medium ? <span className="ml-1 text-xs text-neutral-400">({lead.source_medium})</span> : null}
                        </TableCell>
                        <TableCell>
                          <select
                            value={lead.status}
                            onChange={(e) => handleStatusChange(lead.id, e.target.value)}
                            className={cn('h-8 w-full rounded-md border-0 px-2 text-xs font-medium', leadStatusLabels[lead.status]?.color || 'bg-neutral-100')}
                          >
                            {statusOptions.map((s) => <option key={s} value={s}>{leadStatusLabels[s].label}</option>)}
                          </select>
                        </TableCell>
                        <TableCell>
                          <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', priorityLabels[lead.priority]?.color || 'bg-neutral-100')}>
                            {priorityLabels[lead.priority]?.label || lead.priority}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs">
                          {lead.follow_up_at ? (
                            <div className={cn('flex items-center gap-1', isOverdue ? 'text-red-600' : isToday ? 'text-orange-600' : 'text-neutral-500')}>
                              {isOverdue && <AlertTriangle className="h-3 w-3" />}
                              <Calendar className="h-3 w-3" />
                              {new Date(lead.follow_up_at).toLocaleDateString('id-ID')}
                            </div>
                          ) : '-'}
                        </TableCell>
                        {isAdmin && (
                          <TableCell>
                            <select value={lead.assigned_to || ''} onChange={(e) => handleAssign(lead.id, e.target.value)} className="h-8 rounded-md border border-neutral-200 bg-white px-2 text-xs">
                              <option value="">Unassigned</option>
                              {salesReps.map((rep) => <option key={rep.id} value={rep.id}>{rep.full_name}</option>)}
                            </select>
                          </TableCell>
                        )}
                        <TableCell className="text-xs text-neutral-500">{formatDate(lead.created_at)}</TableCell>
                        <TableCell className="text-right">
                          <Link href={`/admin/leads/${lead.id}`}>
                            <Button variant="ghost" size="sm">
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-neutral-500">
                {totalCount > 0 ? `${page * pageSize + 1}-${Math.min((page + 1) * pageSize, totalCount)} dari ${totalCount}` : '0 hasil'}
              </span>
              <Button variant="outline" size="sm" disabled={(page + 1) * pageSize >= totalCount} onClick={() => setPage(page + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-neutral-500">Per halaman:</span>
              <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }} className="admin-select w-20">
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>
        </>
      )}

      <Dialog open={showAddForm} onOpenChange={setShowAddForm}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader><DialogTitle>Tambah Lead</DialogTitle></DialogHeader>
          <LeadForm
            salesReps={salesReps}
            onSaved={() => { setShowAddForm(false); fetchLeads(); fetchKpis(); }}
            onCancel={() => setShowAddForm(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
