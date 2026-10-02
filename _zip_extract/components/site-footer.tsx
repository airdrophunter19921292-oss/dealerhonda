import Link from 'next/link';
import { Phone, MapPin, Instagram, Facebook, Youtube, Music2 } from 'lucide-react';
import { businessConfig } from '@/lib/business-config';
import { buildWhatsAppLink, buildGenericWhatsAppMessage } from '@/lib/whatsapp';

const footerLinks = [
  { href: '/', label: 'Home' },
  { href: '/#katalog', label: 'Motor' },
  { href: '/simulasi-kredit', label: 'Simulasi Kredit' },
  { href: '/#tentang', label: 'Tentang Kami' },
  { href: '/#faq', label: 'FAQ' },
  { href: '/#kontak', label: 'Kontak' },
];

const areaLinks = [
  { href: '/honda-pekalongan', label: 'Honda Pekalongan' },
  { href: '/honda-pemalang', label: 'Honda Pemalang' },
  { href: '/honda-batang', label: 'Honda Batang' },
];

const socialLinks = [
  { icon: Instagram, href: businessConfig.social.instagram, label: 'Instagram' },
  { icon: Facebook, href: businessConfig.social.facebook, label: 'Facebook' },
  { icon: Music2, href: businessConfig.social.tiktok, label: 'TikTok' },
  { icon: Youtube, href: businessConfig.social.youtube, label: 'YouTube' },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60 bg-neutral-950 text-neutral-300">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-4">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-600 text-white font-bold text-sm">
                H
              </div>
              <div className="flex flex-col leading-tight">
                <span className="text-sm font-bold text-white">{businessConfig.showroomName}</span>
                <span className="text-xs text-neutral-400">Sales: {businessConfig.salesName}</span>
              </div>
            </div>
            <p className="mt-4 max-w-md text-sm text-neutral-400">
              Melayani penjualan dan kredit motor Honda untuk wilayah Pekalongan, Pemalang, Batang dan sekitar Pantura Jawa Tengah.
            </p>
            <div className="mt-4 flex items-center gap-1 text-sm text-neutral-400">
              <MapPin className="mr-1 h-4 w-4" />
              {businessConfig.areas.join(' \u2022 ')}
            </div>
            <a
              href={buildWhatsAppLink(buildGenericWhatsAppMessage('konsultasi motor Honda'))}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-green-400 hover:text-green-300"
            >
              <Phone className="h-4 w-4" />
              {businessConfig.whatsappNumber}
            </a>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white">Menu</h3>
            <ul className="mt-3 space-y-2">
              {footerLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-neutral-400 hover:text-white">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white">Area Layanan</h3>
            <ul className="mt-3 space-y-2">
              {areaLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-neutral-400 hover:text-white">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex gap-3">
              {socialLinks.map((social) => {
                const isPlaceholder = social.href.startsWith('[');
                if (isPlaceholder) {
                  return (
                    <span
                      key={social.label}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-800 text-neutral-500"
                      title={`${social.label} - belum tersedia`}
                    >
                      <social.icon className="h-4 w-4" />
                    </span>
                  );
                }
                return (
                  <a
                    key={social.label}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-800 text-neutral-400 transition-colors hover:bg-red-600 hover:text-white"
                    title={social.label}
                  >
                    <social.icon className="h-4 w-4" />
                  </a>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-10 border-t border-neutral-800 pt-6">
          <p className="text-xs text-neutral-500">
            Disclaimer: Harga OTR, DP, cicilan, promo, warna, dan ketersediaan unit dapat berubah sewaktu-waktu sesuai program dan kebijakan yang berlaku. Informasi pada website merupakan simulasi dan perlu dikonfirmasi kembali kepada sales sebelum melakukan transaksi.
          </p>
          <p className="mt-3 text-xs text-neutral-500">
            &copy; {new Date().getFullYear()} {businessConfig.showroomName}. Semua hak dilindungi.
          </p>
        </div>
      </div>
    </footer>
  );
}
