'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase, CreditApplication, Customer, Product, FinancingProvider, FinanceProgram, Profile } from '@/lib/supabase-client';
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
  CreditCard, Plus, Search, Loader2, ChevronLeft, ChevronRight,
  Eye, ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';
import {
  PageHeader, MetricCard, StatusBadge, LoadingState, ErrorState,
  creditStatusLabels, formatDate, formatCurrency,
} from '@/components/admin/admin-ui';
import { getSafeError } from '@/lib/validation';

const STATUS_FLOW = ['draft', 'submitted', 'in_review', 'survey', 'approved', 'disbursed'];

export default function CreditApplicationsPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const [apps, setApps] = useState<CreditApplication[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [providers, setProviders] = useState<FinancingProvider[]>([]);
  const [programs, setPrograms] = useState<FinanceProgram[]>([]);
  const [salesReps, setSalesReps] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [editingApp, setEditingApp] = useState<CreditApplication | null>(null);
  const [viewingApp, setViewingApp] = useState<CreditApplication | null>(null);
  const pageSize = 10;

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(false);
    let query = supabase.from('credit_applications').select('*', { count: 'exact' });
    if (!isAdmin && profile?.id) query = query.eq('sales_id', profile.id);
    if (statusFilter !== 'all') query = query.eq('status', statusFilter);
    if (search) {
      query = query.or(`motor_name.ilike.%${search}%,finance_name.ilike.%${search}%`);
    }
    query = query.order('created_at', { ascending: false }).range(page * pageSize, (page + 1) * pageSize - 1);
    const { data, error: err, count } = await query;
    if (err) { setError(true); setLoading(false); return; }
    setApps((data || []) as CreditApplication[]);
    setTotal(count || 0);
    setLoading(false);
  }, [isAdmin, profile?.id, statusFilter, search, page]);

  useEffect(() => {
    supabase.from('customers').select('id,name,phone,motor_name,product_id,sales_id').order('name').then(({ data }) => {
      if (data) setCustomers(data as Customer[]);
    });
    supabase.from('products').select('*').eq('status', 'active').order('name').then(({ data }) => {
      if (data) setProducts(data as Product[]);
    });
    supabase.from('financing_providers').select('*').eq('status', 'active').order('name').then(({ data }) => {
      if (data) setProviders(data as FinancingProvider[]);
    });
    supabase.from('finance_programs').select('*').eq('is_active', true).order('name').then(({ data }) => {
      if (data) setPrograms(data as FinanceProgram[]);
    });
    supabase.from('profiles').select('*').eq('role', 'sales').eq('status', 'active').then(({ data }) => {
      if (data) setSalesReps(data as Profile[]);
    });
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { setPage(0); }, [search, statusFilter]);

  const [kpis, setKpis] = useState({ total: 0, new: 0, processing: 0, survey: 0, approved: 0, rejected: 0, disbursed: 0 });

  useEffect(() => {
    (async () => {
      const scope = (q: any) => !isAdmin && profile?.id ? q.eq('sales_id', profile.id) : q;
      const [t, n, p, s, a, r, d] = await Promise.all([
        scope(supabase.from('credit_applications').select('*', { count: 'exact', head: true })),
        scope(supabase.from('credit_applications').select('*', { count: 'exact', head: true })).eq('status', 'submitted'),
        scope(supabase.from('credit_applications').select('*', { count: 'exact', head: true })).in('status', ['in_review', 'revision']),
        scope(supabase.from('credit_applications').select('*', { count: 'exact', head: true })).eq('status', 'survey'),
        scope(supabase.from('credit_applications').select('*', { count: 'exact', head: true })).eq('status', 'approved'),
        scope(supabase.from('credit_applications').select('*', { count: 'exact', head: true })).eq('status', 'rejected'),
        scope(supabase.from('credit_applications').select('*', { count: 'exact', head: true })).eq('status', 'disbursed'),
      ]);
      setKpis({ total: t.count || 0, new: n.count || 0, processing: p.count || 0, survey: s.count || 0, approved: a.count || 0, rejected: r.count || 0, disbursed: d.count || 0 });
    })();
  }, [isAdmin, profile?.id, apps]);

  const totalPages = Math.ceil(total / pageSize);

  const customerName = (id: string) => customers.find((c) => c.id === id)?.name || '-';

  return (
    <div className="space-y-6">
      <PageHeader
        icon={CreditCard}
        title="Pengajuan Kredit"
        description="Kelola seluruh pengajuan kredit customer"
        actions={
          <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={() => { setEditingApp(null); setShowForm(true); }}>
            <Plus className="mr-1 h-4 w-4" /> Tambah Pengajuan
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">
        <MetricCard label="Total" value={kpis.total} icon={CreditCard} color="blue" />
        <MetricCard label="Baru" value={kpis.new} icon={CreditCard} color="cyan" />
        <MetricCard label="Diproses" value={kpis.processing} icon={CreditCard} color="orange" />
        <MetricCard label="Survey" value={kpis.survey} icon={CreditCard} color="amber" />
        <MetricCard label="Approved" value={kpis.approved} icon={CreditCard} color="green" />
        <MetricCard label="Ditolak" value={kpis.rejected} icon={CreditCard} color="red" />
        <MetricCard label="Cair" value={kpis.disbursed} icon={CreditCard} color="green" />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <Input placeholder="Cari motor atau finance..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="admin-select w-full sm:w-48">
          <option value="all">Semua Status</option>
          <option value="draft">Draft</option>
          <option value="submitted">Diajukan</option>
          <option value="in_review">Diproses</option>
          <option value="survey">Survey</option>
          <option value="revision">Revisi</option>
          <option value="approved">Disetujui</option>
          <option value="rejected">Ditolak</option>
          <option value="disbursed">Cair</option>
        </select>
      </div>

      {loading ? <LoadingState label="Memuat pengajuan kredit..." /> : error ? <ErrorState onRetry={fetchData} /> : apps.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 py-16 text-center">
          <CreditCard className="mx-auto mb-3 h-10 w-10 text-neutral-300" />
          <p className="text-sm text-neutral-500">Belum ada pengajuan kredit.</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Motor</TableHead>
                  <TableHead>Finance</TableHead>
                  <TableHead className="text-right">OTR</TableHead>
                  <TableHead className="text-right">DP</TableHead>
                  <TableHead>Tenor</TableHead>
                  <TableHead className="text-right">Angsuran</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tanggal</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apps.map((app) => (
                  <TableRow key={app.id}>
                    <TableCell className="font-medium text-neutral-900">{customerName(app.customer_id)}</TableCell>
                    <TableCell className="text-sm">{app.motor_name || '-'}</TableCell>
                    <TableCell className="text-sm text-neutral-500">{app.finance_name || '-'}</TableCell>
                    <TableCell className="text-right text-sm">{formatCurrency(app.otr_price)}</TableCell>
                    <TableCell className="text-right text-sm">{formatCurrency(app.dp_amount)}</TableCell>
                    <TableCell className="text-sm">{app.tenor_months}x</TableCell>
                    <TableCell className="text-right text-sm">{formatCurrency(app.estimated_installment)}</TableCell>
                    <TableCell><StatusBadge status={app.status} labels={creditStatusLabels} /></TableCell>
                    <TableCell className="text-xs text-neutral-500">{formatDate(app.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => setViewingApp(app)}>
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
          <DialogHeader><DialogTitle>{editingApp ? 'Edit Pengajuan Kredit' : 'Tambah Pengajuan Kredit'}</DialogTitle></DialogHeader>
          <CreditAppForm
            editingApp={editingApp}
            customers={customers}
            products={products}
            providers={providers}
            programs={programs}
            salesReps={salesReps}
            currentUserId={profile?.id}
            onSaved={() => { setShowForm(false); fetchData(); }}
            onCancel={() => setShowForm(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewingApp} onOpenChange={(v) => !v && setViewingApp(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>Detail Pengajuan Kredit</DialogTitle></DialogHeader>
          {viewingApp && <CreditAppDetail app={viewingApp} customerName={customerName(viewingApp.customer_id)} products={products} onEdit={() => { setEditingApp(viewingApp); setViewingApp(null); setShowForm(true); }} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CreditAppForm({ editingApp, customers, products, providers, programs, salesReps, currentUserId, onSaved, onCancel }: {
  editingApp: CreditApplication | null;
  customers: Customer[];
  products: Product[];
  providers: FinancingProvider[];
  programs: FinanceProgram[];
  salesReps: Profile[];
  currentUserId?: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [customerId, setCustomerId] = useState(editingApp?.customer_id || '');
  const [productId, setProductId] = useState(editingApp?.product_id || '');
  const [paymentType, setPaymentType] = useState(editingApp?.payment_type || 'credit');
  const [providerId, setProviderId] = useState(editingApp?.finance_provider_id || '');
  const [programId, setProgramId] = useState(editingApp?.finance_program_id || '');
  const [otrPrice, setOtrPrice] = useState(editingApp?.otr_price.toString() || '');
  const [dpAmount, setDpAmount] = useState(editingApp?.dp_amount.toString() || '');
  const [tenorMonths, setTenorMonths] = useState(editingApp?.tenor_months.toString() || '36');
  const [estimatedInstallment, setEstimatedInstallment] = useState(editingApp?.estimated_installment.toString() || '');
  const [adminFee, setAdminFee] = useState(editingApp?.admin_fee.toString() || '');
  const [insuranceFee, setInsuranceFee] = useState(editingApp?.insurance_fee.toString() || '');
  const [promoDiscount, setPromoDiscount] = useState(editingApp?.promo_discount.toString() || '');
  const [occupation, setOccupation] = useState(editingApp?.occupation || '');
  const [monthlyIncome, setMonthlyIncome] = useState(editingApp?.monthly_income?.toString() || '');
  const [residenceStatus, setResidenceStatus] = useState(editingApp?.residence_status || '');
  const [employmentYears, setEmploymentYears] = useState(editingApp?.employment_years?.toString() || '');
  const [notes, setNotes] = useState(editingApp?.notes || '');
  const [salesId, setSalesId] = useState(editingApp?.sales_id || currentUserId || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedCustomer = customers.find((c) => c.id === customerId);
  const selectedProduct = products.find((p) => p.id === productId);

  useEffect(() => {
    if (selectedProduct && !editingApp) {
      setOtrPrice(selectedProduct.otr.toString());
      const dp = Math.round(selectedProduct.otr * 0.2);
      setDpAmount(dp.toString());
    }
  }, [selectedProduct, editingApp]);

  useEffect(() => {
    if (selectedCustomer && !editingApp) {
      if (selectedCustomer.product_id) setProductId(selectedCustomer.product_id);
      if (selectedCustomer.sales_id) setSalesId(selectedCustomer.sales_id);
    }
  }, [selectedCustomer, editingApp]);

  useEffect(() => {
    if (paymentType === 'cash') {
      setProviderId('');
      setProgramId('');
      setTenorMonths('0');
      setEstimatedInstallment('0');
    }
  }, [paymentType]);

  const selectedProvider = providers.find((p) => p.id === providerId);
  const selectedProgram = programs.find((p) => p.id === programId);

  useEffect(() => {
    if (selectedProgram) {
      setTenorMonths(selectedProgram.tenor_months.toString());
      setAdminFee(selectedProgram.admin_fee.toString());
      setInsuranceFee(selectedProgram.insurance_fee.toString());
      if (selectedProvider) {
        const otr = parseInt(otrPrice) || 0;
        const dp = parseInt(dpAmount) || 0;
        const principal = otr - dp + (selectedProgram.admin_fee || 0) + (selectedProgram.insurance_fee || 0);
        const install = Math.round(principal / selectedProgram.tenor_months);
        setEstimatedInstallment(install.toString());
      }
    }
  }, [selectedProgram, selectedProvider]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId) { setError('Pilih customer terlebih dahulu.'); return; }
    setSaving(true);
    setError(null);

    const provider = providers.find((p) => p.id === providerId);
    const product = products.find((p) => p.id === productId);
    const customer = customers.find((c) => c.id === customerId);

    const payload = {
      customer_id: customerId,
      product_id: productId || null,
      finance_provider_id: paymentType === 'credit' ? (providerId || null) : null,
      finance_program_id: paymentType === 'credit' ? (programId || null) : null,
      motor_name: product?.name || customer?.motor_name || null,
      motor_type: product?.type || null,
      otr_price: parseInt(otrPrice) || 0,
      dp_amount: parseInt(dpAmount) || 0,
      tenor_months: parseInt(tenorMonths) || 0,
      estimated_installment: parseInt(estimatedInstallment) || 0,
      admin_fee: parseInt(adminFee) || 0,
      insurance_fee: parseInt(insuranceFee) || 0,
      promo_discount: parseInt(promoDiscount) || 0,
      finance_name: paymentType === 'credit' ? (provider?.name || null) : null,
      finance_code: provider?.code || null,
      occupation: occupation || null,
      monthly_income: parseInt(monthlyIncome) || null,
      residence_status: residenceStatus || null,
      employment_years: parseInt(employmentYears) || null,
      payment_type: paymentType,
      notes: notes || null,
      sales_id: salesId || null,
    };

    let result;
    if (editingApp) {
      result = await supabase.from('credit_applications').update({ ...payload, updated_by: currentUserId }).eq('id', editingApp.id);
    } else {
      result = await supabase.from('credit_applications').insert({ ...payload, created_by: currentUserId, status: 'draft' });
    }

    setSaving(false);
    if (result.error) { setError(getSafeError(result.error)); } else { onSaved(); }
  };

  return (
    <form onSubmit={handleSave} className="space-y-4">
      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs text-blue-700">
        Estimasi angsuran bersifat perhitungan awal. Angka final mengikuti hasil approval Finance/Leasing.
      </div>

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
          <Label className="text-sm font-medium">Tipe Pembayaran</Label>
          <select value={paymentType} onChange={(e) => setPaymentType(e.target.value)} className="admin-select mt-1.5">
            <option value="credit">Kredit</option>
            <option value="cash">Cash</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-sm font-medium">Harga OTR (Rp)</Label>
          <Input type="number" value={otrPrice} onChange={(e) => setOtrPrice(e.target.value)} required className="mt-1.5" />
        </div>
        <div>
          <Label className="text-sm font-medium">DP (Rp)</Label>
          <Input type="number" value={dpAmount} onChange={(e) => setDpAmount(e.target.value)} className="mt-1.5" />
        </div>
      </div>

      {paymentType === 'credit' && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-medium">Finance/Leasing</Label>
              <select value={providerId} onChange={(e) => { setProviderId(e.target.value); setProgramId(''); }} className="admin-select mt-1.5">
                <option value="">Pilih Finance</option>
                {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-sm font-medium">Program</Label>
              <select value={programId} onChange={(e) => setProgramId(e.target.value)} className="admin-select mt-1.5" disabled={!providerId}>
                <option value="">Pilih Program</option>
                {programs.filter((p) => !providerId || p.provider_id === providerId).map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.tenor_months}x)</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-sm font-medium">Tenor (bln)</Label>
              <Input type="number" value={tenorMonths} onChange={(e) => setTenorMonths(e.target.value)} className="mt-1.5" />
            </div>
            <div>
              <Label className="text-sm font-medium">Angsuran (Rp)</Label>
              <Input type="number" value={estimatedInstallment} onChange={(e) => setEstimatedInstallment(e.target.value)} className="mt-1.5" />
            </div>
            <div>
              <Label className="text-sm font-medium">Promo/Subsidi (Rp)</Label>
              <Input type="number" value={promoDiscount} onChange={(e) => setPromoDiscount(e.target.value)} className="mt-1.5" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-medium">Biaya Admin (Rp)</Label>
              <Input type="number" value={adminFee} onChange={(e) => setAdminFee(e.target.value)} className="mt-1.5" />
            </div>
            <div>
              <Label className="text-sm font-medium">Asuransi (Rp)</Label>
              <Input type="number" value={insuranceFee} onChange={(e) => setInsuranceFee(e.target.value)} className="mt-1.5" />
            </div>
          </div>

          <div className="rounded-lg border border-neutral-100 bg-neutral-50 p-3">
            <p className="text-xs font-semibold text-neutral-600">Estimasi Total Pembayaran</p>
            <p className="mt-1 text-lg font-bold text-red-600">
              {formatCurrency((parseInt(dpAmount) || 0) + (parseInt(estimatedInstallment) || 0) * (parseInt(tenorMonths) || 0))}
            </p>
            <p className="mt-1 text-xs text-neutral-400">Estimasi — angka final mengikuti hasil approval Finance/Leasing.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-medium">Pekerjaan</Label>
              <Input value={occupation} onChange={(e) => setOccupation(e.target.value)} className="mt-1.5" />
            </div>
            <div>
              <Label className="text-sm font-medium">Penghasilan/Bln (Rp)</Label>
              <Input type="number" value={monthlyIncome} onChange={(e) => setMonthlyIncome(e.target.value)} className="mt-1.5" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-medium">Status Tempat Tinggal</Label>
              <select value={residenceStatus} onChange={(e) => setResidenceStatus(e.target.value)} className="admin-select mt-1.5">
                <option value="">Pilih</option>
                <option value="own">Milik Sendiri</option>
                <option value="rent">Sewa</option>
                <option value="family">Keluarga</option>
                <option value="dinas">Rumah Dinas</option>
              </select>
            </div>
            <div>
              <Label className="text-sm font-medium">Lama Bekerja (thn)</Label>
              <Input type="number" value={employmentYears} onChange={(e) => setEmploymentYears(e.target.value)} className="mt-1.5" />
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
        {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Menyimpan...</> : 'Simpan'}
      </Button>
    </form>
  );
}

function CreditAppDetail({ app, customerName, products, onEdit }: {
  app: CreditApplication;
  customerName: string;
  products: Product[];
  onEdit: () => void;
}) {
  const { profile } = useAuth();
  const [updating, setUpdating] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState(false);

  const handleStatusChange = async (newStatus: string) => {
    setUpdating(true);
    const updates: Record<string, unknown> = { status: newStatus, updated_by: profile?.id };
    if (newStatus === 'submitted') updates.submitted_at = new Date().toISOString();
    if (newStatus === 'approved') updates.approved_at = new Date().toISOString();
    if (newStatus === 'rejected') {
      updates.rejected_at = new Date().toISOString();
      updates.rejected_reason = rejectReason || null;
    }
    if (newStatus === 'disbursed') updates.disbursed_at = new Date().toISOString();

    await supabase.from('credit_applications').update(updates).eq('id', app.id);
    await supabase.rpc('log_audit_action', {
      p_user_id: profile?.id, p_user_email: profile?.email || null,
      p_action: `credit_status_changed_to_${newStatus}`, p_entity: 'credit_applications', p_entity_id: app.id,
    });
    setUpdating(false);
    window.location.reload();
  };

  const canAdvance = (current: string, next: string) => STATUS_FLOW.indexOf(current) < STATUS_FLOW.indexOf(next);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-neutral-100 bg-neutral-50 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-neutral-900">{customerName}</p>
            <p className="text-sm text-neutral-500">{app.motor_name} - {formatCurrency(app.otr_price)}</p>
          </div>
          <StatusBadge status={app.status} labels={creditStatusLabels} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div><span className="text-neutral-500">Tipe:</span> <span className="font-medium">{app.payment_type === 'cash' ? 'Cash' : 'Kredit'}</span></div>
        <div><span className="text-neutral-500">Finance:</span> <span className="font-medium">{app.finance_name || '-'}</span></div>
        <div><span className="text-neutral-500">DP:</span> <span className="font-medium">{formatCurrency(app.dp_amount)}</span></div>
        <div><span className="text-neutral-500">Tenor:</span> <span className="font-medium">{app.tenor_months}x</span></div>
        <div><span className="text-neutral-500">Angsuran:</span> <span className="font-medium">{formatCurrency(app.estimated_installment)}</span></div>
        <div><span className="text-neutral-500">Admin Fee:</span> <span className="font-medium">{formatCurrency(app.admin_fee)}</span></div>
        <div><span className="text-neutral-500">Asuransi:</span> <span className="font-medium">{formatCurrency(app.insurance_fee)}</span></div>
        <div><span className="text-neutral-500">Promo:</span> <span className="font-medium">{formatCurrency(app.promo_discount)}</span></div>
      </div>

      {(app.occupation || app.monthly_income || app.residence_status) && (
        <div className="rounded-lg border border-neutral-100 p-3">
          <p className="text-xs font-semibold text-neutral-600">Data Pemohon</p>
          <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
            <div>Pekerjaan: {app.occupation || '-'}</div>
            <div>Penghasilan: {app.monthly_income ? formatCurrency(app.monthly_income) : '-'}</div>
            <div>Tempat Tinggal: {app.residence_status || '-'}</div>
            <div>Lama Bekerja: {app.employment_years ? `${app.employment_years} thn` : '-'}</div>
          </div>
        </div>
      )}

      {app.notes && <p className="text-sm text-neutral-600">{app.notes}</p>}

      {app.rejected_reason && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Alasan Ditolak: {app.rejected_reason}
        </div>
      )}

      {/* Status Actions */}
      <div className="flex flex-wrap gap-2 border-t border-neutral-100 pt-4">
        {app.status === 'draft' && (
          <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" disabled={updating} onClick={() => handleStatusChange('submitted')}>
            {updating ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null} Ajukan
          </Button>
        )}
        {canAdvance(app.status, 'in_review') && app.status !== 'approved' && app.status !== 'disbursed' && (
          <Button size="sm" variant="outline" disabled={updating} onClick={() => handleStatusChange('in_review')}>
            Proses Review
          </Button>
        )}
        {app.status === 'in_review' && (
          <Button size="sm" variant="outline" disabled={updating} onClick={() => handleStatusChange('survey')}>
            Jadwalkan Survey
          </Button>
        )}
        {app.status === 'survey' && (
          <>
            <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" disabled={updating} onClick={() => handleStatusChange('approved')}>
              Setujui
            </Button>
            <Button size="sm" variant="outline" disabled={updating} onClick={() => handleStatusChange('revision')}>
              Minta Revisi
            </Button>
            <Button size="sm" variant="outline" className="text-red-600" disabled={updating} onClick={() => setShowReject(true)}>
              Tolak
            </Button>
          </>
        )}
        {app.status === 'revision' && (
          <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" disabled={updating} onClick={() => handleStatusChange('in_review')}>
            Resubmit
          </Button>
        )}
        {app.status === 'approved' && (
          <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" disabled={updating} onClick={() => handleStatusChange('disbursed')}>
            Pencairan
          </Button>
        )}
        {(app.status === 'draft' || app.status === 'submitted') && (
          <Button size="sm" variant="outline" className="text-red-600" disabled={updating} onClick={() => handleStatusChange('cancelled')}>
            Batalkan
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={onEdit}>Edit</Button>
        {app.status === 'approved' && (
          <Link href="/admin/spk">
            <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white">
              Buat SPK
            </Button>
          </Link>
        )}
      </div>

      {showReject && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 space-y-2">
          <Label className="text-sm font-medium text-red-700">Alasan Penolakan</Label>
          <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={2} placeholder="Contoh: KTP tidak terbaca..." />
          <div className="flex gap-2">
            <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white" disabled={updating || !rejectReason} onClick={() => handleStatusChange('rejected')}>
              Konfirmasi Tolak
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowReject(false)}>Batal</Button>
          </div>
        </div>
      )}
    </div>
  );
}
