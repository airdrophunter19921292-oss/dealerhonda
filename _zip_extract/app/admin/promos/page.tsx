'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase, Promo } from '@/lib/supabase-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
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
import { Plus, Pencil, Trash2, Tag, AlertTriangle } from 'lucide-react';
import { PageHeader, LoadingState, EmptyState } from '@/components/admin/admin-ui';

export default function AdminPromosPage() {
  const [promos, setPromos] = useState<Promo[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Promo | null>(null);
  const [showForm, setShowForm] = useState(false);

  const fetchPromos = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('promos')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) setPromos(data as Promo[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPromos();
  }, [fetchPromos]);

  const handleDelete = async (id: string) => {
    await supabase.from('promos').delete().eq('id', id);
    fetchPromos();
  };

  const today = new Date().toDateString();
  const isExpired = (validUntil: string | null) => {
    if (!validUntil) return false;
    return new Date(validUntil).toDateString() < today;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Tag}
        title="Promo"
        description="Kelola promosi dan penawaran khusus."
        actions={
          <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={() => { setEditing(null); setShowForm(true); }}>
            <Plus className="mr-1 h-4 w-4" /> Tambah Promo
          </Button>
        }
      />

      {loading ? (
        <LoadingState label="Memuat promo..." />
      ) : promos.length === 0 ? (
        <EmptyState icon={Tag} title="Belum ada promo" description="Tambahkan promo untuk ditampilkan di website." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama Promo</TableHead>
                <TableHead>Bonus / Diskon</TableHead>
                <TableHead>Periode</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {promos.map((promo) => (
                <TableRow key={promo.id}>
                  <TableCell>
                    <p className="font-medium">{promo.name}</p>
                    {promo.description && <p className="text-xs text-neutral-500">{promo.description}</p>}
                  </TableCell>
                  <TableCell className="text-sm text-neutral-600">
                    {promo.discount_amount ? `Rp${promo.discount_amount.toLocaleString('id-ID')}` : '-'}
                    {promo.bonus && <p className="text-xs">{promo.bonus}</p>}
                  </TableCell>
                  <TableCell className="text-xs text-neutral-500">
                    {promo.valid_from || '-'} s/d {promo.valid_until || '-'}
                  </TableCell>
                  <TableCell>
                    {isExpired(promo.valid_until) ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700">
                        <AlertTriangle className="h-3 w-3" /> Expired
                      </span>
                    ) : promo.status === 'active' ? (
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
                          setEditing(promo);
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
                            <AlertDialogTitle>Hapus promo?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Promo akan dihapus permanen.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Batal</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(promo.id)}>
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
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Promo' : 'Tambah Promo'}</DialogTitle>
          </DialogHeader>
          <PromoForm promo={editing} onSaved={() => { setShowForm(false); fetchPromos(); }} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PromoForm({ promo, onSaved }: { promo: Promo | null; onSaved: () => void }) {
  const [name, setName] = useState(promo?.name || '');
  const [description, setDescription] = useState(promo?.description || '');
  const [banner, setBanner] = useState(promo?.banner || '');
  const [discountAmount, setDiscountAmount] = useState(promo?.discount_amount?.toString() || '');
  const [bonus, setBonus] = useState(promo?.bonus || '');
  const [validFrom, setValidFrom] = useState(promo?.valid_from || '');
  const [validUntil, setValidUntil] = useState(promo?.valid_until || '');
  const [status, setStatus] = useState(promo?.status || 'active');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      name,
      description: description || null,
      banner: banner || null,
      discount_amount: discountAmount ? parseInt(discountAmount) : null,
      bonus: bonus || null,
      valid_from: validFrom || null,
      valid_until: validUntil || null,
      status,
    };

    let result;
    if (promo) {
      result = await supabase.from('promos').update(payload).eq('id', promo.id);
    } else {
      result = await supabase.from('promos').insert(payload);
    }

    setSaving(false);
    if (result.error) {
      setError(result.error.message);
    } else {
      onSaved();
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div>
        <label className="text-sm font-medium">Nama Promo</label>
        <Input value={name} onChange={(e) => setName(e.target.value)} required className="mt-1.5" />
      </div>
      <div>
        <label className="text-sm font-medium">Deskripsi</label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="mt-1.5" />
      </div>
      <div>
        <label className="text-sm font-medium">URL Banner</label>
        <Input value={banner} onChange={(e) => setBanner(e.target.value)} placeholder="https://..." className="mt-1.5" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium">Potongan Harga (Rp)</label>
          <Input type="number" value={discountAmount} onChange={(e) => setDiscountAmount(e.target.value)} className="mt-1.5" />
        </div>
        <div>
          <label className="text-sm font-medium">Bonus</label>
          <Input value={bonus} onChange={(e) => setBonus(e.target.value)} placeholder="Gratis service, dll" className="mt-1.5" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium">Mulai</label>
          <Input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} className="mt-1.5" />
        </div>
        <div>
          <label className="text-sm font-medium">Berakhir</label>
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
