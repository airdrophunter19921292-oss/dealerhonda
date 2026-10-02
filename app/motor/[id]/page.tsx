import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { motorData } from '@/lib/motor-data';
import { formatRupiah } from '@/lib/whatsapp';
import { MotorDetailClient } from '@/components/motor-detail-client';
import { LeadForm } from '@/components/lead-form';
import { supabase } from '@/lib/supabase-client';
import type { Metadata } from 'next';

type MotorDetail = {
  id: string;
  name: string;
  category: string;
  otr: number;
  image: string;
  popular: boolean;
  financing: { dp: number; tenor35: number; tenor47: number }[];
  seo_title?: string | null;
  seo_description?: string | null;
  description?: string | null;
};

async function getMotor(slug: string): Promise<MotorDetail | null> {
  const { data: product, error } = await supabase
    .from('products')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'active')
    .maybeSingle();

  if (error || !product) return null;

  const today = new Date().toISOString().split('T')[0];
  const { data: plans } = await supabase
    .from('financing_plans')
    .select('*')
    .eq('product_id', product.id)
    .eq('status', 'active')
    .order('sort_order', { ascending: true });

  const activePlans = (plans || []).filter((p: any) => {
    if (p.valid_from && p.valid_from > today) return false;
    if (p.valid_until && p.valid_until < today) return false;
    return true;
  });

  const financing = activePlans.map((p: any) => {
    const tenor35Val = p.tenor35 || (p.tenor_months === 35 ? p.installment_amount : 0);
    const tenor47Val = p.tenor47 || (p.tenor_months === 47 ? p.installment_amount : 0);
    return { dp: p.dp, tenor35: tenor35Val, tenor47: tenor47Val };
  }).filter((f) => f.tenor35 > 0 || f.tenor47 > 0);

  return {
    id: product.slug,
    name: product.name,
    category: product.category,
    otr: product.otr,
    image: product.image || 'https://images.pexels.com/photos/2830762/pexels-photo-2830762.jpeg?auto=compress&cs=tinysrgb&w=800',
    popular: product.popular,
    financing,
    seo_title: product.seo_title,
    seo_description: product.seo_description,
    description: product.description,
  };
}

export async function generateStaticParams() {
  return motorData.map((m) => ({ id: m.id }));
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const motor = await getMotor(params.id);
  if (!motor) return { title: 'Motor tidak ditemukan' };

  const title = motor.seo_title || `${motor.name} - Harga ${formatRupiah(motor.otr)} | Motor Honda Pekalongan`;
  const description = motor.seo_description || `Honda ${motor.name} dengan OTR ${formatRupiah(motor.otr)}. Pilihan DP mulai ${motor.financing.length > 0 ? formatRupiah(motor.financing[0].dp) : '-'}. Melayani Pekalongan, Pemalang, Batang.`;

  return {
    title,
    description,
    alternates: { canonical: `/motor/${motor.id}` },
    openGraph: {
      title: `Honda ${motor.name} - ${formatRupiah(motor.otr)}`,
      description,
      images: [{ url: motor.image }],
    },
  };
}

