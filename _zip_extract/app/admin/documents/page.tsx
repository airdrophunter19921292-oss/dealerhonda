'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase, CustomerDocument, Customer } from '@/lib/supabase-client';
import { useAuth } from '@/lib/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  FileText, Search, Loader2, ChevronLeft, ChevronRight,
  CheckCircle, XCircle, Upload, Eye,
} from 'lucide-react';
import {
  PageHeader, MetricCard, StatusBadge, LoadingState, ErrorState,
  documentStatusLabels, formatDate,
} from '@/components/admin/admin-ui';
import { getSafeError } from '@/lib/validation';
import { cn } from '@/lib/utils';

const CATEGORY_LABELS: Record<string, string> = {
  customer: 'Customer',
  credit: 'Kredit',
  spk: 'SPK',
  delivery: 'Pengiriman',
};

const DOC_TYPES: Record<string, { type: string; label: string; required: boolean }[]> = {
  customer: [
    { type: 'ktp', label: 'KTP', required: true },
    { type: 'kk', label: 'Kartu Keluarga', required: true },
    { type: 'additional', label: 'Dokumen Tambahan', required: false },
  ],
  credit: [
    { type: 'application_form', label: 'Form Pengajuan', required: true },
    { type: 'ktp_copy', label: 'Copy KTP', required: true },
    { type: 'survey_doc', label: 'Dokumen Survey', required: false },
    { type: 'approval_doc', label: 'Approval', required: false },
  ],
  spk: [
    { type: 'spk_doc', label: 'Dokumen SPK', required: true },
    { type: 'payment_proof', label: 'Bukti Pembayaran', required: true },
    { type: 'transaction_doc', label: 'Dokumen Transaksi', required: false },
  ],
  delivery: [
    { type: 'surat_jalan', label: 'Surat Jalan', required: true },
    { type: 'serah_terima', label: 'Bukti Serah Terima', required: false },
    { type: 'delivery_photo', label: 'Foto Serah Terima', required: false },
  ],
};

