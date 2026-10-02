'use client';

import { useEffect, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { businessConfig } from '@/lib/business-config';
import { buildWhatsAppLink, buildGenericWhatsAppMessage } from '@/lib/whatsapp';

export function FloatingWhatsApp() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handler = () => {
      setVisible(window.scrollY > 300);
    };
    window.addEventListener('scroll', handler);
    handler();
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const link = buildWhatsAppLink(buildGenericWhatsAppMessage('konsultasi motor Honda'));

  return (
    <>
      {/* Desktop floating button */}
      <a
        href={link}
        target="_blank"
        rel="noopener noreferrer"
        className={`fixed bottom-6 right-6 z-50 hidden items-center gap-2 rounded-full bg-green-600 px-5 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:bg-green-700 md:flex ${
          visible ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0'
        }`}
      >
        <MessageCircle className="h-5 w-5" />
        Chat Dony
      </a>

      {/* Mobile sticky bottom bar */}
      <div className="fixed inset-x-0 bottom-0 z-50 md:hidden">
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 bg-green-600 px-4 py-3 text-sm font-semibold text-white shadow-lg active:bg-green-700"
        >
          <MessageCircle className="h-5 w-5" />
          Chat Dony - {businessConfig.whatsappNumber}
        </a>
      </div>
    </>
  );
}
