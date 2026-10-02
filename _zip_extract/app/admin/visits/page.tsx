'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase, Visit } from '@/lib/supabase-client';
import { useAuth } from '@/lib/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Plus, CalendarDays, MessageCircle, Pencil, Trash2, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { getSafeError } from '@/lib/validation';
import { PageHeader, LoadingState, EmptyState, formatDate } from '@/components/admin/admin-ui';
import { cn } from '@/lib/utils';

const visitTypeLabels: Record<string, string> = {
  showroom_visit: 'Showroom Visit', test_ride: 'Test Ride', home_visit: 'Home Visit',
  document_check: 'Document Check', delivery: 'Delivery',
};

const visitStatusLabels: Record<string, { label: string; color: string }> = {
  scheduled: { label: 'Dijadwalkan', color: 'bg-blue-100 text-blue-700' },
  confirmed: { label: 'Dikonfirmasi', color: 'bg-cyan-100 text-cyan-700' },
  completed: { label: 'Selesai', color: 'bg-green-100 text-green-700' },
  rescheduled: { label: 'Reschedule', color: 'bg-orange-100 text-orange-700' },
  cancelled: { label: 'Dibatalkan', color: 'bg-red-100 text-red-700' },
  no_show: { label: 'Tidak Hadir', color: 'bg-neutral-100 text-neutral-700' },
};

const tabs = [
  { key: 'all', label: 'Semua' },
  { key: 'today', label: 'Hari Ini' },
  { key: 'upcoming', label: 'Mendatang' },
  { key: 'completed', label: 'Selesai' },
  { key: 'cancelled', label: 'Dibatalkan' },
];

