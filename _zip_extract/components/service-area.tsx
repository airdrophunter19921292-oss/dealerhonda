import Link from 'next/link';
import { MapPin, ChevronRight } from 'lucide-react';

const areas = [
  {
    name: 'Pekalongan',
    href: '/honda-pekalongan',
    desc: 'Motor Honda Pekalongan - Kredit motor Honda untuk wilayah Pekalongan dan sekitarnya.',
  },
  {
    name: 'Pemalang',
    href: '/honda-pemalang',
    desc: 'Motor Honda Pemalang - Kredit motor Honda untuk wilayah Pemalang dan sekitarnya.',
  },
  {
    name: 'Batang',
    href: '/honda-batang',
    desc: 'Motor Honda Batang - Kredit motor Honda untuk wilayah Batang dan sekitarnya.',
  },
];

export function ServiceArea() {
  return (
    <section id="area" className="bg-neutral-50 py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-neutral-900 sm:text-3xl">
            Melayani Area Pantura Jawa Tengah
          </h2>
          <p className="mt-2 text-sm text-neutral-500">
            Kami melayani penjualan dan kredit motor Honda untuk wilayah berikut:
          </p>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-3">
          {areas.map((area) => (
            <Link
              key={area.name}
              href={area.href}
              className="group rounded-xl border border-border/60 bg-white p-6 shadow-sm transition-all hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-600/10 text-red-600">
                  <MapPin className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-bold text-neutral-900">{area.name}</h3>
              </div>
              <p className="mt-3 text-sm text-neutral-500">{area.desc}</p>
              <span className="mt-4 inline-flex items-center text-sm font-medium text-red-600 group-hover:text-red-700">
                Lihat detail
                <ChevronRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
