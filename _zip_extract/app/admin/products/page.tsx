'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase, Product, ProductImage } from '@/lib/supabase-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Plus, Pencil, Search, Package, Archive, Upload, Star, Trash2, Loader2, Bike } from 'lucide-react';
import { getSafeError } from '@/lib/validation';
import { uploadProductImage, deleteProductImage, setPrimaryImage } from '@/lib/storage';
import { PageHeader, LoadingState, EmptyState } from '@/components/admin/admin-ui';

const stockStatusLabels: Record<string, { label: string; color: string }> = {
  ready: { label: 'Ready Stock', color: 'bg-green-100 text-green-700' },
  limited: { label: 'Stok Terbatas', color: 'bg-yellow-100 text-yellow-700' },
  indent: { label: 'Indent', color: 'bg-blue-100 text-blue-700' },
  out_of_stock: { label: 'Stok Habis', color: 'bg-red-100 text-red-700' },
};

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Product | null>(null);
  const [showForm, setShowForm] = useState(false);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('sort_order', { ascending: true });
    if (error) getSafeError(error);
    if (data) setProducts(data as Product[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.category.toLowerCase().includes(search.toLowerCase())
  );

  const handleArchive = async (id: string) => {
    await supabase.from('products').update({ status: 'archived' }).eq('id', id);
    fetchProducts();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Bike}
        title="Produk Motor"
        description="Kelola daftar motor, harga, stok, dan galeri."
        actions={
          <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={() => { setEditing(null); setShowForm(true); }}>
            <Plus className="mr-1 h-4 w-4" /> Tambah Produk
          </Button>
        }
      />

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
        <Input placeholder="Cari motor..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>

      {loading ? (
        <LoadingState label="Memuat produk..." />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Package} title="Belum ada produk" description="Tambahkan motor untuk ditampilkan di website." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Foto</TableHead>
                <TableHead>Nama</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead className="text-right">OTR</TableHead>
                <TableHead>Stok</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>
                    {product.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={product.image} alt={product.name} className="h-10 w-14 rounded object-cover" />
                    ) : (
                      <div className="h-10 w-14 rounded bg-neutral-100" />
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell className="text-sm text-neutral-500">{product.category}</TableCell>
                  <TableCell className="text-right font-semibold">Rp{product.otr.toLocaleString('id-ID')}</TableCell>
                  <TableCell>
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${stockStatusLabels[product.stock_status]?.color || 'bg-neutral-100'}`}>
                      {stockStatusLabels[product.stock_status]?.label || product.stock_status}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={product.status === 'active' ? 'default' : 'secondary'}>
                      {product.status === 'active' ? 'Aktif' : 'Arsip'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => { setEditing(product); setShowForm(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm"><Archive className="h-4 w-4" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Arsipkan produk?</AlertDialogTitle>
                            <AlertDialogDescription>Produk akan disembunyikan dari website publik.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Batal</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleArchive(product.id)}>Ya, Arsipkan</AlertDialogAction>
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Produk' : 'Tambah Produk'}</DialogTitle>
          </DialogHeader>
          <ProductForm product={editing} onSaved={() => { setShowForm(false); fetchProducts(); }} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProductForm({ product, onSaved }: { product: Product | null; onSaved: () => void }) {
  const [name, setName] = useState(product?.name || '');
  const [slug, setSlug] = useState(product?.slug || '');
  const [category, setCategory] = useState(product?.category || 'Matic');
  const [otr, setOtr] = useState(product?.otr.toString() || '');
  const [image, setImage] = useState(product?.image || '');
  const [popular, setPopular] = useState(product?.popular || false);
  const [featured, setFeatured] = useState(product?.featured || false);
  const [stockStatus, setStockStatus] = useState(product?.stock_status || 'ready');
  const [stockQty, setStockQty] = useState(product?.stock_quantity.toString() || '0');
  const [description, setDescription] = useState(product?.description || '');
  const [shortDescription, setShortDescription] = useState(product?.short_description || '');
  const [seoTitle, setSeoTitle] = useState(product?.seo_title || '');
  const [seoDescription, setSeoDescription] = useState(product?.seo_description || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [images, setImages] = useState<ProductImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const productIdRef = useRef<string | null>(product?.id || null);

  useEffect(() => {
    if (product?.id) {
      productIdRef.current = product.id;
      supabase.from('product_images').select('*').eq('product_id', product.id).order('sort_order', { ascending: true }).then(({ data }) => {
        if (data) setImages(data as ProductImage[]);
      });
    }
  }, [product]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !productIdRef.current) return;

    setUploading(true);
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const result = await uploadProductImage(productIdRef.current, file, images.length + i);
      if (result.error) {
        setError(result.error);
        break;
      }
      const { data } = await supabase.from('product_images').insert({
        product_id: productIdRef.current,
        storage_path: result.path,
        public_url: result.publicUrl,
        alt_text: name,
        sort_order: images.length + i,
        is_primary: images.length === 0 && i === 0,
      }).select('*').single();
      if (data) setImages((prev) => [...prev, data as ProductImage]);
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDeleteImage = async (img: ProductImage) => {
    await deleteProductImage(img.storage_path);
    await supabase.from('product_images').delete().eq('id', img.id);
    setImages((prev) => prev.filter((i) => i.id !== img.id));
  };

  const handleSetPrimary = async (img: ProductImage) => {
    const { error: e } = await setPrimaryImage(productIdRef.current!, img.id);
    if (!e) {
      setImages((prev) => prev.map((i) => ({ ...i, is_primary: i.id === img.id })));
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const finalSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    const payload = {
      slug: finalSlug,
      name, category,
      otr: parseInt(otr) || 0,
      image: image || null,
      popular, featured,
      stock_status: stockStatus,
      stock_quantity: parseInt(stockQty) || 0,
      description: description || null,
      short_description: shortDescription || null,
      seo_title: seoTitle || null,
      seo_description: seoDescription || null,
      status: 'active',
    };

    let result;
    if (product) {
      result = await supabase.from('products').update(payload).eq('id', product.id);
    } else {
      result = await supabase.from('products').insert(payload).select('id').single();
      if (result.data) productIdRef.current = result.data.id;
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
      <div>
        <label className="text-sm font-medium">Nama Motor</label>
        <Input value={name} onChange={(e) => setName(e.target.value)} required className="mt-1.5" />
      </div>
      <div>
        <label className="text-sm font-medium">Slug (URL)</label>
        <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="otomatis dari nama" className="mt-1.5" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium">Kategori</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="mt-1.5 h-10 w-full rounded-md border border-input bg-white px-3 text-sm">
            <option value="Matic">Matic</option>
            <option value="Sport / Premium Matic">Sport / Premium Matic</option>
            <option value="Urban">Urban</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">Harga OTR</label>
          <Input type="number" value={otr} onChange={(e) => setOtr(e.target.value)} required className="mt-1.5" />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium">URL Gambar (fallback)</label>
        <Input value={image} onChange={(e) => setImage(e.target.value)} placeholder="https://..." className="mt-1.5" />
      </div>

      {productIdRef.current && (
        <div className="rounded-lg border border-neutral-200 p-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Galeri Gambar</label>
            <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Upload className="mr-1 h-3 w-3" />}
              Upload
            </Button>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={handleFileUpload} className="hidden" />
          </div>
          {images.length > 0 && (
            <div className="mt-3 grid grid-cols-4 gap-2">
              {images.map((img) => (
                <div key={img.id} className="group relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.public_url} alt={img.alt_text || ''} className="aspect-square w-full rounded-md object-cover" />
                  <div className="absolute inset-0 flex items-center justify-center gap-1 rounded-md bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0 text-white" onClick={() => handleSetPrimary(img)}>
                      <Star className={`h-3 w-3 ${img.is_primary ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                    </Button>
                    <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0 text-white" onClick={() => handleDeleteImage(img)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium">Status Stok</label>
          <select value={stockStatus} onChange={(e) => setStockStatus(e.target.value)} className="mt-1.5 h-10 w-full rounded-md border border-input bg-white px-3 text-sm">
            <option value="ready">Ready Stock</option>
            <option value="limited">Stok Terbatas</option>
            <option value="indent">Indent</option>
            <option value="out_of_stock">Stok Habis</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">Jumlah Stok</label>
          <Input type="number" value={stockQty} onChange={(e) => setStockQty(e.target.value)} className="mt-1.5" />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium">Deskripsi Singkat</label>
        <Input value={shortDescription} onChange={(e) => setShortDescription(e.target.value)} placeholder="Satu kalimat" className="mt-1.5" />
      </div>
      <div>
        <label className="text-sm font-medium">Deskripsi</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="mt-1.5 w-full rounded-md border border-input bg-white px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="text-sm font-medium">SEO Title</label>
        <Input value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} placeholder="Otomatis jika kosong" className="mt-1.5" />
      </div>
      <div>
        <label className="text-sm font-medium">SEO Description</label>
        <textarea value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} rows={2} className="mt-1.5 w-full rounded-md border border-input bg-white px-3 py-2 text-sm" />
      </div>
      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" checked={popular} onChange={(e) => setPopular(e.target.checked)} className="h-4 w-4 rounded" />
        Tampilkan sebagai motor populer
      </label>
      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} className="h-4 w-4 rounded" />
        Tampilkan sebagai motor unggulan
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={saving} className="w-full bg-red-600 hover:bg-red-700 text-white">
        {saving ? 'Menyimpan...' : 'Simpan'}
      </Button>
    </form>
  );
}