export default function AdminVisitsPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Visit | null>(null);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 20;

  const fetchVisits = useCallback(async () => {
    setLoading(true);
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    let query = supabase.from('visits').select('*', { count: 'exact' }).order('visit_date', { ascending: true });
    if (!isAdmin && profile?.id) {
      query = query.eq('sales_id', profile.id);
    }

    switch (activeTab) {
      case 'today': query = query.eq('visit_date', todayStr).neq('status', 'cancelled'); break;
      case 'upcoming': query = query.gte('visit_date', todayStr).eq('status', 'scheduled'); break;
      case 'completed': query = query.eq('status', 'completed'); break;
      case 'cancelled': query = query.eq('status', 'cancelled'); break;
    }

    const { data, count, error } = await query.range(page * pageSize, (page + 1) * pageSize - 1);
    if (error) getSafeError(error);
    if (data) setVisits(data as Visit[]);
    setTotalCount(count || 0);
    setLoading(false);
  }, [activeTab, page, isAdmin, profile?.id]);

  useEffect(() => { fetchVisits(); }, [fetchVisits]);

  const handleStatusChange = async (id: string, status: string, oldStatus: string) => {
    const { error } = await supabase.from('visits').update({ status }).eq('id', id);
    if (error) return;
    if (oldStatus !== status) {
      await supabase.from('visit_history').insert({
        visit_id: id, old_status: oldStatus, new_status: status,
        reason: 'Status update', changed_by: profile?.id,
      });
    }
    setVisits((prev) => prev.map((v) => (v.id === id ? { ...v, status } : v)));
  };

  const handleDelete = async (id: string) => {
    await supabase.from('visits').delete().eq('id', id);
    fetchVisits();
  };

  const buildReminderLink = (visit: Visit) => {
    const msg = `Halo Pak/Bu ${visit.customer_name},\n\nKami mengingatkan jadwal kunjungan Anda:\n\nMotor: ${visit.motor_name || '-'}\nTanggal: ${formatDate(visit.visit_date)}\nJam: ${visit.visit_time} WIB\n\nKami tunggu kedatangannya.\n\nTerima kasih.`;
    return `https://wa.me/${visit.customer_phone.replace(/^0/, '62')}?text=${encodeURIComponent(msg)}`;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={CalendarDays}
        title="Jadwal Kunjungan"
        description="Kelola jadwal kunjungan customer ke showroom."
        actions={
          <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={() => { setEditing(null); setShowForm(true); }}>
            <Plus className="mr-1 h-4 w-4" /> Buat Jadwal
          </Button>
        }
      />

      <div className="flex flex-wrap gap-1 rounded-lg border border-neutral-200 bg-white p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); setPage(0); }}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              activeTab === tab.key ? 'bg-red-600 text-white' : 'text-neutral-600 hover:bg-neutral-100'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingState label="Memuat kunjungan..." />
      ) : visits.length === 0 ? (
        <EmptyState icon={CalendarDays} title="Belum ada jadwal kunjungan" description="Jadwalkan kunjungan customer dari halaman ini atau detail lead." />
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Motor</TableHead>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Jam</TableHead>
                  <TableHead>Jenis</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visits.map((visit) => (
                  <TableRow key={visit.id} className="hover:bg-neutral-50">
                    <TableCell>
                      <p className="font-medium text-neutral-900">{visit.customer_name}</p>
                      <p className="text-xs text-neutral-500">{visit.customer_phone}</p>
                    </TableCell>
                    <TableCell className="text-sm text-neutral-600">{visit.motor_name || '-'}</TableCell>
                    <TableCell className="text-sm text-neutral-600">{formatDate(visit.visit_date)}</TableCell>
                    <TableCell className="text-sm text-neutral-600">{visit.visit_time}</TableCell>
                    <TableCell className="text-sm text-neutral-600">{visitTypeLabels[visit.visit_type] || visit.visit_type}</TableCell>
                    <TableCell>
                      <select
                        value={visit.status}
                        onChange={(e) => handleStatusChange(visit.id, e.target.value, visit.status)}
                        className={cn('h-8 w-full rounded-md border-0 px-2 text-xs font-medium', visitStatusLabels[visit.status]?.color || 'bg-neutral-100')}
                      >
                        {Object.keys(visitStatusLabels).map((s) => (
                          <option key={s} value={s}>{visitStatusLabels[s].label}</option>
                        ))}
                      </select>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <a href={buildReminderLink(visit)} target="_blank" rel="noopener noreferrer">
                          <Button variant="ghost" size="sm" title="Reminder WhatsApp">
                            <MessageCircle className="h-4 w-4 text-green-600" />
                          </Button>
                        </a>
                        <Button variant="ghost" size="sm" onClick={() => { setEditing(visit); setShowForm(true); }} title="Edit / Reschedule">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm"><Trash2 className="h-4 w-4" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Hapus jadwal kunjungan?</AlertDialogTitle>
                              <AlertDialogDescription>Jadwal akan dihapus permanen.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Batal</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(visit.id)}>Ya, Hapus</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-neutral-500">
                {page * pageSize + 1}-{Math.min((page + 1) * pageSize, totalCount)} dari {totalCount}
              </span>
              <Button variant="outline" size="sm" disabled={(page + 1) * pageSize >= totalCount} onClick={() => setPage(page + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Kunjungan' : 'Buat Jadwal Kunjungan'}</DialogTitle>
          </DialogHeader>
          <VisitForm visit={editing} salesId={profile?.id || null} onSaved={() => { setShowForm(false); fetchVisits(); }} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function VisitForm({ visit, salesId, onSaved }: { visit: Visit | null; salesId: string | null; onSaved: () => void }) {
  const [customerName, setCustomerName] = useState(visit?.customer_name || '');
  const [customerPhone, setCustomerPhone] = useState(visit?.customer_phone || '');
  const [motorName, setMotorName] = useState(visit?.motor_name || '');
  const [visitDate, setVisitDate] = useState(visit?.visit_date || '');
  const [visitTime, setVisitTime] = useState(visit?.visit_time || '10:00');
  const [visitType, setVisitType] = useState(visit?.visit_type || 'showroom_visit');
  const [notes, setNotes] = useState(visit?.notes || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload = {
      customer_name: customerName, customer_phone: customerPhone,
      motor_name: motorName || null, visit_date: visitDate, visit_time: visitTime,
      visit_type: visitType, notes: notes || null, sales_id: salesId,
      status: visit?.status || 'scheduled',
    };

    let result;
    if (visit) {
      if (visit.visit_date !== visitDate || visit.visit_time !== visitTime) {
        await supabase.from('visit_history').insert({
          visit_id: visit.id, old_date: visit.visit_date, old_time: visit.visit_time,
          new_date: visitDate, new_time: visitTime, reason: 'Reschedule', changed_by: salesId,
        });
      }
      result = await supabase.from('visits').update(payload).eq('id', visit.id);
    } else {
      result = await supabase.from('visits').insert(payload);
    }
    setSaving(false);
    if (result.error) setError(getSafeError(result.error));
    else onSaved();
  };

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div><label className="admin-label">Nama Customer</label><Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} required className="mt-1.5" /></div>
        <div><label className="admin-label">No. WhatsApp</label><Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} required className="mt-1.5" /></div>
      </div>
      <div><label className="admin-label">Motor</label><Input value={motorName} onChange={(e) => setMotorName(e.target.value)} placeholder="Opsional" className="mt-1.5" /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="admin-label">Tanggal</label><Input type="date" value={visitDate} onChange={(e) => setVisitDate(e.target.value)} required className="mt-1.5" /></div>
        <div><label className="admin-label">Jam</label><Input type="time" value={visitTime} onChange={(e) => setVisitTime(e.target.value)} required className="mt-1.5" /></div>
      </div>
      <div>
        <label className="admin-label">Jenis Kunjungan</label>
        <select value={visitType} onChange={(e) => setVisitType(e.target.value)} className="admin-select mt-1.5">
          <option value="showroom_visit">Showroom Visit</option><option value="test_ride">Test Ride</option>
          <option value="home_visit">Home Visit</option><option value="document_check">Document Check</option>
          <option value="delivery">Delivery</option>
        </select>
      </div>
      <div><label className="admin-label">Catatan</label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="mt-1.5" /></div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={saving} className="w-full bg-red-600 hover:bg-red-700 text-white">
        {saving ? 'Menyimpan...' : 'Simpan'}
      </Button>
    </form>
  );
}
