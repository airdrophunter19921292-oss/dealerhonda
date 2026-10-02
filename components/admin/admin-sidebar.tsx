'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-provider';
import { getVisibleGroups } from '@/lib/admin-nav';
import { Home } from 'lucide-react';

export function AdminSidebar() {
  const pathname = usePathname();
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const groups = getVisibleGroups(isAdmin);

  return (
    <aside className="hidden w-60 flex-shrink-0 border-r border-neutral-200 bg-white md:flex md:flex-col">
      <div className="flex h-16 items-center gap-2.5 border-b border-neutral-200 px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-600 text-white font-bold text-sm">
          H
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-bold leading-tight text-neutral-900">Honda Dealer</span>
          <span className="text-xs leading-tight text-neutral-400">Admin Panel</span>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="admin-section-label">{group.label}</p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== '/admin' && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-red-50 text-red-700'
                        : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
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
      </nav>

      <div className="border-t border-neutral-200 p-3">
        <Link
          href="/"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
        >
          <Home className="h-4 w-4 text-neutral-400" />
          Lihat Website
        </Link>
      </div>
    </aside>
  );
}
