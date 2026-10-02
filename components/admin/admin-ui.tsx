'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function PageHeader({
  icon: Icon,
  title,
  description,
  actions,
}: {
  icon?: typeof import('lucide-react').LayoutDashboard;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 pb-6 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        {Icon && (
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600">
            <Icon className="h-5 w-5" />
          </div>
        )}
        <div>
          <h1 className="text-xl font-bold text-neutral-900 sm:text-2xl">{title}</h1>
          {description && <p className="mt-0.5 text-sm text-neutral-500">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export function MetricCard({
  label,
  value,
  icon: Icon,
  color = 'blue',
  sublabel,
}: {
  label: string;
  value: string | number;
  icon: typeof import('lucide-react').Users;
  color?: 'red' | 'blue' | 'green' | 'orange' | 'cyan' | 'amber' | 'neutral' | 'yellow';
  sublabel?: string;
}) {
  const colors: Record<string, string> = {
    red: 'bg-red-50 text-red-600',
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    orange: 'bg-orange-50 text-orange-600',
    cyan: 'bg-cyan-50 text-cyan-600',
    amber: 'bg-amber-50 text-amber-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    neutral: 'bg-neutral-100 text-neutral-600',
  };

  return (
    <div className="admin-card-hover p-4">
      <div className={cn('mb-3 flex h-10 w-10 items-center justify-center rounded-lg', colors[color])}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-2xl font-bold text-neutral-900">{value}</p>
      <p className="mt-0.5 text-xs font-medium text-neutral-500">{label}</p>
      {sublabel && <p className="mt-1 text-xs text-neutral-400">{sublabel}</p>}
    </div>
  );
}

export function SectionCard({
  title,
  action,
  children,
  className,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('admin-card p-5', className)}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between">
          {title && <h2 className="text-base font-bold text-neutral-900">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: typeof import('lucide-react').Users;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-neutral-300 py-16 text-center">
      <Icon className="mx-auto mb-3 h-10 w-10 text-neutral-300" />
      <p className="text-sm font-medium text-neutral-600">{title}</p>
      {description && <p className="mt-1 text-xs text-neutral-400">{description}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function ErrorState({
  message = 'Tidak dapat memuat data.',
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 py-12 text-center">
      <p className="text-sm font-medium text-red-700">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          Coba Lagi
        </button>
      )}
    </div>
  );
}

export function StatusBadge({ status, labels }: { status: string; labels: Record<string, { label: string; color: string }> }) {
  const config = labels[status] || { label: status, color: 'bg-neutral-100 text-neutral-700' };
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', config.color)}>
      {config.label}
    </span>
  );
}

export function LoadingState({ label = 'Memuat...' }: { label?: string }) {
  return (
    <div className="flex h-40 items-center justify-center text-neutral-400">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-300 border-t-red-600" />
      <span className="ml-2 text-sm">{label}</span>
    </div>
  );
}

export const leadStatusLabels: Record<string, { label: string; color: string }> = {
  new: { label: 'Baru', color: 'bg-blue-100 text-blue-700' },
  contacted: { label: 'Dihubungi', color: 'bg-cyan-100 text-cyan-700' },
  follow_up: { label: 'Follow Up', color: 'bg-yellow-100 text-yellow-700' },
  visit_scheduled: { label: 'Kunjungan', color: 'bg-orange-100 text-orange-700' },
  test_ride: { label: 'Test Ride', color: 'bg-purple-100 text-purple-700' },
  negotiation: { label: 'Negosiasi', color: 'bg-amber-100 text-amber-700' },
  converted: { label: 'Converted', color: 'bg-green-100 text-green-700' },
  deal: { label: 'Deal', color: 'bg-green-100 text-green-700' },
  lost: { label: 'Lost', color: 'bg-red-100 text-red-700' },
  cancelled: { label: 'Batal', color: 'bg-neutral-100 text-neutral-700' },
};

export const customerStatusLabels: Record<string, { label: string; color: string }> = {
  active: { label: 'Aktif', color: 'bg-green-100 text-green-700' },
  inactive: { label: 'Nonaktif', color: 'bg-neutral-100 text-neutral-700' },
  archived: { label: 'Diarsipkan', color: 'bg-red-100 text-red-700' },
};

export const priorityLabels: Record<string, { label: string; color: string }> = {
  low: { label: 'Rendah', color: 'bg-neutral-100 text-neutral-700' },
  medium: { label: 'Sedang', color: 'bg-yellow-100 text-yellow-700' },
  high: { label: 'Tinggi', color: 'bg-red-100 text-red-700' },
};

export const visitStatusLabels: Record<string, { label: string; color: string }> = {
  scheduled: { label: 'Dijadwalkan', color: 'bg-blue-100 text-blue-700' },
  confirmed: { label: 'Dikonfirmasi', color: 'bg-cyan-100 text-cyan-700' },
  completed: { label: 'Selesai', color: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Dibatalkan', color: 'bg-red-100 text-red-700' },
  no_show: { label: 'Tidak Hadir', color: 'bg-neutral-100 text-neutral-700' },
};

export function formatDate(date: string | null, opts?: { withTime?: boolean }) {
  if (!date) return '-';
  const d = new Date(date);
  if (opts?.withTime) {
    return d.toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function timeAgo(date: string): string {
  const now = new Date();
  const past = new Date(date);
  const diffMs = now.getTime() - past.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return 'Baru saja';
  if (diffMin < 60) return `${diffMin} menit lalu`;
  if (diffHr < 24) return `${diffHr} jam lalu`;
  if (diffDay < 7) return `${diffDay} hari lalu`;
  return formatDate(date);
}

export const creditStatusLabels: Record<string, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'bg-neutral-100 text-neutral-700' },
  submitted: { label: 'Diajukan', color: 'bg-blue-100 text-blue-700' },
  in_review: { label: 'Diproses', color: 'bg-cyan-100 text-cyan-700' },
  survey: { label: 'Survey', color: 'bg-yellow-100 text-yellow-700' },
  revision: { label: 'Revisi', color: 'bg-orange-100 text-orange-700' },
  approved: { label: 'Disetujui', color: 'bg-green-100 text-green-700' },
  rejected: { label: 'Ditolak', color: 'bg-red-100 text-red-700' },
  cancelled: { label: 'Dibatalkan', color: 'bg-neutral-100 text-neutral-700' },
  disbursed: { label: 'Cair', color: 'bg-green-100 text-green-700' },
};

export const spkStatusLabels: Record<string, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'bg-neutral-100 text-neutral-700' },
  waiting_payment: { label: 'Menunggu Bayar', color: 'bg-yellow-100 text-yellow-700' },
  waiting_credit: { label: 'Menunggu Kredit', color: 'bg-cyan-100 text-cyan-700' },
  approved: { label: 'Disetujui', color: 'bg-blue-100 text-blue-700' },
  unit_reserved: { label: 'Unit Dipesan', color: 'bg-orange-100 text-orange-700' },
  ready_delivery: { label: 'Siap Kirim', color: 'bg-amber-100 text-amber-700' },
  delivered: { label: 'Dikirim', color: 'bg-green-100 text-green-700' },
  completed: { label: 'Selesai', color: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Dibatalkan', color: 'bg-red-100 text-red-700' },
};

export const deliveryStatusLabels: Record<string, { label: string; color: string }> = {
  waiting: { label: 'Menunggu', color: 'bg-neutral-100 text-neutral-700' },
  preparing: { label: 'Disiapkan', color: 'bg-yellow-100 text-yellow-700' },
  ready: { label: 'Siap', color: 'bg-blue-100 text-blue-700' },
  in_delivery: { label: 'Dalam Pengiriman', color: 'bg-orange-100 text-orange-700' },
  delivered: { label: 'Terkirim', color: 'bg-green-100 text-green-700' },
  failed: { label: 'Gagal', color: 'bg-red-100 text-red-700' },
  cancelled: { label: 'Dibatalkan', color: 'bg-neutral-100 text-neutral-700' },
};

export const documentStatusLabels: Record<string, { label: string; color: string }> = {
  required: { label: 'Wajib', color: 'bg-yellow-100 text-yellow-700' },
  uploaded: { label: 'Diunggah', color: 'bg-blue-100 text-blue-700' },
  verified: { label: 'Terverifikasi', color: 'bg-green-100 text-green-700' },
  rejected: { label: 'Ditolak', color: 'bg-red-100 text-red-700' },
};

export const reservationStatusLabels: Record<string, { label: string; color: string }> = {
  available: { label: 'Tersedia', color: 'bg-green-100 text-green-700' },
  reserved: { label: 'Dipesan', color: 'bg-orange-100 text-orange-700' },
  sold: { label: 'Terjual', color: 'bg-blue-100 text-blue-700' },
  delivered: { label: 'Dikirim', color: 'bg-neutral-100 text-neutral-700' },
};

export function formatCurrency(value: number): string {
  return 'Rp' + (value || 0).toLocaleString('id-ID');
}
