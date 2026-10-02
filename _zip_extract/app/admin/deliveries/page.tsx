'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase, Delivery, Spk, Customer, Product, Profile } from '@/lib/supabase-client';
import { useAuth } from '@/lib/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Truck, Plus, Search, Loader2, ChevronLeft, ChevronRight,
  Eye, CheckCircle, AlertTriangle,
} from 'lucide-react';
import {
  PageHeader, MetricCard, StatusBadge, LoadingState, ErrorState,
  deliveryStatusLabels, formatDate, formatCurrency,
} from '@/components/admin/admin-ui';
import { getSafeError } from '@/lib/validation';
import { cn } from '@/lib/utils';

const CHECKLIST_ITEMS: { key: string; label: string }[] = [
  { key: 'documents_complete', label: 'Dokumen Lengkap' },
  { key: 'payment_complete', label: 'Pembayaran Lengkap' },
  { key: 'unit_available', label: 'Unit Tersedia' },
  { key: 'unit_prepared', label: 'Unit Sudah Dipersiapkan' },
  { key: 'accessories_complete', label: 'Accessories Lengkap' },
  { key: 'surat_jalan_ready', label: 'Surat Jalan Tersedia' },
  { key: 'customer_ready', label: 'Customer Siap Menerima' },
];

export default function DeliveriesPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [spks, setSpks] = useState<Spk[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [viewingDelivery, setViewingDelivery] = useState<Delivery | null>(null);
  const pageSize = 10;

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(false);
    let query = supabase.from('deliveries').select('*', { count: 'exact' });
    if (!isAdmin && profile?.id) query = query.eq('sales_id', profile.id);
    if (statusFilter !== 'all') query = query.eq('status', statusFilter);
    if (search) {
      query = query.or(`customer_name.ilike.%${search}%,spk_number.ilike.%${search}%,motor_name.ilike.%${search}%`);
    }
    query = query.order('created_at', { ascending: false }).range(page * pageSize, (page + 1) * pageSize - 1);
    const { data, error: err, count } = await query;
    if (err) { setError(true); setLoading(false); return; }
    setDeliveries((data || []) as Delivery[]);
    setTotal(count || 0);
    setLoading(false);
  }, [isAdmin, profile?.id, statusFilter, search, page]);

  useEffect(() => {
    supabase.from('spks').select('*').in('status', ['ready_delivery', 'unit_reserved']).order('created_at', { ascending: false }).then(({ data }) => {
      if (data) setSpks(data as Spk[]);
    });
    supabase.from('customers').select('id,name,phone,address').order('name').then(({ data }) => {
      if (data) setCustomers(data as Customer[]);
    });
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { setPage(0); }, [search, statusFilter]);

  const [kpis, setKpis] = useState({ total: 0, waiting: 0, preparing: 0, ready: 0, inDelivery: 0, delivered: 0 });

  useEffect(() => {
    (async () => {
      const scope = (q: any) => !isAdmin && profile?.id ? q.eq('sales_id', profile.id) : q;
      const [t, w, p, r, id, dv] = await Promise.all([
        scope(supabase.from('deliveries').select('*', { count: 'exact', head: true })),
        scope(supabase.from('deliveries').select('*', { count: 'exact', head: true })).eq('status', 'waiting'),
        scope(supabase.from('deliveries').select('*', { count: 'exact', head: true })).eq('status', 'preparing'),
        scope(supabase.from('deliveries').select('*', { count: 'exact', head: true })).eq('status', 'ready'),
        scope(supabase.from('deliveries').select('*', { count: 'exact', head: true })).eq('status', 'in_delivery'),
        scope(supabase.from('deliveries').select('*', { count: 'exact', head: true })).eq('status', 'delivered'),
      ]);
      setKpis({ total: t.count || 0, waiting: w.count || 0, preparing: p.count || 0, ready: r.count || 0, inDelivery: id.count || 0, delivered: dv.count || 0 });
    })();
  }, [isAdmin, profile?.id, deliveries]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Truck}
        title="Pengiriman"
        description="Kelola pengiriman unit ke customer"
        actions={
          <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={() => setShowForm(true)}>
            <Plus className="mr-1 h-4 w-4" /> Tambah Pengiriman
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <MetricCard label="Total" value={kpis.total} icon={Truck} color="blue" />
        <MetricCard label="Menunggu" value={kpis.waiting} icon={Truck} color="neutral" />
        <MetricCard label="Disiapkan" value={kpis.preparing} icon={Truck} color="yellow" />
        <MetricCard label="Siap" value={kpis.ready} icon={Truck} color="blue" />
        <MetricCard label="Dalam Kirim" value={kpis.inDelivery} icon={Truck} color="orange" />
        <MetricCard label="Terkirim" value={kpis.delivered} icon={CheckCircle} color="green" />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <Input placeholder="Cari customer, SPK, atau motor..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="admin-select w-full sm:w-48">
          <option value="all">Semua Status</option>
          <option value="waiting">Menunggu</option>
          <option value="preparing">Disiapkan</option>
          <option value="ready">Siap</option>
          <option value="in_delivery">Dalam Pengiriman</option>
          <option value="delivered">Terkirim</option>
          <option value="failed">Gagal</option>
          <option value="cancelled">Dibatalkan</option>
        </select>
      </div>

      {loading ? <LoadingState label="Memuat pengiriman..." /> : error ? <ErrorState onRetry={fetchData} /> : deliveries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 py-16 text-center">
          <Truck className="mx-auto mb-3 h-10 w-10 text-neutral-300" />
          <p className="text-sm text-neutral-500">Belum ada pengiriman.</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Motor</TableHead>
                  <TableHead>No SPK</TableHead>
                  <TableHead>Jadwal Kirim</TableHead>
                  <TableHead>Driver</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deliveries.map((del) => (
                  <TableRow key={del.id}>
                    <TableCell className="font-medium text-neutral-900">{del.customer_name || '-'}</TableCell>
                    <TableCell className="text-sm">{del.motor_name || '-'}</TableCell>
                    <TableCell className="font-mono text-xs text-red-600">{del.spk_number || '-'}</TableCell>
                    <TableCell className="text-xs text-neutral-500">{del.delivery_date ? formatDate(del.delivery_date) : '-'} {del.delivery_time || ''}</TableCell>
                    <TableCell className="text-sm">{del.driver_name || '-'}</TableCell>
                    <TableCell><StatusBadge status={del.status} labels={deliveryStatusLabels} /></TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => setViewingDelivery(del)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-neutral-500">Menampilkan {page * pageSize + 1}-{Math.min((page + 1) * pageSize, total)} dari {total}</p>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>Tambah Pengiriman</DialogTitle></DialogHeader>
          <DeliveryForm
            spks={spks}
            customers={customers}
            currentUserId={profile?.id}
            onSaved={() => { setShowForm(false); fetchData(); }}
            onCancel={() => setShowForm(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewingDelivery} onOpenChange={(v) => !v && setViewingDelivery(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>Detail Pengiriman</DialogTitle></DialogHeader>
          {viewingDelivery && <DeliveryDetail delivery={viewingDelivery} onUpdated={fetchData} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DeliveryForm({ spks, customers, currentUserId, onSaved, onCancel }: {
  spks: Spk[];
  customers: Customer[];
  currentUserId?: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [spkId, setSpkId] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [deliveryTime, setDeliveryTime] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedSpk = spks.find((s) => s.id === spkId);
  const selectedCustomer = customers.find((c) => c.id === selectedSpk?.customer_id);

  useEffect(() => {
    if (selectedCustomer) {
      setDeliveryAddress(selectedCustomer.address || '');
    }
  }, [selectedCustomer]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!spkId) { setError('Pilih SPK terlebih dahulu.'); return; }
    if (!selectedSpk) { setError('SPK tidak ditemukan.'); return; }
    setSaving(true);
    setError(null);

    const payload = {
      spk_id: spkId,
      customer_id: selectedSpk.customer_id,
      product_id: selectedSpk.product_id || null,
      sales_id: selectedSpk.sales_id || currentUserId || null,
      customer_name: selectedCustomer?.name || null,
      customer_phone: selectedCustomer?.phone || null,
      motor_name: selectedSpk.motor_name || null,
      motor_type: selectedSpk.motor_type || null,
      spk_number: selectedSpk.spk_number,
      delivery_address: deliveryAddress || null,
      delivery_date: deliveryDate || null,
      delivery_time: deliveryTime || null,
      driver_name: driverName || null,
      driver_phone: driverPhone || null,
      vehicle_plate: vehiclePlate || null,
      notes: notes || null,
      status: 'waiting',
      created_by: currentUserId || null,
    };

    const { error: insertError } = await supabase.from('deliveries').insert(payload);
    setSaving(false);
    if (insertError) { setError(getSafeError(insertError)); } else { onSaved(); }
  };

  return (
    <form onSubmit={handleSave} className="space-y-4">
      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <div>
        <Label className="text-sm font-medium">SPK *</Label>
        <select value={spkId} onChange={(e) => setSpkId(e.target.value)} className="admin-select mt-1.5" required>
          <option value="">Pilih SPK (Siap Kirim)</option>
          {spks.map((s) => (
            <option key={s.id} value={s.id}>{s.spk_number} - {s.motor_name}</option>
          ))}
        </select>
      </div>

      {selectedSpk && (
        <div className="rounded-lg border border-neutral-100 bg-neutral-50 p-3 text-sm">
          <p className="font-medium">{selectedSpk.spk_number}</p>
          <p className="text-xs text-neutral-500">{selectedSpk.motor_name} - {formatCurrency(selectedSpk.otr_price)}</p>
          {selectedCustomer && <p className="text-xs text-neutral-500">{selectedCustomer.name} - {selectedCustomer.phone}</p>}
        </div>
      )}

      <div>
        <Label className="text-sm font-medium">Alamat Pengiriman</Label>
        <Textarea value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} rows={2} className="mt-1.5" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-sm font-medium">Tanggal Kirim</Label>
          <Input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} className="mt-1.5" />
        </div>
        <div>
          <Label className="text-sm font-medium">Jam Kirim</Label>
          <Input type="time" value={deliveryTime} onChange={(e) => setDeliveryTime(e.target.value)} className="mt-1.5" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-sm font-medium">Nama Driver</Label>
          <Input value={driverName} onChange={(e) => setDriverName(e.target.value)} className="mt-1.5" />
        </div>
        <div>
          <Label className="text-sm font-medium">No. Telepon Driver</Label>
          <Input value={driverPhone} onChange={(e) => setDriverPhone(e.target.value)} className="mt-1.5" />
        </div>
      </div>

      <div>
        <Label className="text-sm font-medium">Plat Kendaraan</Label>
        <Input value={vehiclePlate} onChange={(e) => setVehiclePlate(e.target.value)} placeholder="Contoh: B 1234 ABC" className="mt-1.5" />
      </div>

      <div>
        <Label className="text-sm font-medium">Catatan</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="mt-1.5" />
      </div>

      <Button type="submit" disabled={saving} className="w-full bg-red-600 hover:bg-red-700 text-white">
        {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Menyimpan...</> : 'Simpan'}
      </Button>
    </form>
  );
}

function DeliveryDetail({ delivery, onUpdated }: { delivery: Delivery; onUpdated: () => void }) {
  const { profile } = useAuth();
  const [updating, setUpdating] = useState(false);
  const [checklist, setChecklist] = useState<Record<string, boolean>>(delivery.checklist || {});
  const [error, setError] = useState<string | null>(null);

  const handleChecklistChange = async (key: string, checked: boolean) => {
    const newChecklist = { ...checklist, [key]: checked };
    setChecklist(newChecklist);
    await supabase.from('deliveries').update({ checklist: newChecklist, updated_at: new Date().toISOString() }).eq('id', delivery.id);
  };

  const handleStatusChange = async (newStatus: string) => {
    setUpdating(true);
    setError(null);

    if (newStatus === 'delivered') {
      const { data: success } = await supabase.rpc('complete_delivery', {
        p_delivery_id: delivery.id, p_delivered_by: profile?.id,
      });
      if (!success) {
        setError('Checklist belum lengkap. Semua item wajib harus diceklis sebelum status dapat diubah menjadi Terkirim.');
        setUpdating(false);
        return;
      }
      await supabase.rpc('log_audit_action', {
        p_user_id: profile?.id, p_user_email: profile?.email || null,
        p_action: 'delivery_completed', p_entity: 'deliveries', p_entity_id: delivery.id,
      });
      setUpdating(false);
      onUpdated();
      return;
    }

    const updates: Record<string, unknown> = { status: newStatus, updated_at: new Date().toISOString() };
    await supabase.from('deliveries').update(updates).eq('id', delivery.id);
    await supabase.rpc('log_audit_action', {
      p_user_id: profile?.id, p_user_email: profile?.email || null,
      p_action: `delivery_status_changed_to_${newStatus}`, p_entity: 'deliveries', p_entity_id: delivery.id,
    });
    setUpdating(false);
    onUpdated();
  };

  const allChecked = CHECKLIST_ITEMS.every((item) => checklist[item.key]);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-neutral-100 bg-neutral-50 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-neutral-900">{delivery.customer_name}</p>
            <p className="text-sm text-neutral-500">{delivery.motor_name} - {delivery.spk_number}</p>
          </div>
          <StatusBadge status={delivery.status} labels={deliveryStatusLabels} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div><span className="text-neutral-500">Alamat:</span> <span className="font-medium">{delivery.delivery_address || '-'}</span></div>
        <div><span className="text-neutral-500">Jadwal:</span> <span className="font-medium">{delivery.delivery_date ? formatDate(delivery.delivery_date) : '-'} {delivery.delivery_time || ''}</span></div>
        <div><span className="text-neutral-500">Driver:</span> <span className="font-medium">{delivery.driver_name || '-'}</span></div>
        <div><span className="text-neutral-500">Telepon Driver:</span> <span className="font-medium">{delivery.driver_phone || '-'}</span></div>
        <div><span className="text-neutral-500">Plat:</span> <span className="font-medium">{delivery.vehicle_plate || '-'}</span></div>
        <div><span className="text-neutral-500">Diterima:</span> <span className="font-medium">{delivery.delivered_at ? formatDate(delivery.delivered_at, { withTime: true }) : '-'}</span></div>
      </div>

      {delivery.notes && <p className="text-sm text-neutral-600">{delivery.notes}</p>}

      {/* Checklist */}
      <div className="rounded-lg border border-neutral-200 p-4">
        <p className="mb-3 text-sm font-bold text-neutral-900">Checklist Pengiriman</p>
        <div className="space-y-2">
          {CHECKLIST_ITEMS.map((item) => (
            <div key={item.key} className="flex items-center gap-3">
              <Checkbox
                id={item.key}
                checked={!!checklist[item.key]}
                onCheckedChange={(checked) => handleChecklistChange(item.key, checked === true)}
                disabled={delivery.status === 'delivered'}
              />
              <label htmlFor={item.key} className="text-sm text-neutral-700 cursor-pointer">
                {item.label}
              </label>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2">
          {allChecked ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700">
              <CheckCircle className="h-3 w-3" /> Checklist Lengkap
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-600">
              <AlertTriangle className="h-3 w-3" /> Checklist Belum Lengkap
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" /> {error}
        </div>
      )}

      {/* Status Actions */}
      <div className="flex flex-wrap gap-2 border-t border-neutral-100 pt-4">
        {delivery.status === 'waiting' && (
          <Button size="sm" className="bg-yellow-600 hover:bg-yellow-700 text-white" disabled={updating} onClick={() => handleStatusChange('preparing')}>
            {updating ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null} Siapkan Unit
          </Button>
        )}
        {delivery.status === 'preparing' && (
          <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" disabled={updating} onClick={() => handleStatusChange('ready')}>
            Siap Kirim
          </Button>
        )}
        {delivery.status === 'ready' && (
          <Button size="sm" className="bg-orange-600 hover:bg-orange-700 text-white" disabled={updating} onClick={() => handleStatusChange('in_delivery')}>
            Mulai Pengiriman
          </Button>
        )}
        {delivery.status === 'in_delivery' && (
          <Button size="sm" className={cn('bg-green-600 hover:bg-green-700 text-white', !allChecked && 'opacity-50')} disabled={updating || !allChecked} onClick={() => handleStatusChange('delivered')}>
            {updating ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-1 h-4 w-4" />}
            Selesaikan Pengiriman
          </Button>
        )}
        {(delivery.status === 'in_delivery' || delivery.status === 'ready') && (
          <Button size="sm" variant="outline" className="text-red-600" disabled={updating} onClick={() => handleStatusChange('failed')}>
            Tandai Gagal
          </Button>
        )}
        {delivery.status !== 'delivered' && delivery.status !== 'cancelled' && (
          <Button size="sm" variant="outline" className="text-red-600" disabled={updating} onClick={() => handleStatusChange('cancelled')}>
            Batalkan
          </Button>
        )}
      </div>
    </div>
  );
}
