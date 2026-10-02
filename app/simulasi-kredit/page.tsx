import { CreditSimulatorSection } from '@/components/credit-simulator-section';
import { ContactCta } from '@/components/contact-cta';
import { LeadForm } from '@/components/lead-form';

export const metadata = {
  title: 'Simulasi Kredit Motor Honda | Kalkulator Cicilan',
  description:
    'Simulasi kredit motor Honda dengan pilihan DP dan tenor 35x atau 47x. Pilih motor, pilih DP, lihat estimasi cicilan per bulan.',
  alternates: { canonical: '/simulasi-kredit' },
};

export default function SimulasiKreditPage() {
  return (
    <>
      <div className="bg-gradient-to-br from-neutral-900 to-red-950 py-12">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-white sm:text-4xl">Simulasi Kredit</h1>
          <p className="mt-3 text-base text-neutral-300">
            Pilih motor, DP, dan tenor untuk melihat estimasi cicilan. Lalu chat Dony untuk proses selanjutnya.
          </p>
        </div>
      </div>
      <CreditSimulatorSection />
      <section className="bg-neutral-50 py-12">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-neutral-900 text-center">Mau Lanjut Proses Kredit?</h2>
          <p className="mt-2 text-center text-sm text-neutral-500">Isi form di bawah, sales kami akan bantu proses kredit Anda.</p>
          <div className="mt-8">
            <LeadForm attributionContext={{ pageContext: 'credit_simulator' }} />
          </div>
        </div>
      </section>
      <ContactCta />
    </>
  );
}
