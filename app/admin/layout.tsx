'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-provider';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { AdminTopbar } from '@/components/admin/admin-topbar';
import { Loader2 } from 'lucide-react';

const adminOnlyRoutes = [
  '/admin/products',
  '/admin/promos',
  '/admin/faqs',
  '/admin/seo',
  '/admin/settings',
  '/admin/users',
  '/admin/audit-log',
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === '/admin/login';

  useEffect(() => {
    if (!isLoginPage && !loading && !user) {
      router.replace('/admin/login');
    }
  }, [isLoginPage, user, loading, router]);

  useEffect(() => {
    if (!isLoginPage && !loading && user && profile?.status === 'active') {
      const isAdmin = profile.role === 'admin';
      const needsAdmin = adminOnlyRoutes.some(
        (route) => pathname === route || pathname.startsWith(route + '/')
      );
      if (needsAdmin && !isAdmin) {
        router.replace('/admin');
      }
    }
  }, [isLoginPage, user, profile, loading, pathname, router]);

  if (isLoginPage) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-neutral-50">
        <Loader2 className="h-8 w-8 animate-spin text-neutral-400" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (profile && profile.status !== 'active') {
    return (
      <div className="flex h-screen items-center justify-center bg-neutral-50">
        <div className="max-w-md rounded-xl border border-neutral-200 bg-white p-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50">
            <Loader2 className="h-6 w-6 text-amber-500" />
          </div>
          <h2 className="text-lg font-bold text-neutral-900">Akun Tidak Aktif</h2>
          <p className="mt-2 text-sm text-neutral-500">
            Akun Anda saat ini tidak aktif. Hubungi administrator untuk mengaktifkan kembali.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-neutral-50">
      <AdminSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <AdminTopbar />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