export default async function MotorDetailPage({ params }: { params: { id: string } }) {
  const motor = await getMotor(params.id);
  if (!motor) notFound();

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: `Honda ${motor.name}`,
    description: motor.description || `Honda ${motor.name} dengan OTR ${formatRupiah(motor.otr)}.`,
    brand: { '@type': 'Brand', name: 'Honda' },
    category: motor.category,
    image: motor.image,
    offers: {
      '@type': 'Offer',
      price: motor.otr,
      priceCurrency: 'IDR',
      availability: 'https://schema.org/InStock',
      url: `/motor/${motor.id}`,
    },
  };

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: '/' },
      { '@type': 'ListItem', position: 2, name: 'Motor Honda', item: '/#katalog' },
      { '@type': 'ListItem', position: 3, name: motor.name, item: `/motor/${motor.id}` },
    ],
  };

  const { data: relatedProducts } = await supabase
    .from('products')
    .select('slug, name, category, otr, image')
    .eq('status', 'active')
    .eq('category', motor.category)
    .neq('slug', motor.id)
    .limit(6);

  const relatedMotors = (relatedProducts || []).map((p: any) => ({
    id: p.slug,
    name: p.name,
    otr: p.otr,
    image: p.image || 'https://images.pexels.com/photos/2830762/pexels-photo-2830762.jpeg?auto=compress&cs=tinysrgb&w=800',
  }));

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <nav className="flex items-center gap-2 text-sm text-neutral-500" aria-label="Breadcrumb">
          <Link href="/" className="hover:text-neutral-900">Home</Link>
          <span className="text-neutral-300">/</span>
          <Link href="/#katalog" className="hover:text-neutral-900">Motor</Link>
          <span className="text-neutral-300">/</span>
          <span className="font-medium text-neutral-900">{motor.name}</span>
        </nav>

        <div className="mt-6 grid gap-8 lg:grid-cols-2">
          <div className="relative overflow-hidden rounded-xl border border-border/60 bg-neutral-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={motor.image}
              alt={`Honda ${motor.name}`}
              className="aspect-[4/3] w-full object-cover"
            />
            {motor.popular && (
              <Badge className="absolute left-4 top-4 bg-red-600 text-white hover:bg-red-600">
                Populer
              </Badge>
            )}
          </div>

          <div>
            <span className="text-xs font-semibold text-red-600">{motor.category}</span>
            <h1 className="mt-1 text-2xl font-bold text-neutral-900 sm:text-3xl">
              Honda {motor.name}
            </h1>

            <div className="mt-4 rounded-lg border border-border/60 bg-neutral-50 p-4">
              <p className="text-xs text-neutral-500">Harga OTR</p>
              <p className="text-2xl font-bold text-neutral-900">{formatRupiah(motor.otr)}</p>
            </div>

            {motor.description && (
              <p className="mt-4 text-sm text-neutral-600">{motor.description}</p>
            )}

            <div className="mt-4">
              <h2 className="text-sm font-bold text-neutral-900">Pilihan Pembiayaan</h2>
              <p className="mt-1 text-xs text-neutral-500">
                Pilih DP untuk melihat cicilan 35x dan 47x.
              </p>
            </div>

            <div className="mt-3 overflow-x-auto rounded-lg border border-border/60">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 bg-neutral-50">
                    <th className="px-4 py-2.5 text-left font-semibold text-neutral-700">DP</th>
                    <th className="px-4 py-2.5 text-right font-semibold text-neutral-700">35x</th>
                    <th className="px-4 py-2.5 text-right font-semibold text-neutral-700">47x</th>
                  </tr>
                </thead>
                <tbody>
                  {motor.financing.map((f, i) => (
                    <tr key={i} className="border-b border-border/40 last:border-0">
                      <td className="px-4 py-2.5 font-medium text-red-600">{formatRupiah(f.dp)}</td>
                      <td className="px-4 py-2.5 text-right text-neutral-800">{f.tenor35 > 0 ? formatRupiah(f.tenor35) : '-'}</td>
                      <td className="px-4 py-2.5 text-right text-neutral-800">{f.tenor47 > 0 ? formatRupiah(f.tenor47) : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="mt-3 text-xs text-neutral-400">
              Angsuran dan DP dapat berubah sesuai program pembiayaan yang berlaku. Konfirmasi kepada sales untuk simulasi terbaru.
            </p>

            <MotorDetailClient motor={motor as any} />
          </div>
        </div>

        <div className="mt-12">
          <h2 className="text-lg font-bold text-neutral-900">Motor Lainnya</h2>
          <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
            {relatedMotors.map((m) => (
              <Link
                key={m.id}
                href={`/motor/${m.id}`}
                className="flex-shrink-0 rounded-lg border border-border/60 bg-white p-3 shadow-sm transition-all hover:shadow-md"
              >
                <div className="h-20 w-28 overflow-hidden rounded-md bg-neutral-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.image} alt={m.name} className="h-full w-full object-cover" loading="lazy" />
                </div>
                <p className="mt-2 text-xs font-semibold text-neutral-900">{m.name}</p>
                <p className="text-xs text-neutral-500">{formatRupiah(m.otr)}</p>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <section className="bg-neutral-50 py-12">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-neutral-900 text-center">Tertarik dengan Honda {motor.name}?</h2>
          <p className="mt-2 text-center text-sm text-neutral-500">Isi form di bawah, sales kami akan menghubungi Anda.</p>
          <div className="mt-8">
            <LeadForm attributionContext={{ pageContext: 'vehicle_detail' }} />
          </div>
        </div>
      </section>
    </>
  );
}
