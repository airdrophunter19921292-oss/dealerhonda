'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase, Product, FinancingPlan, FinancingProvider, FinanceProgram } from '@/lib/supabase-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Pencil, Trash2, Search, Wallet, AlertTriangle, Loader2, Building2, Layers } from 'lucide-react';
import { getSafeError } from '@/lib/validation';

export default function AdminFinancingPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [plans, setPlans] = useState<FinancingPlan[]>([]);
  const [providers, setProviders] = useState<FinancingProvider[]>([]);
  const [programs, setPrograms] = useState<FinanceProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState<FinancingPlan | null>(null);
  const [showProgramForm, setShowProgramForm] = useState(false);
  const [editingProgram, setEditingProgram] = useState<FinanceProgram | null>(null);
  const [programSearch, setProgramSearch] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [{ data: pds }, { data: pls }, { data: provs }, { data: fprogs }] = await Promise.all([
      supabase.from('products').select('*').order('sort_order', { ascending: true }),
      supabase.from('financing_plans').select('*').order('sort_order', { ascending: true }),
      supabase.from('financing_providers').select('*').order('name', { ascending: true }),
      supabase.from('finance_programs').select('*').order('created_at', { ascending: false }),
    ]);
    if (pds) setProducts(pds as Product[]);
    if (pls) setPlans(pls as FinancingPlan[]);
    if (provs) setProviders(provs as FinancingProvider[]);
    if (fprogs) setPrograms(fprogs as FinanceProgram[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const filteredPrograms = programs.filter((p) => {
    const q = programSearch.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      (p.code || '').toLowerCase().includes(q) ||
      (p.promo || '').toLowerCase().includes(q)
    );
  });

  const getProductPlans = (productId: string) => plans.filter((p) => p.product_id === productId);
  const getProviderName = (id: string | null) => providers.find((p) => p.id === id)?.name || '-';
  const getProgramCount = (providerId: string | null) =>
    programs.filter((p) => p.provider_id === providerId).length;

  const handleDelete = async (id: string) => {
    await supabase.from('financing_plans').delete().eq('id', id);
    fetchData();
  };

  const handleDeleteProgram = async (id: string) => {
    const { data: usage } = await supabase
      .from('credit_applications')
      .select('id', { count: 'exact', head: true })
      .eq('finance_program_id', id);
    if (usage && (usage as any).count > 0) {
      alert('Program sudah digunakan oleh pengajuan kredit. Nonaktifkan saja, jangan hapus.');
      return;
    }
    const { data: spkUsage } = await supabase
      .from('spks')
      .select('id', { count: 'exact', head: true })
      .eq('credit_application_id', id);
    if (spkUsage && (spkUsage as any).count > 0) {
      alert('Program sudah terhubung dengan SPK. Nonaktifkan saja, jangan hapus.');
      return;
    }
    await supabase.from('finance_programs').delete().eq('id', id);
    fetchData();
  };

  const handleToggleProgram = async (prog: FinanceProgram) => {
    await supabase.from('finance_programs').update({ is_active: !prog.is_active }).eq('id', prog.id);
    fetchData();
  };

  const today = new Date().toDateString();
  const isExpired = (validUntil: string | null) => {
    if (!validUntil) return false;
    return new Date(validUntil).toDateString() < today;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Harga & Kredit</h1>
          <p className="mt-1 text-sm text-neutral-500">Kelola paket pembiayaan dan program finance/leasing</p>
        </div>
      </div>

      <Tabs defaultValue="plans">
        <TabsList>
          <TabsTrigger value="plans">Paket Kredit per Produk</TabsTrigger>
          <TabsTrigger value="programs">Program Finance / Leasing</TabsTrigger>
        </TabsList>

        {/* TAB: Per-Product Financing Plans (existing) */}
        <TabsContent value="plans" className="space-y-4 mt-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <Input
              placeholder="Cari motor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {loading ? (
            <div className="flex h-40 items-center justify-center text-neutral-400"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Memuat...</div>
          ) : filteredProducts.length === 0 ? (
            <div className="rounded-lg border border-dashed border-neutral-300 py-16 text-center">
              <Wallet className="mx-auto mb-3 h-10 w-10 text-neutral-300" />
              <p className="text-sm text-neutral-500">Belum ada produk.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredProducts.map((product) => {
                const productPlans = getProductPlans(product.id);
                return (
                  <div key={product.id} className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
                    <div className="flex items-center justify-between border-b border-neutral-100 p-4">
                      <div>
                        <h3 className="font-semibold text-neutral-900">{product.name}</h3>
                        <p className="text-xs text-neutral-500">{product.category} • OTR Rp{product.otr.toLocaleString('id-ID')}</p>
                      </div>
                      <Button
                        size="sm"
                        className="bg-red-600 hover:bg-red-700 text-white"
                        onClick={() => {
                          setSelectedProduct(product);
                          setEditingPlan(null);
                          setShowForm(true);
                        }}
                      >
                        <Plus className="mr-1 h-3 w-3" />
                        Tambah Paket
                      </Button>
                    </div>
                    {productPlans.length === 0 ? (
                      <p className="p-4 text-sm text-neutral-400">Belum ada paket kredit.</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>DP</TableHead>
                            <TableHead className="text-right">35x</TableHead>
                            <TableHead className="text-right">47x</TableHead>
                            <TableHead>Provider</TableHead>
                            <TableHead>Periode</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Aksi</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {productPlans.map((plan) => (
                            <TableRow key={plan.id}>
                              <TableCell className="font-medium text-red-600">Rp{plan.dp.toLocaleString('id-ID')}</TableCell>
                              <TableCell className="text-right">Rp{plan.tenor35.toLocaleString('id-ID')}</TableCell>
                              <TableCell className="text-right">Rp{plan.tenor47.toLocaleString('id-ID')}</TableCell>
                              <TableCell className="text-sm text-neutral-500">{plan.provider || '-'}</TableCell>
                              <TableCell className="text-xs text-neutral-500">
                                {plan.valid_from || '-'} s/d {plan.valid_until || '-'}
                              </TableCell>
                              <TableCell>
                                {isExpired(plan.valid_until) ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700">
                                    <AlertTriangle className="h-3 w-3" /> Expired
                                  </span>
                                ) : plan.status === 'active' ? (
                                  <Badge>Active</Badge>
                                ) : (
                                  <Badge variant="secondary">Inactive</Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setSelectedProduct(product);
                                      setEditingPlan(plan);
                                      setShowForm(true);
                                    }}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button variant="ghost" size="sm">
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Hapus paket kredit?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Paket akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Batal</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDelete(plan.id)}>
                                          Ya, Hapus
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <Dialog open={showForm} onOpenChange={setShowForm}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingPlan ? 'Edit Paket Kredit' : 'Tambah Paket Kredit'}
                  {selectedProduct && ` — ${selectedProduct.name}`}
                </DialogTitle>
              </DialogHeader>
              <FinancingForm
                product={selectedProduct}
                plan={editingPlan}
                onSaved={() => {
                  setShowForm(false);
                  fetchData();
                }}
              />
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* TAB: Finance Programs CRUD (new) */}
        <TabsContent value="programs" className="space-y-4 mt-4">
          <div className="flex items-center justify-between gap-4">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <Input
                placeholder="Cari program..."
                value={programSearch}
                onChange={(e) => setProgramSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => {
                setEditingProgram(null);
                setShowProgramForm(true);
              }}
            >
              <Plus className="mr-1 h-4 w-4" /> Tambah Program
            </Button>
          </div>

          {loading ? (
            <div className="flex h-40 items-center justify-center text-neutral-400"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Memuat...</div>
          ) : filteredPrograms.length === 0 ? (
            <div className="rounded-lg border border-dashed border-neutral-300 py-16 text-center">
              <Layers className="mx-auto mb-3 h-10 w-10 text-neutral-300" />
              <p className="text-sm text-neutral-500">Belum ada program finance/leasing.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Group by provider */}
              {providers.length > 0 && providers.map((provider) => {
                const providerPrograms = filteredPrograms.filter((p) => p.provider_id === provider.id);
                if (providerPrograms.length === 0) return null;
                return (
                  <div key={provider.id} className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
                    <div className="flex items-center justify-between border-b border-neutral-100 p-4">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-neutral-400" />
                        <div>
                          <h3 className="font-semibold text-neutral-900">{provider.name}</h3>
                          <p className="text-xs text-neutral-500">{provider.code || '-'} • {providerPrograms.length} program</p>
                        </div>
                      </div>
                      <Badge variant={provider.status === 'active' ? 'default' : 'secondary'}>
                        {provider.status === 'active' ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <ProgramsTable
                      programs={providerPrograms}
                      onEdit={(p) => { setEditingProgram(p); setShowProgramForm(true); }}
                      onDelete={handleDeleteProgram}
                      onToggle={handleToggleProgram}
                    />
                  </div>
                );
              })}

              {/* Programs without provider */}
              {(() => {
                const noProvider = filteredPrograms.filter((p) => !p.provider_id || !providers.find((pr) => pr.id === p.provider_id));
                if (noProvider.length === 0) return null;
                return (
                  <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
                    <div className="flex items-center justify-between border-b border-neutral-100 p-4">
                      <div className="flex items-center gap-2">
                        <Layers className="h-5 w-5 text-neutral-400" />
                        <div>
                          <h3 className="font-semibold text-neutral-900">Tanpa Provider</h3>
                          <p className="text-xs text-neutral-500">{noProvider.length} program</p>
                        </div>
                      </div>
                    </div>
                    <ProgramsTable
                      programs={noProvider}
                      onEdit={(p) => { setEditingProgram(p); setShowProgramForm(true); }}
                      onDelete={handleDeleteProgram}
                      onToggle={handleToggleProgram}
                    />
                  </div>
                );
              })()}
            </div>
          )}

          <Dialog open={showProgramForm} onOpenChange={setShowProgramForm}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingProgram ? 'Edit Program Finance' : 'Tambah Program Finance'}
                </DialogTitle>
              </DialogHeader>
              <ProgramForm
                providers={providers}
                program={editingProgram}
                onSaved={() => {
                  setShowProgramForm(false);
                  fetchData();
                }}
              />
            </DialogContent>
          </Dialog>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ProgramsTable({
  programs,
  onEdit,
  onDelete,
  onToggle,
}: {
  programs: FinanceProgram[];
  onEdit: (p: FinanceProgram) => void;
  onDelete: (id: string) => void;
  onToggle: (p: FinanceProgram) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Program</TableHead>
          <TableHead>Kode</TableHead>
          <TableHead>Tenor</TableHead>
          <TableHead>Min DP</TableHead>
          <TableHead>Periode</TableHead>
          <TableHead>Promo</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Aksi</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {programs.map((prog) => (
          <TableRow key={prog.id}>
            <TableCell className="font-medium text-neutral-900">{prog.name}</TableCell>
            <TableCell className="text-xs text-neutral-500">{prog.code || '-'}</TableCell>
            <TableCell className="text-sm text-neutral-600">{prog.tenor_months} bln</TableCell>
            <TableCell className="text-sm text-neutral-600">{prog.min_dp_percent ? `${prog.min_dp_percent}%` : '-'}</TableCell>
            <TableCell className="text-xs text-neutral-500">
              {prog.valid_from || '-'} s/d {prog.valid_until || '-'}
            </TableCell>
            <TableCell className="text-sm text-neutral-600">{prog.promo || '-'}</TableCell>
            <TableCell>
              {prog.is_active ? (
                <Badge>Active</Badge>
              ) : (
                <Badge variant="secondary">Inactive</Badge>
              )}
            </TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-1">
                <Button variant="ghost" size="sm" onClick={() => onToggle(prog)} title={prog.is_active ? 'Nonaktifkan' : 'Aktifkan'}>
                  {prog.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => onEdit(prog)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Hapus program finance?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Jika program sudah digunakan oleh transaksi, gunakan tombol Nonaktifkan sebagai gantinya.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Batal</AlertDialogCancel>
                      <AlertDialogAction onClick={() => onDelete(prog.id)}>
                        Ya, Hapus
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function ProgramForm({
  providers,
  program,
  onSaved,
}: {
  providers: FinancingProvider[];
  program: FinanceProgram | null;
  onSaved: () => void;
}) {
  const [name, setName] = useState(program?.name || '');
  const [code, setCode] = useState(program?.code || '');
  const [providerId, setProviderId] = useState(program?.provider_id || '');
  const [tenorMonths, setTenorMonths] = useState(program?.tenor_months?.toString() || '36');
  const [minDpPercent, setMinDpPercent] = useState(program?.min_dp_percent?.toString() || '20');
  const [rate, setRate] = useState(program?.rate?.toString() || '');
  const [adminFee, setAdminFee] = useState(program?.admin_fee?.toString() || '0');
  const [insuranceFee, setInsuranceFee] = useState(program?.insurance_fee?.toString() || '0');
  const [promo, setPromo] = useState(program?.promo || '');
  const [validFrom, setValidFrom] = useState(program?.valid_from || '');
  const [validUntil, setValidUntil] = useState(program?.valid_until || '');
  const [isActive, setIsActive] = useState(program?.is_active ?? true);
  const [notes, setNotes] = useState(program?.notes || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      name,
      code: code || null,
      provider_id: providerId || null,
      tenor_months: parseInt(tenorMonths) || 0,
      min_dp_percent: parseFloat(minDpPercent) || 0,
      rate: rate ? parseFloat(rate) : null,
      admin_fee: parseInt(adminFee) || 0,
      insurance_fee: parseInt(insuranceFee) || 0,
      promo: promo || null,
      valid_from: validFrom || null,
      valid_until: validUntil || null,
      is_active: isActive,
      notes: notes || null,
    };

    let result;
    if (program) {
      result = await supabase.from('finance_programs').update(payload).eq('id', program.id);
    } else {
      result = await supabase.from('finance_programs').insert(payload);
    }

    setSaving(false);
    if (result.error) {
      setError(getSafeError(result.error));
    } else {
      onSaved();
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium">Nama Program</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} required className="mt-1.5" />
        </div>
        <div>
          <label className="text-sm font-medium">Kode</label>
          <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Opsional" className="mt-1.5" />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium">Finance / Leasing Provider</label>
        <select
          value={providerId}
          onChange={(e) => setProviderId(e.target.value)}
          className="mt-1.5 h-10 w-full rounded-md border border-input bg-white px-3 text-sm"
        >
          <option value="">— Tanpa Provider —</option>
          {providers.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium">Tenor (bulan)</label>
          <Input type="number" value={tenorMonths} onChange={(e) => setTenorMonths(e.target.value)} required className="mt-1.5" />
        </div>
        <div>
          <label className="text-sm font-medium">Min DP (%)</label>
          <Input type="number" value={minDpPercent} onChange={(e) => setMinDpPercent(e.target.value)} className="mt-1.5" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-sm font-medium">Rate (%)</label>
          <Input type="number" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="Opsional" className="mt-1.5" />
        </div>
        <div>
          <label className="text-sm font-medium">Admin Fee (Rp)</label>
          <Input type="number" value={adminFee} onChange={(e) => setAdminFee(e.target.value)} className="mt-1.5" />
        </div>
        <div>
          <label className="text-sm font-medium">Asuransi (Rp)</label>
          <Input type="number" value={insuranceFee} onChange={(e) => setInsuranceFee(e.target.value)} className="mt-1.5" />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium">Promo</label>
        <Input value={promo} onChange={(e) => setPromo(e.target.value)} placeholder="Opsional" className="mt-1.5" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium">Berlaku Dari</label>
          <Input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} className="mt-1.5" />
        </div>
        <div>
          <label className="text-sm font-medium">Berlaku Sampai</label>
          <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className="mt-1.5" />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium">Catatan</label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opsional" rows={2} className="mt-1.5" />
      </div>
      <div className="flex items-center gap-2">
        <input type="checkbox" id="is-active" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-4 w-4" />
        <label htmlFor="is-active" className="text-sm font-medium">Aktif</label>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={saving} className="w-full bg-red-600 hover:bg-red-700 text-white">
        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {saving ? 'Menyimpan...' : 'Simpan'}
      </Button>
    </form>
  );
}

function FinancingForm({ product, plan, onSaved }: { product: Product | null; plan: FinancingPlan | null; onSaved: () => void }) {
  const [dp, setDp] = useState(plan?.dp.toString() || '');
  const [tenor35, setTenor35] = useState(plan?.tenor35.toString() || '');
  const [tenor47, setTenor47] = useState(plan?.tenor47.toString() || '');
  const [provider, setProvider] = useState(plan?.provider || '');
  const [validFrom, setValidFrom] = useState(plan?.valid_from || '');
  const [validUntil, setValidUntil] = useState(plan?.valid_until || '');
  const [status, setStatus] = useState(plan?.status || 'active');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;
    setSaving(true);
    setError(null);

    const payload = {
      product_id: product.id,
      dp: parseInt(dp) || 0,
      tenor35: parseInt(tenor35) || 0,
      tenor47: parseInt(tenor47) || 0,
      provider: provider || null,
      valid_from: validFrom || null,
      valid_until: validUntil || null,
      status,
      sort_order: plan?.sort_order || 0,
    };

    let result;
    if (plan) {
      result = await supabase.from('financing_plans').update(payload).eq('id', plan.id);
    } else {
      result = await supabase.from('financing_plans').insert(payload);
    }

    setSaving(false);
    if (result.error) {
      setError(getSafeError(result.error));
    } else {
      onSaved();
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium">DP (Rp)</label>
          <Input type="number" value={dp} onChange={(e) => setDp(e.target.value)} required className="mt-1.5" />
        </div>
        <div>
          <label className="text-sm font-medium">Provider Leasing</label>
          <Input value={provider} onChange={(e) => setProvider(e.target.value)} placeholder="Opsional" className="mt-1.5" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium">Cicilan 35x (Rp)</label>
          <Input type="number" value={tenor35} onChange={(e) => setTenor35(e.target.value)} required className="mt-1.5" />
        </div>
        <div>
          <label className="text-sm font-medium">Cicilan 47x (Rp)</label>
          <Input type="number" value={tenor47} onChange={(e) => setTenor47(e.target.value)} required className="mt-1.5" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium">Berlaku Dari</label>
          <Input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} className="mt-1.5" />
        </div>
        <div>
          <label className="text-sm font-medium">Berlaku Sampai</label>
          <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className="mt-1.5" />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium">Status</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="mt-1.5 h-10 w-full rounded-md border border-input bg-white px-3 text-sm"
        >
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={saving} className="w-full bg-red-600 hover:bg-red-700 text-white">
        {saving ? 'Menyimpan...' : 'Simpan'}
      </Button>
    </form>
  );
}
