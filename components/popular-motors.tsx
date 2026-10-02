'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Loader2 } from 'lucide-react';
import { MotorCard } from '@/components/motor-card';
import { Motor } from '@/lib/motor-data';
import { supabase } from '@/lib/supabase-client';
import { Button } from '@/components/ui/button';

export function PopularMotors() {
  const [popular, setPopular] = useState<Motor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPopular() {
      const { data: products, error } = await supabase
        .from('products')
        .select('id, slug, name, category, otr, image, popular, status, sort_order')
        .eq('status', 'active')
        .eq('popular', true)
        .order('sort_order', { ascending: true });

      if (error || !products || products.length === 0) {
        setLoading(false);
        return;
      }

      const productIds = products.map((p: any) => p.id);
      const today = new Date().toISOString().split('T')[0];

      const { data: plans } = await supabase
        .from('financing_plans')
        .select('product_id, dp, tenor35, tenor47, tenor_months, installment_amount, status, valid_from, valid_until, sort_order')
        .eq('status', 'active')
        .in('product_id', productIds)
        .order('sort_order', { ascending: true });

      const activePlans = (plans || []).filter((p: any) => {
        if (p.valid_from && p.valid_from > today) return false;
        if (p.valid_until && p.valid_until < today) return false;
        return true;
      });

      const planMap: Record<string, { dp: number; tenor35: number; tenor47: number }[]> = {};
      activePlans.forEach((p: any) => {
        if (!planMap[p.product_id]) planMap[p.product_id] = [];
        const tenor35Val = p.tenor35 || (p.tenor_months === 35 ? p.installment_amount : 0);
        const tenor47Val = p.tenor47 || (p.tenor_months === 47 ? p.installment_amount : 0);
        if (tenor35Val > 0 || tenor47Val > 0) {
          planMap[p.product_id].push({ dp: p.dp, tenor35: tenor35Val, tenor47: tenor47Val });
        }
      });

      const mapped: Motor[] = (products as any[]).map((p) => ({
        id: p.slug,
        name: p.name,
        category: p.category,
        otr: p.otr,
        image: p.image || 'https://images.pexels.com/photos/2830762/pexels-photo-2830762.jpeg?auto=compress&cs=tinysrgb&w=800',
        popular: p.popular,
        financing: planMap[p.id] || [],
      })).filter((m) => m.financing.length > 0);

      setPopular(mapped);
      setLoading(false);
    }
    fetchPopular();
  }, []);

  if (loading) {
    return (
      <section className="bg-neutral-50 py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center py-8 text-neutral-400">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Memuat motor populer...
          </div>
        </div>
      </section>
    );
  }

  if (popular.length === 0) return null;

  return (
    <section className="bg-neutral-50 py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-bold text-neutral-900 sm:text-3xl">Motor Populer</h2>
            <p className="mt-2 text-sm text-neutral-500">
              Pilihan motor Honda yang banyak diminati.
            </p>
          </div>
          <Link href="/#katalog" className="hidden sm:block">
            <Button variant="outline" size="sm">
              Lihat Semua
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {popular.map((motor) => (
            <MotorCard key={motor.id} motor={motor} />
          ))}
        </div>

        <div className="mt-8 text-center sm:hidden">
          <Link href="/#katalog">
            <Button variant="outline" size="sm">
              Lihat Semua Motor
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
