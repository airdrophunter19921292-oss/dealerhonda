import { businessConfig } from './business-config';
import { Motor } from './motor-data';

export function formatRupiah(amount: number): string {
  return 'Rp' + amount.toLocaleString('id-ID');
}

export function formatRupiahShort(amount: number): string {
  return 'Rp' + amount.toLocaleString('id-ID');
}

export function buildWhatsAppLink(message: string): string {
  const encoded = encodeURIComponent(message);
  return `https://wa.me/${businessConfig.whatsappInternational}?text=${encoded}`;
}

export function buildCardWhatsAppMessage(motorName: string): string {
  return `Halo Mas Dony Kurniawan, saya tertarik dengan Honda ${motorName}.

Saya ingin mendapatkan informasi harga, DP, cicilan dan ketersediaan unit.

Terima kasih.`;
}

export function buildDetailWhatsAppMessage(
  motorName: string,
  otr: number,
  dp: number,
  tenor: number,
  cicilan: number
): string {
  return `Halo Mas Dony Kurniawan, saya tertarik dengan Honda ${motorName}.

OTR: ${formatRupiah(otr)}
DP: ${formatRupiah(dp)}
Tenor: ${tenor}x
Cicilan: ${formatRupiah(cicilan)}/bulan

Mohon informasi mengenai ketersediaan unit dan proses kredit.

Terima kasih.`;
}

export function buildLeadFormWhatsAppMessage(data: {
  name: string;
  phone: string;
  city: string;
  motorName: string;
  otr: number;
  dp: number;
  tenor: number;
  cicilan: number;
  message: string;
}): string {
  return `Halo Mas Dony Kurniawan, saya ingin konsultasi motor Honda.

Nama: ${data.name}
No. WhatsApp: ${data.phone}
Kota/Kecamatan: ${data.city}

Motor yang diminati: ${data.motorName}
OTR: ${formatRupiah(data.otr)}

DP: ${formatRupiah(data.dp)}
Tenor: ${data.tenor}x
Cicilan: ${formatRupiah(data.cicilan)}/bulan

Pertanyaan:
${data.message}

Mohon informasi selanjutnya. Terima kasih.`;
}

export function buildGenericWhatsAppMessage(context: string): string {
  return `Halo Mas Dony Kurniawan, saya ingin konsultasi mengenai ${context}.

Mohon informasi selengkapnya. Terima kasih.`;
}

export function getCicilan(
  motor: Motor,
  dp: number,
  tenor: number
): number | null {
  const option = motor.financing.find((f) => f.dp === dp);
  if (!option) return null;
  return tenor === 35 ? option.tenor35 : option.tenor47;
}

export function getMotorById(id: string): Motor | undefined {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { motorData } = require('./motor-data') as typeof import('./motor-data');
  return motorData.find((m: Motor) => m.id === id);
}
