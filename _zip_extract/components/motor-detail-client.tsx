'use client';

import { useState } from 'react';
import { MessageCircle, Calculator } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Motor } from '@/lib/motor-data';
import {
  formatRupiah,
  buildWhatsAppLink,
  buildDetailWhatsAppMessage,
} from '@/lib/whatsapp';

export function MotorDetailClient({ motor }: { motor: Motor }) {
  const [dpIndex, setDpIndex] = useState(0);
  const [tenor, setTenor] = useState<35 | 47>(35);

  const financing = motor.financing[dpIndex];
  const cicilan = tenor === 35 ? financing.tenor35 : financing.tenor47;

  const waLink = buildWhatsAppLink(
    buildDetailWhatsAppMessage(motor.name, motor.otr, financing.dp, tenor, cicilan)
  );

  const simpleWaLink = buildWhatsAppLink(
    `Halo Mas Dony Kurniawan, saya tertarik dengan Honda ${motor.name}. Saya ingin mendapatkan informasi harga, DP, cicilan dan ketersediaan unit. Terima kasih.`
  );

  return (
    <div className="mt-6">
      <div className="rounded-lg border border-border/60 bg-neutral-50 p-4">
        <h3 className="text-sm font-bold text-neutral-900">Pilih DP & Tenor</h3>

        <div className="mt-3">
          <label className="text-xs font-semibold text-neutral-600">DP</label>
          <div className="mt-1.5 grid grid-cols-3 gap-2">
            {motor.financing.map((f, i) => (
              <button
                key={i}
                onClick={() => setDpIndex(i)}
                className={`rounded-md px-2 py-2 text-xs font-medium transition-colors ${
                  dpIndex === i
                    ? 'bg-red-600 text-white'
                    : 'bg-white border border-border text-neutral-700 hover:bg-neutral-100'
                }`}
              >
                {formatRupiah(f.dp)}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3">
          <label className="text-xs font-semibold text-neutral-600">Tenor</label>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            <button
              onClick={() => setTenor(35)}
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                tenor === 35
                  ? 'bg-red-600 text-white'
                  : 'bg-white border border-border text-neutral-700 hover:bg-neutral-100'
              }`}
            >
              35x
            </button>
            <button
              onClick={() => setTenor(47)}
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                tenor === 47
                  ? 'bg-red-600 text-white'
                  : 'bg-white border border-border text-neutral-700 hover:bg-neutral-100'
              }`}
            >
              47x
            </button>
          </div>
        </div>

        <div className="mt-4 rounded-md border border-border/60 bg-white p-3">
          <p className="text-xs text-neutral-500">Estimasi Cicilan / Bulan</p>
          <p className="text-xl font-bold text-red-600">{formatRupiah(cicilan)}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <a href={waLink} target="_blank" rel="noopener noreferrer" className="flex-1">
          <Button className="w-full bg-green-600 hover:bg-green-700 text-white">
            <MessageCircle className="mr-2 h-4 w-4" />
            Chat Dony
          </Button>
        </a>
        <a href={simpleWaLink} target="_blank" rel="noopener noreferrer" className="flex-1">
          <Button variant="outline" className="w-full border-red-600 text-red-600 hover:bg-red-50">
            <Calculator className="mr-2 h-4 w-4" />
            Ajukan Kredit
          </Button>
        </a>
      </div>
    </div>
  );
}
