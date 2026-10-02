'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase, Product } from '@/lib/supabase-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Package, Search, Save, AlertCircle } from 'lucide-react';
import { PageHeader, LoadingState, EmptyState, MetricCard } from '@/components/admin/admin-ui';

const stockStatusLabels: Record<string, { label: string; color: string }> = {
  ready: { label: 'Ready Stock', color: 'bg-green-100 text-green-700' },
  limited: { label: 'Stok Terbatas', color: 'bg-yellow-100 text-yellow-700' },
  indent: { label: 'Indent', color: 'bg-blue-100 text-blue-700' },
  out_of_stock: { label: 'Stok Habis', color: 'bg-red-100 text-red-700' },
};

type StockUpdate = Record<string, { stock_status: string; stock_quantity: number }>;

export default function AdminInventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [updates, setUpdates] = useState<StockUpdate>({});
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('sort_order', { ascending: true });
    if (!error && data) setProducts(data as Product[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleLocalChange = (id: string, field: 'stock_status' | 'stock_quantity', value: string | number) => {
    setUpdates((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        ...(field === 'stock_status' ? { stock_status: value as string } : {}),
        ...(field === 'stock_quantity' ? { stock_quantity: value as number } : {}),
        stock_status: prev[id]?.stock_status || products.find((p) => p.id === id)?.stock_status || 'ready',
        stock_quantity: prev[id]?.stock_quantity ?? products.find((p) => p.id === id)?.stock_quantity ?? 0,
      },
    }));
  };

  const handleSave = async (id: string) => {
    setSaving(true);
    const update = updates[id];
    if (!update) return;

    const { error } = await supabase
      .from('products')
      .update({
        stock_status: update.stock_status,
        stock_quantity: update.stock_quantity,
      })
      .eq('id', id);

    if (!error) {
      setProducts((prev) =>
        prev.map((p) => (p.id === id ? { ...p, stock_status: update.stock_status, stock_quantity: update.stock_quantity } : p))
      );
      setUpdates((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setSavedMsg('Stok berhasil diperbarui.');
      setTimeout(() => setSavedMsg(null), 3000);
    }
    setSaving(false);
  };

  const hasUpdate = (id: string) => !!updates[id];

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Package}
        title="Stok Motor"
        description="Kelola status dan jumlah stok per produk."
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MetricCard label="Total Produk" value={products.length} icon={Package} color="blue" />
        <MetricCard label="Ready Stock" value={products.filter(p => p.stock_status === 'ready').length} icon={Package} color="green" />
        <MetricCard label="Stok Terbatas" value={products.filter(p => p.stock_status === 'limited').length} icon={Package} color="amber" />
        <MetricCard label="Stok Habis" value={products.filter(p => p.stock_status === 'out_of_stock').length} icon={Package} color="red" />
      </div>

      {savedMsg && (
        <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          {savedMsg}
        </div>
      )}

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
        <LoadingState label="Memuat stok..." />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Package} title="Belum ada produk" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead>Status Stok</TableHead>
                <TableHead className="text-right">Jumlah</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((product) => {
                const currentStatus = updates[product.id]?.stock_status ?? product.stock_status;
                const currentQty = updates[product.id]?.stock_quantity ?? product.stock_quantity;
                return (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell className="text-sm text-neutral-500">{product.category}</TableCell>
                    <TableCell>
                      <select
                        value={currentStatus}
                        onChange={(e) => handleLocalChange(product.id, 'stock_status', e.target.value)}
                        className="h-9 w-full rounded-md border border-input bg-white px-3 text-sm"
                      >
                        <option value="ready">Ready Stock</option>
                        <option value="limited">Stok Terbatas</option>
                        <option value="indent">Indent</option>
                        <option value="out_of_stock">Stok Habis</option>
                      </select>
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        value={currentQty}
                        onChange={(e) => handleLocalChange(product.id, 'stock_quantity', parseInt(e.target.value) || 0)}
                        className="w-24 text-right"
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant={hasUpdate(product.id) ? 'default' : 'ghost'}
                        disabled={!hasUpdate(product.id) || saving}
                        onClick={() => handleSave(product.id)}
                        className={hasUpdate(product.id) ? 'bg-red-600 hover:bg-red-700 text-white' : ''}
                      >
                        <Save className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <div className="flex items-start gap-2">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600" />
          <p className="text-xs text-blue-700">
            Website publik hanya menampilkan status stok (Ready, Terbatas, Indent, Habis). Jumlah stok hanya terlihat di admin.
          </p>
        </div>
      </div>
    </div>
  );
}
