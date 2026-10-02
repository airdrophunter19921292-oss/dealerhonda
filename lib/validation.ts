export function getSafeError(error: unknown): string {
  if (!error) return 'Terjadi kesalahan. Silakan coba lagi.';
  const msg = typeof error === 'string' ? error : (error as { message?: string }).message || '';
  if (!msg) return 'Terjadi kesalahan. Silakan coba lagi.';

  const lower = msg.toLowerCase();
  if (lower.includes('jwt') || lower.includes('token') || lower.includes('unauthorized')) {
    return 'Sesi berakhir. Silakan masuk kembali.';
  }
  if (lower.includes('row level security') || lower.includes('rls') || lower.includes('policy')) {
    return 'Anda tidak memiliki izin untuk melakukan aksi ini.';
  }
  if (lower.includes('network') || lower.includes('fetch') || lower.includes('connection')) {
    return 'Koneksi bermasalah. Periksa internet Anda.';
  }
  if (lower.includes('duplicate') || lower.includes('unique')) {
    return 'Data sudah ada. Gunakan data yang berbeda.';
  }
  if (lower.includes('foreign key') || lower.includes('violates')) {
    return 'Data terkait tidak ditemukan.';
  }
  return 'Terjadi kesalahan. Silakan coba lagi.';
}

export function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/[\s\-+]/g, '');
  if (cleaned.startsWith('62')) return cleaned;
  if (cleaned.startsWith('0')) return '62' + cleaned.slice(1);
  if (cleaned.startsWith('8')) return '62' + cleaned;
  return cleaned;
}

export function isValidPhone(phone: string): boolean {
  const normalized = normalizePhone(phone);
  return /^62\d{8,13}$/.test(normalized);
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
