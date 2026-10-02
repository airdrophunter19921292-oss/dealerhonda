'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase, Customer, Profile, Product } from '@/lib/supabase-client';
import { useAuth } from '@/lib/auth-provider';
import {
  PageHeader, LoadingState, EmptyState, MetricCard,
  customerStatusLabels, formatDate,
} from '@/components/admin/admin-ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  UserCircle, Search, MessageCircle, ChevronRight, ChevronLeft, Phone,
  Plus, Users, UserPlus, Archive, CheckCircle, XCircle, Pencil,
} from 'lucide-react';
import Link from 'next/link';
import { CustomerForm } from '@/components/admin/customer-form';
import { cn } from '@/lib/utils';

const sourceLabels: Record<string, string> = {
  walk_in: 'Walk-in', website: 'Website', whatsapp: 'WhatsApp',
  instagram: 'Instagram', facebook: 'Facebook', event: 'Event',
  referral: 'Referral', phone: 'Telepon', other: 'Lainnya', manual: 'Manual',
};

export default function CustomersPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [salesReps, setSalesReps] = useState<Profile[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [salesFilter, setSalesFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<Customer | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [kpis, setKpis] = useState({ total: 0, active: 0, newThisMonth: 0, archived: 0 });

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    let countQuery = supabase.from('customers').select('*', { count: 'exact', head: true });
    let dataQuery = supabase.from('customers').select('*').order('created_at', { ascending: false });

    if (!isAdmin && profile?.id) {
      countQuery = countQuery.eq('sales_id', profile.id);
      dataQuery = dataQuery.eq('sales_id', profile.id);
    }
    if (statusFilter !== 'all') {
      countQuery = countQuery.eq('status', statusFilter);
      dataQuery = dataQuery.eq('status', statusFilter);
    }
    if (sourceFilter !== 'all') {
      countQuery = countQuery.eq('source', sourceFilter);
      dataQuery = dataQuery.eq('source', sourceFilter);
    }
    if (isAdmin && salesFilter !== 'all') {
      if (salesFilter === 'unassigned') {
        countQuery = countQuery.is('sales_id', null);
        dataQuery = dataQuery.is('sales_id', null);
      } else {
        countQuery = countQuery.eq('sales_id', salesFilter);
        dataQuery = dataQuery.eq('sales_id', salesFilter);
      }
    }

    const [countRes, dataRes] = await Promise.all([
      countQuery,
      dataQuery.range(page * pageSize, (page + 1) * pageSize - 1),
    ]);

    setTotalCount(countRes.count || 0);
    setCustomers((dataRes.data || []) as Customer[]);
    setLoading(false);
  }, [isAdmin, profile?.id, statusFilter, sourceFilter, salesFilter, page, pageSize]);

  const fetchKpis = useCallback(async () => {
    if (!profile) return;
    const scope = isAdmin ? null : profile.id;
    const baseQ = supabase.from('customers').select('*', { count: 'exact', head: true });
    const activeQ = supabase.from('customers').select('*', { count: 'exact', head: true }).eq('status', 'active');
    const archivedQ = supabase.from('customers').select('*', { count: 'exact', head: true }).eq('status', 'archived');
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const newQ = supabase.from('customers').select('*', { count: 'exact', head: true }).gte('created_at', monthStart).neq('status', 'archived');

    const scoped = (q: any) => scope ? q.eq('sales_id', scope) : q;

    const [totalR, activeR, archivedR, newR] = await Promise.all([
      scoped(baseQ), scoped(activeQ), scoped(archivedQ), scoped(newQ),
    ]);
    setKpis({
      total: totalR.count || 0,
      active: activeR.count || 0,
      newThisMonth: newR.count || 0,
      archived: archivedR.count || 0,
    });
  }, [profile, isAdmin]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);
  useEffect(() => { fetchKpis(); }, [fetchKpis]);

  useEffect(() => {
    supabase.from('profiles').select('*').eq('role', 'sales').eq('status', 'active').then(({ data }) => {
      if (data) setSalesReps(data as Profile[]);
    });
    supabase.from('products').select('*').eq('status', 'active').order('name').then(({ data }) => {
      if (data) setProducts(data as Product[]);
    });
  }, []);

  const handleArchive = async () => {
    if (!archiveTarget) return;
    setArchiving(true);
    await supabase.rpc('archive_customer', { p_customer_id: archiveTarget.id });
    setArchiving(false);
    setArchiveTarget(null);
    fetchCustomers();
    fetchKpis();
  };

  const handleSaved = () => {
    setShowAddForm(false);
    setEditCustomer(null);
    fetchCustomers();
    fetchKpis();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={UserCircle}
        title="Customer"
        description="Kelola data customer dan riwayat interaksi."
        actions={
          <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={() => { setEditCustomer(null); setShowAddForm(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Tambah Customer
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MetricCard label="Total Customer" value={kpis.total} icon={Users} color="blue" />
        <MetricCard label="Customer Aktif" value={kpis.active} icon={CheckCircle} color="green" />
        <MetricCard label="Baru Bulan Ini" value={kpis.newThisMonth} icon={UserPlus} color="orange" />
        <MetricCard label="Diarsipkan" value={kpis.archived} icon={Archive} color="neutral" />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <Input
            placeholder="Cari nama, nomor, email, kota..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="pl-10"
          />
        </div>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }} className="admin-select sm:w-40">
          <option value="all">Semua Status</option>
          <option value="active">Aktif</option>
          <option value="inactive">Nonaktif</option>
          <option value="archived">Diarsipkan</option>
        </select>
        <select value={sourceFilter} onChange={(e) => { setSourceFilter(e.target.value); setPage(0); }} className="admin-select sm:w-40">
          <option value="all">Semua Sumber</option>
          {Object.entries(sourceLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
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
        <LoadingState label="Memuat customer..." />
      ) : customers.length === 0 ? (
        <EmptyState
          icon={UserCircle}
          title="Belum ada customer"
          description="Tambahkan customer secara manual atau konversikan Lead menjadi Customer."
          action={
            <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={() => setShowAddForm(true)}>
              <Plus className="mr-2 h-4 w-4" /> Tambah Customer
            </Button>
          }
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Kontak</TableHead>
                  <TableHead>Motor</TableHead>
                  <TableHead>Kota</TableHead>
                  <TableHead>Sumber</TableHead>
                  <TableHead>Sales</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Dibuat</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers
                  .filter((c) =>
                    !search ||
                    c.name.toLowerCase().includes(search.toLowerCase()) ||
                    c.phone.includes(search) ||
                    (c.email || '').toLowerCase().includes(search.toLowerCase()) ||
                    (c.city || '').toLowerCase().includes(search.toLowerCase())
                  )
                  .map((c) => {
                    const salesRep = salesReps.find((r) => r.id === c.sales_id);
                    return (
                      <TableRow key={c.id} className="hover:bg-neutral-50">
                        <TableCell>
                          <Link href={`/admin/customers/${c.id}`}>
                            <p className="font-medium text-neutral-900 hover:text-red-600">{c.name}</p>
                          </Link>
                          {c.email && <p className="text-xs text-neutral-500">{c.email}</p>}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-neutral-600">{c.phone}</span>
                            <a href={`https://wa.me/${c.phone.replace(/^0/, '62')}`} target="_blank" rel="noopener noreferrer" className="text-green-600 hover:text-green-700">
                              <MessageCircle className="h-3.5 w-3.5" />
                            </a>
                            <a href={`tel:${c.phone}`} className="text-neutral-400 hover:text-neutral-600">
                              <Phone className="h-3.5 w-3.5" />
                            </a>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-neutral-600">{c.motor_name || '-'}</TableCell>
                        <TableCell className="text-sm text-neutral-600">{c.city || '-'}</TableCell>
                        <TableCell className="text-sm text-neutral-600">{sourceLabels[c.source] || c.source}</TableCell>
                        <TableCell className="text-sm text-neutral-600">{salesRep?.full_name || '-'}</TableCell>
                        <TableCell>
                          <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', customerStatusLabels[c.status]?.color || 'bg-neutral-100 text-neutral-700')}>
                            {customerStatusLabels[c.status]?.label || c.status}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs text-neutral-500">{formatDate(c.created_at)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => { setEditCustomer(c); setShowAddForm(true); }}
                              className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                              title="Edit"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            {c.status !== 'archived' && (
                              <button
                                onClick={() => setArchiveTarget(c)}
                                className="rounded-md p-1.5 text-neutral-400 hover:bg-red-50 hover:text-red-600"
                                title="Arsipkan"
                              >
                                <Archive className="h-4 w-4" />
                              </button>
                            )}
                            <Link href={`/admin/customers/${c.id}`}>
                              <button className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100">
                                <ChevronRight className="h-4 w-4" />
                              </button>
                            </Link>
                          </div>
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

      {/* Add/Edit Customer Dialog */}
      <Dialog open={showAddForm} onOpenChange={(v) => { setShowAddForm(v); if (!v) setEditCustomer(null); }}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editCustomer ? 'Edit Customer' : 'Tambah Customer'}</DialogTitle>
          </DialogHeader>
          <CustomerForm
            salesReps={salesReps}
            products={products}
            editCustomer={editCustomer}
            onSaved={handleSaved}
            onCancel={() => { setShowAddForm(false); setEditCustomer(null); }}
          />
        </DialogContent>
      </Dialog>

      {/* Archive Confirmation */}
      <AlertDialog open={!!archiveTarget} onOpenChange={(v) => !v && setArchiveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arsipkan Customer</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin mengarsipkan customer &quot;{archiveTarget?.name}&quot;? Data customer tidak akan dihapus dan dapat dipulihkan kembali.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleArchive}
              disabled={archiving}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {archiving ? 'Mengarsipkan...' : 'Arsipkan'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
