'use client';

import Link from 'next/link';
import { CheckCircle2, MessageCircle, Calculator } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { buildWhatsAppLink, buildGenericWhatsAppMessage } from '@/lib/whatsapp';

const trustBadges = [
  'Pilihan Motor Honda',
  'Simulasi Kredit',
  'Konsultasi Gratis',
  'Melayani Pekalongan, Pemalang & Batang',
];

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-neutral-900 via-neutral-900 to-red-950">
      <div className="absolute inset-0 opacity-20">
        <img
          src="https://images.pexels.com/photos/2830762/pexels-photo-2830762.jpeg?auto=compress&cs=tinysrgb&w=1600"
          alt=""
          className="h-full w-full object-cover"
        />
      </div>
      <div className="absolute inset-0 bg-gradient-to-r from-neutral-900/90 via-neutral-900/70 to-transparent" />

      <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="max-w-2xl">
          <span className="inline-flex items-center rounded-full bg-red-600/20 px-3 py-1 text-xs font-semibold text-red-400 ring-1 ring-red-600/30">
            Motor Honda &middot; Pantura Jawa Tengah
          </span>
          <h1 className="mt-4 text-3xl font-bold leading-tight text-white sm:text-4xl lg:text-5xl">
            Motor Honda Impian Anda,
            <br />
            <span className="text-red-500">Siap Dibawa Pulang</span>
          </h1>
          <p className="mt-4 text-base text-neutral-300 sm:text-lg">
            Pilihan motor Honda terbaru dengan berbagai pilihan DP dan cicilan. Layani area Pekalongan, Pemalang, Batang dan sekitarnya.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/#katalog">
              <Button size="lg" className="w-full bg-red-600 hover:bg-red-700 text-white sm:w-auto">
                <Calculator className="mr-2 h-5 w-5" />
                Cek Harga & Cicilan
              </Button>
            </Link>
            <a
              href={buildWhatsAppLink(buildGenericWhatsAppMessage('konsultasi motor Honda'))}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button size="lg" variant="outline" className="w-full border-green-500 bg-green-600 text-white hover:bg-green-700 hover:text-white sm:w-auto">
                <MessageCircle className="mr-2 h-5 w-5" />
                Chat WhatsApp
              </Button>
            </a>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {trustBadges.map((badge) => (
              <div key={badge} className="flex items-center gap-2 text-sm text-neutral-300">
                <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-green-500" />
                {badge}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
