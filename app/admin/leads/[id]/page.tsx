'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { supabase, Lead, Visit, LeadEvent, Profile, FollowUp } from '@/lib/supabase-client';
import { useAuth } from '@/lib/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  MessageCircle, Phone, CalendarPlus, ArrowLeft, User, MapPin, Bike,
  Clock, Plus, History, Loader2, PhoneCall, CheckCircle, UserCheck,
} from 'lucide-react';
import Link from 'next/link';
import { leadStatusLabels, formatDate, timeAgo } from '@/components/admin/admin-ui';
import { useRouter } from 'next/navigation';
import { getSafeError } from '@/lib/validation';
import { cn } from '@/lib/utils';

const eventTypeLabels: Record<string, string> = {
  LEAD_CREATED: 'Lead Dibuat', CONTACTED: 'Dihubungi', WHATSAPP_SENT: 'WhatsApp Dikirim',
  PHONE_CALL: 'Telepon', FOLLOW_UP: 'Follow Up', VISIT_SCHEDULED: 'Kunjungan Dijadwalkan',
  STATUS_CHANGED: 'Status Berubah', NOTE_ADDED: 'Catatan Ditambahkan',
  WON: 'Deal', LOST: 'Lost', LEAD_ASSIGNED: 'Lead Ditugaskan',
};

const visitTypes: Record<string, string> = {
  showroom_visit: 'Showroom Visit', test_ride: 'Test Ride', home_visit: 'Home Visit',
  document_check: 'Document Check', delivery: 'Delivery',
};

