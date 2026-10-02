import { MessageCircle, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { businessConfig } from '@/lib/business-config';
import { buildWhatsAppLink, buildGenericWhatsAppMessage } from '@/lib/whatsapp';

export function ContactCta() {
  const waLink = buildWhatsAppLink(buildGenericWhatsAppMessage('konsultasi motor Honda'));

  return (
    <section className="bg-red-600 py-12">
      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
        <h2 className="text-2xl font-bold text-white sm:text-3xl">
          Butuh Bantuan Memilih Motor?
        </h2>
        <p className="mt-3 text-sm text-red-100">
          Masih bingung memilih motor, DP atau cicilan yang sesuai budget? Konsultasikan langsung dengan Dony Kurniawan melalui WhatsApp.
        </p>

        <div className="mt-6 inline-flex flex-col items-center rounded-xl bg-white/10 px-6 py-4 backdrop-blur">
          <p className="text-sm font-semibold text-white">{businessConfig.salesName}</p>
          <p className="text-xs text-red-100">{businessConfig.salesRole}</p>
          <a
            href={`tel:${businessConfig.whatsappNumber}`}
            className="mt-2 flex items-center gap-1 text-sm font-medium text-white"
          >
            <Phone className="h-4 w-4" />
            {businessConfig.whatsappNumber}
          </a>
        </div>

        <div className="mt-6">
          <a href={waLink} target="_blank" rel="noopener noreferrer">
            <Button size="lg" className="bg-green-600 hover:bg-green-700 text-white">
              <MessageCircle className="mr-2 h-5 w-5" />
              Chat WhatsApp Dony
            </Button>
          </a>
        </div>
      </div>
    </section>
  );
}
