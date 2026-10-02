'use client';

import { useEffect, useState, useMemo } from 'react';
import { Search, SlidersHorizontal, RotateCcw, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { MotorCard } from '@/components/motor-card';
import { Motor, motorCategories } from '@/lib/motor-data';
import { supabase } from '@/lib/supabase-client';

type SortOption = 'default' | 'price-asc' | 'price-desc';

export function MotorCatalog() {
  const [motors, setMotors] = useState<Motor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [sortBy, setSortBy] = useState<SortOption>('default');
  const [maxDp, setMaxDp] = useState<number | null>(null);
  const [maxCicilan, setMaxCicilan] = useState<number | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    async function fetchMotors() {
      const { data: products, error } = await supabase
        .from('products')
        .select('id, slug, name, category, otr, image, popular, status, sort_order')
        .eq('status', 'active')
        .order('sort_order', { ascending: true });

      if (error || !products || products.length === 0) {
        setLoading(false);
        return;
      }

      const productIds = products.map((p: { id: string }) => p.id);
      const today = new Date().toISOString().split('T')[0];
      const { data: plans } = await supabase
        .from('financing_plans')
        .select('product_id, dp, tenor35, tenor47, tenor_months, installment_amount, status, valid_from, valid_until, sort_order')
        .eq('status', 'active')
        .in('product_id', productIds)
        .order('sort_order', { ascending: true });

      const activePlans = (plans || []).filter((p: { valid_from: string | null; valid_until: string | null }) => {
        if (p.valid_from && p.valid_from > today) return false;
        if (p.valid_until && p.valid_until < today) return false;
        return true;
      });

      const planMap: Record<string, { dp: number; tenor35: number; tenor47: number }[]> = {};
      activePlans.forEach((p: { product_id: string; dp: number; tenor35: number; tenor47: number; tenor_months: number | null; installment_amount: number | null }) => {
        if (!planMap[p.product_id]) planMap[p.product_id] = [];
        const t35 = p.tenor35 || (p.tenor_months === 35 ? (p.installment_amount || 0) : 0);
        const t47 = p.tenor47 || (p.tenor_months === 47 ? (p.installment_amount || 0) : 0);
        if (t35 > 0 || t47 > 0) {
          planMap[p.product_id].push({ dp: p.dp, tenor35: t35, tenor47: t47 });
        }
      });

      const mapped: Motor[] = products.map((p: { slug: string; name: string; category: Motor['category']; otr: number; image: string | null; popular: boolean; id: string }) => ({
        id: p.slug,
        name: p.name,
        category: p.category,
        otr: p.otr,
        image: p.image || 'https://images.pexels.com/photos/2830762/pexels-photo-2830762.jpeg?auto=compress&cs=tinysrgb&w=800',
        popular: p.popular,
        financing: planMap[p.id] || [],
      })).filter((m) => m.financing.length > 0);

      setMotors(mapped);
      setLoading(false);
    }
    fetchMotors();
  }, []);

  const filtered = useMemo(() => {
    let result = motors.filter((m) => {
      const matchesSearch = m.name.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = category === 'all' || m.category === category;
      const matchesDp = maxDp === null || m.financing.some((f) => f.dp <= maxDp);
      const matchesCicilan = maxCicilan === null || m.financing.some((f) => f.tenor35 <= maxCicilan || f.tenor47 <= maxCicilan);
      return matchesSearch && matchesCategory && matchesDp && matchesCicilan;
    });

    if (sortBy === 'price-asc') {
      result = [...result].sort((a, b) => a.otr - b.otr);
    } else if (sortBy === 'price-desc') {
      result = [...result].sort((a, b) => b.otr - a.otr);
    }

    return result;
  }, [motors, search, category, sortBy, maxDp, maxCicilan]);

  const resetFilters = () => {
    setSearch('');
    setCategory('all');
    setSortBy('default');
    setMaxDp(null);
    setMaxCicilan(null);
  };

  if (loading) {
    return (
      <section id="katalog" className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex items-center justify-center py-12 text-neutral-400">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Memuat katalog motor...
        </div>
      </section>
    );
  }

  return (
    <section id="katalog" className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-neutral-900 sm:text-3xl">Cari Motor Honda</h2>
        <p className="mt-2 text-sm text-neutral-500">Cari motor yang sesuai budget Anda. Bandingkan DP dan cicilan.</p>
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <Input type="text" placeholder="Cari nama motor Honda..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Button variant="outline" onClick={() => setShowFilters(!showFilters)} className="sm:w-auto">
          <SlidersHorizontal className="mr-2 h-4 w-4" />
          Filter
        </Button>
      </div>

      {showFilters ? (
        <div className="mt-4 rounded-lg border border-border/60 bg-neutral-50 p-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="text-xs font-semibold text-neutral-600">Kategori</label>
              <div className="mt-2 flex flex-wrap gap-2">
                <button onClick={() => setCategory('all')} className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${category === 'all' ? 'bg-red-600 text-white' : 'bg-white border border-border text-neutral-700 hover:bg-neutral-100'}`}>Semua</button>
                {motorCategories.map((cat) => (
                  <button key={cat} onClick={() => setCategory(cat)} className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${category === cat ? 'bg-red-600 text-white' : 'bg-white border border-border text-neutral-700 hover:bg-neutral-100'}`}>{cat}</button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-neutral-600">Pilihan DP</label>
              <div className="mt-2 flex flex-wrap gap-2">
                <button onClick={() => setMaxDp(null)} className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${maxDp === null ? 'bg-red-600 text-white' : 'bg-white border border-border text-neutral-700 hover:bg-neutral-100'}`}>Semua DP</button>
                <button onClick={() => setMaxDp(3000000)} className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${maxDp === 3000000 ? 'bg-red-600 text-white' : 'bg-white border border-border text-neutral-700 hover:bg-neutral-100'}`}>DP &lt; 3 Juta</button>
                <button onClick={() => setMaxDp(4000000)} className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${maxDp === 4000000 ? 'bg-red-600 text-white' : 'bg-white border border-border text-neutral-700 hover:bg-neutral-100'}`}>DP &lt; 4 Juta</button>
                <button onClick={() => setMaxDp(5000000)} className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${maxDp === 5000000 ? 'bg-red-600 text-white' : 'bg-white border border-border text-neutral-700 hover:bg-neutral-100'}`}>DP &lt; 5 Juta</button>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-neutral-600">Budget Cicilan</label>
              <div className="mt-2 flex flex-wrap gap-2">
                <button onClick={() => setMaxCicilan(null)} className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${maxCicilan === null ? 'bg-red-600 text-white' : 'bg-white border border-border text-neutral-700 hover:bg-neutral-100'}`}>Semua Cicilan</button>
                <button onClick={() => setMaxCicilan(900000)} className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${maxCicilan === 900000 ? 'bg-red-600 text-white' : 'bg-white border border-border text-neutral-700 hover:bg-neutral-100'}`}>&lt; 900rb/bln</button>
                <button onClick={() => setMaxCicilan(1200000)} className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${maxCicilan === 1200000 ? 'bg-red-600 text-white' : 'bg-white border border-border text-neutral-700 hover:bg-neutral-100'}`}>&lt; 1,2jt/bln</button>
                <button onClick={() => setMaxCicilan(1500000)} className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${maxCicilan === 1500000 ? 'bg-red-600 text-white' : 'bg-white border border-border text-neutral-700 hover:bg-neutral-100'}`}>&lt; 1,5jt/bln</button>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-neutral-600">Urutkan Harga</label>
              <div className="mt-2 flex flex-wrap gap-2">
                <button onClick={() => setSortBy('default')} className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${sortBy === 'default' ? 'bg-red-600 text-white' : 'bg-white border border-border text-neutral-700 hover:bg-neutral-100'}`}>Default</button>
                <button onClick={() => setSortBy('price-asc')} className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${sortBy === 'price-asc' ? 'bg-red-600 text-white' : 'bg-white border border-border text-neutral-700 hover:bg-neutral-100'}`}>Termurah</button>
                <button onClick={() => setSortBy('price-desc')} className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${sortBy === 'price-desc' ? 'bg-red-600 text-white' : 'bg-white border border-border text-neutral-700 hover:bg-neutral-100'}`}>Tertinggi</button>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              <RotateCcw className="mr-2 h-3 w-3" />
              Reset Filter
            </Button>
          </div>
        </div>
      ) : null}

      <div className="mt-6 flex items-center justify-between">
        <p className="text-sm text-neutral-500">Menampilkan {filtered.length} motor</p>
      </div>

      {filtered.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed border-border py-16 text-center">
          <p className="text-sm text-neutral-500">Tidak ada motor yang sesuai filter Anda.</p>
          <Button variant="outline" size="sm" onClick={resetFilters} className="mt-4">
            <RotateCcw className="mr-2 h-3 w-3" />
            Reset Filter
          </Button>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((motor) => (
            <MotorCard key={motor.id} motor={motor} />
          ))}
        </div>
      )}
    </section>
  );
}
