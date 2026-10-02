'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { supabase, Customer, Profile, Product, FollowUp, Visit, Deal, Lead, LeadEvent, CreditApplication, Spk, CustomerDocument, Delivery } from '@/lib/supabase-client';
import { useAuth } from '@/lib/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  MessageCircle, Phone, User, MapPin, Bike,
  Clock, Plus, Loader2, PhoneCall, Pencil,
  Archive, Mail, Home, ChevronRight,
  CreditCard, ClipboardList, FileText, Truck,
} from 'lucide-react';
import Link from 'next/link';
import {
  customerStatusLabels, formatDate,
  SectionCard, StatusBadge,
  creditStatusLabels, spkStatusLabels, deliveryStatusLabels, documentStatusLabels, formatCurrency,
} from '@/components/admin/admin-ui';
import { CustomerForm } from '@/components/admin/customer-form';
import { getSafeError } from '@/lib/validation';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const sourceLabels: Record<string, string> = {
  walk_in: 'Walk-in', website: 'Website', whatsapp: 'WhatsApp',
  instagram: 'Instagram', facebook: 'Facebook', event: 'Event',
  referral: 'Referral', phone: 'Telepon', other: 'Lainnya', manual: 'Manual',
};

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

const visitTypes: Record<string, string> = {
  showroom_visit: 'Showroom Visit', test_ride: 'Test Ride', home_visit: 'Home Visit',
  document_check: 'Document Check', delivery: 'Delivery',
};

