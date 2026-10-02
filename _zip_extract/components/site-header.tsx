'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Menu, X, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { businessConfig } from '@/lib/business-config';
import { buildWhatsAppLink, buildGenericWhatsAppMessage } from '@/lib/whatsapp';

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/#katalog', label: 'Motor' },
  { href: '/simulasi-kredit', label: 'Simulasi Kredit' },
  { href: '/#area', label: 'Area Layanan' },
  { href: '/#faq', label: 'FAQ' },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2" onClick={() => setOpen(false)}>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-600 text-white font-bold text-sm">
            H
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-bold text-neutral-900">Motor Honda</span>
            <span className="text-xs text-neutral-500">Pekalongan &middot; Pemalang &middot; Batang</span>
          </div>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <a
            href={buildWhatsAppLink(buildGenericWhatsAppMessage('ketersediaan unit dan promo motor Honda'))}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button className="bg-green-600 hover:bg-green-700 text-white">
              <Phone className="mr-2 h-4 w-4" />
              Chat Dony
            </Button>
          </a>
        </div>

        <button
          className="rounded-md p-2 text-neutral-700 md:hidden"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-border/60 bg-white md:hidden">
          <nav className="flex flex-col gap-1 px-4 py-3">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-md px-3 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100"
                onClick={() => setOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <a
              href={buildWhatsAppLink(buildGenericWhatsAppMessage('ketersediaan unit dan promo motor Honda'))}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
            >
              <Button className="mt-2 w-full bg-green-600 hover:bg-green-700 text-white">
                <Phone className="mr-2 h-4 w-4" />
                Chat Dony - {businessConfig.whatsappNumber}
              </Button>
            </a>
          </nav>
        </div>
      )}
    </header>
  );
}
