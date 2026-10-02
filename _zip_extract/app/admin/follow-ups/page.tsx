'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase, FollowUp, Lead, Profile } from '@/lib/supabase-client';
import { useAuth } from '@/lib/auth-provider';
import { PageHeader, LoadingState, EmptyState } from '@/components/admin/admin-ui';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  PhoneCall, MessageCircle, ChevronRight, CheckCircle, AlertTriangle,
  Calendar, Loader2, Plus,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

type FollowUpWithLead = FollowUp & { leads?: Pick<Lead, 'id' | 'name' | 'phone' | 'motor_name'> };

const typeLabels: Record<string, string> = {
  call: 'Telepon', whatsapp: 'WhatsApp', visit: 'Kunjungan', email: 'Email', meeting: 'Meeting', other: 'Lainnya',
};

const resultLabels: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-700' },
  completed: { label: 'Selesai', color: 'bg-green-100 text-green-700' },
  no_answer: { label: 'Tidak Dijawab', color: 'bg-neutral-100 text-neutral-700' },
  rescheduled: { label: 'Reschedule', color: 'bg-blue-100 text-blue-700' },
  cancelled: { label: 'Dibatalkan', color: 'bg-red-100 text-red-700' },
};

const tabs = [
  { key: 'today', label: 'Hari Ini' },
  { key: 'overdue', label: 'Terlambat' },
  { key: 'tomorrow', label: 'Besok' },
  { key: 'week', label: 'Minggu Ini' },
  { key: 'completed', label: 'Selesai' },
];

export default function FollowUpsPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const [loading, setLoading] = useState(true);
  const [followUps, setFollowUps] = useState<FollowUpWithLead[]>([]);
  const [activeTab, setActiveTab] = useState('today');
  const [completingId, setCompletingId] = useState<string | null>(null);

  const fetchFollowUps = useCallback(async () => {
    setLoading(true);
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const tomorrow = new Date(now.getTime() + 86400000).toISOString().split('T')[0];
    const weekEnd = new Date(now.getTime() + 7 * 86400000).toISOString().split('T')[0];

    let query = supabase.from('follow_ups').select('*,leads(id,name,phone,motor_name)');
    if (!isAdmin && profile?.id) {
      query = query.eq('user_id', profile.id);
    }

    switch (activeTab) {
      case 'today':
        query = query.eq('scheduled_at', todayStr).eq('result', 'pending');
        break;
      case 'overdue':
        query = query.lt('scheduled_at', todayStr).eq('result', 'pending');
        break;
      case 'tomorrow':
        query = query.eq('scheduled_at', tomorrow).eq('result', 'pending');
        break;
      case 'week':
        query = query.gte('scheduled_at', todayStr).lte('scheduled_at', weekEnd).eq('result', 'pending');
        break;
      case 'completed':
        query = query.neq('result', 'pending');
        break;
    }

    const { data } = await query.order('scheduled_at', { ascending: true });
    setFollowUps((data || []) as FollowUpWithLead[]);
    setLoading(false);
  }, [activeTab, isAdmin, profile?.id]);

  useEffect(() => { fetchFollowUps(); }, [fetchFollowUps]);

  const handleComplete = async (id: string, result: string) => {
    setCompletingId(id);
    await supabase.rpc('complete_follow_up', { p_follow_up_id: id, p_result: result, p_note: null });
    setCompletingId(null);
    fetchFollowUps();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={PhoneCall}
        title="Follow-up"
        description="Kelola aktivitas follow-up customer Anda."
      />

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 rounded-lg border border-neutral-200 bg-white p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              activeTab === tab.key
                ? 'bg-red-600 text-white'
                : 'text-neutral-600 hover:bg-neutral-100'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingState label="Memuat follow-up..." />
      ) : followUps.length === 0 ? (
        <EmptyState
          icon={CheckCircle}
          title="Tidak ada follow-up"
          description={activeTab === 'today' ? 'Tidak ada follow-up yang dijadwalkan hari ini.' : 'Tidak ada data pada kategori ini.'}
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Motor</TableHead>
                <TableHead>Tipe</TableHead>
                <TableHead>Jadwal</TableHead>
                <TableHead>Hasil</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {followUps.map((fu) => {
                const isOverdue = fu.scheduled_at && new Date(fu.scheduled_at) < new Date(new Date().toISOString().split('T')[0]) && fu.result === 'pending';
                return (
                  <TableRow key={fu.id}>
                    <TableCell>
                      <p className="font-medium text-neutral-900">{fu.leads?.name || 'Unknown'}</p>
                      <p className="text-xs text-neutral-500">{fu.leads?.phone}</p>
                    </TableCell>
                    <TableCell className="text-sm text-neutral-600">{fu.leads?.motor_name || '-'}</TableCell>
                    <TableCell>
                      <span className="text-xs font-medium text-neutral-600">{typeLabels[fu.type] || fu.type}</span>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className={cn('flex items-center gap-1', isOverdue ? 'text-red-600' : 'text-neutral-600')}>
                        {isOverdue && <AlertTriangle className="h-3 w-3" />}
                        <Calendar className="h-3 w-3" />
                        {fu.scheduled_at ? new Date(fu.scheduled_at).toLocaleDateString('id-ID') : '-'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', resultLabels[fu.result]?.color || 'bg-neutral-100')}>
                        {resultLabels[fu.result]?.label || fu.result}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {fu.result === 'pending' && (
                          <>
                            <a
                              href={`https://wa.me/${(fu.leads?.phone || '').replace(/^0/, '62')}?text=${encodeURIComponent(`Halo ${fu.leads?.name || ''}`)}`}
                              target="_blank" rel="noopener noreferrer"
                              className="rounded-md p-1.5 text-green-600 hover:bg-green-50"
                            >
                              <MessageCircle className="h-4 w-4" />
                            </a>
                            <button
                              onClick={() => handleComplete(fu.id, 'completed')}
                              disabled={completingId === fu.id}
                              className="rounded-md p-1.5 text-green-600 hover:bg-green-50"
                              title="Selesai"
                            >
                              {completingId === fu.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                            </button>
                          </>
                        )}
                        {fu.lead_id && (
                          <Link href={`/admin/leads/${fu.lead_id}`} className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100">
                            <ChevronRight className="h-4 w-4" />
                          </Link>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
