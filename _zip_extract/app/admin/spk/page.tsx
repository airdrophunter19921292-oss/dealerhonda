'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase, Spk, Customer, Product, CreditApplication, FinancingProvider, Profile } from '@/lib/supabase-client';
import { useAuth } from '@/lib/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  ClipboardList, Plus, Search, Loader2, ChevronLeft, ChevronRight,
  Eye, Package, CheckCircle, AlertTriangle,
} from 'lucide-react';
import Link from 'next/link';
import {
  PageHeader, MetricCard, StatusBadge, LoadingState, ErrorState,
  spkStatusLabels, formatDate, formatCurrency,
} from '@/components/admin/admin-ui';
import { getSafeError } from '@/lib/validation';

export default function SpkPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const [spks, setSpks] = useState<Spk[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [creditApps, setCreditApps] = useState<CreditApplication[]>([]);
  const [salesReps, setSalesReps] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [viewingSpk, setViewingSpk] = useState<Spk | null>(null);
  const pageSize = 10;

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(false);
    let query = supabase.from('spks').select('*', { count: 'exact' });
    if (!isAdmin && profile?.id) query = query.eq('sales_id', profile.id);
    if (statusFilter !== 'all') query = query.eq('status', statusFilter);
    if (search) {
      query = query.or(`spk_number.ilike.%${search}%,motor_name.ilike.%${search}%`);
    }
    query = query.order('created_at', { ascending: false }).range(page * pageSize, (page + 1) * pageSize - 1);
    const { data, error: err, count } = await query;
    if (err) { setError(true); setLoading(false); return; }
    setSpks((data || []) as Spk[]);
    setTotal(count || 0);
    setLoading(false);
  }, [isAdmin, profile?.id, statusFilter, search, page]);

  useEffect(() => {
    supabase.from('customers').select('id,name,phone,motor_name,product_id,sales_id').order('name').then(({ data }) => {
      if (data) setCustomers(data as Customer[]);
    });
    supabase.from('products').select('*').order('name').then(({ data }) => {
      if (data) setProducts(data as Product[]);
    });
    supabase.from('credit_applications').select('*').eq('status', 'approved').order('created_at', { ascending: false }).then(({ data }) => {
      if (data) setCreditApps(data as CreditApplication[]);
    });
    supabase.from('profiles').select('*').eq('role', 'sales').eq('status', 'active').then(({ data }) => {
      if (data) setSalesReps(data as Profile[]);
    });
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { setPage(0); }, [search, statusFilter]);

  const [kpis, setKpis] = useState({ total: 0, draft: 0, approved: 0, reserved: 0, readyDelivery: 0, delivered: 0 });

  useEffect(() => {
    (async () => {
      const scope = (q: any) => !isAdmin && profile?.id ? q.eq('sales_id', profile.id) : q;
      const [t, d, a, r, rd, dv] = await Promise.all([
        scope(supabase.from('spks').select('*', { count: 'exact', head: true })),
        scope(supabase.from('spks').select('*', { count: 'exact', head: true })).eq('status', 'draft'),
        scope(supabase.from('spks').select('*', { count: 'exact', head: true })).eq('status', 'approved'),
        scope(supabase.from('spks').select('*', { count: 'exact', head: true })).eq('status', 'unit_reserved'),
        scope(supabase.from('spks').select('*', { count: 'exact', head: true })).eq('status', 'ready_delivery'),
        scope(supabase.from('spks').select('*', { count: 'exact', head: true })).eq('status', 'delivered'),
      ]);
      setKpis({ total: t.count || 0, draft: d.count || 0, approved: a.count || 0, reserved: r.count || 0, readyDelivery: rd.count || 0, delivered: dv.count || 0 });
    })();
  }, [isAdmin, profile?.id, spks]);

  const totalPages = Math.ceil(total / pageSize);
  const customerName = (id: string) => customers.find((c) => c.id === id)?.name || '-';

  return (
    <div className="space-y-6">
      <PageHeader
        icon={ClipboardList}
        title="SPK / Order"
        description="Kelola Surat Pesanan Kendaraan"
        actions={
          <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={() => setShowForm(true)}>
            <Plus className="mr-1 h-4 w-4" /> Tambah SPK
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <MetricCard label="Total SPK" value={kpis.total} icon={ClipboardList} color="blue" />
        <MetricCard label="Draft" value={kpis.draft} icon={ClipboardList} color="neutral" />
        <MetricCard label="Approved" value={kpis.approved} icon={CheckCircle} color="blue" />
        <MetricCard label="Unit Reserved" value={kpis.reserved} icon={Package} color="orange" />
        <MetricCard label="Siap Kirim" value={kpis.readyDelivery} icon={ClipboardList} color="amber" />
        <MetricCard label="Dikirim" value={kpis.delivered} icon={CheckCircle} color="green" />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <Input placeholder="Cari nomor SPK atau motor..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="admin-select w-full sm:w-48">
          <option value="all">Semua Status</option>
          <option value="draft">Draft</option>
          <option value="waiting_payment">Menunggu Bayar</option>
          <option value="waiting_credit">Menunggu Kredit</option>
          <option value="approved">Disetujui</option>
          <option value="unit_reserved">Unit Dipesan</option>
          <option value="ready_delivery">Siap Kirim</option>
          <option value="delivered">Dikirim</option>
          <option value="completed">Selesai</option>
          <option value="cancelled">Dibatalkan</option>
        </select>
      </div>

      {loading ? <LoadingState label="Memuat SPK..." /> : error ? <ErrorState onRetry={fetchData} /> : spks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 py-16 text-center">
          <ClipboardList className="mx-auto mb-3 h-10 w-10 text-neutral-300" />
          <p className="text-sm text-neutral-500">Belum ada SPK.</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nomor SPK</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Motor</TableHead>
                  <TableHead>Tipe</TableHead>
                  <TableHead className="text-right">OTR</TableHead>
                  <TableHead className="text-right">DP</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tanggal</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {spks.map((spk) => (
                  <TableRow key={spk.id}>
                    <TableCell className="font-mono text-xs font-medium text-red-600">{spk.spk_number}</TableCell>
                    <TableCell className="font-medium text-neutral-900">{customerName(spk.customer_id)}</TableCell>
                    <TableCell className="text-sm">{spk.motor_name || '-'}</TableCell>
                    <TableCell><span className={spk.payment_type === 'cash' ? 'text-blue-600' : 'text-orange-600'}>{spk.payment_type === 'cash' ? 'Cash' : 'Kredit'}</span></TableCell>
                    <TableCell className="text-right text-sm">{formatCurrency(spk.otr_price)}</TableCell>
                    <TableCell className="text-right text-sm">{formatCurrency(spk.dp_amount)}</TableCell>
                    <TableCell><StatusBadge status={spk.status} labels={spkStatusLabels} /></TableCell>
                    <TableCell className="text-xs text-neutral-500">{formatDate(spk.spk_date)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => setViewingSpk(spk)}>
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
          <DialogHeader><DialogTitle>Tambah SPK</DialogTitle></DialogHeader>
          <SpkForm
            customers={customers}
            products={products}
            creditApps={creditApps}
            salesReps={salesReps}
            currentUserId={profile?.id}
            onSaved={() => { setShowForm(false); fetchData(); }}
            onCancel={() => setShowForm(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewingSpk} onOpenChange={(v) => !v && setViewingSpk(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>Detail SPK</DialogTitle></DialogHeader>
          {viewingSpk && <SpkDetail spk={viewingSpk} customerName={customerName(viewingSpk.customer_id)} products={products} onUpdated={fetchData} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SpkForm({ customers, products, creditApps, salesReps, currentUserId, onSaved, onCancel }: {
  customers: Customer[];
  products: Product[];
  creditApps: CreditApplication[];
  salesReps: Profile[];
  currentUserId?: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [customerId, setCustomerId] = useState('');
  const [creditAppId, setCreditAppId] = useState('');
  const [productId, setProductId] = useState('');
  const [paymentType, setPaymentType] = useState('credit');
  const [color, setColor] = useState('');
  const [otrPrice, setOtrPrice] = useState('');
  const [dpAmount, setDpAmount] = useState('');
  const [tenorMonths, setTenorMonths] = useState('0');
  const [installmentAmount, setInstallmentAmount] = useState('0');
  const [adminFee, setAdminFee] = useState('0');
  const [insuranceFee, setInsuranceFee] = useState('0');
  const [promoDiscount, setPromoDiscount] = useState('0');
  const [financeName, setFinanceName] = useState('');
  const [salesId, setSalesId] = useState(currentUserId || '');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedCustomer = customers.find((c) => c.id === customerId);
  const selectedProduct = products.find((p) => p.id === productId);

  useEffect(() => {
    if (creditAppId) {
      const app = creditApps.find((a) => a.id === creditAppId);
      if (app) {
        setCustomerId(app.customer_id);
        setProductId(app.product_id || '');
        setPaymentType(app.payment_type);
        setOtrPrice(app.otr_price.toString());
        setDpAmount(app.dp_amount.toString());
        setTenorMonths(app.tenor_months.toString());
        setInstallmentAmount(app.estimated_installment.toString());
        setAdminFee(app.admin_fee.toString());
        setInsuranceFee(app.insurance_fee.toString());
        setPromoDiscount(app.promo_discount.toString());
        setFinanceName(app.finance_name || '');
        if (app.sales_id) setSalesId(app.sales_id);
      }
    }
  }, [creditAppId]);

  useEffect(() => {
    if (selectedCustomer && !creditAppId) {
      if (selectedCustomer.product_id) setProductId(selectedCustomer.product_id);
      if (selectedCustomer.sales_id) setSalesId(selectedCustomer.sales_id);
    }
  }, [selectedCustomer, creditAppId]);

  useEffect(() => {
    if (selectedProduct && !creditAppId) {
      setOtrPrice(selectedProduct.otr.toString());
      const dp = Math.round(selectedProduct.otr * 0.2);
      setDpAmount(dp.toString());
    }
  }, [selectedProduct, creditAppId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId) { setError('Pilih customer terlebih dahulu.'); return; }
    setSaving(true);
    setError(null);

    const { data: spkNo } = await supabase.rpc('generate_spk_number');
    if (!spkNo) { setError('Gagal membuat nomor SPK.'); setSaving(false); return; }

    const product = products.find((p) => p.id === productId);
    const customer = customers.find((c) => c.id === customerId);

    const payload = {
      spk_number: spkNo,
      customer_id: customerId,
      credit_application_id: creditAppId || null,
      product_id: productId || null,
      sales_id: salesId || null,
      created_by: currentUserId,
      motor_name: product?.name || customer?.motor_name || null,
      motor_type: product?.type || null,
      color: color || null,
      otr_price: parseInt(otrPrice) || 0,
      payment_type: paymentType,
      finance_name: paymentType === 'credit' ? (financeName || null) : null,
      dp_amount: parseInt(dpAmount) || 0,
      tenor_months: parseInt(tenorMonths) || 0,
      installment_amount: parseInt(installmentAmount) || 0,
      admin_fee: parseInt(adminFee) || 0,
      insurance_fee: parseInt(insuranceFee) || 0,
      promo_discount: parseInt(promoDiscount) || 0,
      status: 'draft',
      notes: notes || null,
    };

    const { error: insertError } = await supabase.from('spks').insert(payload);
    setSaving(false);
    if (insertError) { setError(getSafeError(insertError)); } else { onSaved(); }
  };

  return (
    <form onSubmit={handleSave} className="space-y-4">
      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {creditApps.length > 0 && (
        <div>
          <Label className="text-sm font-medium">Dari Pengajuan Kredit Approved</Label>
          <select value={creditAppId} onChange={(e) => setCreditAppId(e.target.value)} className="admin-select mt-1.5">
            <option value="">Manual (tanpa kredit)</option>
            {creditApps.map((a) => (
              <option key={a.id} value={a.id}>{a.motor_name} - {formatCurrency(a.otr_price)}</option>
            ))}
          </select>
        </div>
      )}

      <div>
        <Label className="text-sm font-medium">Customer *</Label>
        <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="admin-select mt-1.5" required>
          <option value="">Pilih Customer</option>
          {customers.map((c) => <option key={c.id} value={c.id}>{c.name} - {c.phone}</option>)}
        </select>
      </div>

      {selectedCustomer && (
        <div className="rounded-lg border border-neutral-100 bg-neutral-50 p-3 text-sm">
          <p className="font-medium">{selectedCustomer.name}</p>
          <p className="text-xs text-neutral-500">{selectedCustomer.phone} - {selectedCustomer.motor_name || '-'}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-sm font-medium">Motor</Label>
          <select value={productId} onChange={(e) => setProductId(e.target.value)} className="admin-select mt-1.5">
            <option value="">Pilih Motor</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name} - {formatCurrency(p.otr)}</option>)}
          </select>
        </div>
        <div>
          <Label className="text-sm font-medium">Warna</Label>
          <Input value={color} onChange={(e) => setColor(e.target.value)} placeholder="Warna unit" className="mt-1.5" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-sm font-medium">Tipe Pembayaran</Label>
          <select value={paymentType} onChange={(e) => setPaymentType(e.target.value)} className="admin-select mt-1.5">
            <option value="credit">Kredit</option>
            <option value="cash">Cash</option>
          </select>
        </div>
        <div>
          <Label className="text-sm font-medium">Harga OTR (Rp)</Label>
          <Input type="number" value={otrPrice} onChange={(e) => setOtrPrice(e.target.value)} required className="mt-1.5" />
        </div>
      </div>

      {paymentType === 'credit' && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-medium">Finance</Label>
              <Input value={financeName} onChange={(e) => setFinanceName(e.target.value)} className="mt-1.5" />
            </div>
            <div>
              <Label className="text-sm font-medium">DP (Rp)</Label>
              <Input type="number" value={dpAmount} onChange={(e) => setDpAmount(e.target.value)} className="mt-1.5" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-sm font-medium">Tenor</Label>
              <Input type="number" value={tenorMonths} onChange={(e) => setTenorMonths(e.target.value)} className="mt-1.5" />
            </div>
            <div>
              <Label className="text-sm font-medium">Angsuran (Rp)</Label>
              <Input type="number" value={installmentAmount} onChange={(e) => setInstallmentAmount(e.target.value)} className="mt-1.5" />
            </div>
            <div>
              <Label className="text-sm font-medium">Promo (Rp)</Label>
              <Input type="number" value={promoDiscount} onChange={(e) => setPromoDiscount(e.target.value)} className="mt-1.5" />
            </div>
          </div>
        </>
      )}

      <div>
        <Label className="text-sm font-medium">Sales/PIC</Label>
        <select value={salesId} onChange={(e) => setSalesId(e.target.value)} className="admin-select mt-1.5">
          <option value="">Pilih Sales</option>
          {salesReps.map((r) => <option key={r.id} value={r.id}>{r.full_name}</option>)}
        </select>
      </div>

      <div>
        <Label className="text-sm font-medium">Catatan</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="mt-1.5" />
      </div>

      <Button type="submit" disabled={saving} className="w-full bg-red-600 hover:bg-red-700 text-white">
        {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Menyimpan...</> : 'Simpan SPK'}
      </Button>
    </form>
  );
}

function SpkDetail({ spk, customerName, products, onUpdated }: {
  spk: Spk;
  customerName: string;
  products: Product[];
  onUpdated: () => void;
}) {
  const { profile } = useAuth();
  const [updating, setUpdating] = useState(false);
  const [reserveError, setReserveError] = useState<string | null>(null);

  const handleStatusChange = async (newStatus: string) => {
    setUpdating(true);
    setReserveError(null);

    if (newStatus === 'unit_reserved' && spk.product_id) {
      const { data: success } = await supabase.rpc('reserve_unit', { p_product_id: spk.product_id, p_spk_id: spk.id });
      if (!success) {
        setReserveError('Unit sudah dipesan oleh transaksi lain. Tidak dapat melakukan double reservation.');
        setUpdating(false);
        return;
      }
    }

    const updates: Record<string, unknown> = { status: newStatus, updated_by: profile?.id };
    if (newStatus === 'unit_reserved') updates.unit_reserved_at = new Date().toISOString();

    await supabase.from('spks').update(updates).eq('id', spk.id);
    await supabase.rpc('log_audit_action', {
      p_user_id: profile?.id, p_user_email: profile?.email || null,
      p_action: `spk_status_changed_to_${newStatus}`, p_entity: 'spks', p_entity_id: spk.id,
    });
    setUpdating(false);
    onUpdated();
    window.location.reload();
  };

  const product = products.find((p) => p.id === spk.product_id);
  const unitStatus = product?.reservation_status || 'available';

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-neutral-100 bg-neutral-50 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-mono text-lg font-bold text-red-600">{spk.spk_number}</p>
            <p className="text-sm text-neutral-500">{customerName} - {formatDate(spk.spk_date)}</p>
          </div>
          <StatusBadge status={spk.status} labels={spkStatusLabels} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div><span className="text-neutral-500">Motor:</span> <span className="font-medium">{spk.motor_name || '-'}</span></div>
        <div><span className="text-neutral-500">Warna:</span> <span className="font-medium">{spk.color || '-'}</span></div>
        <div><span className="text-neutral-500">Tipe:</span> <span className="font-medium">{spk.payment_type === 'cash' ? 'Cash' : 'Kredit'}</span></div>
        <div><span className="text-neutral-500">OTR:</span> <span className="font-medium">{formatCurrency(spk.otr_price)}</span></div>
        {spk.payment_type === 'credit' && (
          <>
            <div><span className="text-neutral-500">Finance:</span> <span className="font-medium">{spk.finance_name || '-'}</span></div>
            <div><span className="text-neutral-500">DP:</span> <span className="font-medium">{formatCurrency(spk.dp_amount)}</span></div>
            <div><span className="text-neutral-500">Tenor:</span> <span className="font-medium">{spk.tenor_months}x</span></div>
            <div><span className="text-neutral-500">Angsuran:</span> <span className="font-medium">{formatCurrency(spk.installment_amount)}</span></div>
          </>
        )}
      </div>

      {spk.product_id && (
        <div className="rounded-lg border border-neutral-100 p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-neutral-600">Status Unit</p>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              unitStatus === 'available' ? 'bg-green-100 text-green-700' :
              unitStatus === 'reserved' ? 'bg-orange-100 text-orange-700' :
              unitStatus === 'sold' ? 'bg-blue-100 text-blue-700' :
              'bg-neutral-100 text-neutral-700'
            }`}>{unitStatus}</span>
          </div>
        </div>
      )}

      {spk.notes && <p className="text-sm text-neutral-600">{spk.notes}</p>}

      {reserveError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" /> {reserveError}
        </div>
      )}

      {/* Status Actions */}
      <div className="flex flex-wrap gap-2 border-t border-neutral-100 pt-4">
        {spk.status === 'draft' && spk.payment_type === 'credit' && (
          <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" disabled={updating} onClick={() => handleStatusChange('waiting_credit')}>
            {updating ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null} Menunggu Kredit
          </Button>
        )}
        {spk.status === 'draft' && spk.payment_type === 'cash' && (
          <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" disabled={updating} onClick={() => handleStatusChange('waiting_payment')}>
            {updating ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null} Menunggu Bayar
          </Button>
        )}
        {(spk.status === 'waiting_credit' || spk.status === 'waiting_payment') && (
          <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" disabled={updating} onClick={() => handleStatusChange('approved')}>
            Setujui SPK
          </Button>
        )}
        {spk.status === 'approved' && spk.product_id && (
          <Button size="sm" className="bg-orange-600 hover:bg-orange-700 text-white" disabled={updating} onClick={() => handleStatusChange('unit_reserved')}>
            Reserve Unit
          </Button>
        )}
        {spk.status === 'unit_reserved' && (
          <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white" disabled={updating} onClick={() => handleStatusChange('ready_delivery')}>
            Siap Kirim
          </Button>
        )}
        {spk.status === 'ready_delivery' && (
          <Link href="/admin/deliveries">
            <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white">
              Buat Pengiriman
            </Button>
          </Link>
        )}
        {spk.status !== 'cancelled' && spk.status !== 'completed' && spk.status !== 'delivered' && (
          <Button size="sm" variant="outline" className="text-red-600" disabled={updating} onClick={() => handleStatusChange('cancelled')}>
            Batalkan
          </Button>
        )}
      </div>
    </div>
  );
}