export default function DocumentsPage() {
  const { profile } = useAuth();
  const [docs, setDocs] = useState<CustomerDocument[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [showChecklist, setShowChecklist] = useState<Customer | null>(null);
  const pageSize = 10;

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(false);
    let query = supabase.from('customer_documents').select('*, customers!customer_documents_customer_id_fkey(name,phone)', { count: 'exact' });
    if (categoryFilter !== 'all') query = query.eq('category', categoryFilter);
    if (statusFilter !== 'all') query = query.eq('status', statusFilter);
    if (search.trim()) {
      const s = search.trim();
      const { data: matchedCustomers } = await supabase.from('customers').select('id').ilike('name', `%${s}%`);
      const customerIds = (matchedCustomers || []).map((c) => c.id);
      const { data: matchedSpks } = await supabase.from('spks').select('id').ilike('spk_number', `%${s}%`);
      const spkIds = (matchedSpks || []).map((s2) => s2.id);
      const conditions: string[] = [`label.ilike.%${s}%`, `file_name.ilike.%${s}%`];
      if (customerIds.length > 0) conditions.push(`customer_id.in.(${customerIds.join(',')})`);
      if (spkIds.length > 0) conditions.push(`spk_id.in.(${spkIds.join(',')})`);
      query = query.or(conditions.join(','));
    }
    query = query.order('created_at', { ascending: false }).range(page * pageSize, (page + 1) * pageSize - 1);
    const { data, error: err, count } = await query;
    if (err) { setError(true); setLoading(false); return; }
    setDocs((data || []) as CustomerDocument[]);
    setTotal(count || 0);
    setLoading(false);
  }, [categoryFilter, statusFilter, page, search]);

  useEffect(() => {
    supabase.from('customers').select('id,name,phone').order('name').then(({ data }) => {
      if (data) setCustomers(data as Customer[]);
    });
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { setPage(0); }, [search, categoryFilter, statusFilter]);

  const [kpis, setKpis] = useState({ total: 0, required: 0, uploaded: 0, verified: 0, rejected: 0 });

  useEffect(() => {
    (async () => {
      const [t, r, u, v, rej] = await Promise.all([
        supabase.from('customer_documents').select('*', { count: 'exact', head: true }),
        supabase.from('customer_documents').select('*', { count: 'exact', head: true }).eq('status', 'required'),
        supabase.from('customer_documents').select('*', { count: 'exact', head: true }).eq('status', 'uploaded'),
        supabase.from('customer_documents').select('*', { count: 'exact', head: true }).eq('status', 'verified'),
        supabase.from('customer_documents').select('*', { count: 'exact', head: true }).eq('status', 'rejected'),
      ]);
      setKpis({ total: t.count || 0, required: r.count || 0, uploaded: u.count || 0, verified: v.count || 0, rejected: rej.count || 0 });
    })();
  }, [docs]);

  const totalPages = Math.ceil(total / pageSize);
  const customerName = (id: string) => customers.find((c) => c.id === id)?.name || '-';

  return (
    <div className="space-y-6">
      <PageHeader
        icon={FileText}
        title="Dokumen"
        description="Manajemen dokumen customer dengan checklist"
        actions={
          <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={() => setShowChecklist(customers[0] || null)} disabled={customers.length === 0}>
            <Upload className="mr-1 h-4 w-4" /> Upload Dokumen
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <MetricCard label="Total" value={kpis.total} icon={FileText} color="blue" />
        <MetricCard label="Wajib" value={kpis.required} icon={FileText} color="yellow" />
        <MetricCard label="Diunggah" value={kpis.uploaded} icon={Upload} color="cyan" />
        <MetricCard label="Terverifikasi" value={kpis.verified} icon={CheckCircle} color="green" />
        <MetricCard label="Ditolak" value={kpis.rejected} icon={XCircle} color="red" />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <Input placeholder="Cari dokumen..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="admin-select w-full sm:w-40">
          <option value="all">Semua Kategori</option>
          <option value="customer">Customer</option>
          <option value="credit">Kredit</option>
          <option value="spk">SPK</option>
          <option value="delivery">Pengiriman</option>
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="admin-select w-full sm:w-40">
          <option value="all">Semua Status</option>
          <option value="required">Wajib</option>
          <option value="uploaded">Diunggah</option>
          <option value="verified">Terverifikasi</option>
          <option value="rejected">Ditolak</option>
        </select>
      </div>

      {loading ? <LoadingState label="Memuat dokumen..." /> : error ? <ErrorState onRetry={fetchData} /> : docs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 py-16 text-center">
          <FileText className="mx-auto mb-3 h-10 w-10 text-neutral-300" />
          <p className="text-sm text-neutral-500">Belum ada dokumen.</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead>Dokumen</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Diunggah</TableHead>
                  <TableHead>Diverifikasi</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {docs.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium text-neutral-900">{customerName(doc.customer_id)}</TableCell>
                    <TableCell><Badge variant="outline">{CATEGORY_LABELS[doc.category] || doc.category}</Badge></TableCell>
                    <TableCell className="text-sm">{doc.label}</TableCell>
                    <TableCell><StatusBadge status={doc.status} labels={documentStatusLabels} /></TableCell>
                    <TableCell className="text-xs text-neutral-500">{doc.uploaded_at ? formatDate(doc.uploaded_at) : '-'}</TableCell>
                    <TableCell className="text-xs text-neutral-500">{doc.verified_at ? formatDate(doc.verified_at) : '-'}</TableCell>
                    <TableCell className="text-right">
                      <DocActions doc={doc} onUpdated={fetchData} />
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

      <Dialog open={!!showChecklist} onOpenChange={(v) => !v && setShowChecklist(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>Checklist & Upload Dokumen</DialogTitle></DialogHeader>
          {showChecklist && <DocumentChecklist customer={showChecklist} customers={customers} onUpdated={fetchData} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DocActions({ doc, onUpdated }: { doc: CustomerDocument; onUpdated: () => void }) {
  const { profile } = useAuth();
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [updating, setUpdating] = useState(false);

  const handleVerify = async () => {
    setUpdating(true);
    await supabase.from('customer_documents').update({
      status: 'verified', verified_by: profile?.id, verified_at: new Date().toISOString(),
    }).eq('id', doc.id);
    setUpdating(false);
    onUpdated();
  };

  const handleReject = async () => {
    setUpdating(true);
    await supabase.from('customer_documents').update({
      status: 'rejected', rejection_reason: rejectReason || null,
    }).eq('id', doc.id);
    setUpdating(false);
    setShowReject(false);
    onUpdated();
  };

  return (
    <div className="flex justify-end gap-1">
      {doc.status === 'uploaded' && (
        <>
          <Button variant="ghost" size="sm" className="text-green-600" disabled={updating} onClick={handleVerify}>
            <CheckCircle className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="text-red-600" disabled={updating} onClick={() => setShowReject(true)}>
            <XCircle className="h-4 w-4" />
          </Button>
        </>
      )}
      {showReject && (
        <Dialog open onOpenChange={(v) => !v && setShowReject(false)}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Tolak Dokumen</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Label className="text-sm font-medium">Alasan Penolakan</Label>
              <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3} placeholder="Contoh: KTP tidak terbaca..." />
              <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white" disabled={!rejectReason || updating} onClick={handleReject}>
                Konfirmasi Tolak
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function DocumentChecklist({ customer, customers, onUpdated }: {
  customer: Customer;
  customers: Customer[];
  onUpdated: () => void;
}) {
  const { profile } = useAuth();
  const [selectedCustomerId, setSelectedCustomerId] = useState(customer.id);
  const [docs, setDocs] = useState<CustomerDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('customer_documents').select('*').eq('customer_id', selectedCustomerId).order('category,document_type');
    setDocs((data || []) as CustomerDocument[]);
    setLoading(false);
  }, [selectedCustomerId]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  const ensureDocExists = async (category: string, docType: string, label: string, isRequired: boolean) => {
    const existing = docs.find((d) => d.category === category && d.document_type === docType);
    if (!existing) {
      const { data } = await supabase.from('customer_documents').insert({
        customer_id: selectedCustomerId,
        category, document_type: docType, label, is_required: isRequired, status: 'required',
      }).select().maybeSingle();
      if (data) {
        setDocs((prev) => [...prev, data as CustomerDocument]);
        return data as CustomerDocument;
      }
    }
    return existing || null;
  };

  const handleUpload = async (category: string, docType: string, label: string, isRequired: boolean, file: File) => {
    setUploading(true);
    setError(null);
    try {
      const doc = await ensureDocExists(category, docType, label, isRequired);
      if (!doc) { setError('Gagal membuat record dokumen.'); setUploading(false); return; }

      const filePath = `${selectedCustomerId}/${category}/${docType}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from('motor-images').upload(filePath, file);
      if (uploadError) { setError(getSafeError(uploadError)); setUploading(false); return; }

      const { data: urlData } = supabase.storage.from('motor-images').getPublicUrl(filePath);

      await supabase.from('customer_documents').update({
        file_path: filePath,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type,
        status: 'uploaded',
        uploaded_by: profile?.id,
        uploaded_at: new Date().toISOString(),
      }).eq('id', doc.id);

      fetchDocs();
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload gagal');
    }
    setUploading(false);
  };

  const getCategoryDocs = (category: string) => {
    const existing = docs.filter((d) => d.category === category);
    const types = DOC_TYPES[category] || [];
    return types.map((t) => {
      const doc = existing.find((d) => d.document_type === t.type);
      return { ...t, doc };
    });
  };

  const completionPercent = (() => {
    const allTypes = Object.values(DOC_TYPES).flat().filter((t) => t.required);
    const requiredCount = allTypes.length;
    const verifiedCount = allTypes.filter((t) => {
      const doc = docs.find((d) => d.document_type === t.type && d.status === 'verified');
      return !!doc;
    }).length;
    return requiredCount > 0 ? Math.round((verifiedCount / requiredCount) * 100) : 0;
  })();

  return (
    <div className="space-y-4">
      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <div>
        <Label className="text-sm font-medium">Customer</Label>
        <select value={selectedCustomerId} onChange={(e) => setSelectedCustomerId(e.target.value)} className="admin-select mt-1.5">
          {customers.map((c) => <option key={c.id} value={c.id}>{c.name} - {c.phone}</option>)}
        </select>
      </div>

      <div className="rounded-lg border border-neutral-100 bg-neutral-50 p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-neutral-700">Kelengkapan Dokumen Wajib</p>
          <span className={cn('text-lg font-bold', completionPercent === 100 ? 'text-green-600' : 'text-orange-600')}>
            {completionPercent}%
          </span>
        </div>
        <div className="mt-2 h-2 rounded-full bg-neutral-200">
          <div className={cn('h-2 rounded-full transition-all', completionPercent === 100 ? 'bg-green-500' : 'bg-orange-500')} style={{ width: `${completionPercent}%` }} />
        </div>
        <p className="mt-1 text-xs text-neutral-500">
          {completionPercent === 100 ? 'Lengkap' : 'Belum lengkap'}
        </p>
      </div>

      {loading ? <LoadingState label="Memuat checklist..." /> : (
        Object.entries(DOC_TYPES).map(([category, types]) => {
          const catDocs = getCategoryDocs(category);
          return (
            <div key={category} className="rounded-lg border border-neutral-200 p-4">
              <p className="mb-3 text-sm font-bold text-neutral-900">{CATEGORY_LABELS[category]}</p>
              <div className="space-y-2">
                {catDocs.map((item) => (
                  <div key={item.type} className="flex items-center justify-between border-b border-neutral-100 pb-2 last:border-0">
                    <div className="flex items-center gap-2">
                      {item.doc?.status === 'verified' ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : item.doc?.status === 'uploaded' ? (
                        <Upload className="h-4 w-4 text-blue-600" />
                      ) : item.doc?.status === 'rejected' ? (
                        <XCircle className="h-4 w-4 text-red-600" />
                      ) : (
                        <div className={cn('h-4 w-4 rounded border', item.required ? 'border-orange-400' : 'border-neutral-300')} />
                      )}
                      <span className="text-sm">{item.label}</span>
                      {item.required && <span className="text-xs text-red-500">*</span>}
                      {item.doc?.status === 'rejected' && item.doc.rejection_reason && (
                        <span className="text-xs text-red-500">({item.doc.rejection_reason})</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {item.doc?.file_path && (
                        <a href={supabase.storage.from('motor-images').getPublicUrl(item.doc.file_path).data.publicUrl} target="_blank" rel="noopener noreferrer">
                          <Button variant="ghost" size="sm"><Eye className="h-3 w-3" /></Button>
                        </a>
                      )}
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleUpload(category, item.type, item.label, item.required, file);
                          }}
                        />
                        <span className="inline-flex items-center rounded-md border border-neutral-200 px-2 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50">
                          {uploading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Upload className="mr-1 h-3 w-3" />}
                          Upload
                        </span>
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
