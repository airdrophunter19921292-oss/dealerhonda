'use client';

import { useState, useEffect } from 'react';
import { MessageCircle, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Motor } from '@/lib/motor-data';
import {
  formatRupiah,
  buildWhatsAppLink,
  buildLeadFormWhatsAppMessage,
} from '@/lib/whatsapp';
import { businessConfig } from '@/lib/business-config';
import { supabase } from '@/lib/supabase-client';
import { trackLead } from '@/lib/analytics';
import { isValidPhone } from '@/lib/validation';
import { getAttribution, type AttributionContext } from '@/lib/lead-attribution';

export function LeadForm({ attributionContext }: { attributionContext?: AttributionContext } = {}) {
  const [motors, setMotors] = useState<Motor[]>([]);
  const [loadingMotors, setLoadingMotors] = useState(true);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [motorId, setMotorId] = useState('');
  const [dpIndex, setDpIndex] = useState(0);
  const [tenor, setTenor] = useState<35 | 47>(35);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchMotors() {
      const { data: products, error } = await supabase
        .from('products')
        .select('id, slug, name, otr, status')
        .eq('status', 'active')
        .order('sort_order', { ascending: true });

      if (error || !products || products.length === 0) {
        setLoadingMotors(false);
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

      const productMap: Record<string, { dp: number; tenor35: number; tenor47: number }[]> = {};
      activePlans.forEach((p: any) => {
        if (!productMap[p.product_id]) productMap[p.product_id] = [];
        const tenor35Val = p.tenor35 || (p.tenor_months === 35 ? p.installment_amount : 0);
        const tenor47Val = p.tenor47 || (p.tenor_months === 47 ? p.installment_amount : 0);
        if (tenor35Val > 0 || tenor47Val > 0) {
          productMap[p.product_id].push({ dp: p.dp, tenor35: tenor35Val, tenor47: tenor47Val });
        }
      });

      const mappedMotors: Motor[] = (products as any[]).map((p) => ({
        id: p.slug,
        name: p.name,
        category: 'Matic' as const,
        otr: p.otr,
        image: '',
        popular: false,
        financing: productMap[p.id] || [],
      })).filter((m: Motor) => m.financing.length > 0);

      if (mappedMotors.length > 0) {
        setMotors(mappedMotors);
        setMotorId(mappedMotors[0].id);
      }
      setLoadingMotors(false);
    }
    fetchMotors();
  }, []);

  const motor = motors.find((m) => m.id === motorId);
  const financing = motor?.financing[dpIndex];
  const cicilan = financing ? (tenor === 35 ? financing.tenor35 : financing.tenor47) : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!motor || !financing) return;

    if (!name.trim()) {
      setError('Nama wajib diisi.');
      return;
    }
    if (!phone.trim()) {
      setError('Nomor WhatsApp wajib diisi.');
      return;
    }
    if (!isValidPhone(phone)) {
      setError('Nomor WhatsApp tidak valid. Contoh: 081234567890');
      return;
    }

    setSubmitting(true);
    setError(null);

    const { data: productRow } = await supabase
      .from('products')
      .select('id')
      .eq('slug', motorId)
      .maybeSingle();

    const attribution = getAttribution(attributionContext);

    const { error: dbError } = await supabase.from('leads').insert({
      name,
      phone,
      city,
      product_id: productRow?.id || null,
      motor_name: motor.name,
      dp: financing.dp,
      tenor,
      installment: cicilan,
      message,
      source: attribution.source,
      source_type: attribution.source_type,
      source_page: attribution.source_page,
      source_campaign: attribution.source_campaign,
      source_medium: attribution.source_medium,
      source_content: attribution.source_content,
      utm_source: attribution.utm_source,
      utm_medium: attribution.utm_medium,
      utm_campaign: attribution.utm_campaign,
      utm_content: attribution.utm_content,
      utm_term: attribution.utm_term,
      landing_page: attribution.landing_page,
      last_touch_page: attribution.last_touch_page,
      campaign: attribution.campaign,
      status: 'new',
    });

    if (dbError) {
      setError('Gagal menyimpan data. Silakan coba lagi.');
      setSubmitting(false);
      return;
    }

    trackLead((attribution.source_page || attribution.source || 'homepage') as any, motorId, { dp: financing.dp, tenor, source_type: attribution.source_type, source_medium: attribution.source_medium });

    const waMessage = buildLeadFormWhatsAppMessage({
      name: name || '-',
      phone: phone || '-',
      city: city || '-',
      motorName: motor.name,
      otr: motor.otr,
      dp: financing.dp,
      tenor,
      cicilan,
      message: message || '-',
    });
    window.open(buildWhatsAppLink(waMessage), '_blank');

    setSubmitted(true);
    setSubmitting(false);
  };

  if (loadingMotors) {
    return (
      <section id="kontak" className="bg-neutral-50 py-12">
        <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center py-12 text-neutral-400">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Memuat data motor...
          </div>
        </div>
      </section>
    );
  }

  if (submitted) {
    return (
      <section id="kontak" className="bg-neutral-50 py-12">
        <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-xl border border-green-200 bg-white p-8 text-center shadow-sm">
            <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-green-600" />
            <h2 className="text-xl font-bold text-neutral-900">Data Terkirim!</h2>
            <p className="mt-2 text-sm text-neutral-500">
              Data Anda telah disimpan dan WhatsApp sedang dibuka. Jika WhatsApp tidak terbuka otomatis, silakan hubungi Dony Kurniawan langsung di {businessConfig.whatsappNumber}.
            </p>
            <Button
              className="mt-4 bg-green-600 hover:bg-green-700 text-white"
              onClick={() => {
                setSubmitted(false);
                setName('');
                setPhone('');
                setCity('');
                setMessage('');
              }}
            >
              Kirim Lagi
            </Button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="kontak" className="bg-neutral-50 py-12">
      <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-neutral-900 sm:text-3xl">
            Cek Motor & Cicilan via WhatsApp
          </h2>
          <p className="mt-2 text-sm text-neutral-500">
            Isi data singkat di bawah ini. Data akan otomatis dikirim ke WhatsApp Dony Kurniawan.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4 rounded-xl border border-border/60 bg-white p-6 shadow-sm">
          <div>
            <label className="text-sm font-semibold text-neutral-700">Nama</label>
            <Input
              type="text"
              placeholder="Nama Anda"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="mt-1.5"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-neutral-700">Nomor WhatsApp</label>
            <Input
              type="tel"
              placeholder="08xxxxxxxxxx"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              className="mt-1.5"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-neutral-700">Kota / Kecamatan</label>
            <Input
              type="text"
              placeholder="Contoh: Pekalongan"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              required
              className="mt-1.5"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-neutral-700">Pilih Motor</label>
            <select
              value={motorId}
              onChange={(e) => { setMotorId(e.target.value); setDpIndex(0); }}
              className="mt-1.5 h-10 w-full rounded-md border border-input bg-white px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {motors.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          {motor && financing && (
            <>
              <div>
                <label className="text-sm font-semibold text-neutral-700">Pilih DP</label>
                <select
                  value={dpIndex}
                  onChange={(e) => setDpIndex(Number(e.target.value))}
                  className="mt-1.5 h-10 w-full rounded-md border border-input bg-white px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {motor.financing.map((f, i) => (
                    <option key={i} value={i}>
                      {formatRupiah(f.dp)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-semibold text-neutral-700">Pilih Tenor</label>
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTenor(35)}
                    className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                      tenor === 35
                        ? 'bg-red-600 text-white'
                        : 'bg-white border border-border text-neutral-700 hover:bg-neutral-100'
                    }`}
                  >
                    35x
                  </button>
                  <button
                    type="button"
                    onClick={() => setTenor(47)}
                    className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                      tenor === 47
                        ? 'bg-red-600 text-white'
                        : 'bg-white border border-border text-neutral-700 hover:bg-neutral-100'
                    }`}
                  >
                    47x
                  </button>
                </div>
              </div>

              <div className="rounded-lg border border-border/60 bg-neutral-50 p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-neutral-500">Cicilan / bulan</span>
                  <span className="font-bold text-red-600">{formatRupiah(cicilan)}</span>
                </div>
              </div>
            </>
          )}

          <div>
            <label className="text-sm font-semibold text-neutral-700">Pesan / Pertanyaan</label>
            <Textarea
              placeholder="Contoh: Apakah unit tersedia?"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="mt-1.5"
              rows={3}
            />
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <Button type="submit" disabled={submitting} className="w-full bg-green-600 hover:bg-green-700 text-white">
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Mengirim...
              </>
            ) : (
              <>
                <MessageCircle className="mr-2 h-4 w-4" />
                Kirim ke WhatsApp Dony
              </>
            )}
          </Button>

          <p className="text-center text-xs text-neutral-400">
            Data Anda akan disimpan dan dikirim langsung ke WhatsApp Dony Kurniawan ({businessConfig.whatsappNumber}).
          </p>
        </form>
      </div>
    </section>
  );
}
