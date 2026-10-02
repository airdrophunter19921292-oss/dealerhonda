import { HeroSection } from '@/components/hero-section';
import { PopularMotors } from '@/components/popular-motors';
import { MotorCatalog } from '@/components/motor-catalog';
import { CreditSimulatorSection } from '@/components/credit-simulator-section';
import { TrustSection } from '@/components/trust-section';
import { ServiceArea } from '@/components/service-area';
import { FaqSection } from '@/components/faq-section';
import { ContactCta } from '@/components/contact-cta';
import { LeadForm } from '@/components/lead-form';

export default function Home() {
  return (
    <>
      <HeroSection />
      <PopularMotors />
      <MotorCatalog />
      <CreditSimulatorSection />
      <TrustSection />
      <ServiceArea />
      <FaqSection />
      <ContactCta />
      <LeadForm />
    </>
  );
}
