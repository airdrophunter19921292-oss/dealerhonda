import Link from 'next/link';
import { MapPin, MessageCircle, CheckCircle2, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MotorCard } from '@/components/motor-card';
import { motorData } from '@/lib/motor-data';
import { buildWhatsAppLink, buildGenericWhatsAppMessage } from '@/lib/whatsapp';
import { ContactCta } from '@/components/contact-cta';
import { LeadForm } from '@/components/lead-form';

export const metadata = {
  title: 'Motor Honda Pemalang | Kredit Motor Honda Pemalang',
  description:
    'Motor Honda Pemalang - Pilihan motor Honda dengan berbagai DP dan cicilan untuk wilayah Pemalang. Kredit motor Honda Pemalang dengan tenor 35x dan 47x.',
  alternates: { canonical: '/honda-pemalang' },
};

const popularMotors = motorData.filter((m) => m.popular);

export default function PemalangPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Motor Honda Pemalang',
    description: 'Kredit motor Honda untuk wilayah Pemalang dengan berbagai pilihan DP dan cicilan.',
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="bg-gradient-to-br from-neutral-900 to-red-950 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <span className="inline-flex items-center rounded-full bg-red-600/20 px-3 py-1 text-xs font-semibold text-red-400 ring-1 ring-red-600/30">
              <MapPin className="mr-1 h-3 w-3" />
              Area Layanan
            </span>
            <h1 className="mt-4 text-3xl font-bold text-white sm:text-4xl">
              Motor Honda Pemalang
            </h1>
            <p className="mt-3 text-base text-neutral-300">
              Pilihan motor Honda terbaru dengan berbagai pilihan DP dan cicilan untuk wilayah Pemalang dan sekitarnya. Konsultasi gratis, proses kredit mudah.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link href="/#katalog">
                <Button size="lg" className="w-full bg-red-600 hover:bg-red-700 text-white sm:w-auto">
                  Cek Harga & Cicilan
                </Button>
              </Link>
              <a
                href={buildWhatsAppLink(buildGenericWhatsAppMessage('motor Honda di Pemalang'))}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button size="lg" className="w-full bg-green-600 hover:bg-green-700 text-white sm:w-auto">
                  <MessageCircle className="mr-2 h-5 w-5" />
                  Chat Dony
                </Button>
              </a>
            </div>
          </div>
        </div>
      </div>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-bold text-neutral-900">Motor Populer di Pemalang</h2>
        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {popularMotors.map((m) => (
            <MotorCard key={m.id} motor={m} />
          ))}
        </div>
        <div className="mt-8 text-center">
          <Link href="/#katalog">
            <Button variant="outline">
              Lihat Semua Motor
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      <section className="bg-neutral-50 py-12">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-neutral-900">Kredit Motor Honda Pemalang</h2>
          <div className="mt-4 space-y-3 text-sm text-neutral-600">
            <p>
              Kami melayani penjualan dan kredit motor Honda untuk wilayah Pemalang, termasuk Pemalang Kota dan seluruh kecamatan di Kabupaten Pemalang.
            </p>
            <p>
              Pilihan motor Honda tersedia dari tipe BeAT, Scoopy, Vario, STYLO, PCX, hingga ADV dengan berbagai pilihan DP dan tenor 35x maupun 47x.
            </p>
          </div>
          <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {[
              'Konsultasi motor sesuai kebutuhan',
              'Pilihan DP dan tenor fleksibel',
              'Simulasi cicilan transparan',
              'Respon sales via WhatsApp',
              'Melayani seluruh Pemalang',
              'Proses kredit mudah',
            ].map((item) => (
              <div key={item} className="flex items-center gap-2 text-sm text-neutral-700">
                <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-green-600" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <ContactCta />

      <section className="bg-white py-12">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-neutral-900 text-center">Mau Konsultasi Kredit Motor?</h2>
          <p className="mt-2 text-center text-sm text-neutral-500">Isi form di bawah, sales kami akan menghubungi Anda.</p>
          <div className="mt-8">
            <LeadForm attributionContext={{ pageContext: 'pemalang' }} />
          </div>
        </div>
      </section>
    </>
  );
}
