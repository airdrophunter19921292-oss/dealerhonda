import { CheckCircle2, Headphones, Wallet, Calculator, MessageCircle, MapPin } from 'lucide-react';

const features = [
  {
    icon: Headphones,
    title: 'Konsultasi Motor',
    desc: 'Konsultasi motor sesuai kebutuhan dan budget Anda.',
  },
  {
    icon: Wallet,
    title: 'Pilihan DP & Tenor',
    desc: 'Berbagai pilihan DP dan tenor 35x / 47x.',
  },
  {
    icon: Calculator,
    title: 'Simulasi Transparan',
    desc: 'Simulasi cicilan transparan, tidak ada biaya tersembunyi.',
  },
  {
    icon: MessageCircle,
    title: 'Respon Sales Cepat',
    desc: 'Respon sales melalui WhatsApp, langsung dari Dony Kurniawan.',
  },
  {
    icon: MapPin,
    title: 'Melayani Pantura',
    desc: 'Melayani area Pekalongan, Pemalang, Batang dan sekitarnya.',
  },
  {
    icon: CheckCircle2,
    title: 'Proses Mudah',
    desc: 'Proses kredit mudah, konsultasi gratis tanpa biaya.',
  },
];

export function TrustSection() {
  return (
    <section id="tentang" className="bg-white py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-neutral-900 sm:text-3xl">
            Kenapa Beli Motor Melalui Kami?
          </h2>
          <p className="mt-2 text-sm text-neutral-500">
            Kami bantu Anda mendapatkan motor Honda impian dengan cicilan yang sesuai.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-border/60 bg-neutral-50 p-6 transition-colors hover:bg-neutral-100"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-red-600/10 text-red-600">
                <f.icon className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-base font-bold text-neutral-900">{f.title}</h3>
              <p className="mt-1 text-sm text-neutral-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