export default function AdminLeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { profile, isAdmin } = useAuth();
  const [lead, setLead] = useState<Lead | null>(null);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [events, setEvents] = useState<LeadEvent[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [salesReps, setSalesReps] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showVisitForm, setShowVisitForm] = useState(false);
  const [showFollowUpForm, setShowFollowUpForm] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [converting, setConverting] = useState(false);
  const [convertError, setConvertError] = useState<string | null>(null);
  const [convertSuccess, setConvertSuccess] = useState<string | null>(null);
  const router = useRouter();

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [{ data: leadData }, { data: visitData }, { data: eventData }, { data: fuData }] = await Promise.all([
      supabase.from('leads').select('*').eq('id', id).maybeSingle(),
      supabase.from('visits').select('*').eq('lead_id', id).order('visit_date', { ascending: false }),
      supabase.from('lead_events').select('*').eq('lead_id', id).order('created_at', { ascending: false }),
      supabase.from('follow_ups').select('*').eq('lead_id', id).order('created_at', { ascending: false }),
    ]);
    if (leadData) setLead(leadData as Lead);
    if (visitData) setVisits(visitData as Visit[]);
    if (eventData) setEvents(eventData as LeadEvent[]);
    if (fuData) setFollowUps(fuData as FollowUp[]);
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (isAdmin) {
      supabase.from('profiles').select('*').eq('role', 'sales').eq('status', 'active').then(({ data }) => {
        if (data) setSalesReps(data as Profile[]);
      });
    }
  }, [isAdmin]);

  const handleStatusChange = async (status: string) => {
    if (!lead) return;
    await supabase.rpc('change_lead_status', { p_lead_id: lead.id, p_new_status: status, p_note: null });
    setLead({ ...lead, status });
    fetchData();
  };

  const handleAssign = async (assignedTo: string) => {
    if (!lead) return;
    await supabase.rpc('assign_lead', { p_lead_id: lead.id, p_assigned_to: assignedTo || null });
    setLead({ ...lead, assigned_to: assignedTo || null });
    fetchData();
  };

  const handleAddNote = async () => {
    if (!lead || !noteText.trim()) return;
    await supabase.from('lead_events').insert({
      lead_id: lead.id, user_id: profile?.id, event_type: 'NOTE_ADDED', note: noteText.trim(),
    });
    setNoteText('');
    fetchData();
  };

  const handleConvert = async () => {
    if (!lead) return;
    setConverting(true);
    setConvertError(null);
    setConvertSuccess(null);
    const { data, error } = await supabase.rpc('convert_lead_to_customer', { p_lead_id: lead.id });
    if (error) {
      const msg = error.message || '';
      if (msg.includes('ALREADY_CONVERTED')) {
        const parts = msg.split('|');
        setConvertError('Lead ini sudah dikonversi menjadi customer.');
        if (parts[1]) setConvertSuccess(parts[1]);
      } else {
        setConvertError(getSafeError(error));
      }
      setConverting(false);
      return;
    }
    setConverting(false);
    setConvertSuccess(data as string);
    fetchData();
  };

  const handleSetFollowUp = async () => {
    if (!lead || !followUpDate) return;
    await supabase.rpc('create_follow_up', {
      p_lead_id: lead.id, p_type: 'call', p_note: null, p_scheduled_at: followUpDate,
    });
    setLead({ ...lead, follow_up_at: followUpDate, status: 'follow_up' });
    setFollowUpDate('');
    fetchData();
  };

  const waNumber = lead?.phone.replace(/^0/, '62') || '';
  const waLink = `https://wa.me/${waNumber}?text=${encodeURIComponent(
    `Halo ${lead?.name}, terima kasih telah menghubungi kami mengenai ${lead?.motor_name || 'motor Honda'}. Apakah ada yang bisa saya bantu?`
  )}`;

  if (loading) return (
    <div className="flex h-40 items-center justify-center text-neutral-400">
      <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Memuat...
    </div>
  );

  if (!lead) return <div className="text-center text-neutral-400">Lead tidak ditemukan.</div>;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link href="/admin/leads" className="text-neutral-500 hover:text-neutral-900">Lead Customer</Link>
        <span className="text-neutral-300">/</span>
        <span className="font-medium text-neutral-900">{lead.name}</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {/* Lead Info */}
          <div className="admin-card p-6">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-xl font-bold text-neutral-900">{lead.name}</h1>
                <p className="mt-1 text-sm text-neutral-500">Diterima: {formatDate(lead.created_at, { withTime: true })}</p>
              </div>
              <span className={cn('rounded-full px-3 py-1 text-xs font-medium', leadStatusLabels[lead.status]?.color || 'bg-neutral-100')}>
                {leadStatusLabels[lead.status]?.label || lead.status}
              </span>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-neutral-400" /><span>{lead.phone}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-neutral-400" /><span>{lead.city || '-'}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Bike className="h-4 w-4 text-neutral-400" /><span>{lead.motor_name || '-'}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-neutral-400" /><span>Sumber: {lead.source || '-'}</span>
              </div>
            </div>

            {(lead.dp || lead.tenor || lead.installment) && (
              <div className="mt-4 rounded-lg border border-neutral-100 bg-neutral-50 p-4">
                <h3 className="text-sm font-semibold text-neutral-700">Pilihan Pembiayaan</h3>
                <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
                  <div><p className="text-xs text-neutral-500">DP</p><p className="font-medium">{lead.dp ? `Rp${lead.dp.toLocaleString('id-ID')}` : '-'}</p></div>
                  <div><p className="text-xs text-neutral-500">Tenor</p><p className="font-medium">{lead.tenor ? `${lead.tenor}x` : '-'}</p></div>
                  <div><p className="text-xs text-neutral-500">Cicilan</p><p className="font-medium">{lead.installment ? `Rp${lead.installment.toLocaleString('id-ID')}` : '-'}</p></div>
                </div>
              </div>
            )}

            {lead.message && (
              <div className="mt-4">
                <h3 className="text-sm font-semibold text-neutral-700">Pesan Customer</h3>
                <p className="mt-1 text-sm text-neutral-600">{lead.message}</p>
              </div>
            )}
          </div>

          {/* Timeline */}
          <div className="admin-card p-6">
            <h2 className="flex items-center gap-2 text-base font-bold text-neutral-900">
              <History className="h-4 w-4" /> Timeline Aktivitas
            </h2>
            {events.length === 0 ? (
              <p className="mt-4 text-sm text-neutral-400">Belum ada aktivitas.</p>
            ) : (
              <div className="mt-4 space-y-1">
                {events.map((event, i) => {
                  const isToday = new Date(event.created_at).toDateString() === new Date().toDateString();
                  const isYesterday = new Date(event.created_at).toDateString() === new Date(Date.now() - 86400000).toDateString();
                  const showDateHeader = i === 0 ||
                    new Date(events[i - 1].created_at).toDateString() !== new Date(event.created_at).toDateString();
                  return (
                    <div key={event.id}>
                      {showDateHeader && (
                        <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wider text-neutral-400 first:mt-0">
                          {isToday ? 'Hari Ini' : isYesterday ? 'Kemarin' : formatDate(event.created_at)}
                        </p>
                      )}
                      <div className="flex gap-3 py-1">
                        <div className="flex flex-col items-center">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-red-50 text-xs font-bold text-red-600">
                            {event.event_type.charAt(0)}
                          </div>
                          {i < events.length - 1 && <div className="mt-1 w-px flex-1 bg-neutral-200" />}
                        </div>
                        <div className="pb-3">
                          <p className="text-sm font-medium text-neutral-900">{eventTypeLabels[event.event_type] || event.event_type}</p>
                          {event.note && <p className="mt-0.5 text-sm text-neutral-600">{event.note}</p>}
                          <p className="mt-0.5 text-xs text-neutral-400">{new Date(event.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Add Note */}
          <div className="admin-card p-6">
            <h2 className="text-base font-bold text-neutral-900">Tambah Catatan</h2>
            <div className="mt-3 flex gap-2">
              <Textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Tulis catatan tentang lead ini..." rows={2} />
            </div>
            <Button size="sm" className="mt-2 bg-red-600 hover:bg-red-700 text-white" onClick={handleAddNote} disabled={!noteText.trim()}>
              <Plus className="mr-1 h-4 w-4" /> Tambah Catatan
            </Button>
          </div>

          {/* Visits */}
          <div className="admin-card p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-neutral-900">Jadwal Kunjungan</h2>
              <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white" onClick={() => setShowVisitForm(true)}>
                <CalendarPlus className="mr-1 h-4 w-4" /> Jadwalkan
              </Button>
            </div>
            {visits.length === 0 ? (
              <p className="mt-4 text-sm text-neutral-400">Belum ada jadwal kunjungan.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {visits.map((v) => (
                  <div key={v.id} className="flex items-center justify-between border-b border-neutral-100 pb-3 last:border-0">
                    <div>
                      <p className="text-sm font-medium">{formatDate(v.visit_date)} • {v.visit_time}</p>
                      <p className="text-xs text-neutral-500">{visitTypes[v.visit_type] || v.visit_type}</p>
                    </div>
                    <span className={cn('rounded-full px-2 py-1 text-xs font-medium',
                      v.status === 'scheduled' ? 'bg-blue-100 text-blue-700' :
                      v.status === 'completed' ? 'bg-green-100 text-green-700' :
                      v.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                      'bg-neutral-100 text-neutral-700')}>
                      {v.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="admin-card p-6">
            <h2 className="text-sm font-bold text-neutral-900">Aksi</h2>
            {convertError && (
              <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {convertError}
                {convertSuccess && (
                  <Link href={`/admin/customers/${convertSuccess}`} className="mt-2 block">
                    <Button size="sm" variant="outline" className="border-red-300 text-red-700">Lihat Customer</Button>
                  </Link>
                )}
              </div>
            )}
            {convertSuccess && !convertError && (
              <div className="mb-3 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                Lead berhasil dikonversi menjadi Customer.
                <Link href={`/admin/customers/${convertSuccess}`} className="mt-2 block">
                  <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white">Lihat Customer</Button>
                </Link>
              </div>
            )}
            <div className="mt-4 space-y-2">
              {lead.status !== 'converted' && lead.status !== 'deal' && (
                <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white" onClick={handleConvert} disabled={converting}>
                  {converting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Mengkonversi...</> : <><UserCheck className="mr-2 h-4 w-4" /> Convert to Customer</>}
                </Button>
              )}
              {lead.customer_id && lead.status === 'converted' && (
                <Link href={`/admin/customers/${lead.customer_id}`} className="block">
                  <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                    <UserCheck className="mr-2 h-4 w-4" /> Lihat Customer
                  </Button>
                </Link>
              )}
              <a href={waLink} target="_blank" rel="noopener noreferrer" className="block">
                <Button className="w-full bg-green-600 hover:bg-green-700 text-white">
                  <MessageCircle className="mr-2 h-4 w-4" /> Chat WhatsApp
                </Button>
              </a>
              <a href={`tel:${lead.phone}`} className="block">
                <Button variant="outline" className="w-full"><Phone className="mr-2 h-4 w-4" /> Telepon</Button>
              </a>
              <Button variant="outline" className="w-full" onClick={() => setShowVisitForm(true)}>
                <CalendarPlus className="mr-2 h-4 w-4" /> Jadwalkan Kunjungan
              </Button>
              <Button variant="outline" className="w-full" onClick={() => setShowFollowUpForm(true)}>
                <PhoneCall className="mr-2 h-4 w-4" /> Tambah Follow-up
              </Button>
            </div>
          </div>

          <div className="admin-card p-6">
            <h2 className="text-sm font-bold text-neutral-900">Ubah Status</h2>
            <select value={lead.status} onChange={(e) => handleStatusChange(e.target.value)} className="admin-select mt-3">
              {Object.keys(leadStatusLabels).map((s) => (
                <option key={s} value={s}>{leadStatusLabels[s].label}</option>
              ))}
            </select>
          </div>

          {isAdmin && (
            <div className="admin-card p-6">
              <h2 className="text-sm font-bold text-neutral-900">Assign Sales</h2>
              <select value={lead.assigned_to || ''} onChange={(e) => handleAssign(e.target.value)} className="admin-select mt-3">
                <option value="">Unassigned</option>
                {salesReps.map((rep) => (
                  <option key={rep.id} value={rep.id}>{rep.full_name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="admin-card p-6">
            <h2 className="flex items-center gap-2 text-sm font-bold text-neutral-900">
              <Clock className="h-4 w-4" /> Follow-up
            </h2>
            {lead.follow_up_at && (
              <p className="mt-2 text-sm text-neutral-600">
                Dijadwalkan: <span className="font-medium">{formatDate(lead.follow_up_at)}</span>
              </p>
            )}
            <div className="mt-3 flex gap-2">
              <Input type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} className="flex-1" />
              <Button size="sm" onClick={handleSetFollowUp} disabled={!followUpDate}>Set</Button>
            </div>
            {followUps.length > 0 && (
              <div className="mt-4 space-y-2 border-t border-neutral-100 pt-3">
                {followUps.slice(0, 5).map((fu) => (
                  <div key={fu.id} className="flex items-center gap-2 text-xs">
                    <CheckCircle className={cn('h-3 w-3', fu.result === 'completed' ? 'text-green-500' : 'text-neutral-300')} />
                    <span className="text-neutral-600">{fu.type}</span>
                    <span className="text-neutral-400">{formatDate(fu.scheduled_at)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Visit Form Dialog */}
      <Dialog open={showVisitForm} onOpenChange={setShowVisitForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Jadwalkan Kunjungan</DialogTitle></DialogHeader>
          <VisitForm lead={lead} salesId={profile?.id || null} onSaved={() => { setShowVisitForm(false); fetchData(); }} />
        </DialogContent>
      </Dialog>

      {/* Follow-up Form Dialog */}
      <Dialog open={showFollowUpForm} onOpenChange={setShowFollowUpForm}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Tambah Follow-up</DialogTitle></DialogHeader>
          <FollowUpForm leadId={lead.id} onSaved={() => { setShowFollowUpForm(false); fetchData(); }} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function VisitForm({ lead, salesId, onSaved }: { lead: Lead; salesId: string | null; onSaved: () => void }) {
  const [visitDate, setVisitDate] = useState('');
  const [visitTime, setVisitTime] = useState('10:00');
  const [visitType, setVisitType] = useState('showroom_visit');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from('visits').insert({
      lead_id: lead.id, customer_name: lead.name, customer_phone: lead.phone,
      motor_name: lead.motor_name, product_id: lead.product_id,
      visit_date: visitDate, visit_time: visitTime, visit_type: visitType,
      notes: notes || null, sales_id: salesId, status: 'scheduled',
    });
    if (insertError) { setError(getSafeError(insertError)); setSaving(false); return; }
    await supabase.rpc('change_lead_status', { p_lead_id: lead.id, p_new_status: 'visit_scheduled', p_note: `Kunjungan dijadwalkan: ${formatDate(visitDate)} ${visitTime}` });
    setSaving(false);
    onSaved();
  };

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div className="rounded-lg border border-neutral-100 bg-neutral-50 p-3 text-sm">
        <p className="font-medium">{lead.name} • {lead.phone}</p>
        <p className="text-xs text-neutral-500">{lead.motor_name || '-'}</p>
      </div>
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
        {saving ? 'Menyimpan...' : 'Jadwalkan'}
      </Button>
    </form>
  );
}

function FollowUpForm({ leadId, onSaved }: { leadId: string; onSaved: () => void }) {
  const [type, setType] = useState('call');
  const [scheduledAt, setScheduledAt] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await supabase.rpc('create_follow_up', {
      p_lead_id: leadId, p_type: type, p_note: note || null, p_scheduled_at: scheduledAt,
    });
    setSaving(false);
    onSaved();
  };

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div>
        <label className="admin-label">Tipe Follow-up</label>
        <select value={type} onChange={(e) => setType(e.target.value)} className="admin-select mt-1.5">
          <option value="call">Telepon</option><option value="whatsapp">WhatsApp</option>
          <option value="visit">Kunjungan</option><option value="email">Email</option>
          <option value="meeting">Meeting</option><option value="other">Lainnya</option>
        </select>
      </div>
      <div><label className="admin-label">Tanggal *</label><Input type="date" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} required className="mt-1.5" /></div>
      <div><label className="admin-label">Catatan</label><Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="mt-1.5" /></div>
      <Button type="submit" disabled={saving || !scheduledAt} className="w-full bg-red-600 hover:bg-red-700 text-white">
        {saving ? 'Menyimpan...' : 'Simpan'}
      </Button>
    </form>
  );
}
