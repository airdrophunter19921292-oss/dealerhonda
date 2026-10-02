'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { X, Home } from 'lucide-react';
import { useAuth } from '@/lib/auth-provider';
import { getVisibleGroups } from '@/lib/admin-nav';

export function AdminMobileNav({ onClose }: { onClose: () => void }) {
  const pathname = usePathname();
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const groups = getVisibleGroups(isAdmin);

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="absolute left-0 top-0 h-full w-72 overflow-y-auto bg-white shadow-xl">
        <div className="flex h-16 items-center justify-between border-b border-neutral-200 px-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-600 text-white font-bold text-sm">H</div>
            <span className="text-sm font-bold">Honda Dealer</span>
          </div>
          <button onClick={onClose} className="rounded-md p-2 text-neutral-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="px-3 pb-4">
          {groups.map((group) => (
            <div key={group.label}>
              <p className="admin-section-label">{group.label}</p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = pathname === item.href ||
                    (item.href !== '/admin' && pathname.startsWith(item.href));
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${
                        isActive
                          ? 'bg-red-50 text-red-700'
                          : 'text-neutral-600 hover:bg-neutral-100'
                      }`}
                    >
                      <item.icon className={`h-4 w-4 ${isActive ? 'text-red-600' : 'text-neutral-400'}`} />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
          <Link
            href="/"
            onClick={onClose}
            className="mt-2 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-neutral-600 hover:bg-neutral-100"
          >
            <Home className="h-4 w-4 text-neutral-400" />
            Lihat Website
          </Link>
        </nav>
      </div>
    </div>
  );
}