type TimelineItem = {
  id: string;
  date: string;
  title: string;
  description?: string | null;
  type: string;
};

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [salesReps, setSalesReps] = useState<Profile[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [leadEvents, setLeadEvents] = useState<LeadEvent[]>([]);
  const [linkedLead, setLinkedLead] = useState<Lead | null>(null);
  const [creditApps, setCreditApps] = useState<CreditApplication[]>([]);
  const [spks, setSpks] = useState<Spk[]>([]);
  const [documents, setDocuments] = useState<CustomerDocument[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showFollowUpForm, setShowFollowUpForm] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: custData } = await supabase.from('customers').select('*').eq('id', id).maybeSingle();

    let custLeadId: string | null = null;
    if (custData) {
      const cust = custData as Customer;
      setCustomer(cust);
      custLeadId = cust.lead_id;
    }

    const leadFilter = custLeadId
      ? { leadId: custLeadId, useLead: true }
      : { leadId: id, useLead: false };

    const [{ data: fuData }, { data: visitData }, { data: dealData }, { data: caData }, { data: spkData }, { data: docData }, { data: delData }] = await Promise.all([
      supabase.from('follow_ups').select('*').or(`lead_id.eq.${leadFilter.leadId}`).order('created_at', { ascending: false }),
      supabase.from('visits').select('*').eq('lead_id', leadFilter.leadId).order('visit_date', { ascending: false }),
      supabase.from('deals').select('*').eq('lead_id', leadFilter.leadId).order('created_at', { ascending: false }),
      supabase.from('credit_applications').select('*').eq('customer_id', id).order('created_at', { ascending: false }),
      supabase.from('spks').select('*').eq('customer_id', id).order('created_at', { ascending: false }),
      supabase.from('customer_documents').select('*').eq('customer_id', id).order('created_at', { ascending: false }),
      supabase.from('deliveries').select('*').eq('customer_id', id).order('created_at', { ascending: false }),
    ]);

    if (custData) {
      const cust = custData as Customer;
      if (cust.lead_id) {
        const [{ data: leadData }, { data: eventData }] = await Promise.all([
          supabase.from('leads').select('*').eq('id', cust.lead_id).maybeSingle(),
          supabase.from('lead_events').select('*').eq('lead_id', cust.lead_id).order('created_at', { ascending: false }),
        ]);
        if (leadData) setLinkedLead(leadData as Lead);
        if (eventData) setLeadEvents(eventData as LeadEvent[]);
      }
    }
    if (fuData) setFollowUps(fuData as FollowUp[]);
    if (visitData) setVisits(visitData as Visit[]);
    if (dealData) setDeals(dealData as Deal[]);
    if (caData) setCreditApps(caData as CreditApplication[]);
    if (spkData) setSpks(spkData as Spk[]);
    if (docData) setDocuments(docData as CustomerDocument[]);
    if (delData) setDeliveries(delData as Delivery[]);
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    supabase.from('profiles').select('*').eq('role', 'sales').eq('status', 'active').then(({ data }) => {
      if (data) setSalesReps(data as Profile[]);
    });
    supabase.from('products').select('*').eq('status', 'active').order('name').then(({ data }) => {
      if (data) setProducts(data as Product[]);
    });
  }, []);

  const handleAddNote = async () => {
    if (!customer || !customer.lead_id || !noteText.trim()) return;
    setSavingNote(true);
    await supabase.from('lead_events').insert({
      lead_id: customer.lead_id, user_id: profile?.id, event_type: 'NOTE_ADDED', note: noteText.trim(),
    });
    setNoteText('');
    setSavingNote(false);
    fetchData();
  };

  const handleArchive = async () => {
    if (!customer) return;
    await supabase.rpc('archive_customer', { p_customer_id: customer.id });
    fetchData();
  };

  const waNumber = customer?.phone.replace(/^0/, '62') || '';
  const waLink = `https://wa.me/${waNumber}?text=${encodeURIComponent(
    `Halo ${customer?.name}, terima kasih telah menghubungi kami. Apakah ada yang bisa saya bantu?`
  )}`;

  const salesRep = salesReps.find((r) => r.id === customer?.sales_id);

  const timeline: TimelineItem[] = [
    ...(leadEvents || []).map((e) => ({
      id: e.id, date: e.created_at, title: e.event_type.replace(/_/g, ' '),
      description: e.note, type: 'event',
    })),
    ...(followUps || []).map((f) => ({
      id: f.id, date: f.created_at, title: `Follow-up: ${typeLabels[f.type] || f.type}`,
      description: f.note, type: 'followup',
    })),
    ...(visits || []).map((v) => ({
      id: v.id, date: v.created_at, title: `Kunjungan: ${visitTypes[v.visit_type] || v.visit_type}`,
      description: `${formatDate(v.visit_date)} ${v.visit_time}`, type: 'visit',
    })),
    ...(deals || []).map((d) => ({
      id: d.id, date: d.created_at, title: `Deal: Rp${d.deal_value.toLocaleString('id-ID')}`,
      description: d.notes, type: 'deal',
    })),
    ...creditApps.map((ca) => ({
      id: ca.id, date: ca.created_at, title: `Pengajuan Kredit: ${ca.motor_name || '-'}`,
      description: `${formatCurrency(ca.otr_price)} - ${ca.status}`, type: 'credit',
    })),
    ...spks.map((s) => ({
      id: s.id, date: s.created_at, title: `SPK: ${s.spk_number}`,
      description: `${s.motor_name || '-'} - ${s.status}`, type: 'spk',
    })),
    ...deliveries.map((d) => ({
      id: d.id, date: d.created_at, title: `Pengiriman: ${d.motor_name || '-'}`,
      description: `${d.spk_number || ''} - ${d.status}`, type: 'delivery',
    })),
    ...documents.filter((d) => d.status === 'uploaded').map((d) => ({
      id: d.id, date: d.uploaded_at || d.created_at, title: `Dokumen: ${d.label}`,
      description: d.status, type: 'document',
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (loading) return (
    <div className="flex h-40 items-center justify-center text-neutral-400">
      <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Memuat...
    </div>
  );

  if (!customer) return <div className="text-center text-neutral-400">Customer tidak ditemukan.</div>;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link href="/admin/customers" className="text-neutral-500 hover:text-neutral-900">Customer</Link>
        <span className="text-neutral-300">/</span>
        <span className="font-medium text-neutral-900">{customer.name}</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {/* Customer Profile */}
          <div className="admin-card p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4 grid w-full grid-cols-3 sm:grid-cols-7">
              <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
              <TabsTrigger value="followup" className="text-xs">Follow-up</TabsTrigger>
              <TabsTrigger value="credit" className="text-xs">Kredit</TabsTrigger>
              <TabsTrigger value="spk" className="text-xs">SPK</TabsTrigger>
              <TabsTrigger value="documents" className="text-xs">Dokumen</TabsTrigger>
              <TabsTrigger value="delivery" className="text-xs">Pengiriman</TabsTrigger>
              <TabsTrigger value="activity" className="text-xs">Activity</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4 mt-0">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-xl font-bold text-neutral-900">{customer.name}</h1>
                <p className="mt-1 text-sm text-neutral-500">Customer sejak: {formatDate(customer.created_at)}</p>
              </div>
              <span className={cn('rounded-full px-3 py-1 text-xs font-medium', customerStatusLabels[customer.status]?.color || 'bg-neutral-100')}>
                {customerStatusLabels[customer.status]?.label || customer.status}
              </span>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-neutral-400" /><span>{customer.phone}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-neutral-400" /><span>{customer.email || '-'}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-neutral-400" /><span>{[customer.city, customer.province].filter(Boolean).join(', ') || '-'}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Bike className="h-4 w-4 text-neutral-400" /><span>{customer.motor_name || '-'} {customer.motor_type ? `(${customer.motor_type})` : ''}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-neutral-400" /><span>Tipe: {customer.customer_type === 'individual' ? 'Individu' : 'Perusahaan'}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Home className="h-4 w-4 text-neutral-400" /><span>Sumber: {sourceLabels[customer.source] || customer.source}</span>
              </div>
            </div>

            {customer.address && (
              <div className="mt-4 rounded-lg border border-neutral-100 bg-neutral-50 p-3">
                <p className="text-xs text-neutral-500">Alamat</p>
                <p className="mt-1 text-sm text-neutral-700">{customer.address}</p>
              </div>
            )}

            {customer.notes && (
              <div className="mt-4">
                <h3 className="text-sm font-semibold text-neutral-700">Catatan</h3>
                <p className="mt-1 text-sm text-neutral-600">{customer.notes}</p>
              </div>
            )}

            {linkedLead && (
              <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 p-3">
                <p className="text-xs font-medium text-blue-700">Berasal dari Lead</p>
                <Link href={`/admin/leads/${linkedLead.id}`} className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline">
                  Lihat Lead {linkedLead.motor_name ? `• ${linkedLead.motor_name}` : ''}
                  <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
            )}
            </TabsContent>

            <TabsContent value="followup" className="space-y-4 mt-0">
              <SectionCard title="Riwayat Follow-up">
                {followUps.length === 0 ? (
                  <p className="py-6 text-center text-sm text-neutral-400">Belum ada follow-up.</p>
                ) : (
                  <div className="space-y-3">
                    {followUps.map((fu) => {
                      const fuRep = salesReps.find((r) => r.id === fu.user_id);
                      return (
                        <div key={fu.id} className="flex items-start justify-between border-b border-neutral-100 pb-3 last:border-0">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-neutral-900">{typeLabels[fu.type] || fu.type}</p>
                            <p className="text-xs text-neutral-500">
                              {fu.scheduled_at ? formatDate(fu.scheduled_at) : formatDate(fu.created_at)}
                              {fu.completed_at ? ` • Selesai: ${formatDate(fu.completed_at)}` : ''}
                            </p>
                            <p className="text-xs text-neutral-400">Sales: {fuRep?.full_name || '-'}</p>
                            {fu.note && <p className="mt-1 text-sm text-neutral-600">{fu.note}</p>}
                          </div>
                          <span className={cn('ml-2 flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium', resultLabels[fu.result]?.color || 'bg-neutral-100')}>
                            {resultLabels[fu.result]?.label || fu.result}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </SectionCard>

              {/* Visit History */}
              <SectionCard title="Riwayat Kunjungan">
            {visits.length === 0 ? (
              <p className="py-6 text-center text-sm text-neutral-400">Belum ada kunjungan.</p>
            ) : (
              <div className="space-y-3">
                {visits.map((v) => (
                  <div key={v.id} className="flex items-center justify-between border-b border-neutral-100 pb-3 last:border-0">
                    <div>
                      <p className="text-sm font-medium">{formatDate(v.visit_date)} • {v.visit_time}</p>
                      <p className="text-xs text-neutral-500">{visitTypes[v.visit_type] || v.visit_type}</p>
                    </div>
                    <span className={cn('rounded-full px-2 py-1 text-xs font-medium',
                      v.status === 'completed' ? 'bg-green-100 text-green-700' :
                      v.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                      'bg-blue-100 text-blue-700')}>
                      {v.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
            </TabsContent>

            <TabsContent value="credit" className="space-y-4 mt-0">
              <SectionCard title="Pengajuan Kredit" action={<Link href="/admin/credit-applications"><Button size="sm" className="bg-red-600 hover:bg-red-700 text-white"><CreditCard className="mr-1 h-3 w-3" /> Kelola</Button></Link>}>
                {creditApps.length === 0 ? (
                  <p className="py-6 text-center text-sm text-neutral-400">Belum ada pengajuan kredit.</p>
                ) : (
                  <div className="space-y-3">
                    {creditApps.map((ca) => (
                      <div key={ca.id} className="flex items-center justify-between border-b border-neutral-100 pb-3 last:border-0">
                        <div>
                          <p className="text-sm font-medium text-neutral-900">{ca.motor_name || '-'}</p>
                          <p className="text-xs text-neutral-500">{formatCurrency(ca.otr_price)} - DP {formatCurrency(ca.dp_amount)} - {ca.tenor_months}x</p>
                          <p className="text-xs text-neutral-400">{formatDate(ca.created_at)}</p>
                        </div>
                        <StatusBadge status={ca.status} labels={creditStatusLabels} />
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>
            </TabsContent>

            <TabsContent value="spk" className="space-y-4 mt-0">
              <SectionCard title="SPK / Order" action={<Link href="/admin/spk"><Button size="sm" className="bg-red-600 hover:bg-red-700 text-white"><ClipboardList className="mr-1 h-3 w-3" /> Kelola</Button></Link>}>
                {spks.length === 0 ? (
                  <p className="py-6 text-center text-sm text-neutral-400">Belum ada SPK.</p>
                ) : (
                  <div className="space-y-3">
                    {spks.map((s) => (
                      <div key={s.id} className="flex items-center justify-between border-b border-neutral-100 pb-3 last:border-0">
                        <div>
                          <p className="font-mono text-sm font-medium text-red-600">{s.spk_number}</p>
                          <p className="text-xs text-neutral-500">{s.motor_name || '-'} - {formatCurrency(s.otr_price)} - {s.payment_type === 'cash' ? 'Cash' : 'Kredit'}</p>
                          <p className="text-xs text-neutral-400">{formatDate(s.spk_date)}</p>
                        </div>
                        <StatusBadge status={s.status} labels={spkStatusLabels} />
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>
            </TabsContent>

            <TabsContent value="documents" className="space-y-4 mt-0">
              <SectionCard title="Dokumen" action={<Link href="/admin/documents"><Button size="sm" className="bg-red-600 hover:bg-red-700 text-white"><FileText className="mr-1 h-3 w-3" /> Kelola</Button></Link>}>
                {documents.length === 0 ? (
                  <p className="py-6 text-center text-sm text-neutral-400">Belum ada dokumen.</p>
                ) : (
                  <div className="space-y-3">
                    {documents.map((d) => (
                      <div key={d.id} className="flex items-center justify-between border-b border-neutral-100 pb-3 last:border-0">
                        <div>
                          <p className="text-sm font-medium text-neutral-900">{d.label}</p>
                          <p className="text-xs text-neutral-500">{d.category} - {d.document_type}</p>
                        </div>
                        <StatusBadge status={d.status} labels={documentStatusLabels} />
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>
            </TabsContent>

            <TabsContent value="delivery" className="space-y-4 mt-0">
              <SectionCard title="Pengiriman" action={<Link href="/admin/deliveries"><Button size="sm" className="bg-red-600 hover:bg-red-700 text-white"><Truck className="mr-1 h-3 w-3" /> Kelola</Button></Link>}>
                {deliveries.length === 0 ? (
                  <p className="py-6 text-center text-sm text-neutral-400">Belum ada pengiriman.</p>
                ) : (
                  <div className="space-y-3">
                    {deliveries.map((d) => (
                      <div key={d.id} className="flex items-center justify-between border-b border-neutral-100 pb-3 last:border-0">
                        <div>
                          <p className="text-sm font-medium text-neutral-900">{d.motor_name || '-'}</p>
                          <p className="text-xs text-neutral-500">{d.spk_number || '-'} - {d.delivery_date ? formatDate(d.delivery_date) : '-'}</p>
                          <p className="text-xs text-neutral-400">Driver: {d.driver_name || '-'}</p>
                        </div>
                        <StatusBadge status={d.status} labels={deliveryStatusLabels} />
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>
            </TabsContent>

            <TabsContent value="activity" className="space-y-4 mt-0">
              {/* Purchase History */}
              <SectionCard title="Riwayat Pembelian">
                {deals.length === 0 ? (
                  <p className="py-6 text-center text-sm text-neutral-400">Belum ada pembelian.</p>
                ) : (
                  <div className="space-y-3">
                    {deals.map((d) => (
                      <div key={d.id} className="flex items-center justify-between border-b border-neutral-100 pb-3 last:border-0">
                        <div>
                          <p className="text-sm font-medium text-neutral-900">Rp{d.deal_value.toLocaleString('id-ID')}</p>
                          <p className="text-xs text-neutral-500">{formatDate(d.deal_date)} {d.notes ? `• ${d.notes}` : ''}</p>
                        </div>
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">{d.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>

              {/* Timeline */}
              <SectionCard title="Timeline Aktivitas">
                {timeline.length === 0 ? (
                  <p className="py-6 text-center text-sm text-neutral-400">Belum ada aktivitas.</p>
                ) : (
                  <div className="space-y-1">
                    {timeline.map((item, i) => {
                      const isToday = new Date(item.date).toDateString() === new Date().toDateString();
                      const showDateHeader = i === 0 || new Date(timeline[i - 1].date).toDateString() !== new Date(item.date).toDateString();
                      return (
                        <div key={item.id}>
                          {showDateHeader && (
                            <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wider text-neutral-400 first:mt-0">
                              {isToday ? 'Hari Ini' : formatDate(item.date)}
                            </p>
                          )}
                          <div className="flex gap-3 py-1">
                            <div className="flex flex-col items-center">
                              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-red-50 text-xs font-bold text-red-600">
                                {item.type === 'deal' ? 'D' : item.type === 'visit' ? 'V' : item.type === 'followup' ? 'F' : item.type === 'credit' ? 'K' : item.type === 'spk' ? 'S' : item.type === 'delivery' ? 'P' : item.type === 'document' ? 'D' : 'E'}
                              </div>
                              {i < timeline.length - 1 && <div className="mt-1 w-px flex-1 bg-neutral-200" />}
                            </div>
                            <div className="pb-3">
                              <p className="text-sm font-medium capitalize text-neutral-900">{item.title}</p>
                              {item.description && <p className="mt-0.5 text-sm text-neutral-600">{item.description}</p>}
                              <p className="mt-0.5 text-xs text-neutral-400">{new Date(item.date).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </SectionCard>
            </TabsContent>
          </Tabs>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="admin-card p-6">
            <h2 className="text-sm font-bold text-neutral-900">Quick Action</h2>
            <div className="mt-4 space-y-2">
              <a href={waLink} target="_blank" rel="noopener noreferrer" className="block">
                <Button className="w-full bg-green-600 hover:bg-green-700 text-white">
                  <MessageCircle className="mr-2 h-4 w-4" /> WhatsApp
                </Button>
              </a>
              <a href={`tel:${customer.phone}`} className="block">
                <Button variant="outline" className="w-full"><Phone className="mr-2 h-4 w-4" /> Telepon</Button>
              </a>
              <Button variant="outline" className="w-full" onClick={() => setShowFollowUpForm(true)}>
                <PhoneCall className="mr-2 h-4 w-4" /> Follow-up
              </Button>
              <Button variant="outline" className="w-full" onClick={() => setShowEditForm(true)}>
                <Pencil className="mr-2 h-4 w-4" /> Edit
              </Button>
              <Link href="/admin/credit-applications" className="block">
                <Button variant="outline" className="w-full">
                  <CreditCard className="mr-2 h-4 w-4" /> Ajukan Kredit
                </Button>
              </Link>
              <Link href="/admin/spk" className="block">
                <Button variant="outline" className="w-full" disabled={creditApps.filter((ca) => ca.status === 'approved').length === 0}>
                  <ClipboardList className="mr-2 h-4 w-4" /> Buat SPK
                </Button>
              </Link>
              {customer.status !== 'archived' && (
                <Button variant="outline" className="w-full text-red-600 hover:bg-red-50" onClick={handleArchive}>
                  <Archive className="mr-2 h-4 w-4" /> Arsipkan
                </Button>
              )}
            </div>
          </div>

          <div className="admin-card p-6">
            <h2 className="text-sm font-bold text-neutral-900">Informasi Customer</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-neutral-500">Sales/PIC</dt><dd className="font-medium text-neutral-900">{salesRep?.full_name || '-'}</dd></div>
              <div className="flex justify-between"><dt className="text-neutral-500">Sumber</dt><dd className="font-medium text-neutral-900">{sourceLabels[customer.source] || customer.source}</dd></div>
              <div className="flex justify-between"><dt className="text-neutral-500">Tipe</dt><dd className="font-medium text-neutral-900">{customer.customer_type === 'individual' ? 'Individu' : 'Perusahaan'}</dd></div>
              <div className="flex justify-between"><dt className="text-neutral-500">Dibuat</dt><dd className="font-medium text-neutral-900">{formatDate(customer.created_at)}</dd></div>
              <div className="flex justify-between"><dt className="text-neutral-500">Diperbarui</dt><dd className="font-medium text-neutral-900">{formatDate(customer.updated_at)}</dd></div>
            </dl>
          </div>

          {customer.lead_id && (
            <div className="admin-card p-6">
              <h2 className="flex items-center gap-2 text-sm font-bold text-neutral-900">
                <Clock className="h-4 w-4" /> Tambah Catatan
              </h2>
              <div className="mt-3">
                <Textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Tulis catatan..." rows={2} />
              </div>
              <Button size="sm" className="mt-2 bg-red-600 hover:bg-red-700 text-white" onClick={handleAddNote} disabled={!noteText.trim() || savingNote}>
                {savingNote ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Plus className="mr-1 h-4 w-4" />}
                Tambah
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={showEditForm} onOpenChange={setShowEditForm}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Customer</DialogTitle></DialogHeader>
          <CustomerForm
            salesReps={salesReps}
            products={products}
            editCustomer={customer}
            onSaved={() => { setShowEditForm(false); fetchData(); }}
            onCancel={() => setShowEditForm(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Follow-up Dialog */}
      <Dialog open={showFollowUpForm} onOpenChange={setShowFollowUpForm}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Tambah Follow-up</DialogTitle></DialogHeader>
          <CustomerFollowUpForm
            customer={customer}
            leadId={customer.lead_id}
            onSaved={() => { setShowFollowUpForm(false); fetchData(); }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CustomerFollowUpForm({ customer, leadId, onSaved }: { customer: Customer; leadId: string | null; onSaved: () => void }) {
  const [type, setType] = useState('call');
  const [scheduledAt, setScheduledAt] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    if (leadId) {
      const { error: rpcError } = await supabase.rpc('create_follow_up', {
        p_lead_id: leadId, p_type: type, p_note: note || null, p_scheduled_at: scheduledAt,
      });
      if (rpcError) { setError(getSafeError(rpcError)); setSaving(false); return; }
    } else {
      const { error: insertError } = await supabase.from('follow_ups').insert({
        customer_id: customer.id, type, note: note || null, scheduled_at: scheduledAt, result: 'pending',
      });
      if (insertError) { setError(getSafeError(insertError)); setSaving(false); return; }
    }
    setSaving(false);
    onSaved();
  };

  return (
    <form onSubmit={handleSave} className="space-y-4">
      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      <div className="rounded-lg border border-neutral-100 bg-neutral-50 p-3 text-sm">
        <p className="font-medium">{customer.name} • {customer.phone}</p>
        <p className="text-xs text-neutral-500">{customer.motor_name || '-'}</p>
      </div>
      <div>
        <Label className="text-sm font-medium text-neutral-700">Tipe Follow-up</Label>
        <select value={type} onChange={(e) => setType(e.target.value)} className="admin-select mt-1.5">
          <option value="call">Telepon</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="visit">Kunjungan</option>
          <option value="email">Email</option>
          <option value="meeting">Meeting</option>
          <option value="other">Lainnya</option>
        </select>
      </div>
      <div>
        <Label className="text-sm font-medium text-neutral-700">Tanggal *</Label>
        <Input type="date" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} required className="mt-1.5" />
      </div>
      <div>
        <Label className="text-sm font-medium text-neutral-700">Catatan</Label>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="mt-1.5" />
      </div>
      <Button type="submit" disabled={saving || !scheduledAt} className="w-full bg-red-600 hover:bg-red-700 text-white">
        {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Menyimpan...</> : 'Simpan'}
      </Button>
    </form>
  );
}
