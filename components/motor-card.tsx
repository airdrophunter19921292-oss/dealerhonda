'use client';

import Link from 'next/link';
import { MessageCircle, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Motor } from '@/lib/motor-data';
import { formatRupiah, buildWhatsAppLink, buildCardWhatsAppMessage } from '@/lib/whatsapp';

export function MotorCard({ motor }: { motor: Motor }) {
  const lowestDp = motor.financing.reduce((min, f) => Math.min(min, f.dp), Infinity);
  const lowestCicilan = motor.financing.reduce((min, f) => Math.min(min, f.tenor35, f.tenor47), Infinity);

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-xl border border-border/60 bg-white shadow-sm transition-all hover:shadow-md">
      <div className="relative aspect-[4/3] overflow-hidden bg-neutral-100">
        <img
          src={motor.image}
          alt={`Honda ${motor.name}`}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        {motor.popular && (
          <Badge className="absolute left-3 top-3 bg-red-600 text-white hover:bg-red-600">
            Populer
          </Badge>
        )}
        <span className="absolute right-3 top-3 rounded-md bg-black/70 px-2 py-1 text-xs font-medium text-white">
          {motor.category}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="text-base font-bold text-neutral-900">{motor.name}</h3>

        <div className="mt-3 space-y-1.5">
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-neutral-500">OTR</span>
            <span className="text-sm font-bold text-neutral-900">{formatRupiah(motor.otr)}</span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-neutral-500">Mulai DP</span>
            <span className="text-sm font-semibold text-red-600">{formatRupiah(lowestDp)}</span>
          </div>
          <div className="flex items-baseline justify-between border-t border-border/40 pt-1.5">
            <span className="text-xs text-neutral-500">Cicilan mulai</span>
            <span className="text-sm font-medium text-neutral-800">{formatRupiah(lowestCicilan)}/bln</span>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <Link href={`/motor/${motor.id}`} className="flex-1">
            <Button variant="outline" size="sm" className="w-full">
              Cek Detail
              <ChevronRight className="ml-1 h-3 w-3" />
            </Button>
          </Link>
          <a
            href={buildWhatsAppLink(buildCardWhatsAppMessage(motor.name))}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1"
          >
            <Button size="sm" className="w-full bg-green-600 hover:bg-green-700 text-white">
              <MessageCircle className="mr-1 h-3 w-3" />
              Chat Dony
            </Button>
          </a>
        </div>
      </div>
    </div>
  );
}
