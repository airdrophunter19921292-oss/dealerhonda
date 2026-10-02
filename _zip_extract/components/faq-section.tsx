'use client';

import { useEffect, useState } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { supabase } from '@/lib/supabase-client';
import { Loader2 } from 'lucide-react';

type FaqItem = { id: string; question: string; answer: string };

export function FaqSection() {
  const [faqs, setFaqs] = useState<FaqItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchFaqs() {
      const { data, error } = await supabase
        .from('faqs')
        .select('id, question, answer')
        .eq('status', 'active')
        .order('sort_order', { ascending: true });

      if (!error && data && data.length > 0) {
        setFaqs(data as FaqItem[]);
      }
      setLoading(false);
    }
    fetchFaqs();
  }, []);

  if (loading) {
    return (
      <section id="faq" className="bg-white py-12">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center py-8 text-neutral-400">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Memuat FAQ...
          </div>
        </div>
      </section>
    );
  }

  if (faqs.length === 0) return null;

  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };

  return (
    <section id="faq" className="bg-white py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
      />
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-neutral-900 sm:text-3xl">FAQ</h2>
          <p className="mt-2 text-sm text-neutral-500">
            Pertanyaan yang sering ditanyakan tentang kredit motor Honda.
          </p>
        </div>

        <Accordion type="single" collapsible className="mt-8">
          {faqs.map((faq, i) => (
            <AccordionItem key={faq.id || i} value={`item-${i}`}>
              <AccordionTrigger className="text-left text-sm font-semibold text-neutral-900">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="text-sm text-neutral-600">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
