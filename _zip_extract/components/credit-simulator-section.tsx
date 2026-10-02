'use client';

import { useState, useEffect } from 'react';
import { Calculator, MessageCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Motor } from '@/lib/motor-data';
import { formatRupiah, buildWhatsAppLink, buildDetailWhatsAppMessage } from '@/lib/whatsapp';
import { supabase } from '@/lib/supabase-client';
import { trackEvent } from '@/lib/analytics';

export function CreditSimulatorSection() {
  const [motors, setMotors] = useState<Motor[]>([]);
  const [loading, setLoading] = useState(true);
  const [motorId, setMotorId] = useState('');
  const [dpIndex, setDpIndex] = useState(0);
  const [tenor, setTenor] = useState<35 | 47>(35);

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

      if (mapped.length > 0) {
        setMotors(mapped);
        setMotorId(mapped[0].id);
      }
      setLoading(false);
    }
    fetchMotors();
  }, []);

  const motor = motors.find((m) => m.id === motorId);
  const financing = motor?.financing[dpIndex];
  const cicilan = financing ? (tenor === 35 ? financing.tenor35 : financing.tenor47) : 0;

  const waLink = motor && financing
    ? buildWhatsAppLink(buildDetailWhatsAppMessage(motor.name, motor.otr, financing.dp, tenor, cicilan))
    : '#';

  if (loading) {
    return (
      <section id="simulasi" className="bg-white py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center py-12 text-neutral-400">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Memuat data simulasi...
          </div>
        </div>
      </section>
    );
  }

  if (!motor || !financing) {
    return (
      <section id="simulasi" className="bg-white py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-neutral-400">Belum ada data motor untuk simulasi.</p>
        </div>
      </section>
    );
  }

  return (
    <section id="simulasi" className="bg-white py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-neutral-900 sm:text-3xl">Simulasi Kredit</h2>
          <p className="mt-2 text-sm text-neutral-500">
            Pilih motor, DP, dan tenor untuk melihat estimasi cicilan.
          </p>
        </div>

        <div className="mx-auto mt-8 max-w-2xl rounded-xl border border-border/60 bg-neutral-50 p-6">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-semibold text-neutral-700">Pilih Motor</label>
              <select
                value={motorId}
                onChange={(e) => { setMotorId(e.target.value); setDpIndex(0); }}
                className="mt-1.5 h-10 w-full rounded-md border border-input bg-white px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {motors.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} - {formatRupiah(m.otr)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-semibold text-neutral-700">Pilih DP</label>
              <div className="mt-1.5 grid grid-cols-3 gap-2">
                {motor.financing.map((f, i) => (
                  <button
                    key={i}
                    onClick={() => setDpIndex(i)}
                    className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                      dpIndex === i
                        ? 'bg-red-600 text-white'
                        : 'bg-white border border-border text-neutral-700 hover:bg-neutral-100'
                    }`}
                  >
                    {formatRupiah(f.dp)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-neutral-700">Pilih Tenor</label>
              <div className="mt-1.5 grid grid-cols-2 gap-2">
                <button
                  onClick={() => setTenor(35)}
                  className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    tenor === 35
                      ? 'bg-red-600 text-white'
                      : 'bg-white border border-border text-neutral-700 hover:bg-neutral-100'
                  }`}
                >
                  35x Cicilan
                </button>
                <button
                  onClick={() => setTenor(47)}
                  className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    tenor === 47
                      ? 'bg-red-600 text-white'
                      : 'bg-white border border-border text-neutral-700 hover:bg-neutral-100'
                  }`}
                >
                  47x Cicilan
                </button>
              </div>
            </div>

            <div className="rounded-lg border border-border/60 bg-white p-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-neutral-500">Motor</p>
                  <p className="font-semibold text-neutral-900">{motor.name}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500">OTR</p>
                  <p className="font-semibold text-neutral-900">{formatRupiah(motor.otr)}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500">DP</p>
                  <p className="font-semibold text-red-600">{formatRupiah(financing.dp)}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500">Tenor</p>
                  <p className="font-semibold text-neutral-900">{tenor}x</p>
                </div>
              </div>
              <div className="mt-3 border-t border-border/40 pt-3">
                <p className="text-xs text-neutral-500">Estimasi Cicilan / Bulan</p>
                <p className="text-2xl font-bold text-red-600">{formatRupiah(cicilan)}</p>
              </div>
            </div>

            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackEvent('submit_simulator', 'simulator', { motor: motor.name, dp: financing.dp, tenor })}
            >
              <Button className="w-full bg-green-600 hover:bg-green-700 text-white">
                <MessageCircle className="mr-2 h-4 w-4" />
                Ajukan Kredit via WhatsApp
              </Button>
            </a>

            <p className="text-center text-xs text-neutral-400">
              Angsuran dan DP dapat berubah sesuai program pembiayaan yang berlaku. Konfirmasi kepada sales untuk simulasi terbaru.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
